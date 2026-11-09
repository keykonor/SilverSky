"""Composition boundary for four separate runtime roles."""

from __future__ import annotations

from datetime import datetime

from .candidate_planner import candidates
from .safety_reviewer import review
from .solution_synthesizer import synthesize


def plan(user_request: dict) -> dict:
    if user_request.get("urgency") == "MEDICAL_EMERGENCY":
        raise ValueError("medical emergency: contact 120 or local emergency services before ordinary route planning")
    window = user_request.get("departure_window")
    if window and datetime.fromisoformat(window["start"]) >= datetime.fromisoformat(window["end"]):
        raise ValueError("departure window must end after it starts")
    proposed, warnings = candidates(user_request)
    reviewed = [review(candidate, user_request) for candidate in proposed]
    return synthesize(user_request, proposed, reviewed, warnings)
