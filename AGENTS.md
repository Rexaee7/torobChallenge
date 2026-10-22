# Rules for coding agents

- Task source of truth: `docs/Torob_InPerson_Shopping_Agent_Project_Plan_EN.md`; status in `PROGRESS.md`; architecture in `DECISIONS.md`.
- Inspect existing code before changing it; no broad rewrites. Keep the app runnable after every step.
- Shared contracts live in `src/lib/types.ts`. Changing them = record it in `DECISIONS.md`.
- Server-only code is under `src/lib/server/` (imports `server-only`). Pure logic (parsers, normalize, contact simulation) lives in `src/lib/` and is unit-tested in `tests/`.
- Never commit `.env*` files or API keys. The LLM key is only set as a Liara env var.
- Never present dataset prices as live, offers as stock, declared hours as guaranteed, or simulated replies as real. Never show dataset phone numbers.
- Run `npm test` and `npm run typecheck` before committing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
