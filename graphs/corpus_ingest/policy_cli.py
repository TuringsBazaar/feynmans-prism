from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

import yaml

from .db import fetch_papers
from .policy import load_questions, run_policy

logger = logging.getLogger("rwx-policy")


def _render(result: dict) -> str:
    lines = [result["problem"], "", "probability distribution over papers"]
    for paper in result["papers"]:
        lines.append(f"  {paper['probability']:.4f}  {paper['title']}  [{paper['h4']}]")
    lines.append("")
    lines.append("rwx decimals")
    for key in ("read", "write", "execute"):
        lines.append(f"  {key:<8}{result['urges'][key]:.4f}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(
        prog="rwx-policy",
        description="Select corpus papers and calculate read/write/execute urges",
    )
    parser.add_argument(
        "problem", nargs="?", help="research problem or current question"
    )
    parser.add_argument(
        "--questions", help="optional Markdown file of research questions"
    )
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--state", help="optional YAML research-state file")
    parser.add_argument("--paper-count", type=int, default=5)
    parser.add_argument("--output", help="optional JSON output path")
    args = parser.parse_args(argv)
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")
    if not args.problem and not args.questions:
        parser.error("a problem argument or --questions is required")
    state = yaml.safe_load(Path(args.state).read_text()) if args.state else {}
    if not isinstance(state, dict):
        raise TypeError("research state must be a YAML mapping")
    papers = fetch_papers(args.database_url)
    questions = load_questions(args.questions) if args.questions else [args.problem]
    results = []
    for question in questions:
        logger.info("fetched question: %s", question)
        result = run_policy(
            question,
            papers,
            state=state,
            paper_count=args.paper_count,
        )
        results.append(result)
        print(_render(result))
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        payload = results[0] if len(results) == 1 else results
        output.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
