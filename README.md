# همراه خرید — دستیار خرید حضوری تهران

دستیار هوشمند فارسی و موبایل‌محور برای خرید حضوری از فروشگاه‌ها و پاساژهای تهران، روی دیتاست ترب (هکاتون ترب × استارکوچ).

**چهار گام:** ۱) کمک به انتخاب محصول/مدل ← ۲) پیدا کردن فروشگاه‌های حضوری نزدیک ← ۳) مقایسه فروشگاه‌ها (قیمت ثبت‌شده، فاصله، ساعت اعلامی، خرید قسطی، آدرس داخل پاساژ) ← ۴) پیگیری از فروشنده (شبیه‌سازی) + جایگزین‌یابی + برنامه مراجعه.

## Features
- Conversational agent (BoxAPI `gpt-5.4-mini`, OpenAI-compatible tool-calling) over our own tools: product search, shop finder, comparison, alternatives. Automatic rule-based fallback when the LLM is unavailable.
- Structured UI: chips for budget / installment, radius, sort, visit-time, compare trays — no forced chat.
- Persian full-text search (SQLite FTS5 + Persian normalization + small synonym list).
- Shop finder with approximate distance, declared opening hours at the planned visit time, strict installment filter (per provider), mall / floor / unit extraction from addresses, directions links (Neshan / Balad / Google).
- Simulated seller follow-up (price, stock, hours, installment, exact in-mall location) with explicit "simulated" labels, then one-click alternatives (next seller, bigger radius, similar products).
- Visit plan: nearest-neighbour stop order, follow-up status per stop, copyable checklist.
- Data honesty: recorded price vs. last update vs. unverified stock vs. simulated reply are always labeled separately; missing data is shown as "ثبت نشده".

## Run locally
```bash
npm install
npm run data:extract          # unzips torob-dataset.zip into data/raw/
npm run data:build            # builds data/torob.db (+ data/quality-report.json)
cp .env.example .env.local    # optional: add BOXAPI_API_KEY
npm run dev
```
Requires Node ≥ 22.13 (uses built-in `node:sqlite`, no native addons).

## Tests
```bash
npm test                      # unit tests (normalization, parsers, geo, intent, contact simulation)
npm run smoke -- http://localhost:3000   # API smoke test against a running server
```

## Deploy (Liara)
The app ships as a Docker image (`Dockerfile`, `liara.json`). The database is built locally and copied into the image.
```bash
npm run data:build
npm i -g @liara/cli && liara login
liara env set BOXAPI_API_KEY=... --app hamrah-kharid   # or via the Liara panel
liara deploy --app hamrah-kharid
npm run smoke -- https://hamrah-kharid.liara.run
```

## Data notes
- Most shop names and all phone numbers in the dataset are synthetic → we never show phone numbers or real call/WhatsApp links. Shops with a website/Instagram are marked "نام تأییدشده".
- Offers are about a week old; prices are "recorded", never "live". An offer is not proof of stock.
- Installment filter only keeps shops with explicit `payment_options`; empty = "ثبت نشده", not "ندارد".
- Coverage is partial (~10% of Tehran shops, ≤300 products per shop) — "no result" never means "not available in Tehran".

See `PROGRESS.md` and `DECISIONS.md` for status and architecture decisions.
