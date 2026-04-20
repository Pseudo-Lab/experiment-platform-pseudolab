import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BASE = "/api/v1/bug-reports"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def created_report():
    """버그리포트 하나 생성 후 반환, 테스트 종료 후 삭제."""
    payload = {
        "title": "테스트 버그",
        "category": "functional",
        "severity": "major",
        "description": "재현 절차: 1. 로그인 2. 버튼 클릭",
        "attachment_keys": [],
    }
    resp = client.post(BASE + "/", json=payload)
    assert resp.status_code == 201
    report = resp.json()
    yield report
    client.delete(f"{BASE}/{report['id']}")


@pytest.fixture
def created_report_minor():
    payload = {
        "title": "Minor 버그",
        "category": "ui",
        "severity": "minor",
        "attachment_keys": [],
    }
    resp = client.post(BASE + "/", json=payload)
    assert resp.status_code == 201
    report = resp.json()
    yield report
    client.delete(f"{BASE}/{report['id']}")


# ---------------------------------------------------------------------------
# 생성
# ---------------------------------------------------------------------------

class TestCreateBugReport:
    def test_success(self):
        payload = {
            "title": "생성 테스트",
            "category": "ui",
            "severity": "minor",
            "attachment_keys": [],
        }
        resp = client.post(BASE + "/", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == "생성 테스트"
        assert body["category"] == "ui"
        assert body["severity"] == "minor"
        client.delete(f"{BASE}/{body['id']}")

    def test_default_status_is_reported(self, created_report):
        assert created_report["status"] == "reported"

    def test_severity_stored(self, created_report):
        assert created_report["severity"] == "major"

    def test_description_stored(self, created_report):
        assert "재현 절차" in created_report["description"]

    def test_attachments_empty_by_default(self, created_report):
        assert created_report["attachments"] == []

    def test_comments_empty_by_default(self, created_report):
        assert created_report["comments"] == []

    def test_missing_title_returns_422(self):
        resp = client.post(BASE + "/", json={"category": "ui", "attachment_keys": []})
        assert resp.status_code == 422

    def test_invalid_category_returns_422(self):
        resp = client.post(BASE + "/", json={"title": "x", "category": "invalid", "attachment_keys": []})
        assert resp.status_code == 422

    def test_invalid_severity_returns_422(self):
        resp = client.post(BASE + "/", json={"title": "x", "category": "ui", "severity": "extreme", "attachment_keys": []})
        assert resp.status_code == 422

    def test_all_categories_accepted(self):
        for cat in ["ui", "functional", "performance", "feature_request", "other"]:
            resp = client.post(BASE + "/", json={"title": f"{cat} 버그", "category": cat, "attachment_keys": []})
            assert resp.status_code == 201, f"category={cat} failed"
            client.delete(f"{BASE}/{resp.json()['id']}")

    def test_all_severities_accepted(self):
        for sev in ["minor", "major", "critical"]:
            resp = client.post(BASE + "/", json={"title": f"{sev} 버그", "category": "other", "severity": sev, "attachment_keys": []})
            assert resp.status_code == 201, f"severity={sev} failed"
            client.delete(f"{BASE}/{resp.json()['id']}")


# ---------------------------------------------------------------------------
# 목록 조회
# ---------------------------------------------------------------------------

class TestListBugReports:
    def test_list_returns_200(self):
        resp = client.get(BASE + "/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_created_appears_in_list(self, created_report):
        resp = client.get(BASE + "/")
        ids = [r["id"] for r in resp.json()]
        assert created_report["id"] in ids

    def test_filter_by_status_reported(self, created_report):
        resp = client.get(BASE + "/", params={"status": "reported"})
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.json()]
        assert created_report["id"] in ids

    def test_filter_excludes_other_status(self, created_report):
        resp = client.get(BASE + "/", params={"status": "resolved"})
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.json()]
        assert created_report["id"] not in ids

    def test_invalid_status_returns_422(self):
        resp = client.get(BASE + "/", params={"status": "unknown"})
        assert resp.status_code == 422

    def test_list_items_have_no_comments(self, created_report):
        """목록 응답은 댓글을 로드하지 않는다."""
        resp = client.get(BASE + "/")
        report = next(r for r in resp.json() if r["id"] == created_report["id"])
        assert report["comments"] == []


# ---------------------------------------------------------------------------
# 단건 조회
# ---------------------------------------------------------------------------

class TestGetBugReport:
    def test_get_existing(self, created_report):
        resp = client.get(f"{BASE}/{created_report['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created_report["id"]

    def test_get_nonexistent(self):
        resp = client.get(f"{BASE}/nonexistent-id-00000")
        assert resp.status_code == 404

    def test_get_includes_all_fields(self, created_report):
        resp = client.get(f"{BASE}/{created_report['id']}")
        body = resp.json()
        for field in ["id", "title", "category", "severity", "status", "attachments", "comments", "created_at", "updated_at"]:
            assert field in body, f"field '{field}' missing"


# ---------------------------------------------------------------------------
# 수정
# ---------------------------------------------------------------------------

class TestUpdateBugReport:
    def test_update_status_to_in_progress(self, created_report):
        resp = client.patch(f"{BASE}/{created_report['id']}", json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_update_status_to_resolved(self, created_report):
        resp = client.patch(f"{BASE}/{created_report['id']}", json={"status": "resolved"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"

    def test_update_severity(self, created_report):
        resp = client.patch(f"{BASE}/{created_report['id']}", json={"severity": "critical"})
        assert resp.status_code == 200
        assert resp.json()["severity"] == "critical"

    def test_update_invalid_status_returns_422(self, created_report):
        resp = client.patch(f"{BASE}/{created_report['id']}", json={"status": "invalid"})
        assert resp.status_code == 422

    def test_update_nonexistent_returns_404(self):
        resp = client.patch(f"{BASE}/nonexistent-id-00000", json={"status": "resolved"})
        assert resp.status_code == 404

    def test_status_filter_after_update(self, created_report):
        report_id = created_report["id"]
        client.patch(f"{BASE}/{report_id}", json={"status": "resolved"})

        resolved = client.get(BASE + "/", params={"status": "resolved"})
        assert report_id in [r["id"] for r in resolved.json()]

        reported = client.get(BASE + "/", params={"status": "reported"})
        assert report_id not in [r["id"] for r in reported.json()]


# ---------------------------------------------------------------------------
# 댓글
# ---------------------------------------------------------------------------

class TestComments:
    def test_add_comment(self, created_report):
        resp = client.post(
            f"{BASE}/{created_report['id']}/comments",
            json={"content": "확인했습니다.", "author": "홍길동"},
        )
        assert resp.status_code == 200
        comments = resp.json()["comments"]
        assert len(comments) == 1
        assert comments[0]["content"] == "확인했습니다."
        assert comments[0]["author"] == "홍길동"

    def test_add_comment_without_author(self, created_report):
        resp = client.post(
            f"{BASE}/{created_report['id']}/comments",
            json={"content": "익명 댓글"},
        )
        assert resp.status_code == 200
        comment = resp.json()["comments"][-1]
        assert comment["author"] is None

    def test_multiple_comments_ordered(self, created_report):
        report_id = created_report["id"]
        for i in range(3):
            client.post(f"{BASE}/{report_id}/comments", json={"content": f"댓글 {i}"})
        resp = client.get(f"{BASE}/{report_id}")
        comments = resp.json()["comments"]
        assert len(comments) == 3
        contents = [c["content"] for c in comments]
        assert contents == ["댓글 0", "댓글 1", "댓글 2"]

    def test_comment_missing_content_returns_422(self, created_report):
        resp = client.post(
            f"{BASE}/{created_report['id']}/comments",
            json={"author": "홍길동"},
        )
        assert resp.status_code == 422

    def test_add_comment_to_nonexistent_report(self):
        resp = client.post(
            f"{BASE}/nonexistent-id-00000/comments",
            json={"content": "댓글"},
        )
        assert resp.status_code == 404

    def test_comments_visible_on_get(self, created_report):
        report_id = created_report["id"]
        client.post(f"{BASE}/{report_id}/comments", json={"content": "상세 조회 확인"})
        resp = client.get(f"{BASE}/{report_id}")
        assert any(c["content"] == "상세 조회 확인" for c in resp.json()["comments"])

    def test_comments_not_in_list(self, created_report):
        report_id = created_report["id"]
        client.post(f"{BASE}/{report_id}/comments", json={"content": "목록에 안 나와야 함"})
        resp = client.get(BASE + "/")
        report = next(r for r in resp.json() if r["id"] == report_id)
        assert report["comments"] == []


# ---------------------------------------------------------------------------
# 첨부 파일 및 성능 최적화
# ---------------------------------------------------------------------------

class TestAttachmentsAndOptimization:
    def test_upload_returns_url(self):
        """파일 업로드 시 즉시 미리보기를 위한 url을 반환해야 한다."""
        import io
        file_content = b"fake image content"
        file = io.BytesIO(file_content)
        resp = client.post(
            f"{BASE}/upload",
            files={"file": ("test.png", file, "image/png")}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "url" in body
        assert body["url"] is not None
        assert "bug-reports/" in body["key"]

    def test_list_does_not_include_urls(self):
        """성능 최적화를 위해 목록 조회 시에는 attachment의 url이 None이어야 한다."""
        # 1. 파일 업로드
        import io
        file = io.BytesIO(b"content")
        upload_resp = client.post(f"{BASE}/upload", files={"file": ("test.png", file, "image/png")})
        attachment = upload_resp.json()

        # 2. 리포트 생성
        payload = {
            "title": "URL 최적화 테스트",
            "category": "ui",
            "severity": "minor",
            "attachment_keys": [attachment],
        }
        create_resp = client.post(BASE + "/", json=payload)
        report_id = create_resp.json()["id"]

        try:
            # 3. 목록 조회 확인
            list_resp = client.get(BASE + "/")
            report_in_list = next(r for r in list_resp.json() if r["id"] == report_id)
            for att in report_in_list["attachments"]:
                assert att["url"] is None, "목록에서는 url이 비어있어야 함 (성능 최적화)"

            # 4. 상세 조회 확인
            get_resp = client.get(f"{BASE}/{report_id}")
            report_detail = get_resp.json()
            for att in report_detail["attachments"]:
                assert att["url"] is not None, "상세 조회에서는 url이 포함되어야 함"
        finally:
            client.delete(f"{BASE}/{report_id}")


# ---------------------------------------------------------------------------
# 삭제
# ---------------------------------------------------------------------------

class TestDeleteBugReport:
    def test_delete_success(self, created_report):
        report_id = created_report["id"]
        resp = client.delete(f"{BASE}/{report_id}")
        assert resp.status_code == 204
        
        # 삭제 후 조회 시 404
        get_resp = client.get(f"{BASE}/{report_id}")
        assert get_resp.status_code == 404

    def test_delete_nonexistent_returns_404(self):
        resp = client.delete(f"{BASE}/nonexistent-id-00000")
        assert resp.status_code == 404
