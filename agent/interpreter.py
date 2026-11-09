"""Conservative intent extraction and caller-held planning state."""

from __future__ import annotations

import copy
import re
from datetime import datetime, timedelta, timezone

from .data_access import LocalDataService

TZ = timezone(timedelta(hours=8))
AGE = re.compile(r"(?<!\d)(\d{1,3})\s*岁")
BARE_AGE = re.compile(r"(?:我爸|我妈|老人)\s*(\d{2})(?!\d)")
EXACT = re.compile(r"(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(上午|下午|晚上|中午)?\s*(\d{1,2})[:：](\d{2})")
RELATIVE = re.compile(r"(今天|明天)\s*(上午|下午|晚上|中午)?\s*(\d{1,2})[:：](\d{2})")
RELATIVE_HOUR = re.compile(r"(今天|明天)\s*(上午|下午|晚上|中午)\s*([一二三四五六七八九十]|十[一二])点(?:半)?")
CN_HOURS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12}


def _time(text: str, reference_time: str) -> dict:
    match = EXACT.search(text)
    if match:
        year, month, day = map(int, match.group(1, 2, 3))
        period, hour, minute = match[4], int(match[5]), int(match[6])
    else:
        match = RELATIVE.search(text)
        hour_match = RELATIVE_HOUR.search(text) if not match else None
        base = datetime.fromisoformat(reference_time.replace("Z", "+00:00")).astimezone(TZ)
        if match:
            date = base.date() + timedelta(days=match[1] == "明天")
            year, month, day = date.year, date.month, date.day
            period, hour, minute = match[2], int(match[3]), int(match[4])
        elif hour_match:
            date = base.date() + timedelta(days=hour_match[1] == "明天")
            year, month, day = date.year, date.month, date.day
            period, hour, minute = hour_match[2], CN_HOURS[hour_match[3]], 30 if hour_match.group().endswith("半") else 0
        else:
            window = re.search(r"(今天|明天)\s*下午(?!\s*\d{1,2}[:：])", text)
            if not window:
                return {}
            date = base.date() + timedelta(days=window[1] == "明天")
            start = datetime(date.year, date.month, date.day, 12, tzinfo=TZ)
            return {"departure_window": {"start": start.isoformat(timespec="seconds"), "end": (start + timedelta(hours=6)).isoformat(timespec="seconds"), "precision": "AFTERNOON"}}
    if period in ("下午", "晚上") and hour < 12:
        hour += 12
    if period == "上午" and hour == 12:
        hour = 0
    try:
        return {"departure_time": datetime(year, month, day, hour, minute, tzinfo=TZ).isoformat(timespec="seconds")}
    except ValueError:
        return {}


def _places(text: str) -> dict:
    names = [poi["name"] for dataset in LocalDataService().pois() for poi in dataset["pois"]]
    names += ["天津大学北洋园校区", "天津大学", "天津医大总医院", "天津五大道", "天津站", "天大", "医院", "家里", "家中", "深圳南山区"]
    matches = []
    for name in sorted(set(names), key=len, reverse=True):
        for match in re.finditer(re.escape(name) + r"(?:附近)?", text):
            if not any(start <= match.start() < end for start, end, _ in matches):
                matches.append((match.start(), match.end(), match.group()))
    matches.sort()
    result = {}
    for start, end, name in matches:
        before, after = text[max(0, start - 7):start], text[end:end + 4]
        if re.search(r"(?:从|由)[^到去前往]*$", before) or after.startswith(("出发", "走")):
            result["origin"] = {"label": name}
        elif re.search(r"(?:到|去|前往)[^从由]*$", before):
            result["destination"] = {"label": name}
        elif len(matches) == 1:
            result["location_candidate"] = {"label": name}
    if len(matches) >= 2:
        result.setdefault("origin", {"label": matches[0][2]})
        result.setdefault("destination", {"label": matches[1][2]})
    return result


def _mobility(text: str) -> str | None:
    normalized = text
    for denial in ("不需要搀扶", "无需搀扶", "不需要人扶", "没有行动不便", "并非行动不便", "没有腿脚不方便", "没有走路困难"):
        normalized = normalized.replace(denial, "")
    if re.search(r"(?:腿脚|行动|走路).{0,5}(?:不灵光|不灵便|费劲|吃力|不方便)", normalized):
        return "LIMITED"
    if any(x in normalized for x in ("走不了太远", "腿脚不是特别方便")):
        return "LIMITED"
    if any(x in normalized for x in ("坐轮椅", "用轮椅", "使用轮椅", "需要轮椅")) and not any(x in normalized for x in ("无需轮椅", "不需要轮椅")):
        return "WHEELCHAIR"
    for code, phrases in (("ASSISTED", ("需要搀扶", "需要人扶")), ("LIMITED", ("行动不便", "行动能力有限", "走路困难", "腿脚不方便", "腿脚不太灵便")), ("MODERATE", ("行动一般", "腿脚一般")), ("NORMAL", ("行动正常", "行动自如", "走路没问题"))):
        if any(x in normalized for x in phrases):
            return code
    if any(x in normalized for x in ("腿脚还行", "走多了容易累", "正常能走")):
        return "MODERATE" if "容易累" in normalized or "走多" in normalized else "NORMAL"
    if any(x in normalized for x in ("身体挺好", "身体很好")):
        return "NORMAL"
    return None


def _focus(text: str) -> str | None:
    if "走不了太远" in text:
        return "LESS_WALKING"
    if any(x in text for x in ("别太折腾", "来回换车", "别让我来回换车")):
        return "FEWER_TRANSFERS"
    if re.search(r"(?:别|少|不想).{0,6}(?:走|步行)", text) or re.search(r"(?:走|步行).{0,5}(?:少|短|不远)", text):
        return "LESS_WALKING"
    if re.search(r"(?:别|少|减少).{0,8}(?:换乘|换车|转车|换.{0,3}次车)", text):
        return "FEWER_TRANSFERS"
    for code, phrases in (("LESS_WALKING", ("少走路", "少走一点", "少步行")), ("FEWER_TRANSFERS", ("少换乘", "少转车", "换乘越少越好")), ("SAFETY_COMFORT", ("安全舒适", "安全舒服", "舒服一点", "舒适优先")), ("TIME", ("时间优先", "尽量快", "快一点", "越快越好", "最快", "赶时间", "尽快到")), ("LOW_COST", ("低成本", "省钱", "经济优先")), ("BALANCED", ("均衡", "综合考虑"))):
        if any(x in text for x in phrases):
            return code
    return None


def _urgency(text: str) -> tuple[str | None, bool]:
    symptoms = ("胸痛", "胸口疼", "胸口很痛", "呼吸困难", "喘不过气", "喘不上气", "昏迷", "大出血", "突然晕倒", "意识不清")
    if any(re.search(r"(?:如果|假如|假设).*" + re.escape(word), text) for word in symptoms):
        return None, True
    def negated(word: str) -> bool:
        if any(prefix + word in text for prefix in ("没有", "无", "曾经", "以前", "如果")):
            return True
        return bool(re.search(r"(?:没有|无)(?:胸痛|胸口疼|呼吸困难|喘不过气)(?:或|和)" + re.escape(word), text))
    active = any(word in text and not negated(word) for word in symptoms)
    if active or any(x in text for x in ("正在急救", "危及生命", "突发心梗")):
        return "MEDICAL_EMERGENCY", False
    if "不着急" in text and re.search(r"(?:\d+|[一二三四五六七八九十]+)\s*分钟(?:必须|一定要|得)到", text):
        return "UNKNOWN", True
    if any(x in text for x in ("赶高铁", "赶火车", "赶飞机", "快赶不上", "只是赶时间", "一般赶时间", "时间有点赶")):
        return "TIME_SENSITIVE", False
    if any(x in text for x in ("非紧急", "不着急", "普通出行", "没有症状", "并非急症", "没什么不舒服")):
        return ("TIME_SENSITIVE" if "比较急" in text else "NORMAL"), False
    if "比较急" in text and "复诊" in text:
        return "TIME_SENSITIVE", False
    if any(x in text for x in ("紧急", "很急", "急着")):
        return "URGENT_TRAVEL", "医院" in text or "急诊" in text
    return None, False


def _extract(text: str, reference_time: str) -> tuple[dict, list[str]]:
    result = _places(text)
    result.update(_time(text, reference_time))
    cities = {code for name, code in (("天津", "TIANJIN"), ("深圳", "SHENZHEN")) if name in text}
    if len(cities) == 1:
        result["city"] = cities.pop()
    age_match, mobility = AGE.search(text) or BARE_AGE.search(text), _mobility(text)
    age = int(age_match[1]) if age_match else None
    walk = re.search(r"(?:步行|走路)(?:不超过|最多|上限)?\s*(\d+(?:\.\d+)?)\s*米", text)
    wheelchair = False if any(x in text for x in ("无需轮椅", "不需要轮椅")) else True if any(x in text for x in ("需要轮椅", "使用轮椅", "用轮椅", "坐轮椅")) else None
    no_assistance = any(x in text for x in ("无需陪同", "不需要陪同"))
    wants_assistance = any(x in text for x in ("需要陪同", "需要陪护", "需陪同", "最好有人陪着"))
    assistance_conflict = no_assistance and "最好有人陪着" in text
    assistance = None if assistance_conflict else False if no_assistance else True if wants_assistance else None
    if age is not None or mobility or walk or wheelchair is not None or assistance is not None:
        result["elderly_profile"] = {"age": age if age is not None and age <= 120 else None, "mobility": mobility or "UNKNOWN", "walking_tolerance_m": float(walk[1]) if walk else None, "wheelchair_requirement": wheelchair, "assistance_requirement": assistance}
    focus = _focus(text)
    air = "GROUND_ONLY" if any(x in text for x in ("只要地面", "不考虑低空")) else "ALLOW_SIMULATION" if "允许模拟低空" in text else None
    if focus or air:
        result["preferences"] = {"focus": focus or "BALANCED", "air_option": air or "UNSPECIFIED"}
    secondary = []
    if focus != "LESS_WALKING" and any(x in text for x in ("容易累", "走不了太远", "少走", "别走太远")):
        secondary.append("LESS_WALKING")
    if focus != "TIME" and any(x in text for x in ("快一点", "越快越好", "赶时间")):
        secondary.append("TIME")
    if focus != "SAFETY_COMFORT" and "安全第一" in text:
        secondary.append("SAFETY_COMFORT")
    if secondary:
        result.setdefault("elderly_profile", {"age": None, "mobility": "UNKNOWN", "walking_tolerance_m": None, "wheelchair_requirement": None, "assistance_requirement": None})["preferences"] = secondary
    urgency, uncertain = _urgency(text)
    pending = ["urgency"] if uncertain else []
    if wheelchair is True and any(x in text for x in ("自己走一点", "也能走一点")):
        pending.append("elderly_profile.mobility")
    if mobility is None and urgency != "MEDICAL_EMERGENCY" and any(x in text for x in ("我父亲", "我母亲", "我爸", "我妈")):
        pending.append("elderly_profile.mobility")
    if assistance_conflict:
        pending.append("elderly_profile.assistance_requirement")
    if mobility is None and re.search(r"(?:行动|腿脚).{0,8}(?:能力|不|没|一般|正常|困难|灵|好|差)", text):
        pending.append("elderly_profile.mobility")
    if focus is None and re.search(r"(?:优先|尽量|最好|少走|换乘|换车|成本|费用)", text):
        pending.append("preferences.focus")
    if urgency:
        result["urgency"] = urgency
    return result, pending


def _merge(previous: dict, current: dict) -> dict:
    state = copy.deepcopy(previous)
    for key, value in current.items():
        if key in ("elderly_profile", "preferences") and key in state:
            skip = (None, "UNKNOWN") if key == "elderly_profile" else ("BALANCED", "UNSPECIFIED")
            state[key].update({name: item for name, item in value.items() if item not in skip})
        else:
            state[key] = value
    if "departure_time" in current:
        state.pop("departure_window", None)
    if "departure_window" in current:
        state.pop("departure_time", None)
    if "origin" in current or "destination" in current:
        state.pop("location_candidate", None)
    return state


def interpret(text: str, reference_time: str, planning_state: dict | None = None) -> dict:
    """Merge turns without server-side storage; state belongs to the planning session caller."""
    current, uncertain = _extract(text, reference_time)
    explicit_mobility_uncertain = "elderly_profile.mobility" in uncertain and bool(re.search(r"行动|腿脚|轮椅|走路", text))
    candidate = current.get("location_candidate")
    # A bare place can answer the immediately outstanding origin question when
    # the other endpoint is already specific. Keep generic areas ambiguous.
    if (
        planning_state
        and candidate
        and "origin" not in planning_state
        and planning_state.get("destination", {}).get("label") not in (None, "医院")
        and candidate["label"] not in ("家里", "家中", "医院", "深圳南山区")
        and re.fullmatch(r"\s*" + re.escape(candidate["label"]) + r"[\s。！!？?]*", text)
    ):
        current["origin"] = current.pop("location_candidate")
    if planning_state and current.get("location_candidate") and planning_state.get("destination", {}).get("label") == "医院" and "医院" in current["location_candidate"]["label"]:
        current["destination"] = current.pop("location_candidate")
    if planning_state and current.get("location_candidate") and planning_state.get("origin", {}).get("label") in ("天津大学", "天大") and current["location_candidate"]["label"].startswith("天津大学"):
        current["origin"] = current.pop("location_candidate")
    if planning_state and planning_state.get("urgency") == "MEDICAL_EMERGENCY" and current.get("urgency") != "MEDICAL_EMERGENCY":
        if any(phrase in text for phrase in ("没有症状", "并非急症", "刚才说错了", "症状是过去的")):
            current.setdefault("urgency", "NORMAL")
        else:
            current.pop("urgency", None)
    if planning_state and "location_candidate" in planning_state:
        if "是起点" in text or "作为起点" in text:
            current["origin"] = planning_state["location_candidate"]
        elif "是目的地" in text or "作为目的地" in text:
            current["destination"] = planning_state["location_candidate"]
    state = _merge(planning_state or {}, current)
    pending = set(state.get("pending_clarifications", []))
    pending.update(uncertain)
    if "urgency" in current and "urgency" not in uncertain:
        pending.discard("urgency")
    if current.get("elderly_profile", {}).get("mobility") not in (None, "UNKNOWN") and "elderly_profile.mobility" not in uncertain:
        pending.discard("elderly_profile.mobility")
    if current.get("elderly_profile", {}).get("assistance_requirement") is not None and "elderly_profile.assistance_requirement" not in uncertain:
        pending.discard("elderly_profile.assistance_requirement")
    if current.get("preferences", {}).get("focus") not in (None, "BALANCED"):
        pending.discard("preferences.focus")
    if pending:
        state["pending_clarifications"] = sorted(pending)
    else:
        state.pop("pending_clarifications", None)
    uncertain = sorted(pending)
    candidate = state.get("location_candidate")
    if state.get("origin", {}).get("label") in ("家里", "家中"):
        uncertain.append("origin")
    if state.get("destination", {}).get("label") == "医院":
        uncertain.append("destination")
    reference = datetime.fromisoformat(reference_time.replace("Z", "+00:00"))
    time_value = state.get("departure_time") or state.get("departure_window", {}).get("start")
    past_time = bool(time_value and datetime.fromisoformat(time_value) < reference)
    if past_time:
        state.pop("departure_time", None)
        state.pop("departure_window", None)
    missing = [key for key in ("origin", "destination") if key not in state]
    if "departure_time" not in state and "departure_window" not in state:
        missing.append("departure_time")
    if candidate:
        uncertain.append("location_role")
    profile = state.get("elderly_profile", {"age": None, "mobility": "UNKNOWN", "walking_tolerance_m": None, "wheelchair_requirement": None, "assistance_requirement": None})
    preferences = state.get("preferences", {"focus": "SAFETY_COMFORT", "air_option": "UNSPECIFIED"})
    urgency = state.get("urgency", "UNKNOWN")
    emergency = urgency == "MEDICAL_EMERGENCY"
    summary = f"城市：{state.get('city', '待确认')}；年龄：{profile.get('age') if profile.get('age') is not None else '待确认'}；行动能力：{profile['mobility']}；偏好：{preferences['focus']}；紧急程度：{urgency}。"
    if emergency:
        question = "请优先联系 120 或当地紧急医疗服务；SilverSky 不能替代急救系统。"
    elif candidate:
        question = f"“{candidate['label']}”是起点还是目的地？请告诉我另一端地点" + ("和出发时间。" if "departure_time" in missing else "。")
    else:
        names = {"origin": "具体起点", "destination": "目的地", "departure_time": "出发时间"}
        question = "请告诉我" + "、".join(names[key] for key in missing) + "。" if missing else None
    if "urgency" in uncertain and not emergency:
        question = (question + " " if question else "") + "请确认是一般赶时间，还是发生了需要急救的症状或危险？"
    if "elderly_profile.mobility" in uncertain and (not missing or explicit_mobility_uncertain) and not emergency:
        question = (question + " " if question else "") + "请确认行动能力是正常、一般，还是需要协助？"
    if "preferences.focus" in uncertain and not emergency:
        question = (question + " " if question else "") + "请确认更看重安全舒适、时间、少步行、少换乘还是费用？"
    if "origin" in uncertain and not emergency:
        question = (question + " " if question else "") + "请提供家里的具体出发位置。"
    if "destination" in uncertain and not emergency:
        question = (question + " " if question else "") + "请提供具体医院名称。"
    if past_time and not emergency:
        question = (question + " " if question else "") + "之前的出发时间已过去，请重新输入未来出发时间。"
    if "elderly_profile.assistance_requirement" in uncertain and not emergency:
        question = (question + " " if question else "") + "请确认老人出行是否需要有人陪同？"
    request = None
    can_plan = not missing and not emergency and not uncertain
    if can_plan:
        request = {"origin": state["origin"], "destination": state["destination"], "departure_time": state.get("departure_time"), "urgency": urgency, "elderly_profile": profile, "preferences": preferences}
        if "departure_window" in state:
            request["departure_window"] = state["departure_window"]
        if "city" in state:
            request["city"] = state["city"]
    assumptions = ["年龄仅表述为七十多岁，未给出精确年龄。"] if "七十多岁" in text else []
    return {"user_request": request, "needs_summary": summary, "interpretation_summary": summary, "missing_fields": missing, "uncertain_fields": uncertain, "assumptions": assumptions, "structured_intent": state, "planning_state": state, "follow_up_question": question, "planning_allowed": can_plan}
