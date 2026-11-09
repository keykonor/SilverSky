"""Guard the readiness check against silently accepting incompatible contracts."""

import json
from pathlib import Path
import shutil

import pytest

from scripts.check_project_ready import ROOT, check_baseline, check_requests, local_file


def baseline_copy(tmp_path: Path) -> Path:
    manifest = json.loads((ROOT / "schemas/BASELINE.json").read_text(encoding="utf-8"))
    for name in ["schemas/BASELINE.json", *(row["path"] for row in manifest["files"])]:
        dest = tmp_path / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, dest)
    return tmp_path


def test_contract_change_is_rejected(tmp_path):
    root = baseline_copy(tmp_path)
    path = root / "schemas/core.v0.1.schema.json"
    path.write_text(path.read_text(encoding="utf-8").replace('"VERIFIED"', '"REAL_DATA"'), encoding="utf-8")
    assert any("contract drift: schemas/core.v0.1.schema.json" in error for error in check_baseline(root))


def test_windows_line_endings_keep_same_baseline(tmp_path):
    root = baseline_copy(tmp_path)
    path = root / "frontend/src/types/contracts.ts"
    path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    assert check_baseline(root) == []


def test_missing_contract_cannot_be_dropped_from_baseline(tmp_path):
    root = baseline_copy(tmp_path)
    path = root / "schemas/BASELINE.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["files"].pop()
    path.write_text(json.dumps(manifest), encoding="utf-8")
    assert any("exactly" in error for error in check_baseline(root))


def test_preview_cannot_claim_complete_history(tmp_path):
    path = tmp_path / "docs/requirements/requests.json"
    path.parent.mkdir(parents=True)
    ledger = json.loads((ROOT / "docs/requirements/requests.json").read_text(encoding="utf-8"))
    ledger["coverage"]["full_history_complete"] = True
    # Only test provenance, without depending on repository attachments.
    for row in ledger["requests"]:
        row["related_files"] = []
    ledger["historical_requirement_index"] = []
    path.write_text(json.dumps(ledger), encoding="utf-8")
    assert any("complete history" in error for error in check_requests(tmp_path))


def test_request_attachment_must_exist(tmp_path):
    path = tmp_path / "docs/requirements/requests.json"
    path.parent.mkdir(parents=True)
    ledger = json.loads((ROOT / "docs/requirements/requests.json").read_text(encoding="utf-8"))
    ledger["requests"] = [ledger["requests"][0]]
    ledger["requests"][0]["related_files"] = ["missing-source.md"]
    ledger["historical_requirement_index"] = []
    path.write_text(json.dumps(ledger), encoding="utf-8")
    with pytest.raises(ValueError, match="missing-source.md"):
        check_requests(tmp_path)


def test_sources_cannot_escape_repository(tmp_path):
    with pytest.raises(ValueError, match="outside repository"):
        local_file(tmp_path, "../outside.md")
