# SCOPE.md — Anomaly Log & Database Schema

## Database Schema

### Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt, 12 rounds |
| is_guest | BOOLEAN | true for unknown CSV members |
| created_at | TIMESTAMP | |

#### `groups`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| description | VARCHAR nullable | |
| created_by_id | UUID FK → users | |
| created_at | TIMESTAMP | |

#### `group_memberships`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| user_id | UUID FK → users | |
| joined_at | DATE | When they joined |
| left_at | DATE nullable | null = still active |

This table is the answer to Sam's question ("why would March electricity affect my balance?").
Expenses dated before `joined_at` or after `left_at` do not affect this user's balance.

#### `exchange_rates`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| from_currency | VARCHAR(3) | e.g. "USD" |
| to_currency | VARCHAR(3) | e.g. "INR" |
| rate | DECIMAL(18,6) | e.g. 84.5 |
| effective_date | DATE | Most recent rate on/before expense date is used |
| source | VARCHAR | "manual" |
| created_at | TIMESTAMP | |

#### `expenses`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| description | VARCHAR | |
| amount | DECIMAL(18,2) | In original currency |
| currency | VARCHAR(3) | "INR" or "USD" |
| amount_inr | DECIMAL(18,2) | Always computed at import time |
| paid_by_id | UUID FK → users | |
| split_type | ENUM | equal, unequal, percentage, share |
| expense_date | DATE | |
| is_settlement | BOOLEAN | true if this was converted from a settlement row |
| notes | TEXT nullable | |
| import_row_index | INT nullable | null for manually entered expenses |
| created_by_id | UUID FK → users | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `expense_splits`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| expense_id | UUID FK → expenses | |
| user_id | UUID FK → users | |
| share_value | DECIMAL(18,6) nullable | Raw input (null for equal) |
| computed_amount_inr | DECIMAL(18,2) | Final INR amount this person owes |
| is_settled | BOOLEAN | default false |

#### `settlements`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| paid_by_id | UUID FK → users | |
| paid_to_id | UUID FK → users | |
| amount | DECIMAL(18,2) | |
| currency | VARCHAR(3) | |
| amount_inr | DECIMAL(18,2) | |
| settlement_date | DATE | |
| notes | TEXT nullable | |
| created_at | TIMESTAMP | |

#### `import_sessions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| filename | VARCHAR | |
| imported_by_id | UUID FK → users | |
| imported_at | TIMESTAMP | |
| status | ENUM | pending, complete, failed |
| row_count | INT | |
| imported_count | INT | |
| skipped_count | INT | |
| anomaly_count | INT | pending rows |

#### `import_anomalies`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → import_sessions | |
| row_index | INT | 0-based CSV row |
| raw_row | JSONB | original CSV row preserved |
| anomaly_code | VARCHAR | e.g. "A01_EXACT_DUPLICATE" |
| severity | ENUM | info, warning, error |
| description | TEXT | human-readable |
| resolution_policy | TEXT | documented policy |
| action_taken | TEXT | what happened |
| resulting_expense_id | UUID nullable FK → expenses | |

---

## Anomaly Catalogue

All 15+ deliberate data problems found in `expenses_export.csv`:

| Code | Row(s) | Problem | Severity | Policy |
|---|---|---|---|---|
| A01_EXACT_DUPLICATE | 5 & 6 | "Dinner at Marina Bites" logged twice by Dev on 08-02-2026, same amount ₹3200 | warning | Skip second row. First is imported. |
| A02_SETTLEMENT_AS_EXPENSE | 13 | "Rohan paid Aisha back" — no split_type, settlement keywords in notes | warning | Convert to Settlement record, not Expense. |
| A03_COMMA_IN_AMOUNT | 7 | Electricity Feb: amount `"1,200"` (quoted, comma-formatted) | info | Strip comma, parse as 1200. |
| A04_SUB_PAISA_PRECISION | 9 | Cylinder refill: amount `899.995` (3 decimal places) | info | Round to ₹900.00. |
| A05_NAME_MISMATCH | 11 | "Priya S" in paid_by and split_with — not an exact match to "Priya" | warning | Fuzzy-match to "Priya". Flag for user confirmation. |
| A06_UNKNOWN_MEMBER | 23 | "Dev's friend Kabir" in split_with for Parasailing | warning | Create guest account for Kabir. Flag for merge. |
| A07_CONFLICTING_DUPLICATE | 23 & 24 | "Dinner at Thalassa" (Aisha, ₹2400) vs "Thalassa dinner" (Rohan, ₹2450) — same date, similar name | error | Hold both as PENDING. User must choose which to keep. |
| A08_NONSTANDARD_DATE | 27 | Airport cab date: `Mar-14` instead of `DD-MM-YYYY` | warning | Parse as 14 March (contextual year). Flag. |
| A09_MISSING_CURRENCY | 28 | Groceries DMart: currency field is blank | warning | Default to INR. Flag. |
| A10_ZERO_AMOUNT | 31 | Dinner order Swiggy: amount is 0, notes say "counted twice earlier" | info | Skip row entirely. Log as placeholder. |
| A11_STALE_MEMBER_IN_SPLIT | 36 | 02-04-2026 Groceries: Meera (left end of March) still in split_with | warning | Remove Meera, recalculate equal split among remaining 3. |
| A12_AMBIGUOUS_DATE | 33 | Deep cleaning service: `04-05-2026` — could be April 5 or May 4 per notes | warning | Apply DD-MM-YYYY convention → April 5. Flag. |
| A13_PERCENTAGE_NOT_100 | 14 | Pizza Friday: 30+30+30+20 = 110%, notes say "might be off" | error | Hold as PENDING. Cannot normalise without changing intent. |
| A14_SPLIT_TYPE_DETAILS_CONFLICT | 44 | Furniture: split_type=equal but split_details has share-style values | warning | split_type wins. Details ignored. Flag. |
| A15_MISSING_PAYER | 20 | House cleaning supplies: paid_by is blank | error | Hold as PENDING. Cannot import without payer. |
| A16_NEGATIVE_AMOUNT | 26 | Parasailing refund: amount is -30 USD | info | Treat as refund expense. Store as negative amount_inr. |
