PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  question TEXT NOT NULL,
  task TEXT NOT NULL,
  config TEXT NOT NULL CHECK (json_valid(config)),
  status TEXT NOT NULL DEFAULT 'ready',
  owner_pid INTEGER,
  owner_host TEXT,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  answer TEXT
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  paper_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  abstract TEXT NOT NULL,
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  relevance REAL NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
  body TEXT,
  content_hash TEXT,
  fetched_at TEXT,
  UNIQUE (id, content_hash)
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('search','fetch','extract','verify','follow')),
  target TEXT NOT NULL,
  source_id INTEGER REFERENCES sources(id),
  parent_id INTEGER REFERENCES actions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','uncertain')),
  eta REAL NOT NULL CHECK (eta > 0 AND eta <= 1),
  request TEXT CHECK (request IS NULL OR json_valid(request)),
  response TEXT CHECK (response IS NULL OR json_valid(response)),
  selection TEXT CHECK (selection IS NULL OR json_valid(selection)),
  reserved_tokens INTEGER NOT NULL DEFAULT 0,
  used_tokens INTEGER,
  usage TEXT CHECK (usage IS NULL OR json_valid(usage)),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  reward REAL NOT NULL DEFAULT 0 CHECK (reward >= 0 AND reward <= 1),
  UNIQUE (kind, target)
);
CREATE TABLE IF NOT EXISTS central_arguments (
  source_id INTEGER PRIMARY KEY REFERENCES sources(id),
  action_id INTEGER NOT NULL UNIQUE REFERENCES actions(id),
  content_hash TEXT NOT NULL,
  graph TEXT NOT NULL CHECK (json_valid(graph)),
  review TEXT CHECK (review IS NULL OR json_valid(review)),
  status TEXT NOT NULL DEFAULT 'unreviewed',
  FOREIGN KEY (source_id, content_hash) REFERENCES sources(id, content_hash)
);
CREATE TABLE IF NOT EXISTS open_questions (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES central_arguments(source_id),
  item_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('author_stated','inferred')),
  limitation_node TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (json_valid(evidence)),
  status TEXT NOT NULL DEFAULT 'unreviewed',
  UNIQUE (source_id, item_id)
);
CREATE TABLE IF NOT EXISTS related_papers (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES central_arguments(source_id),
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('cited','follow_up')),
  rationale TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (json_valid(evidence)),
  status TEXT NOT NULL DEFAULT 'unreviewed',
  UNIQUE (source_id, item_id)
);
CREATE TABLE IF NOT EXISTS trails (
  transition TEXT PRIMARY KEY,
  pheromone REAL NOT NULL CHECK (pheromone >= 0.05 AND pheromone <= 10)
);
CREATE TABLE IF NOT EXISTS tree_nodes (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES tree_nodes(id),
  node_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  source_id INTEGER REFERENCES sources(id),
  data TEXT NOT NULL CHECK (json_valid(data)),
  origin TEXT NOT NULL CHECK (origin IN ('executor','user')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tree_parent ON tree_nodes(parent_id, id);
