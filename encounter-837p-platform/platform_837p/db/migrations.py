from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence


@dataclass(frozen=True)
class SqlFile:
    version: int
    filename: str
    path: Path


def discover_sql_files(directory: Path) -> List[SqlFile]:
    files: List[SqlFile] = []
    for path in directory.glob("*.sql"):
        prefix = path.stem.split("_", maxsplit=1)[0]
        if not prefix.isdigit():
            continue
        files.append(SqlFile(version=int(prefix), filename=path.name, path=path))
    files.sort(key=lambda f: (f.version, f.filename))
    return files


def discover_migrations(directory: Path) -> List[SqlFile]:
    """Backward-compatible alias used by migration CLI and tests."""
    return discover_sql_files(directory)


def plan_pending(files: Sequence[SqlFile], applied_versions: Iterable[int]) -> List[SqlFile]:
    existing = set(applied_versions)
    return [f for f in files if f.version not in existing]


def _ensure_migration_tracking(cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          filename TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


def _fetch_applied_versions(cursor) -> set[int]:
    cursor.execute("SELECT version FROM schema_migrations;")
    rows = cursor.fetchall()
    return {int(r[0]) for r in rows}


def apply_migrations(connection, migrations_dir: Path) -> List[SqlFile]:
    migrations = discover_migrations(migrations_dir)
    applied: List[SqlFile] = []

    with connection.cursor() as cursor:
        _ensure_migration_tracking(cursor)
        pending = plan_pending(migrations, _fetch_applied_versions(cursor))
        for migration in pending:
            cursor.execute(migration.path.read_text(encoding="utf-8"))
            cursor.execute(
                "INSERT INTO schema_migrations (version, filename) VALUES (%s, %s);",
                (migration.version, migration.filename),
            )
            applied.append(migration)

    connection.commit()
    return applied

