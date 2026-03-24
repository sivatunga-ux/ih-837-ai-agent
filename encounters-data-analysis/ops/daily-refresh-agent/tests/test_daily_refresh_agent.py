from __future__ import annotations

import json
from pathlib import Path


def test_example_config_has_required_fields() -> None:
    cfg_path = Path(__file__).resolve().parents[1] / "config.example.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    assert "repo_path" in cfg
    assert "branch" in cfg
    assert "logs_dir" in cfg
    assert "tests" in cfg
    assert "run_python_tests" in cfg["tests"]
    assert "python_test_path" in cfg["tests"]
    assert "web" in cfg
    assert "run_web_smoke" in cfg["web"]
    assert "web_entry_file" in cfg["web"]

