# AI_USAGE.md

## AI Tool Used
**Kiro** (Amazon) — used as the primary development collaborator throughout this project.

---

## How I Used It

Kiro was used to:
1. Scaffold all backend modules (auth, groups, expenses, balances, settlements, import)
2. Write the Prisma schema based on the architecture I designed
3. Generate the CSV validator and resolver logic
4. Build frontend components (React + Tailwind)
5. Write the SCOPE, DECISIONS, and README documents

I directed every step — specifying the architecture, anomaly policies, split type logic, and balance algorithm before asking Kiro to implement them.

---

## Cases Where the AI Produced Something Wrong

### Case 1 — Percentage split validation tolerance
**What Kiro generated:**
```typescript
if (Math.abs(totalPct - 100) > 1) { // 1% tolerance
```
**Problem:** A 1% tolerance on percentage splits is too loose. For a ₹48,000 rent payment, 1% = ₹480 — a significant amount that could be silently swallowed. Also, the Pizza Friday row has a 10% overage, which would pass a 1% tolerance and get auto-normalised when it should be flagged.

**Fix:** Changed to `> 0.1` (0.1% tolerance), which only covers floating-point noise and forces the Pizza Friday row to correctly trigger `A13_PERCENTAGE_NOT_100`.

---

### Case 2 — Balance calculation not accounting for settlements
**What Kiro generated:**
The first version of `balances.service.ts` computed balances only from `expenses` and `expense_splits`. It did not query the `settlements` table at all.

**Problem:** The "Rohan paid Aisha back ₹5000" row would be converted to a Settlement, but the balance calculation would still show Rohan owes Aisha ₹5000. The balances page would be wrong.

**Fix:** Added a settlements query and adjusted the balance accumulation — `settlement.paidById.paid += amount` and `settlement.paidToId.owed += amount`. This mirrors how a settlement flows: Rohan's debt decreases, Aisha's credit decreases.

---

### Case 3 — Stale member removal recalculated with wrong total
**What Kiro generated:**
In the resolver, when a stale member was removed from an equal split, the remaining participants were split using the original `totalInr`. The removed person's share was effectively unaccounted for.

**Example:** April groceries (₹2640, 4 people originally). Meera removed → 3 people. Kiro was splitting ₹2640 / 4 = ₹660 each for 3 people, leaving ₹660 unaccounted.

**Problem:** The total never changed — the 3 remaining people should each pay ₹2640/3 = ₹880.

**Fix:** After removing stale members, the active participant list is rebuilt before calling `computeSplits`. The total `amountInr` stays the same; the denominator changes. This is documented in `SCOPE.md` under A11.

---

## Key Prompts Used

1. *"Analyze the CSV. Find every deliberate data anomaly. Catalogue each one with its row number, problem description, category, and proposed handling policy. Do not generate code yet."*

2. *"Design a PostgreSQL schema for the shared expenses app. Every model must have a clear single responsibility. Include a time-bound membership table that answers 'was this user a member on this specific date?'"*

3. *"Write the balance calculation engine as a pure read-only module — no DB writes. The algorithm must produce simplified debts (minimum transactions to settle all balances). Explain the greedy algorithm in comments."*

4. *"The CSV import must be split into parser → validator → resolver → report stages. Each stage is a separate file. The validator must not write to the DB. The resolver must not do validation."*
