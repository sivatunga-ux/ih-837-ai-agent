from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence


@dataclass(frozen=True)
class SeedFile:
    version: int
    filename: str
    path: Path


def discover_seed_files(seeds_dir: Path) -> List[SeedFile]:
    files: List[SeedFile] = []
    for path in seeds_dir.glob("*.sql"):
        prefix = path.stem.split("_", maxsplit=1)[0]
        if not prefix.isdigit():
            continue
        files.append(SeedFile(version=int(prefix), filename=path.name, path=path))
    files.sort(key=lambda f: (f.version, f.filename))
    return files


def apply_seed_files(connection, seeds_dir: Path) -> List[SeedFile]:
    files = discover_seed_files(seeds_dir)
    if not files:
        return []
    with connection.cursor() as cursor:
        for seed_file in files:
            cursor.execute(seed_file.path.read_text(encoding="utf-8"))
    connection.commit()
    return list(files)


# Backward-compatible names for existing imports.
discover_seeds = discover_seed_files


