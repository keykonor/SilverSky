"""Read-only offline readiness checks and optional loopback HTTP smoke checks."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import ProxyHandler, build_opener


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_FILES = {
    "schemas/core.v0.1.schema.json",
    "schemas/datasets.v0.1.schema.json",
    "frontend/src/types/contracts.ts",
}
DOC_FILES = (
    "README.md", "AGENTS.md", "docs/DEVELOPMENT.md",
    "docs/requirements/README.md", "schemas/README.md",
)


def local_file(root: Path, name: str) -> Path:
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"path outside repository: {name}")
    if not path.is_file():
        raise ValueError(f"missing file: {name}")
    return path


def read_json(root: Path, name: str):
    return json.loads(local_file(root, name).read_text(encoding="utf-8-sig"))


def check_baseline(root: Path) -> list[str]:
    errors = []
    manifest = read_json(root, "schemas/BASELINE.json")
    if manifest["hash_algorithm"] != "sha256-lf":
        errors.append("unsupported baseline hash algorithm")
    records = manifest["files"]
    paths = [row["path"] for row in records]
    if len(paths) != len(set(paths)) or set(paths) != CONTRACT_FILES:
        errors.append("baseline must cover exactly the two schemas and core TS mirror")
    for row in records:
        actual = hashlib.sha256(local_file(root, row["path"]).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
        if actual != row["sha256"]:
            errors.append(f"contract drift: {row['path']}; review proposal/consumers before updating baseline")
    return errors


def check_requests(root: Path) -> list[str]:
    errors = []
    ledger = read_json(root, "docs/requirements/requests.json")
    coverage = ledger["coverage"]
    if not isinstance(coverage["full_history_complete"], bool):
        errors.append("full_history_complete must be boolean")
    if coverage["referenced_chat_access"] == "TRUNCATED_PREVIEW_ONLY" and coverage["full_history_complete"]:
        errors.append("truncated preview cannot be recorded as complete history")
    ids = set()
    rows = ledger["requests"]
    if not rows:
        errors.append("request ledger is empty")
    for row in rows:
        ident = row["id"]
        if not re.fullmatch(r"REQ-\d{3,}", ident) or ident in ids:
            errors.append(f"invalid or duplicate request id: {ident}")
        ids.add(ident)
        for key in ("source_kind", "source_ref", "original_text", "capture_scope", "acceptance", "status", "observed_on"):
            if not isinstance(row[key], str) or not row[key].strip():
                errors.append(f"{ident}: missing {key}")
        for name in row["related_files"]:
            local_file(root, name)
    for row in ledger["historical_requirement_index"]:
        local_file(root, row["source_ref"])
        if row["user_verbatim_available"]:
            errors.append(f"{row['id']}: decision index is not a user chat export")
    return errors


def check_docs(root: Path) -> list[str]:
    errors = []
    for name in DOC_FILES:
        path = local_file(root, name)
        body = path.read_text(encoding="utf-8-sig")
        if len(re.findall(r"^```", body, re.M)) % 2:
            errors.append(f"unclosed Markdown fence: {name}")
        for href in re.findall(r"\[[^\]\n]+\]\(([^)]+)\)", body):
            url = urlsplit(href)
            if url.scheme or href.startswith("#"):
                continue
            target = (path.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(root.resolve()) or not target.exists():
                errors.append(f"broken local document link: {name} -> {href}")
    return errors


def check_config(root: Path) -> list[str]:
    errors = []
    core = read_json(root, "schemas/core.v0.1.schema.json")
    expected = core["$defs"]["DataStatus"]["enum"]
    types = local_file(root, "frontend/src/types/contracts.ts").read_text(encoding="utf-8-sig")
    match = re.search(r"export type DataStatus\s*=([^;]+);", types)
    actual = re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)) if match else []
    if set(actual) != set(expected):
        errors.append("DataStatus differs between schema and frontend mirror")
    scripts = read_json(root, "frontend/package.json")["scripts"]
    for name in ("dev", "typecheck", "test", "build"):
        if name not in scripts:
            errors.append(f"missing documented npm script: {name}")
    for filename, names in (
        (".env.example", {"AMAP_WEB_KEY", "AMAP_SECURITY_JS_CODE", "AMAP_WEB_SERVICE_KEY"}),
        ("frontend/.env.example", {"VITE_CESIUM_ION_TOKEN"}),
    ):
        # Read templates only, never local credentials or process environment.
        body = local_file(root, filename).read_text(encoding="utf-8-sig")
        found = set(re.findall(r"^([A-Z][A-Z0-9_]*)\s*=", body, re.M))
        if not names.issubset(found):
            errors.append(f"documented variable absent from template: {filename}")
    for filename in ("scripts/validate_contract.py", "scripts/verify_data_baseline.py", "scripts/verify_version_archives.py", "requirements.txt"):
        local_file(root, filename)
    return errors


def check_smoke() -> list[str]:
    errors = []
    # No environment proxies, credentials, upstream map requests or mutations.
    opener = build_opener(ProxyHandler({}))
    required_routes = {"/health", "/api/v1/interpret", "/api/v1/plan", "/api/v1/reality/places", "/api/v1/reality/ground", "/api/v1/reality/route-by-id"}
    for url, kind in (
        ("http://127.0.0.1:8000/health", "health"),
        ("http://127.0.0.1:8000/openapi.json", "openapi"),
        ("http://127.0.0.1:5173/", "frontend"),
        ("http://127.0.0.1:5173/health", "health"),
    ):
        try:
            with opener.open(url, timeout=5) as response:
                body = response.read().decode("utf-8")
            if kind == "health" and json.loads(body).get("status") != "ok":
                errors.append(f"health status not ok: {url}")
            elif kind == "openapi" and not required_routes.issubset(json.loads(body).get("paths", {})):
                errors.append(f"documented API routes missing: {url}")
            elif kind == "frontend" and not re.search(r'id=[\"\']root[\"\']', body):
                errors.append(f"frontend root element missing: {url}")
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            errors.append(f"local smoke failed: {url} ({type(exc).__name__}); check README service startup")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true", help="also check the two running loopback services")
    args = parser.parse_args()
    errors = []
    for label, check in (("schema baseline", check_baseline), ("request ledger", check_requests), ("document links/fences", check_docs), ("scripts/enums/env templates", check_config)):
        try:
            findings = check(ROOT)
        except (ValueError, KeyError, TypeError, OSError) as exc:
            findings = [f"{label}: {type(exc).__name__}: {exc}"]
        errors.extend(findings)
        print(f"{'FAIL' if findings else 'PASS'}: {label}")
    if args.smoke:
        findings = check_smoke()
        errors.extend(findings)
        print(f"{'FAIL' if findings else 'PASS'}: local service smoke (4 URLs)")
    for error in errors:
        print(f"  - {error}")
    print("Scope: file consistency only; contract semantics, online maps and real-user acceptance require separate checks.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
