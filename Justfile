set shell := ["bash", "-uc"]

# Show available tasks
default:
    @just --list

# Install Python dependencies
sync:
    uv sync

# Resolve graphs/corpus/paper-dump.md into Postgres (needs DATABASE_URL)
ingest:
    uv run gate graphs/corpus/paper-dump.md

# Select top-k papers and read/write/execute urges
policy problem:
    uv run rwx-policy "{{problem}}"

# Ingest, then run the policy
run problem: ingest
    uv run rwx-policy "{{problem}}"

# Run corpus tests
test:
    uv run python -m unittest discover -s tests

# Lint and format check
lint:
    uv run ruff check graphs tools tests
    uv run ruff format --check graphs tools tests

# Start N DeepSeek pears waiting for manual assignments; reopen an existing room
[positional-arguments]
pears count="3" room="manual-pears":
    @cd torrent && node --env-file-if-exists=.env.local --import tsx scripts/orchestrator.ts start "$1" --room "$2" --deepseek

# Reopen a DeepSeek room
[positional-arguments]
pears-attach room="manual-pears":
    @cd torrent && node --env-file-if-exists=.env.local --import tsx scripts/orchestrator.ts attach --room "$1" --deepseek

# Restart a DeepSeek room with N pears (clears their conversation histories)
[positional-arguments]
pears-restart count="3" room="manual-pears":
    @cd torrent && node --env-file-if-exists=.env.local --import tsx scripts/orchestrator.ts restart "$1" --room "$2" --deepseek

# Stop a DeepSeek room
[positional-arguments]
pears-stop room="manual-pears":
    @cd torrent && node --env-file-if-exists=.env.local --import tsx scripts/orchestrator.ts stop --room "$1" --deepseek
