from __future__ import annotations
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectWithKey
from app.db import d1


class ProjectService:

    async def list(self, account_id: str | None = None) -> List[ProjectWithKey]:
        rows = await d1.security_query("SELECT * FROM projects WHERE id IN (SELECT project_id FROM project_owner WHERE account_id = ?) ORDER BY created_at DESC", [account_id]) if account_id else await d1.query("SELECT * FROM projects ORDER BY created_at DESC")
        return [ProjectWithKey(**row) for row in rows]

    async def get(self, project_id: str) -> Optional[ProjectWithKey]:
        rows = await d1.query("SELECT * FROM projects WHERE id = ?", [project_id])
        if not rows:
            return None
        return ProjectWithKey(**rows[0])

    async def get_by_api_key(self, api_key: str) -> Optional[Project]:
        if api_key.startswith("sk_live_"):
            return None
        rows = await d1.security_query("SELECT * FROM projects WHERE api_key = ?", [api_key])
        if not rows:
            return None
        return Project(**rows[0])

    async def get_by_server_key(self, token: str) -> Optional[Project]:
        # No legacy public-key fallback, including missing/revoked rows or DB errors.
        if not token.startswith("sk_live_"):
            return None
        try:
            rows = await d1.security_query(
                "SELECT p.* FROM projects p JOIN project_server_credential k "
                "ON k.project_id = p.id WHERE k.token_hash = ? AND k.revoked_at IS NULL",
                [hashlib.sha256(token.encode()).hexdigest()],
            )
        except Exception:
            return None
        return Project(**rows[0]) if rows else None

    async def rotate_public_key(self, project_id: str, expected_key: str) -> str:
        """Operator-only CAS; callers must never log the expected or returned key."""
        new_key = f"pk_sdk_{secrets.token_urlsafe(32)}"
        rows = await d1.security_query(
            "UPDATE projects SET api_key = ? WHERE id = ? AND api_key = ? RETURNING id",
            [new_key, project_id, expected_key],
        )
        if rows != [{"id": project_id}]:
            raise HTTPException(status_code=409, detail="Project credential changed concurrently")
        return new_key

    async def _active_server_hashes(self, project_id: str) -> list[str]:
        if not await d1.security_query("SELECT id FROM projects WHERE id = ?", [project_id]):
            raise HTTPException(404, "Project not found")
        rows = await d1.security_query(
            "SELECT token_hash FROM project_server_credential WHERE project_id = ? AND revoked_at IS NULL ORDER BY token_hash",
            [project_id],
        )
        return [row["token_hash"] for row in rows]

    async def rotate_server_key(self, project_id: str) -> str:
        active = await self._active_server_hashes(project_id)
        # No automatic retry: a racing change requires a fresh deliberate request.
        token = "sk_live_" + secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode()).hexdigest()
        rows = await d1.security_query(
            "INSERT INTO project_server_credential (token_hash, project_id) SELECT ?, ? "
            "WHERE EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='rotate_project_server_credential') AND COALESCE((SELECT group_concat(token_hash, ',') FROM "
            "(SELECT token_hash FROM project_server_credential WHERE project_id=? AND revoked_at IS NULL ORDER BY token_hash)), '') = ? "
            "RETURNING token_hash, project_id",
            [digest, project_id, project_id, ",".join(active)],
        )
        if rows != [{"token_hash": digest, "project_id": project_id}]:
            raise HTTPException(409, "Server credential changed concurrently")
        return token

    async def revoke_server_key(self, project_id: str) -> None:
        active = await self._active_server_hashes(project_id)
        rows = await d1.security_query(
            "UPDATE project_server_credential SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') "
            "WHERE project_id=? AND revoked_at IS NULL AND "
            "COALESCE((SELECT group_concat(token_hash, ',') FROM "
            "(SELECT token_hash FROM project_server_credential WHERE project_id=? AND revoked_at IS NULL ORDER BY token_hash)), '') = ? "
            "RETURNING token_hash",
            [project_id, project_id, ",".join(active)],
        )
        if sorted(row.get("token_hash", "") for row in rows) != active:
            raise HTTPException(409, "Server credential changed concurrently")

    async def sdk_status(self, project_id: str) -> dict:
        existing = await d1.query("SELECT 1 FROM projects WHERE id = ?", [project_id])
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        events = await d1.query(
            "SELECT 1 FROM event_log WHERE project_id = ? AND created_at >= ? LIMIT 1",
            [project_id, cutoff],
        )
        exposures = await d1.query(
            "SELECT 1 FROM feature_flag_exposure WHERE project_id = ? AND evaluated_at >= ? LIMIT 1",
            [project_id, cutoff],
        )
        connected = bool(events or exposures)
        return {"project_id": project_id, "status": "connected" if connected else "not_connected"}

    async def delete(self, project_id: str) -> None:
        existing = await d1.security_query("SELECT 1 FROM projects WHERE id = ?", [project_id])
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

        exp_refs = await d1.security_query(
            "SELECT 1 FROM experiments WHERE project_id = ? LIMIT 1", [project_id]
        )
        if exp_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete project '{project_id}': referenced by one or more experiments",
            )

        flag_refs = await d1.security_query(
            "SELECT 1 FROM feature_flag WHERE project_id = ? LIMIT 1", [project_id]
        )
        if flag_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete project '{project_id}': referenced by one or more feature flags",
            )

        # Retain the migration 036 FK policy, including revoked credential history.
        credential_refs = await d1.security_query(
            "SELECT 1 FROM project_server_credential WHERE project_id = ? LIMIT 1",
            [project_id],
        )
        if credential_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete project '{project_id}': referenced by server credentials",
            )

        # A failed write (including a racing FK insert) must never become HTTP 204.
        deleted = await d1.security_query(
            "DELETE FROM projects WHERE id = ? RETURNING id", [project_id]
        )
        if deleted != [{"id": project_id}]:
            raise HTTPException(status_code=409, detail="Project changed concurrently")

    async def create(self, data: ProjectCreate, account_id: str | None = None) -> ProjectWithKey:
        existing = await d1.security_query("SELECT 1 FROM projects WHERE id = ?", [data.id])
        if existing:
            raise HTTPException(status_code=409, detail=f"Project '{data.id}' already exists")

        api_key = f"pk_sdk_{secrets.token_urlsafe(32)}"
        if account_id:
            # The view's INSTEAD OF trigger inserts project + owner in one statement.
            # Any trigger/FK failure rolls back both; lost responses leave an owned project.
            await d1.security_query(
                "INSERT INTO owned_project_creation (id, name, api_key, base_url, project_type, account_id) VALUES (?, ?, ?, ?, ?, ?)",
                [data.id, data.name, api_key, data.base_url, data.project_type, account_id],
            )
            rows = await d1.security_query(
                "SELECT p.* FROM projects p JOIN project_owner o ON o.project_id=p.id WHERE p.id=? AND o.account_id=? AND p.api_key=?",
                [data.id, account_id, api_key],
            )
        else:
            rows = await d1.security_query(
                "INSERT INTO projects (id, name, api_key, base_url, project_type) VALUES (?, ?, ?, ?, ?) RETURNING *",
                [data.id, data.name, api_key, data.base_url, data.project_type],
            )
        if len(rows) != 1 or rows[0].get("id") != data.id:
            raise HTTPException(503, "Project creation could not be confirmed")
        result = ProjectWithKey(**rows[0])
        return result

    async def update(self, project_id: str, data: ProjectUpdate) -> ProjectWithKey:
        existing = await self.get(project_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
        await d1.execute(
            "UPDATE projects SET base_url = ? WHERE id = ?",
            [data.base_url, project_id],
        )
        result = await self.get(project_id)
        if not result:
            raise HTTPException(status_code=500, detail="Update failed")
        return result


project_service = ProjectService()
