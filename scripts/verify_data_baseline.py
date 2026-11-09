"""Verify the frozen Sprint 3 input data without reading local credentials."""

from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "SPRINT3_BASELINE.sha256"


def main() -> None:
    actual_files = {path.relative_to(ROOT).as_posix() for path in (ROOT / "data").rglob("*.json")}
    expected_files: set[str] = set()
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        digest, separator, name = line.partition("  ")
        if not separator or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise SystemExit(f"Invalid manifest entry: {line}")
        if name in expected_files or name not in actual_files:
            raise SystemExit(f"Unexpected or duplicate dataset: {name}")
        expected_files.add(name)
        found = sha256((ROOT / name).read_bytes()).hexdigest()
        if found != digest:
            raise SystemExit(f"Dataset hash mismatch: {name}")
    if expected_files != actual_files:
        raise SystemExit(f"Dataset inventory mismatch: {sorted(actual_files ^ expected_files)}")
    print(f"Sprint 3 data baseline verified: {len(expected_files)} JSON files")


if __name__ == "__main__":
    main()
