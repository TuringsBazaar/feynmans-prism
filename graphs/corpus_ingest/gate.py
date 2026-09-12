from __future__ import annotations

import argparse
import json
import logging
import os

from .corpus import parse_markdown, resolve_papers
from .db import sync_papers

logger = logging.getLogger("gate")


def run(
    source_paths: list[str],
    database_url: str | None,
    *,
    dry_run: bool = False,
    max_workers: int = 4,
    timeout: float = 15.0,
) -> dict:
    """The gate: move papers from the dump(s), through arxiv, into postgres."""
    # way 1 — dump: parse each rough markdown into seeds + expansion sources
    seeds = []
    expansion_count = 0
    for source in source_paths:
        logger.info("computing among %s", source)
        parsed = parse_markdown(source)
        seeds.extend(parsed.papers)
        expansion_count += len(parsed.expansion_sources)
    # way 2 — arxiv: resolve each seed into canonical metadata
    papers, skipped = resolve_papers(seeds, max_workers=max_workers, timeout=timeout)
    # way 3 — db: reconcile the papers table to the resolved set
    written = False
    if not dry_run:
        if not database_url:
            raise ValueError("DATABASE_URL is required unless --dry-run is used")
        sync_papers(database_url, papers)
        written = True
    logger.info("wrote %d papers to the table (%d skipped)", len(papers), len(skipped))
    return {
        "paper_count": len(papers),
        "skipped": skipped,
        "expansion_source_count": expansion_count,
        "database_written": written,
    }


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(
        prog="gate",
        description="Resolve rough Markdown paper dumps into the PostgreSQL papers table",
    )
    parser.add_argument(
        "source",
        nargs="+",
        default=["graphs/corpus/paper-dump.md"],
        help="rough Markdown corpus source(s)",
    )
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument(
        "--dry-run", action="store_true", help="resolve without writing PostgreSQL"
    )
    parser.add_argument("--max-workers", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=15.0)
    args = parser.parse_args(argv)
    try:
        summary = run(
            args.source,
            args.database_url,
            dry_run=args.dry_run,
            max_workers=args.max_workers,
            timeout=args.timeout,
        )
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
