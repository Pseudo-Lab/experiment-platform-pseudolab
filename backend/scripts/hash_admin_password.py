from __future__ import annotations

from getpass import getpass

from app.core.auth import hash_password


def main() -> None:
    password = getpass("Admin password: ")
    confirm = getpass("Confirm password: ")
    if password != confirm:
        raise SystemExit("Passwords do not match")
    print(hash_password(password))


if __name__ == "__main__":
    main()
