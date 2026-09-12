from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from pathlib import Path

POLICY_PATH = Path(__file__).with_name("rwx.md")

# active heuristics are the bullets under "## Heuristics" before the "---".
_HEURISTIC_RE = re.compile(r"\*\*H(\d+)\*\*\s*(?:\(([\d.]+)\))?\s*[—-]\s*(.*)")

# each per-paper score is fed by these heuristic ids (see rwx.md).
_SCORE_HEURISTICS = {
    "entropy": ("H1", "H2"),
    "compression": ("H1",),
    "implementation": ("H1",),
    "methodological_integrity": ("H3",),
}

_NUMERIC_RE = re.compile(r"\d+(?:\.\d+)?%?")

_NOVELTY_TERMS = {
    "first",
    "novel",
    "new",
    "state-of-the-art",
    "sota",
    "outperform",
    "unprecedented",
    "we propose",
}
_IMPLEMENT_TERMS = {
    "implement",
    "code",
    "open-source",
    "open source",
    "github",
    "available",
    "release",
    "library",
    "toolbox",
    "framework",
}
_EXPERIMENT_TERMS = {
    "experiment",
    "study",
    "in silico",
    "evaluation",
    "benchmark",
    "dataset",
    "simulation",
    "measure",
    "in vivo",
    "in vitro",
}
_INTEGRITY_TERMS = {
    "baseline",
    "compare",
    "ablation",
    "standard deviation",
    "confidence interval",
    "p <",
    "p=",
    "n=",
    "±",
    "log",
    "flops",
    "metric",
    "accuracy",
    "error",
    "significance",
    "units",
    "reproduc",
}


def load_heuristics(path: str | Path = POLICY_PATH) -> dict[str, dict]:
    text = Path(path).read_text()
    active: dict[str, dict] = {}
    in_heuristics = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Heuristics"):
            in_heuristics = True
            continue
        if in_heuristics and (stripped == "---" or stripped.startswith("#")):
            break
        if not in_heuristics or not stripped.startswith(("-", "*")):
            continue
        match = _HEURISTIC_RE.search(stripped)
        if not match:
            continue
        weight = float(match.group(2)) if match.group(2) else 0.5
        active[f"H{match.group(1)}"] = {
            "weight": weight,
            "text": match.group(3).strip(),
        }
    return active


def _quantitative_density(text: str) -> float:
    if not text:
        return 0.0
    tokens = text.split()
    if not tokens:
        return 0.0
    hits = sum(
        1 for token in tokens if _NUMERIC_RE.search(token) or token in {"%", "n=", "±"}
    )
    return min(1.0, (hits / len(tokens)) * 8.0)


def entropy_score(paper: dict, current_year: int) -> float:
    year = paper.get("publication_year")
    recency = 0.0
    if year:
        recency = max(0.0, min(1.0, (year - 2000) / max(1, current_year - 2000)))
    cited = paper.get("cited_by_count") or 0
    age = max(1, current_year - (year or current_year))
    velocity = min(1.0, math.log1p(cited / age) / math.log1p(50.0))
    text = f"{paper.get('title') or ''} {paper.get('abstract') or ''}".lower()
    novelty = 1.0 if any(term in text for term in _NOVELTY_TERMS) else 0.0
    return 0.4 * recency + 0.4 * velocity + 0.2 * novelty


def compression_score(paper: dict) -> float:
    return _quantitative_density(paper.get("abstract") or "")


def implementation_score(paper: dict) -> float:
    abstract = (paper.get("abstract") or "").lower()
    score = 0.0
    if paper.get("has_code"):
        score += 0.5
    if any(term in abstract for term in _IMPLEMENT_TERMS):
        score += 0.3
    if any(term in abstract for term in _EXPERIMENT_TERMS):
        score += 0.2
    return min(1.0, score)


def methodological_integrity_score(paper: dict) -> float:
    abstract = (paper.get("abstract") or "").lower()
    hits = sum(1 for term in _INTEGRITY_TERMS if term in abstract)
    return min(1.0, hits / 5.0)


def paper_scores(
    paper: dict, heuristics: dict[str, dict]
) -> tuple[dict[str, float], float]:
    current_year = datetime.now(UTC).year
    scores = {
        "entropy": entropy_score(paper, current_year),
        "compression": compression_score(paper),
        "implementation": implementation_score(paper),
        "methodological_integrity": methodological_integrity_score(paper),
    }
    weights = {
        name: sum(heuristics[hid]["weight"] for hid in ids if hid in heuristics)
        for name, ids in _SCORE_HEURISTICS.items()
    }
    total = sum(weights.values()) or 1.0
    taste = sum(scores[name] * weights[name] for name in scores) / total
    return scores, taste
