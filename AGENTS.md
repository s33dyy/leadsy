## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## machine safety

This project is developed on an 8 GB Mac and can hang when several Codex chats, Docker, browser automation, and Next/Turbopack run together.

Rules:
- Treat `/Users/pratikchoudhuri/Documents/leadsy` as the canonical working path. It is a real local directory, not the external SSD copy.
- Before starting a dev server, check whether port `3000` is already listening. Reuse the existing server when possible.
- Run only one Leadsy dev server at a time. Do not leave extra `next dev`, `next build`, `npm`, `screen`, or browser verification sessions running.
- Use `npm run dev` for local development. It intentionally runs `next dev --webpack`; do not run bare `next dev` or Turbopack dev because it previously panicked/hung the machine.
- Keep `npm run build` as the production build command.
- Do not run `npm run typecheck`, `npm run lint`, `npm run build`, Docker Compose, and browser automation all at the same time. Run them sequentially unless the user explicitly asks for speed over stability.
- Prefer `npm run typecheck` and `npm run lint` before `npm run build`; build is heavier.
- Avoid repeated full browser checks. Verify with source/API first, then do one browser pass only when needed.
- If a command hangs, inspect and stop the specific stuck process before launching another copy.
- Docker is optional for most UI work. Do not start `docker compose up` unless the task needs Postgres/Redis or Docker validation.
- Local data lives in `data/app`, Postgres data in `data/postgres`, and Redis data in `data/redis`; do not create duplicate hidden data stores.
- The external SSD copy is archival only. Do not start dev servers from `/Volumes/Pratik's SSD/Projects/leadsy`.
- Keep status updates concise and mention when a process is intentionally left running.

## commit and ci/cd handoff

Every code or documentation change must leave the local machine in a server-visible state unless the user explicitly asks for a local-only commit.

Rules:
- Before committing application code, run verification sequentially in this order unless the change is docs-only: `npm run typecheck`, `npm run lint`, relevant focused `npm run test:*` commands, then `npm run build` when UI/app behavior changed.
- For docs-only changes, at minimum run `git diff --check` before committing.
- After every successful commit, immediately push the current branch to `origin` with upstream tracking if needed: `git push -u origin HEAD`.
- After pushing, verify the commit reached the remote with `git ls-remote --heads origin "$(git branch --show-current)"` or `git status -sb`.
- Do not tell the user work is complete unless the commit hash and push status are known. If push fails, report the failure plainly and include the exact next action needed.
- Never leave local-only commits at the end of a task unless the user explicitly requested that.
- Keep commits atomic and small; if a change needs multiple commits, push after each commit so CI/CD can run on every increment.
- Do not push directly to `main`; work on a feature branch and let the remote CI/CD pipeline validate it before merge/deploy.
