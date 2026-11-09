"""Read-only, replaceable boundary for the Sprint 1 local datasets."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError


ROOT = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def _dataset_validator() -> Draft202012Validator:
    with (ROOT / "schemas/datasets.v0.1.schema.json").open(encoding="utf-8") as stream:
        schema = json.load(stream)
    return Draft202012Validator(schema, format_checker=FormatChecker())


class LocalDataService:
    """Load source-labelled snapshots; never perform live routing or geocoding."""

    def __init__(self, root: Path = ROOT) -> None:
        self.root = Path(root)

    def _read(self, relative: str) -> dict:
        with (self.root / relative).open(encoding="utf-8") as stream:
            dataset = json.load(stream)
        _dataset_validator().validate(dataset)
        return dataset

    def pois(self) -> list[dict]:
        return [
            self._read("data/public/tianjin-poi.json"),
            self._read("data/public/shenzhen-poi.json"),
        ]

    def ground_routes(self) -> dict:
        return self._read("data/public/ground-routes.json")

    def air_scenarios(self) -> dict:
        dataset = self._read("data/simulated/air-scenarios.json")
        for scenario in dataset["scenarios"]:
            # Older scenarios may have labels only. When coordinates are supplied,
            # candidate_planner uses A/B array positions, so reject ambiguous pairs.
            ports = scenario.get("simulated_vertiports")
            if ports is None:
                continue
            expected = (
                ("A", scenario["vertiport_a"], ports[0]),
                ("B", scenario["vertiport_b"], ports[1]),
            )
            for role, name, port in expected:
                if (port["id"] != f'{scenario["scenario_id"]}-SIM-VP-{role}'
                        or port["name"] != name
                        or port["city"] != scenario["city"]):
                    raise ValidationError(
                        f'{scenario["scenario_id"]}: simulated vertiport {role} ID, name or city does not match its scenario'
                    )
            if ports[0]["coordinate"] == ports[1]["coordinate"]:
                raise ValidationError(
                    f'{scenario["scenario_id"]}: simulated vertiport A and B coordinates must differ'
                )
        return dataset

    def aliases(self) -> dict:
        return self._read("data/public/golden-aliases.json")

    def resolve(self, label: str, *, city: str | None = None, scenario_id: str | None = None) -> tuple[dict, dict] | None:
        """Resolve an exact POI, or a unique Golden alias with explicit context."""
        normalized = label.replace("附近", "").strip()
        matches = []
        for dataset in self.pois():
            for poi in dataset["pois"]:
                if normalized == poi["name"] and (city is None or city == dataset["city"]) and (scenario_id is None or scenario_id == dataset["scenario_id"]):
                    matches.append((dataset, poi))
        if len(matches) == 1:
            return matches[0]
        if matches or (city is None and scenario_id is None):
            return None
        try:
            registry = self.aliases()
        except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, ValidationError):
            return None
        aliases = [item for item in registry["aliases"] if item["alias"] == normalized and (city is None or item["city"] == city) and (scenario_id is None or item["scenario_id"] == scenario_id)]
        ids = {item["canonical_id"] for item in aliases}
        if len(ids) != 1:
            return None
        for dataset in self.pois():
            if (city is None or city == dataset["city"]) and (scenario_id is None or scenario_id == dataset["scenario_id"]):
                for poi in dataset["pois"]:
                    if poi["poi_id"] in ids and poi["name"] == aliases[0]["canonical_name"]:
                        return dataset, poi
        return None
