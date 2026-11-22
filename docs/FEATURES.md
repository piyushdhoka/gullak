# Gullak features

## Shipped in this release (Android + iOS PWA, same code)

| Feature | Where | How |
|---|---|---|
| Automatic capture | iPhone: Shortcut → `/ingest`. Android: reads SMS (see ANDROID.md) | `packages/core` parser |
| AI categories | every payment the owner hasn't categorised before | Qwen3 0.6B (SemIf-style option scoring), see below |
| One-tap Review | payments the model wasn't sure about | `resolve_review`, remembered per payee |
| Dashboard | Summary tab: spent, received, daily average, projection, vs last month, categories, merchants | `apps/mobile/src/lib/stats.ts` (tested) |
| Trend | last 6 months bar chart + average | `trend()` |
| Subscriptions & repeats | home card + full screen: monthly total, next expected date | `recurringPayments()` |
| Budgets | per-category monthly limits, "left", "over", "on pace to go over" | `budgets` table + `budgetProgress()` |
| Cash / manual payments | "+" on the home screen | `add_manual_transaction` |
| Delete account | Settings | `delete_my_account` (everything cascades) |

All maths runs in the shared app code from the transactions the app already holds, so Android and iPhone
always show the same numbers, offline included.

## How the AI categorises (no rules, no merchant lists)

1. If you've picked a category for this payee before, that's it (your choice always wins).
2. Otherwise the model gets the payment and a lettered list of the 14 categories with short descriptions,
   and we read the probability it gives each letter (SemIf / openjev "semantic if"). One forward pass.
3. If its best letter is at least 60% likely, that's the category (`category_source = 'model'`).
   Otherwise the payment goes to Review, and your one tap becomes the rule for that payee.

Model: **Qwen3 0.6B** (smallest SemIf model, 4-bit GGUF, ~400 MB) on llama.cpp's `llama-server`, on the
EC2 box (`infra/llm-setup.sh`). The fixed instructions are cached, so only the new payment is processed.

## AI features next (the unique part)

The model already runs next to the data. These build on it, cheapest first.

1. **"Why?" on every category** (S). Show the model's top 3 options with probabilities on the payment
   screen ("Food 72%, Groceries 18%"). Makes the AI transparent and one tap fixes it.
2. **Learns from you, not just per payee** (M). Few-shot: put your last ~10 corrections into the prompt
   ("You said BHARAT MEDICOS is Health"), so similar shops land right first time.
3. **Ask Gullak** (M). Chat over your own data: "How much on chai this month?", "What did Goa cost?".
   The model turns questions into calls to our stats functions (tool use), never raw SQL, never raw SMS.
4. **Money diary** (S). Each evening one line written by the model: "₹640 today, mostly Zepto. Food is
   ₹800 under budget this week." Push notification, opt-in.
5. **Smart anomaly notes** (S). "₹2,000 to a new payee at 2 am" or "Netflix went up from ₹499 to ₹649":
   rule finds it, the model explains it in plain words.
6. **Natural-language cash entry** (S). Type or say "chai 20, auto 60" → two cash payments, categorised.
7. **Receipt / bill photo → payment** (L). Camera on Android; small vision model or Claude for parsing.
8. **On-device model on Android** (L). Same Qwen3 0.6B GGUF in the app (llama.rn), so categorising
   works offline and nothing leaves the phone.
9. **Goal jars with AI nudges** (M). "Goa trip ₹30,000 by March": model suggests weekly amounts from your
   real spending and tells you which category to cut.
10. **Hinglish everything** (S). Model replies and notifications in Hinglish if you prefer it.

## Not doing for now
Generic finance features (net worth, tax, bills, splitting) stay out until the AI pieces above are solid.
