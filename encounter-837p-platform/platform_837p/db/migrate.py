from __future__ import annotations

import argparse
import os
from pathlib import Path

from .migrations import apply_migrations, discover_migrations


def _default_migrations_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "db" / "migrations"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply PostgreSQL schema migrations.")
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL DSN. Defaults to DATABASE_URL env var.",
    )
    parser.add_argument(
        "--migrations-dir",
        type=Path,
        default=_default_migrations_dir(),
        help="Directory containing SQL migration files.",
    )
    parser.add_argument(
        "--plan",
        action="store_true",
        help="Print ordered migration files without applying them.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    migrations = discover_migrations(args.migrations_dir)

    if args.plan:
        for migration in migrations:
            print(f"{migration.version:04d} {migration.filename}")
        return 0

    if not args.dsn:
        raise SystemExit("DATABASE_URL (or --dsn) is required to apply migrations.")

    import psycopg

    with psycopg.connect(args.dsn) as connection:
        applied = apply_migrations(connection, args.migrations_dir)

    if not applied:
        print("No pending migrations.")
        return 0

    for migration in applied:
        print(f"Applied {migration.version:04d} {migration.filename}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

