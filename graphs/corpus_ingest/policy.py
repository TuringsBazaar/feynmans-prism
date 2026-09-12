from __future__ import annotations

import logging
import re
from pathlib import Path

from .heuristics import load_heuristics, paper_scores

logger = logging.getLogger("rwx")

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP_WORDS = {
    "a",
    "an",
    "and",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def _tokens(value: str) -> set[str]:
    return {
        token for token in TOKEN_RE.findall(value.lower()) if token not in STOP_WORDS
    }


_QUESTION_RE = re.compile(r"^(?:[-*]\s+|\d+\.\s+)(.+)$")


def load_questions(path: str | Path) -> list[str]:
    """Read research questions from a Markdown file.

    Question lines are bullets (`- `, `* `) or numbered (`1. `). Description
    paragraphs under a question are ignored; only the title line is returned.
    """
    questions = []
    for line in Path(path).read_text().splitlines():
        match = _QUESTION_RE.match(line.strip())
        if match and match.group(1).strip():
            questions.append(match.group(1).strip())
    return questions


def _apply_optimal_stopping(papers: list[dict]) -> dict[int, str]:
    """Secretary rule (H4) over papers in arrival order (paper_id).

    Reject the first ~37% unconditionally to estimate the score distribution,
    then accept the first paper whose score exceeds every score seen so far.
    """
    ordered = sorted(papers, key=lambda paper: paper.get("paper_id") or 0)
    count = len(ordered)
    if count == 0:
        return {}
    threshold = max(1, int(0.37 * count))
    running_max = max(paper["score"] for paper in ordered[:threshold])
    decisions: dict[int, str] = {}
    for index, paper in enumerate(ordered):
        if index < threshold:
            decision = "calibrate"
        elif paper["score"] > running_max:
            decision = "accept"
        else:
            decision = "calibrate"
        decisions[paper["paper_id"]] = decision
        running_max = max(running_max, paper["score"])
    return decisions


def rank_papers(
    problem: str,
    papers: list[dict],
    paper_count: int = 5,
) -> list[dict]:
    heuristics = load_heuristics()
    query = _tokens(problem)
    scored = []
    for paper in papers:
        title_tokens = _tokens(paper["title"])
        relevance = len(query & title_tokens) / len(query) if query else 0.0
        scores, taste = paper_scores(paper, heuristics)
        score = 100 * (0.75 * relevance + 0.25 * taste)
        scored.append(
            {
                **paper,
                "score": round(score, 3),
                "signals": {
                    "title_relevance": round(relevance, 6),
                    "taste": round(taste, 6),
                    **{name: round(value, 6) for name, value in scores.items()},
                },
            }
        )
    scored.sort(key=lambda paper: (-paper["score"], str(paper["paper_id"])))
    decisions = _apply_optimal_stopping(scored)
    selected = [
        {**paper, "h4": decisions.get(paper["paper_id"], "calibrate")}
        for paper in scored[: max(1, paper_count)]
    ]
    total = sum(paper["score"] for paper in selected) or 1.0
    for paper in selected:
        paper["probability"] = round(paper["score"] / total, 6)
    return selected


def _fraction(selected: list[dict], values: set[str]) -> float:
    if not selected:
        return 0.0
    return sum(str(paper["paper_id"]) in values for paper in selected) / len(selected)


def compute_urges(selected: list[dict], state: dict) -> dict:
    read_ids = {str(value) for value in state.get("read_paper_ids") or []}
    noted_ids = {str(value) for value in state.get("noted_paper_ids") or []}
    read_coverage = _fraction(selected, read_ids)
    note_coverage = _fraction(selected, noted_ids)
    hypotheses = state.get("hypotheses") or []
    experiments = state.get("experiments") or []
    hypothesis_ready = float(
        any(item.get("status") == "testable" for item in hypotheses)
    )
    runnable = float(any(item.get("status") == "runnable" for item in experiments))
    result_coverage = (
        sum(
            bool(item.get("result_recorded"))
            or item.get("status") in {"completed", "failed"}
            for item in experiments
        )
        / len(experiments)
        if experiments
        else 0.0
    )
    raw = {
        "read": 0.05 + 0.75 * (1.0 - read_coverage),
        "write": 0.05 + 0.65 * max(note_coverage, result_coverage),
        "execute": 0.05 + hypothesis_ready * (0.55 * runnable + 0.40 * read_coverage),
    }
    total = sum(raw.values())
    return {
        "urges": {key: round(value / total, 6) for key, value in raw.items()},
        "raw_urges": {key: round(value, 6) for key, value in raw.items()},
    }


def run_policy(
    problem: str,
    papers: list[dict],
    state: dict | None = None,
    paper_count: int = 5,
) -> dict:
    selected = rank_papers(problem, papers, paper_count)
    logger.info("finished scoring papers")
    logger.info("computing rwx decimals")
    urges = compute_urges(selected, state or {})
    return {
        "schema_version": "rwx.policy.v0",
        "problem": problem,
        "papers": selected,
        **urges,
        "policy_version": "heuristic-taste-v0",
    }
