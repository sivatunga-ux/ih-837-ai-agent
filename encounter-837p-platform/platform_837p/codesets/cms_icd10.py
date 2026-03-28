from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path
from urllib.request import urlopen

import psycopg

from .models import CodeSetType, CmsZipTarget, FiscalYearPeriod

CM_FAMILY = CodeSetType.ICD10CM
PCS_FAMILY = CodeSetType.ICD10PCS
CODE_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.]{1,10}$")


def build_default_periods(year: int) -> list[FiscalYearPeriod]:
    return [
        FiscalYearPeriod(
            fiscal_year=year,
            period_label=f"FY{year}_H1",
            release_phase="ANNUAL",
            effective_start=__import__("datetime").date(year - 1, 10, 1),
            effective_end=__import__("datetime").date(year, 3, 31),
        ),
        FiscalYearPeriod(
            fiscal_year=year,
            period_label=f"FY{year}_H2_APRIL_UPDATE",
            release_phase="APRIL_UPDATE",
            effective_start=__import__("datetime").date(year, 4, 1),
            effective_end=__import__("datetime").date(year, 9, 30),
        ),
    ]


def cms_zip_url_candidates(year: int) -> list[CmsZipTarget]:
    windows = build_default_periods(year)
    h1 = windows[0]
    h2 = windows[1]
    return [
        CmsZipTarget(
            year=year,
            code_system=CM_FAMILY,
            period_label=h1.period_label,
            release_phase=h1.release_phase,
            url=f"https://www.cms.gov/files/zip/{year}-code-descriptions-tabular-order.zip",
        ),
        CmsZipTarget(
            year=year,
            code_system=CM_FAMILY,
            period_label=h2.period_label,
            release_phase=h2.release_phase,
            url=f"https://www.cms.gov/files/zip/april-1-{year}-code-descriptions-tabular-order.zip",
        ),
        CmsZipTarget(
            year=year,
            code_system=PCS_FAMILY,
            period_label=h1.period_label,
            release_phase=h1.release_phase,
            url=f"https://www.cms.gov/files/zip/{year}-icd-10-pcs-codes-file.zip",
        ),
        CmsZipTarget(
            year=year,
            code_system=PCS_FAMILY,
            period_label=h2.period_label,
            release_phase=h2.release_phase,
            url=f"https://www.cms.gov/files/zip/april-1-{year}-icd-10-pcs-codes-file.zip",
        ),
    ]


def _download(url: str) -> bytes:
    with urlopen(url) as response:  # nosec B310 - intentional CMS fetch
        return response.read()


def _pick_member(zf: zipfile.ZipFile) -> str:
    candidates = [name for name in zf.namelist() if not name.endswith("/") and re.search(r"\.(txt|csv)$", name, re.I)]
    if not candidates:
        raise ValueError("No text/csv files found in zip")
    candidates.sort(key=lambda name: (len(name), name.lower()))
    return candidates[0]


def parse_codes_from_text(text: str) -> list[tuple[str, str | None, str]]:
    seen = set()
    rows: list[tuple[str, str | None, str]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        token = line.split()[0].replace(",", "").upper()
        if not CODE_PATTERN.match(token):
            continue
        if token in seen:
            continue
        seen.add(token)
        rows.append((token, None, raw_line[:500]))
    return rows


def parse_codes_from_zip_bytes(payload: bytes) -> list[tuple[str, str | None, str]]:
    with zipfile.ZipFile(__import__("io").BytesIO(payload)) as zf:
        member = _pick_member(zf)
        raw = zf.read(member)
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
    return parse_codes_from_text(text)


def _insert_release(cursor, *, target: CmsZipTarget, period: FiscalYearPeriod, source_checksum: str, local_zip_path: str) -> str:
    cursor.execute(
        """
        INSERT INTO external_codeset_releases (
          codeset_name,
          release_year,
          release_phase,
          effective_start,
          effective_end,
          source_url,
          source_checksum_sha256,
          local_zip_path
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (codeset_name, release_year, release_phase)
        DO UPDATE SET
          source_url = EXCLUDED.source_url,
          source_checksum_sha256 = EXCLUDED.source_checksum_sha256,
          local_zip_path = EXCLUDED.local_zip_path,
          downloaded_at = now()
        RETURNING release_id;
        """,
        (
            target.code_system.value,
            target.year,
            target.release_phase,
            period.effective_start,
            period.effective_end,
            target.url,
            source_checksum,
            local_zip_path,
        ),
    )
    return str(cursor.fetchone()[0])


def _replace_entries(cursor, *, release_id: str, period: FiscalYearPeriod, rows: list[tuple[str, str | None, str]]) -> int:
    cursor.execute("DELETE FROM external_codeset_entries WHERE release_id = %s;", (release_id,))
    for code, description, raw_line in rows:
        cursor.execute(
            """
            INSERT INTO external_codeset_entries (
              release_id,
              code,
              description,
              effective_start,
              effective_end,
              raw_line
            )
            VALUES (%s, %s, %s, %s, %s, %s);
            """,
            (
                release_id,
                code,
                description,
                period.effective_start,
                period.effective_end,
                raw_line,
            ),
        )
    return len(rows)


def _record_load_run(cursor, *, status: str, details: dict) -> None:
    cursor.execute(
        """
        INSERT INTO external_codeset_load_runs (
          completed_at,
          status,
          initiated_by,
          details
        )
        VALUES (now(), %s, 'platform_837p.codesets.load_icd10', %s::jsonb);
        """,
        (status, json.dumps(details, sort_keys=True)),
    )


def load_years_into_db(*, dsn: str, years: list[int], download_dir: Path, family_filter: str | None = None) -> list[dict]:
    if not years:
        return []

    loaded: list[dict] = []
    download_dir.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cursor:
            for year in years:
                periods = {p.release_phase: p for p in build_default_periods(year)}
                for target in cms_zip_url_candidates(year):
                    if family_filter == "CM" and target.code_system != CM_FAMILY:
                        continue
                    if family_filter == "PCS" and target.code_system != PCS_FAMILY:
                        continue

                    period = periods[target.release_phase]
                    file_name = target.url.rsplit("/", maxsplit=1)[-1]
                    out_path = download_dir / str(year) / target.code_system.value.lower() / file_name
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    payload = _download(target.url)
                    out_path.write_bytes(payload)
                    checksum = hashlib.sha256(payload).hexdigest()

                    release_id = _insert_release(
                        cursor,
                        target=target,
                        period=period,
                        source_checksum=checksum,
                        local_zip_path=str(out_path),
                    )
                    rows = parse_codes_from_zip_bytes(payload)
                    entry_count = _replace_entries(cursor, release_id=release_id, period=period, rows=rows)
                    loaded.append(
                        {
                            "release_id": release_id,
                            "codeset_name": target.code_system.value,
                            "release_year": year,
                            "release_phase": target.release_phase,
                            "effective_start": str(period.effective_start),
                            "effective_end": str(period.effective_end),
                            "entry_count": entry_count,
                        }
                    )

            _record_load_run(cursor, status="COMPLETED", details={"years": years, "loaded_count": len(loaded)})
        conn.commit()
    return loaded

