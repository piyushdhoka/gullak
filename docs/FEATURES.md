# Gullak: feature brainstorm

What today's finance apps do, what our bank-SMS data makes possible, and what we should build next.
Gullak has one unfair advantage: **every bank already texts every payment**. We get near-complete data
with no bank login, no Account Aggregator consent and no typing.

## 1. What modern finance apps do (2025–26)

| App | What people like about it | Fits Gullak? |
|---|---|---|
| **Axio (ex-Walnut)**, India | SMS-based tracking, bill reminders, "safe to spend" | Closest to us. Shows SMS works at scale. |
| **Fold / Jupiter / Fi**, India | Account Aggregator sync, smart categories, money "pots" | AA needs a licensed partner; SMS gets most of the value free. |
| **CRED**, India | Card bill due dates, "money insights", rewards | Bill and due-date SMS give us this. |
| **INDmoney**, India | Net worth, SIP tracking, US stocks | SIP debits and balances come from SMS. |
| **Copilot / Monarch**, US | Beautiful review flow, recurring-payment calendar, rules | Our Review screen + recurring detection. |
| **YNAB**, US | Envelope budgeting: "give every rupee a job" | Budgets per category (table ready). |
| **Rocket Money**, US | Finds subscriptions, cancels them | Recurring detection (built), cancel guides later. |
| **Cleo**, UK/US | Chat with your money, roasts, nudges | "Ask Gullak" over our own data. |
| **Splitwise** | Shared expenses | P2P UPI transfers to friends are already in the data. |

## 2. What the SMS data can tell us

Every captured SMS gives: amount, direction, payee/VPA, bank, account last-4, UPI ref, time, and often the
**available balance**. Bank SMS we currently skip also hold gold: **card statements and due dates**,
**failed and reversed payments**, **EMI and mandate** notices.

## 3. Feature ideas, by value

Legend: **Data** = what it needs. **Effort**: S / M / L.

### Ready now (backend shipped in v2)
| Feature | What the user sees | Data | Status |
|---|---|---|---|
| Month dashboard | Spent, received, per-day average, vs last month, by category, top merchants, daily chart | transactions | `month_summary()` |
| Trend | Last 6–36 months, average month | transactions | `spending_trend()` |
| Subscriptions & recurring | "Netflix ₹649, next ~12 Dec", rent, SIPs, EMIs | same payee, similar amount, 3+ months | `recurring_payments()` |
| Account balances | Balance per bank account, no bank login | "Avl Bal" in SMS | `account_balances` view |
| Budgets | Monthly limit per category, progress in the month summary | budgets table | table + summary field |
| Own categories | "Office lunch", "Pet", with emoji and colour | categories table | `list_categories()` |
| Tags / trips | Tag spends "Goa 2026"; trip total | `tags[]` | column + index |
| Export | CSV of any date range | transactions | `export_transactions()` |
| Delete account | One tap, everything gone | – | `delete_my_account()` |

### Next (high value, small or medium effort)
1. **Bill & due-date reminders** (M). Parse statement SMS ("Total Amt Due Rs 12,340, due 05-12") into a
   `bills` table, push 3 days and 1 day before. Mark paid automatically when the card payment SMS arrives.
2. **Safe to spend today** (S). (Budget or average month − spent − upcoming recurring) ÷ days left.
   One number on the home screen.
3. **Refund & failed-payment tracker** (M). Debit followed by "reversed/refund" for the same ref or amount.
   Show pending refunds older than 5 days so nothing gets lost.
4. **Unusual spend alerts** (S). Amount over 3× the payee's usual, a new merchant above ₹5,000,
   or two identical charges within 10 minutes (double debit).
5. **Salary & payday view** (S). Detect the monthly salary credit; show the "month" from payday to payday.
6. **Weekly digest push** (S). Sunday 8 pm: "₹4,210 this week, 12% less than usual. Biggest: Zepto."
7. **Gullak jars (goals)** (M). Named goals ("Goa trip ₹30,000") with a target date; count SIP or transfer
   debits to a chosen account towards them. Fits the piggy-bank brand.
8. **Split with friends** (M). P2P UPI to a person you also receive from → suggest "settle up"; share a
   UPI collect link.
9. **Cash & UPI Lite** (S). Quick-add sheet with recent amounts; ATM withdrawals become a cash wallet
   that manual spends draw down.

### Later (bigger bets)
10. **Investments view** (M). SIP debits (Groww, Zerodha, ICCL) → monthly invested, streaks. Holdings
    need CAS statement import (email PDF), not SMS.
11. **Tax helper** (M). ELSS SIPs (80C), health insurance (80D), rent payments (HRA) collected for March.
12. **Trip planner** (L). Pick a past trip tag, see the cost breakdown, set a budget for the next one,
    live spend vs plan while travelling.
13. **Ask Gullak** (M). Chat over your own data ("how much on food in Diwali week?") using Claude with
    tool calls into our SQL functions. Never sends raw SMS, only aggregates.
14. **Auto-categorising unknown payees with AI** (S). Claude Haiku for readable payee names the rules
    miss, with confidence threshold (pipeline hook already exists: `CLASSIFIER_URL`).
15. **Family / shared gullak** (L). Two people share one budget; each keeps private accounts.
16. **Net worth** (L). Balances + investments + manually added assets and loans.
17. **Home-screen widgets** (M, Android first). Today's spend, safe-to-spend.

### Android-specific (because Android can read SMS itself)
- **Import past months** on first launch (up to ~2 years of SMS): instant history, instant insights.
- **No setup**: one permission, no capture address, no Shortcut.
- **Offline**: parse on the phone with `@gullak/core`, queue, upload when online.

## 4. Privacy promises to keep
- Only messages that look financial leave the phone; others are dropped unstored (already true).
- No ads, no selling data, export and delete always available.
- AI features see aggregates, not raw SMS, and are opt-in.

## 5. Suggested order
1. Android app with SMS import (biggest jump in data quality)
2. Bill reminders + safe-to-spend + unusual-spend alerts
3. Jars (goals) + weekly digest
4. Trips + Ask Gullak
