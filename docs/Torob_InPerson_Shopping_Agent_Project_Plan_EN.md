# Torob In-Person Shopping Agent — Project Analysis & Task Breakdown

> Language of implementation backlog: English. Product language: Persian (RTL).
> Important: Do not call paid hosted models during development. Any LLM integration is optional and disabled by default.

## Dataset inspection notes
- Uploaded archive contains `products.csv` (225,903 rows), `offers.csv` (331,506 rows), `shops.csv` (6,476 rows), plus README.
- `products.csv`: `product_id`, `persian_title`, `brand_name`, `category_name`, `model`, `specs`, `image_urls`.
- `offers.csv`: `offer_id`, `product_id`, `shop_id`, `price_toman`, `seller_title`, `description`, `warranty`, `last_price_changed_at`.
- `shops.csv`: `shop_id`, `name`, `category_names`, `address`, `location_label`, `lat`, `lon`, `weekly_hours`, `contacts`, `payment_options`, `supports_fast_delivery`, `website_url`, `instagram`.
- Treat JSON-looking CSV columns as untrusted strings; parse defensively.
- Per challenge notes: most shop names are synthetic, all phone numbers are fake, store coverage is selective, and an offer is not live stock confirmation.

## 0. Document purpose and operating rules

### P0-001 — Treat this as a build specification
Use this document as the implementation backlog and acceptance checklist. Do not silently skip tasks; if time is short, follow the priority labels and record deferred items.

### P0-002 — Keep all task tickets in English
Implementation tasks, code comments where useful, API contracts, test names, and agent prompts should be written in English. The end-user product must be Persian-first and right-to-left.

### P0-003 — Do not spend paid LLM credits during development
Do not make live calls to BoxAPI or any paid hosted model. Create a provider interface and a deterministic mock provider. Mark model-dependent tasks as MODEL-OPTIONAL and leave integration disabled by default.

### P0-004 — Do not misrepresent data
The dataset contains stale-ish offer data, mostly synthetic shop names, and fake phone numbers. Never imply a phone number is real or that stock/price was live-verified. Mock messaging/WhatsApp flows must be clearly labeled as simulated.

### P0-005 — Keep a working vertical slice
After each phase, keep the app runnable. Add migrations/seeds, tests, and a short README update with each meaningful feature.

## 1. Product goal and success criteria

### Goal
Build a Persian, mobile-first assistant that helps a person complete an in-person purchase in Tehran: clarify what to buy, discover and compare products, find nearby physical sellers, compare stores and visit conditions, and follow up with sellers through simulated messaging/WhatsApp workflows.

### Primary success path
User describes a need → assistant asks only useful clarifying questions → user sees product candidates and trade-offs → user selects a product or shortlist → nearby shops with offers are found → user filters/sorts shops → user checks address/hours/payment options → user requests price/stock/hours confirmation → simulated contact result is shown → if unavailable, stale, closed, or not found, useful alternatives are offered.

### Definition of done
A judge can complete the main path on a deployed URL from a mobile viewport without needing a developer. Product/store results come from the provided CSV dataset. Every price, location, opening-hours, financing, and verification claim has a visible evidence/status label.

### Score focus
Product 75, UX 75, intelligence 50, deployment 40, engineering 40, dataset use 20. Prioritize the product flow, clear UX, robust fallback behavior, and deployment over unnecessary infrastructure.

## 2. Dataset facts and data integrity rules

### DATA-001 — Input files
Use products.csv (225,903 rows), offers.csv (331,506 rows), shops.csv (6,476 rows). The observed columns are documented in DATA-002 through DATA-004. Keep the original files unchanged.

### DATA-002 — products.csv fields
product_id, persian_title, brand_name, category_name, model, specs, image_urls. Parse specs and image_urls as JSON strings defensively; malformed JSON must not crash ingestion.

### DATA-003 — offers.csv fields
offer_id, product_id, shop_id, price_toman, seller_title, description, warranty, last_price_changed_at. Offers connect products to shops and contain recorded price and last-change timestamp.

### DATA-004 — shops.csv fields
shop_id, name, category_names, address, location_label, lat, lon, weekly_hours, contacts, payment_options, supports_fast_delivery, website_url, instagram. Several fields are JSON strings and many are null.

### DATA-005 — Synthetic data warnings
6,364 of 6,476 shop names are synthetic according to the challenge notes; all phone numbers are fake. Only 112 shop names are non-synthetic and have a website or Instagram reference. Do not rely on names or phone numbers as verified real-world identity/contact data.

### DATA-006 — Coverage warning
The dataset is a selective subset of Tehran stores (challenge notes estimate about 10% coverage), and each store is capped at 300 products. No matching result does not prove a product is unavailable in Tehran.

### DATA-007 — Timestamp and price honesty
The challenge notes say offers were from the previous week; timestamps in the uploaded file should be parsed and displayed as supplied. Treat prices as recorded offers, not live quotes. If age is unknown or parsing fails, show 'Update time unavailable'.

### DATA-008 — Physical-store semantics
An offer is evidence that the dataset links a product to a shop; it is not proof of current stock. A shop's category alone is not evidence it carries a specific product.

### DATA-009 — Financing semantics
Read payment_options as structured data and map only explicit, supported values to financing/payment filters. Unknown/empty is 'Not specified', never 'No'. Distinguish in-person Torob Pay acceptance from other installment/credit options if represented.

### DATA-010 — Contact privacy
Only show contact channels that the challenge dataset/license and final rules permit. Since numbers are known fake, do not enable real outbound calls or suggest that an actual seller was contacted.

## 3. Proposed architecture and stack

### ARCH-001 — Web app
Use a responsive Persian RTL web app. Suggested default: Next.js + TypeScript + Tailwind CSS, with accessible components and server-side API routes. Equivalent stack is acceptable if the team already has a faster reliable starter.

### ARCH-002 — Backend API
Use typed REST endpoints or server actions with clear service boundaries: catalog, search, ranking, shops, geo, visit planning, contact simulation, recommendations, and analytics.

### ARCH-003 — Storage
For the hackathon, PostgreSQL is recommended if available; SQLite is acceptable for a simple single-instance deployment. Keep schema and repository code portable. Do not load all CSV rows into browser memory.

### ARCH-004 — Search
Start with PostgreSQL full-text/trigram or a local search index. Normalize Persian text before indexing. A vector database is optional, not required for the first successful release.

### ARCH-005 — Maps and distance
Use latitude/longitude from the dataset and Haversine distance. Render a map only if a dependable free/open map option is available and attribution is included. Always provide a usable list view as fallback.

### ARCH-006 — LLM boundary
Define an AssistantProvider interface with a deterministic rule-based implementation. Optional future model adapter may use OpenAI-compatible API settings, but it must be disabled by default and must not be invoked in tests or normal demo flows.

### ARCH-007 — Contact integration
Build a ContactAdapter interface with a deterministic mock implementation for WhatsApp/message follow-up. Do not send messages to fake numbers. If real WhatsApp is later added, require approved real contact data, credentials, explicit user confirmation, and an audit trail.

### ARCH-008 — Deploy
Deploy to Liara if credentials/availability are provided, otherwise use a dependable alternative. Include health check, environment variable validation, production build, and a short smoke-test script.

## 4. Functional backlog — ingestion, data quality, search

### DATA-101 — Inspect and profile CSVs (P0)
Record row counts, columns, null rates, duplicate IDs, orphan offer references, invalid coordinates, malformed JSON rates, invalid prices, and timestamp parse failures. Output a data-quality report.

### DATA-102 — Build robust importer (P0)
Create a repeatable import command. Use streaming/chunked CSV parsing for large files; support UTF-8 and Persian text; preserve original IDs and raw values.

### DATA-103 — Parse JSON fields safely (P0)
Parse products.image_urls, products.specs, shops.category_names, shops.contacts, shops.payment_options, shops.weekly_hours. On failure, preserve raw value and return an empty normalized structure plus a warning.

### DATA-104 — Normalize Persian search text (P0)
Normalize Arabic/Persian Yeh and Kaf, diacritics, tatweel, ZWNJ/whitespace, punctuation, Arabic/Persian digits, and case for Latin text. Keep display strings unchanged.

### DATA-105 — Create normalized relational schema (P0)
Create products, shops, offers tables with stable primary keys, foreign keys, useful indexes, nullable fields, and imported_at metadata. Store price as integer toman and timestamp as timezone-aware value.

### DATA-106 — Validate joins (P0)
Verify every offer references an existing product and shop. Report and skip or quarantine orphan records rather than failing the whole import.

### DATA-107 — Add seed/test fixture dataset (P0)
Create a tiny deterministic fixture with products, stores, offers, missing data, stale prices, malformed hours, financing options, and multiple stores for automated tests.

### SEARCH-101 — Product search API (P0)
Implement query, category, brand, min/max price, and pagination filters. Return product title, brand, category, image, specs summary, and matched fields.

### SEARCH-102 — Search ranking (P0)
Rank exact product ID/model/title and brand matches above partial token matches; use category and specs as secondary signals. Explain the match reason in the response.

### SEARCH-103 — Typo and synonym tolerance (P1)
Support common Persian spelling variations and a small editable synonym dictionary (e.g. colloquial product names). Do not silently broaden so far that unrelated results dominate.

### SEARCH-104 — Search empty state (P0)
When no product matches, offer query reformulations, nearby category choices, known relevant bazaars/market districts if confidence is reasonable, and a clear warning that dataset coverage is incomplete.

### SEARCH-105 — Product details (P0)
Show product images when available, brand/category, parsed specs, and number of dataset offers. Missing fields should be omitted or labeled, never fabricated.

### SEARCH-106 — Offer/store lookup (P0)
Given product_id, fetch all linked offers and shops with price, last price update, address, coordinates, hours, payment options, and data-confidence labels.

## 5. Functional backlog — assistant and product selection

### AGENT-101 — Define conversation state (P0)
Model the journey as explicit states: NEED_DISCOVERY, PRODUCT_RESULTS, PRODUCT_COMPARE, STORE_RESULTS, STORE_COMPARE, CONTACT_CONFIRMATION, ALTERNATIVES, VISIT_PLAN. Persist state per session.

### AGENT-102 — Intent and slot extraction (P0)
Extract product/category, use case, budget, brand preferences, must-have specs, location/radius, travel constraints, financing needs, visit time, and selected product/store. Use rules/forms first; model is optional.

### AGENT-103 — Ask focused clarifying questions (P0)
Ask one high-value question at a time only when it changes ranking materially. Provide quick replies and allow 'not sure' or skip.

### AGENT-104 — Preference capture UI (P0)
Use structured chips, sliders, dropdowns, and filters for budget, category, brand, specs, radius, financing, and open-at-visit-time. Do not force every step through chat.

### AGENT-105 — Recommendation rationale (P0)
Every recommendation must include short, grounded reasons such as 'within budget', 'matches selected brand', 'closest listed seller', or 'has an explicit financing flag'. Never claim personalized fit without a matching user preference.

### AGENT-106 — Product shortlist (P0)
Let users save/compare 2–4 products, remove candidates, change budget/preferences, and return to prior results without restarting.

### AGENT-107 — Product comparison (P0)
Build a comparison table/cards for price range, specs, brand, warranty when present, image, and availability of listed offers. Highlight differences, not just duplicate all details.

### AGENT-108 — Trade-off explanation (P1)
Summarize best-value, lowest recorded price, closest seller coverage, and strongest spec match as distinct options. Do not label one as objectively best without explaining criteria.

### AGENT-109 — Optional model adapter (MODEL-OPTIONAL)
Provide an interface and prompt contract for natural-language intent extraction or explanation. Do not call the provided BoxAPI/OpenAI-compatible endpoint during development/demo by default; use deterministic fixtures and rule-based fallback.

## 6. Functional backlog — nearby shops, comparison, visit planning

### GEO-101 — Location input (P0)
Allow user to type a Tehran neighborhood/address or use browser geolocation after permission. If location permission is denied, continue with neighborhood selection and a radius control.

### GEO-102 — Geocode policy (P1)
If geocoding is added, use a free/allowed provider with attribution, caching, rate limits, and graceful failure. Do not require an API key for the main demo path.

### GEO-103 — Distance calculation (P0)
Calculate straight-line distance from user coordinates to each shop with valid coordinates. Label it as approximate distance, not route distance or travel time.

### GEO-104 — Radius and area filters (P0)
Filter by selected radius/neighborhood; support quick radius changes (e.g. 1, 3, 5, 10 km) and update results without losing product selection.

### GEO-105 — Store cards (P0)
Show store name with a synthetic-data warning where appropriate, address, location label, approximate distance, listed price, price-update timestamp, hours status, payment options, and confidence labels.

### GEO-106 — Store comparison (P0)
Compare 2–4 stores by recorded price, distance, address specificity, declared hours, explicit financing, fast-delivery flag (secondary only), and data freshness. Keep unknowns visible.

### GEO-107 — Opening-hours parser (P0)
Parse weekly_hours defensively. Display declared schedule separately from real-time open status. If hours are missing or malformed, show 'Hours not provided'. Never infer 'open now' without reliable local time and valid hours.

### GEO-108 — Visit-time planning (P1)
Let the user choose intended visit day/time and filter stores that declare they should be open then. Label this as based on declared hours, not live confirmation.

### GEO-109 — Directions handoff (P1)
Offer an external map/directions link using coordinates/address when available. Do not claim exact indoor directions based on coordinates alone.

### GEO-110 — Mall/shop localization (P1)
Parse address text for mall, floor, unit, shop number, street, and landmark. Present the exact available address fragment. If indoor details are absent, say so and offer a message template asking the seller for floor/unit/landmark.

### GEO-111 — Bazaar fallback (P1)
When exact product/store results are empty or weak, recommend a relevant Tehran market/district only when the category-to-market association is well-grounded. Clearly label this as a general area suggestion, not a confirmed seller or stock listing.

### GEO-112 — Map/list fallback (P0)
If map tiles, geolocation, or third-party map service fails, the full store list, distance labels where possible, and address copy/open-in-map links must remain usable.

## 7. Functional backlog — contact, verification, alternatives

### CONTACT-101 — Message composer (P0)
Create a Persian message template that asks about exact product/model, current price, physical stock, color/size/spec variant, warranty, financing, opening hours, and precise in-mall location.

### CONTACT-102 — WhatsApp handoff (P0)
For the 112 stores with a supplied website/Instagram, display only verified dataset-provided public links. A WhatsApp deep link may be shown only when a valid, permitted real number is available; dataset phone values are fake, so do not generate WhatsApp links from them.

### CONTACT-103 — Mock contact workflow (P0)
Implement a clearly labeled simulation: user selects 'Simulate message', app shows queued/sent simulation, then a deterministic sample reply such as confirmed / price changed / unavailable / no response. Display 'Demo simulation — no real seller was contacted'.

### CONTACT-104 — Contact result states (P0)
Support CONFIRMED, PRICE_CHANGED, OUT_OF_STOCK, CLOSED, NO_RESPONSE, CONTACT_UNAVAILABLE, and UNKNOWN. Include timestamps and source/status labels.

### CONTACT-105 — Re-rank after reply (P0)
If price changes or stock is unavailable in a simulated reply, update the current recommendation set and offer comparable alternatives nearby. Keep original recorded offer and simulated reply distinct.

### CONTACT-106 — Follow-up reminders (P2)
Allow a local session reminder or copyable checklist to follow up before leaving. Do not build notification infrastructure unless time remains.

### ALT-101 — Similar product alternatives (P0)
Find alternatives by category, brand/spec similarity, budget, and user constraints. Exclude hard conflicts such as wrong size/compatibility when the data supports detecting them.

### ALT-102 — Nearby seller alternatives (P0)
If a store is closed, too far, lacks explicit financing, has no response, or is unavailable, show next-best stores for the same product with reasons.

### ALT-103 — Relax constraints interactively (P0)
Offer user-controlled relaxations: expand radius, increase budget, allow another brand, broaden specs, remove financing requirement only with explicit consent, or show general market districts.

### ALT-104 — No-result recovery (P0)
Never dead-end. Explain which constraint caused zero results when possible, show one-click relaxation actions, and preserve the user's original criteria.

### ALT-105 — Alternative explanation (P1)
For each fallback, say what changed versus the original request (e.g. same category but different brand; same model farther away; nearby market district rather than confirmed shop).

## 8. Functional backlog — financing, reviews, external enrichment

### PAY-101 — Financing filter (P0)
Parse payment_options and distinguish explicit supported financing/credit options from empty or unknown data. A strict financing filter must return only stores with explicit matching evidence.

### PAY-102 — Unknown payment state (P0)
Display 'Not specified in dataset' for missing payment options; do not interpret missing as unsupported.

### PAY-103 — Torob Pay distinction (P1)
If data explicitly identifies in-person Torob Pay acceptance, show it separately from generic installment/credit options. Do not infer it from a generic payment label.

### REV-101 — Review/quality signals (P1)
There is no supplied review dataset. Build an honest review panel with 'No verified review data supplied' unless an approved external source is implemented.

### REV-102 — External research adapter (P2)
Design a pluggable enrichment interface for product specifications or reviews from permitted sources. Keep it off by default until source policy, rate limits, attribution, and legal access are reviewed.

### REV-103 — External result provenance (P2)
If external enrichment is added, show source name, retrieval time, and whether information is official, community-sourced, or inferred. Never blend external review sentiment into dataset facts without labeling.

### REV-104 — Manufacturer/spec enrichment (P2)
Optionally enrich incomplete product specs from manufacturer pages for a small demo subset. Cache results and retain source URLs. Do not scrape sites that disallow it.

## 9. UX, visual design, accessibility

### UX-101 — Design system (P0)
Create consistent tokens for spacing, typography, borders, colors, elevations, status chips, and card layouts. Use a calm shopping-oriented visual style and avoid a generic chat-only interface.

### UX-102 — RTL and Persian typography (P0)
Set document direction to RTL, use Persian-capable fonts, ensure mixed Latin model numbers and prices render correctly, and test punctuation/number alignment.

### UX-103 — Mobile-first layouts (P0)
Optimize for narrow screens, touch targets, sticky filters where useful, readable comparison cards, and no horizontal overflow.

### UX-104 — Main journey screen (P0)
Provide a prominent search/need input, suggested intents, preference chips, progress/step indicator, and a visible way to edit constraints.

### UX-105 — Result cards (P0)
Design product and store cards with clear hierarchy, images when available, key attributes, status badges, price freshness, and one primary next action.

### UX-106 — Status language (P0)
Use distinct labels for 'Recorded offer', 'Updated at', 'Stock not verified', 'Simulated reply', 'Hours declared', 'Unknown', and 'Synthetic store name' where relevant.

### UX-107 — Loading/error/empty states (P0)
Design skeletons, recoverable errors, no-results guidance, missing-image placeholders, and API-offline states. Preserve user input when requests fail.

### UX-108 — Accessible controls (P1)
Ensure keyboard focus, semantic labels, contrast, screen-reader names, and reduced-motion support. Do not encode status only by color.

### UX-109 — Onboarding/demo hints (P1)
Include a small demo prompt and explain that seller contact is simulated. Avoid long onboarding that blocks the main path.

### UX-110 — No forced chat-only workflow (P0)
Ensure filters, compare actions, chips, and cards let users progress without typing every follow-up into chat.

## 10. Backend, API, observability and security

### API-101 — Define contracts (P0)
Document request/response schemas and validation for search, product details, offers, store search, compare, assistant turn, contact simulation, and health.

### API-102 — Validate inputs (P0)
Validate query length, numeric ranges, radius, pagination, IDs, and enums. Return useful 4xx errors instead of server crashes.

### API-103 — Pagination and limits (P0)
Paginate large product/store result sets and cap compare list size. Avoid returning all 225k products or 331k offers in one response.

### API-104 — Caching (P1)
Cache stable product details and normalized search results where useful; invalidate/reload after data import. Do not cache user-specific location or contact state globally.

### API-105 — Logging (P0)
Log request IDs, endpoint latency, import errors, and unexpected exceptions without logging sensitive user text or precise location unnecessarily.

### API-106 — Health/readiness (P0)
Expose health and readiness endpoints that check app process and database connectivity. Include dataset version/import timestamp in diagnostics.

### SEC-101 — Secrets (P0)
Use environment variables for database credentials and future provider keys. Never commit .env files, API keys, or production credentials.

### SEC-102 — Safe outbound actions (P0)
No real outbound messages/calls in the demo. Any future real contact action must show destination, message preview, consent, and explicit send confirmation.

### SEC-103 — External URL safety (P1)
Validate website/Instagram URLs and allow only http/https. Avoid rendering untrusted HTML from CSV fields.

### SEC-104 — Privacy controls (P1)
Do not persist precise geolocation beyond the session unless required and consented. Provide a manual-location alternative.

## 11. Testing and quality gates

### TEST-101 — Unit tests for normalization (P0)
Cover Persian/Arabic character variants, whitespace/ZWNJ, digit conversion, punctuation, empty strings, and Latin model numbers.

### TEST-102 — Import tests (P0)
Cover malformed JSON, nulls, duplicate IDs, orphan offers, invalid prices, invalid coordinates, and timestamp timezone conversion.

### TEST-103 — Search/ranking tests (P0)
Verify exact match beats partial match, filters are honored, pagination is stable, and zero results return recovery metadata.

### TEST-104 — Financing tests (P0)
Verify strict financing filter excludes unknown/empty payment_options and includes only explicit qualifying records.

### TEST-105 — Freshness/status tests (P0)
Verify old or missing price timestamps are labeled correctly and offers are never presented as live stock confirmation.

### TEST-106 — Geo tests (P0)
Verify distance calculations, invalid-coordinate handling, radius filtering, and stable sorting.

### TEST-107 — Contact simulation tests (P0)
Verify each simulated state, disclaimer, timestamps, and alternative recommendations. Assert no real external network call is made.

### TEST-108 — End-to-end main path (P0)
Automate: search need → choose product → compare offers → set location/radius → compare stores → simulate message → handle unavailable/no-response → choose alternative.

### TEST-109 — E2E edge paths (P1)
Test no product result, no nearby store, geolocation denied, missing hours, missing images, financing-only search, stale price, store closed at planned visit time, and API/database failure.

### TEST-110 — Responsive/RTL QA (P0)
Manually test mobile and desktop viewports, Persian and Latin mixed strings, cards, comparison, filters, modal/dialog focus, and map/list fallback.

### TEST-111 — Demo seed scenario (P0)
Provide reproducible scenarios and a reset command so the judges see deterministic results rather than random mock responses.

## 12. Deployment and demo readiness

### DEP-101 — Environment configuration (P0)
Create .env.example with documented variables and safe defaults. Validate required production values at startup.

### DEP-102 — Production build (P0)
Run type-check, lint, unit tests, and production build in CI or a documented script. The app must not depend on development-only server behavior.

### DEP-103 — Database migration/import (P0)
Add a repeatable migration and import job. Avoid running the full CSV import on every web server startup.

### DEP-104 — Deploy to Liara (P0)
Configure app/service, build command, start command, environment variables, database, persistent storage if needed, and health check. Keep deployment instructions in README.

### DEP-105 — Deployment fallback (P1)
If Liara setup is blocked, deploy to an available stable platform and document the reason. Never let platform setup prevent a local working demo.

### DEP-106 — Smoke test (P0)
After deployment, verify health endpoint, product search, offer/store results, contact simulation, and a full mobile journey against production data.

### DEP-107 — Resilience (P1)
Handle cold starts, database connection failures, missing map provider, and slow external services without blank screens. Main shopping flow must work without external APIs.

### DEP-108 — Demo script (P0)
Prepare a 3–5 minute judge walkthrough and a backup screen recording or screenshots. Include a reset path and known limitations.

## 13. Expanded scenario matrix

### SCN-001 — User knows exact model
Exact model query → product detail → seller offers → nearest/cheapest/financing filters → contact simulation.

### SCN-002 — User knows category but not model
Ask use-case/budget/spec questions → recommend a small product shortlist → explain trade-offs → let user compare.

### SCN-003 — Product not found
Try normalized/synonym search → suggest broader category/alternate terms → show related products → optionally suggest a relevant market district with uncertainty label.

### SCN-004 — No seller for selected product nearby
Expand radius → show farther sellers → offer same-product alternative sellers → offer similar products → market-district fallback.

### SCN-005 — Price appears stale
Show recorded price and last-change time → offer simulated message asking for current price → if changed, update comparison using simulated reply and preserve original price as history.

### SCN-006 — Stock not confirmed
Explicitly show stock unverified → prompt seller inquiry → simulated confirmed/unavailable/no-response outcomes → branch to alternatives.

### SCN-007 — Seller does not respond
Show no-response status, do not claim contact succeeded in reality → offer another seller for same product and a retry/copy-message option.

### SCN-008 — Store is closed or hours missing
Use declared hours only → filter for planned visit time → show unknown hours clearly → recommend another store declared open at that time.

### SCN-009 — User needs installment/credit
Strict explicit financing filter → explain evidence → if none, offer radius/brand/budget changes, but never silently remove financing requirement.

### SCN-010 — Store inside a mall is hard to find
Extract mall/floor/unit/shop number from address → show copyable address and landmark → provide a message asking for exact entrance/floor/unit.

### SCN-011 — User has no location permission
Manual neighborhood/address input → radius-based search if coordinates can be obtained → otherwise area-based results with no fake distance.

### SCN-012 — User changes budget/location late
Retain product and preferences → edit one filter → refresh stores and ranking without resetting conversation.

### SCN-013 — Incomplete specs or no reviews
Show available specs only → disclose missing specs/review data → optionally show source-attributed enrichment if implemented.

### SCN-014 — Dataset name is synthetic
Show store location and offer data as dataset records; warn that name/contact identity is not verified; do not suggest contacting a fake phone number.

### SCN-015 — Map/API/database failure
Keep list/search/compare working, show a recoverable message, and avoid blocking the main journey.

## 14. Work split for a two-person implementation team

### Builder A — Data/backend/search
Own DATA-101..107, SEARCH-101..106, API-101..106, GEO-103/107 where shared backend logic is needed, PAY-101..103, tests for data/search, and backend deployment readiness.

### Builder B — UX/frontend/journey
Own UX-101..110, AGENT-103..108 UI integration, GEO-101/104/105/106/109/110/112 presentation, CONTACT-101..105 UI, alternatives UX, RTL/responsive QA, and end-to-end journey.

### Shared ownership
Agree on schemas and API contracts before parallel implementation. One person owns integration/release. Both review the other person's pull requests and run the demo path.

### Suggested cadence
Day 1: inspect data, lock UX flow, scaffold app, API contracts. Day 2: import/search/product cards and preference flow. Day 3: stores/geospatial/filter/compare. Day 4: contact simulation, alternatives, edge states. Day 5: testing, visual polish, deploy, demo rehearsal. Adjust to actual hackathon time.

## 15. Prioritization and implementation order

### Must ship (P0)
CSV import and relational joins; Persian-normalized search; product shortlist/compare; offer-to-store discovery; radius/location filters; store comparison; honest price freshness and stock status; explicit financing filter; mock messaging/WhatsApp workflow; alternative recovery; mobile RTL UI; automated main-path tests; deployed working URL.

### Should ship (P1)
Synonyms/typo tolerance; visit-time filter; address parsing for mall/floor/unit; map/directions handoff; bazaar fallback; manufacturer/review enrichment adapter; accessibility polish; caching and resilient provider fallbacks.

### Stretch (P2)
Follow-up reminders, external review enrichment, broad external web research, advanced semantic/vector retrieval, real messaging integrations. These must not jeopardize P0 delivery.

### Implementation rule
Do not start with a complex multi-agent LLM architecture. First make deterministic search, ranking, state transitions, and mock contact work end-to-end. Add a model only where it produces a measurable improvement and can fall back safely.

## 16. Acceptance checklist for final judging

### AC-001
A Persian-speaking user can complete the primary journey without instructions from the team.

### AC-002
Both product discovery and physical-store discovery/comparison are implemented.

### AC-003
Products and offers are connected by IDs from the supplied dataset; no invented products or stores are used as dataset results.

### AC-004
The UI clearly distinguishes recorded offer price, last update, unverified stock, declared hours, unknown data, and simulated contact.

### AC-005
Financing-only results require explicit positive dataset evidence.

### AC-006
No-result, closed-store, stale-price, unavailable-product, and no-response paths provide useful alternatives.

### AC-007
Shop addresses expose available mall/floor/unit details without inventing indoor directions.

### AC-008
The app works when geolocation is denied and when maps/external APIs are unavailable.

### AC-009
The dataset import and test suite are repeatable; no paid model call is made by default.

### AC-010
The deployed URL passes the smoke test and the demo is rehearsed with deterministic scenarios.

## 17. Agent handoff template

### Use this template for each implementation ticket
Task ID and title; objective; context; inputs/files; exact implementation steps; API/schema changes; edge cases; tests; acceptance criteria; dependencies; explicit non-goals; report of files changed and commands run.

### Prompt safety for coding agents
Tell the agent to inspect the existing repository before changing it, follow established conventions, avoid broad rewrites, never use live paid-model calls, never fabricate seller verification, and run relevant tests before reporting completion.
