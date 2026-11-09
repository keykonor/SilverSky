"""Verify frozen version folders against their original Git archives. No writes."""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile


ROOT = Path(__file__).resolve().parents[1]


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def verify() -> None:
    manifest = json.loads((ROOT / "versions/manifest.json").read_text("utf-8"))
    if manifest["format_version"] != 1 or len(manifest["versions"]) != 3:
        raise ValueError("Expected manifest format 1 and exactly three versions")
    folders: set[str] = set()
    tags: set[str] = set()
    for version in manifest["versions"]:
        folder, commit, tag = version["folder"], version["commit"], version["tag"]
        if not re.fullmatch(r"v[1-3]-sprint[1-3]", folder):
            raise ValueError(f"Invalid folder: {folder}")
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError(f"Invalid commit for {folder}")
        if folder in folders or tag in tags:
            raise ValueError("Duplicate folder or tag")
        folders.add(folder)
        tags.add(tag)
        if git("rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}").decode().strip() != commit:
            raise ValueError(f"Tag moved: {tag}")
        if git("rev-parse", f"{commit}^{{tree}}").decode().strip() != version["tree"]:
            raise ValueError(f"Tree mismatch: {folder}")
        raw = git("-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", commit)
        if hashlib.sha256(raw).hexdigest() != version["archive_sha256"]:
            raise ValueError(f"Archive checksum mismatch: {folder}")
        base = ROOT / "versions" / folder
        if base.is_symlink() or not base.is_dir():
            raise ValueError(f"Archive directory missing or linked: {folder}")
        expected: set[str] = set()
        total_bytes = 0
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
            for member in archive:
                path = base / member.name
                if not path.resolve().is_relative_to(base.resolve()):
                    raise ValueError(f"Unsafe or linked path: {folder}/{member.name}")
                if member.isdir():
                    continue
                if not member.isfile() or path.is_symlink():
                    raise ValueError(f"Unsupported entry: {folder}/{member.name}")
                expected.add(member.name)
                total_bytes += member.size
                source = archive.extractfile(member)
                if source is None or not path.is_file() or path.read_bytes() != source.read():
                    raise ValueError(f"Changed or missing file: {folder}/{member.name}")
        entries = list(base.rglob("*"))
        if any(p.is_symlink() for p in entries):
            raise ValueError(f"Unexpected symbolic link in {folder}")
        actual = {p.relative_to(base).as_posix() for p in entries if p.is_file()}
        if actual != expected:
            raise ValueError(f"Unexpected files in {folder}: {sorted(actual - expected)}")
        if len(expected) != version["file_count"] or total_bytes != version["total_bytes"]:
            raise ValueError(f"Inventory mismatch: {folder}")
        print(f"PASS {folder}: {len(expected)} files, {total_bytes} bytes; tag/tree/content match")


if __name__ == "__main__":
    verify()
