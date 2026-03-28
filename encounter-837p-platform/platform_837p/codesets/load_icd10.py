from __future__ import annotations

import argparse
from pathlib import Path

from .cms_icd10 import load_years_into_db


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download and load CMS ICD-10 CM/PCS codesets by fiscal year.")
    parser.add_argument("--dsn", required=True, help="PostgreSQL DSN.")
    parser.add_argument("--start-year", type=int, required=True, help="Start fiscal year (inclusive).")
    parser.add_argument("--end-year", type=int, required=True, help="End fiscal year (inclusive).")
    parser.add_argument(
        "--family",
        choices=["ALL", "CM", "PCS"],
        default="ALL",
        help="Codeset family to ingest.",
    )
    parser.add_argument(
        "--download-dir",
        type=Path,
        default=Path("downloads/icd10"),
        help="Local folder for downloaded CMS ZIP files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.end_year < args.start_year:
        raise SystemExit("--end-year must be greater than or equal to --start-year")
    years = list(range(args.start_year, args.end_year + 1))

    family_filter = None if args.family == "ALL" else args.family
    loaded = load_years_into_db(
        dsn=args.dsn,
        years=years,
        download_dir=args.download_dir,
        family_filter=family_filter,
    )
    print(f"Loaded {len(loaded)} release(s).")
    for item in loaded:
        print(
            f"{item.codeset_name} FY{item.release_year} "
            f"{item.release_phase} {item.effective_start}..{item.effective_end}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

