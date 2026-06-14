# DECISIONS.md — Engineering Decision Log

Each entry follows: **Decision → Options Considered → Why I Chose This**.

---

## 1. Balance calculation: store `amount_inr` on every expense

**Decision:** At write time, convert and persist `amount_inr` alongside the original `amount + currency`.

**Options considered:**
- A. Store original amount only; convert at query time on every balance calculation.
- B. Store `amount_inr` at write time using the exchange rate effective on the expense date.

**Why B:** Option A requires fetching exchange rates on every balance read and recomputing every time a rate is updated. Option B gives deterministic, reproducible results: the conversion is locked to the rate that was valid when the expense happened. Priya's concern ("the sheet pretends a dollar is a rupee") is fixed by this — the USD Goa expenses are converted at 84.5 INR/USD and that figure never changes retroactively.

---

## 2. Exchange rates: manual entry, not a live API

**Decision:** Exchange rates are stored in the DB and entered manually (or via seed). No external API calls.

**Options considered:**
- A. Fetch from a live FX API (Open Exchange Rates, etc.) on every import.
- B. Store rates manually, seeded at startup.

**Why B:** A live API introduces a network dependency, an API key, rate-limiting risk, and non-reproducible results (the rate on a given date can be revised). For this assignment, using a known rate (84.5 INR/USD for 2026) is correct and fully explainable in a live session. The `effective_date` column means we can add historical rates if needed.

---

## 3. Duplicate detection: exact + near, with different policies

**Decision:** Exact duplicates (same date + payer + amount + description) are auto-skipped. Conflicting duplicates (same date + payer, similar description, different amounts) are held PENDING.

**Options considered:**
- A. Auto-skip all duplicates based on exact match only.
- B. Two-tier: auto-skip exact, hold conflicting for user review.

**Why B:** The Thalassa dinner case (rows 23 and 24) has two different amounts logged by two different people — auto-skipping either is a silent data change. Meera's requirement ("I want to approve anything the app deletes or changes") applies here. The user sees both rows and picks one.

---

## 4. Settlement detection: signal-based, not a separate CSV column

**Decision:** Detect settlement rows by checking: (a) `split_type` is blank AND (b) description or notes contain settlement keywords.

**Options considered:**
- A. Require a dedicated `is_settlement` column in the CSV format.
- B. Infer from existing data signals.

**Why B:** We cannot edit the CSV (assignment rule). The "Rohan paid Aisha back" row has blank `split_type` and the note "this is a settlement not an expense??" — two strong signals. This approach handles the data as-is.

---

## 5. Time-bound membership: `joined_at` + `left_at` on `group_memberships`

**Decision:** Store join and leave dates on the membership record. Balance calculation respects these dates.

**Options considered:**
- A. Boolean `is_active` flag — simpler but loses date information.
- B. `joined_at` + `left_at` — full temporal record.

**Why B:** Sam's requirement ("I moved in mid-April, why would March electricity affect my balance?") requires knowing the exact date. A boolean flag can't answer that. With `left_at`, when Meera's post-March appearances in splits are detected during import, we can flag them precisely.

---

## 6. Rounding: `distributeEqually` puts remainder on first person

**Decision:** When splitting ₹100 equally among 3 people, the result is [33.34, 33.33, 33.33]. The remainder paisa goes to the first person in the array.

**Options considered:**
- A. Round each share independently → risk of sums not matching total.
- B. Compute N-1 shares, derive the last one as `total - sum(others)`.
- C. Add remainder to first person.

**Why C:** Options A and B both have tradeoffs. C is the simplest rule to explain, produces exact sums, and is documented as a single function (`distributeEqually` in `utils/rounding.ts`). If the rounding rule needs to change, there is exactly one place to change it.

---

## 7. Guest users for unknown CSV members

**Decision:** When a CSV row references a person not in the group (e.g. "Dev's friend Kabir"), create a guest `User` record with `is_guest = true` and add them to the group.

**Options considered:**
- A. Reject the row entirely.
- B. Ignore the unknown person and split only among known members.
- C. Create a guest account.

**Why C:** Option A loses real expense data. Option B silently changes the split amounts, which violates the "handle deliberately rather than silently" requirement. Option C preserves the data exactly and lets the user decide later whether to merge the guest with a real account or leave them as-is.

---

## 8. Percentage anomaly: hold PENDING instead of normalising

**Decision:** If percentages don't sum to 100%, hold the row PENDING rather than auto-normalising.

**Options considered:**
- A. Auto-normalise: scale each percentage proportionally so they sum to 100.
- B. Hold PENDING and require user correction.

**Why B:** The Pizza Friday row (30+30+30+20 = 110%) has a note saying "percentages might be off." Silently changing the numbers would alter financial data without consent. The user needs to decide what the correct percentages are — that's a product decision, not a math operation.

---

## 9. Import pipeline: 4-stage separation (parser → validator → resolver → report)

**Decision:** Split the import logic into four clearly named files with no cross-dependencies.

**Why:** Each stage is independently explainable:
- `parser.ts` — "reads bytes, returns rows, does nothing else"
- `validator.ts` — "checks every row against rules, returns anomalies, writes nothing"
- `resolver.ts` — "applies policies and writes to DB"
- `report.ts` — "reads session + anomalies and formats output"

This makes it possible to point at any file in a live session and explain its full responsibility in one sentence.
