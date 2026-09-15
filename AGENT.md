# STYLE

- Reduce complexity through minimizing the three variables here
  - Reduce change amplification: Seemingly simple changes require code modifications in many different places
  - Reduce cognitive load: 
    - There needs to be a simple file structure so any developer or agent can understand entire repo within 30 seconds
  - Limit unknown unknowns: It's not obvious which pieces of code must be modified to complete a task
- Deep modules: Complex implementations should be hidden behind simple interfaces with sensible defaults that work for the most common use cases. Reduce the number of places where exceptions must be handled
- No authored function may exceed 35 physical lines, including comments, blank lines, and callbacks. oxlint enforces this.
- No authored source file may exceed 300 lines. Aim below 200 when the responsibilities divide naturally. The source-file check includes Astro, CSS, JavaScript, TypeScript, scripts, and tests.
- Comments should be used to explain things that can’t be expressed in code, like the rationale for why a certain decision was made.
- Agents can communicate with each other through a centralized discord channel
- Agents can write to CHANGELOG.md and CONTEXT.md. Human will write to AGENT.me and DESIGN.md
- Funding. Keep track of the token costs according to openrouter per day of development
- Prefer mutually exclusive, collectively exhaustive domain boundaries. Be precise. Names should be borrowed from physics, cs, engineering or cognitive science.
- Compare existing tools by features, complexity, community size and date published
- Use `pnpm add` for TypeScript dependencies and `uv add` for Python dependencies.
- Use oxlint and Prettier for TypeScript and Ruff for future Python research.
- Run Python through `uv run`, never bare `python` or `python3`.
- Observability: Track model-fitting runs in Weights & Biases; use Cloudflare observability for runtime operations.
- Place run instructions in `README.md` after each significant update
- Do not remove user comments in any scripts
- Put representative visual output in `examples`; keep scratch output untracked.
- Never commit plaintext secrets. Use committed `.env.op` references after the
  1Password CLI is installed and the relevant vault items exist.
- Pause after a stage and update the README with minimal edits.
- Do not automatically commit or deploy after a stage.


Verification
- uv sync + Python tests pass with slim deps.
- pnpm -C torrent lint / typecheck / test green
- Smoke: two pnpm -C torrent pear terminals → first shows coordinator · aman, second gets guillefix; space join reflects as 1 peer on the other side; pnpm -C torrent message -- hi appears in both feeds; q un-announces (no ghost via pgrep -fl pear.tsx). node torrent/scripts/guillefix.cjs pears still interoperates.
- under 500 ms network latency
- Orchestrator falls back to Terminal.app windows (tmux isn't installed here) — verify that path.
