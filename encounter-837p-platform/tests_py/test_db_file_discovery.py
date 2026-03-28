from pathlib import Path

from platform_837p.db.migrations import discover_migrations
from platform_837p.db.seeds import discover_seed_files


def test_discover_migrations_orders_by_version_and_name(tmp_path: Path) -> None:
    (tmp_path / "0010_later.sql").write_text("SELECT 1;", encoding="utf-8")
    (tmp_path / "0002_init.sql").write_text("SELECT 1;", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")

    result = discover_migrations(tmp_path)

    assert [entry.filename for entry in result] == ["0002_init.sql", "0010_later.sql"]


def test_discover_seeds_orders_by_version_and_name(tmp_path: Path) -> None:
    (tmp_path / "0003_more.sql").write_text("SELECT 1;", encoding="utf-8")
    (tmp_path / "0001_core.sql").write_text("SELECT 1;", encoding="utf-8")

    result = discover_seed_files(tmp_path)

    assert [entry.version for entry in result] == [1, 3]
