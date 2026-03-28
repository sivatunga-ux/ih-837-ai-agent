from __future__ import annotations

import argparse
import os
from pathlib import Path

from .seeds import apply_seed_files, discover_seed_files


def _default_seeds_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "db" / "seeds"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply PostgreSQL seed files.")
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL DSN. Defaults to DATABASE_URL env var.",
    )
    parser.add_argument(
        "--seeds-dir",
        type=Path,
        default=_default_seeds_dir(),
        help="Directory containing seed SQL files.",
    )
    parser.add_argument(
        "--plan",
        action="store_true",
        help="Print ordered seed files without applying them.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    seed_files = discover_seed_files(args.seeds_dir)

    if args.plan:
        for file in seed_files:
            print(file.name)
        return 0

    if not args.dsn:
        raise SystemExit("DATABASE_URL (or --dsn) is required to apply seed files.")

    import psycopg

    with psycopg.connect(args.dsn) as connection:
        applied = apply_seed_files(connection, args.seeds_dir)

    if not applied:
        print("No seed files applied.")
        return 0

    for file in applied:
        print(f"Applied {file.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

