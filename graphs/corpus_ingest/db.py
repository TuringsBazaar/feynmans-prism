from __future__ import annotations

from pathlib import Path

import psycopg

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def sync_papers(database_url: str, papers: list[dict]) -> int:
    if not papers:
        raise ValueError("refusing to empty the papers table from an empty import")
    urls = [paper["url"] for paper in papers]
    with psycopg.connect(database_url) as connection:
        connection.execute(SCHEMA_PATH.read_text())
        for paper in papers:
            connection.execute(
                """
                INSERT INTO papers (
                    doi, title, url, abstract, publication_year,
                    cited_by_count, has_code, taste_score
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    doi = EXCLUDED.doi,
                    title = EXCLUDED.title,
                    abstract = EXCLUDED.abstract,
                    publication_year = EXCLUDED.publication_year,
                    cited_by_count = EXCLUDED.cited_by_count,
                    has_code = EXCLUDED.has_code,
                    taste_score = EXCLUDED.taste_score,
                    updated_at = NOW()
                """,
                (
                    paper.get("doi"),
                    paper["title"],
                    paper["url"],
                    paper.get("abstract"),
                    paper.get("publication_year"),
                    paper.get("cited_by_count"),
                    paper.get("has_code", False),
                    paper["taste_score"],
                ),
            )
        connection.execute("DELETE FROM papers WHERE NOT (url = ANY(%s))", (urls,))
    return len(papers)


def fetch_papers(database_url: str) -> list[dict]:
    with psycopg.connect(database_url) as connection:
        rows = connection.execute(
            """
            SELECT id, doi, title, url, abstract, publication_year,
                   cited_by_count, has_code, taste_score
            FROM papers
            ORDER BY id
            """
        ).fetchall()
    return [
        {
            "paper_id": row[0],
            "doi": row[1],
            "title": row[2],
            "url": row[3],
            "abstract": row[4],
            "publication_year": row[5],
            "cited_by_count": row[6],
            "has_code": row[7],
            "taste_score": row[8],
        }
        for row in rows
    ]
