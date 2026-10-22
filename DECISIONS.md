# Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Single Next.js (App Router, TS, Tailwind v4) app — UI + API routes | One deployable unit; fastest path in a 3×5h budget. |
| D2 | SQLite via built-in `node:sqlite` + FTS5, read-only, built offline by `scripts/build-db.ts` | No DB service to provision on Liara; no native addon downloads (slow/blocked networks); CSV import never runs on web startup. |
| D3 | DB file baked into the Docker image | Data is static for the hackathon; avoids disk/volume setup. Rebuild + redeploy to update. |
| D4 | Deploy on Liara (Docker platform) | Iranian judges; `*.vercel.app` is sometimes filtered in Iran. |
| D5 | LLM = BoxAPI `gpt-5.4-mini` with tool-calling; `respond` tool for structured final answer; rule-based fallback (`src/lib/intent.ts`) | Intelligence score; fast + cheap model; demo never breaks if the API is down. |
| D6 | Seller contact is a deterministic simulation (`src/lib/contact.ts`) with a visible demo control for the outcome | Dataset phone numbers are fake; deterministic = reproducible demo. |
| D7 | Neighborhood picker built from dataset `location_label` centroids | Location input without an external geocoding API/key. |
| D8 | Product/shop IDs exposed in the API are the dataset string IDs | Traceability to the supplied dataset (AC-003). |
| D9 | Client state (location, budget, shortlist, plan, contact results, chat) in zustand + localStorage | No accounts needed; state survives reloads; nothing personal stored server-side. |
