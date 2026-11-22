# Setup

Production: **https://gullak.sparkstudio.co.in** on an EC2 instance (Amazon Linux 2023,
user `ec2-user`; set `GULLAK_HOST` and `GULLAK_KEY` locally before deploying).

```
iPhone Shortcut ──HTTPS──► Caddy (443, Let's Encrypt) ──► gullak server (127.0.0.1:8787)
                                                           ├─ /ingest, /api/*   (Node 24 + Hono)
                                                           ├─ SQLite  /var/lib/gullak/gullak.db
                                                           └─ the web app       /opt/gullak/dist
```

## One-time, outside the code

1. **DNS (Hostinger → Domains → sparkstudio.co.in → DNS / Nameservers → Manage DNS records):**
   add `A` record, Name `gullak`, Points to the instance IP, TTL 300.
2. **AWS security group** of the instance (EC2 → Instances → Security → Security groups → Edit
   inbound rules): add **HTTP 80** and **HTTPS 443** from `0.0.0.0/0` (and `::/0`). Keep SSH 22
   limited to your IP if possible.
3. Optional but recommended: give the instance an **Elastic IP** so the address survives a
   stop/start (then update the DNS record to it).

Caddy retries the certificate automatically; once DNS and ports are right it's live within minutes.

## Deploy / update

From the project folder on Windows:

```powershell
.\deploy\deploy.ps1
```

Builds the web app, uploads app + server, and runs `infra/remote-setup.sh` on the instance
(idempotent: installs Node 24, Caddy, swap, the `gullak` systemd service). Data in
`/var/lib/gullak` is never touched by a deploy. Config lives in `/etc/gullak/env`.

Useful on the server:

```bash
sudo systemctl status gullak caddy
sudo journalctl -u gullak -f
ls /var/lib/gullak/backups      # daily SQLite backups, last 14 kept
```

## First use on the iPhone

1. Open https://gullak.sparkstudio.co.in in **Safari** → Share → **Add to Home Screen**. Open it from the icon.
2. **Create Account**: the first account becomes the owner; sign-up then closes.
3. **Setup** tab → Turn On Notifications → Create Capture Key → copy the key and server address.
4. Shortcuts → Automation → **+** → **Message** → Message Contains: a single space →
   **Run Immediately**, Notify When Run off → New Blank Automation → **Get Contents of URL**:
   - URL: `https://gullak.sparkstudio.co.in/ingest`
   - Method: POST
   - Headers: `x-capture-key` = your key
   - Request Body: JSON — `text` = Shortcut Input (Content), `received_at` = Current Date
5. Setup tab → **Send Test SMS**.

Messages that don't look like bank SMS are dropped without being stored. UPI Lite payments
usually send no SMS.

## How categories are decided

1. Your own choice for that payee (one tap in **Review**, or “Remember for this payee”).
2. Known merchants (Swiggy, Zepto, Uber, IRCTC, …).
3. Signals: credit → Income/Refund, ATM → Cash, mobile-number VPA or `UPI/P2A` → Transfers,
   shop words in a readable name (MEDICAL → Health, KIRANA → Groceries, DHABA → Food, …).
4. Optional model — **only** for readable names, and only above `CLASSIFIER_MIN_CONFIDENCE` (0.6).
5. Otherwise **Review**: QR codes / IDs (`paytmqr…`, `Q4829…`, `BHARATPE…`) are never guessed; you
   pick once and every past and future payment to that payee follows.

## Optional classifier

Set in `/etc/gullak/env` and `sudo systemctl restart gullak`:

```
CLASSIFIER_URL=http://127.0.0.1:8090/classify
CLASSIFIER_TOKEN=<shared secret>
```

Contract (1.5 s timeout; failures are ignored):

```
POST { "payee": "SHREE GANESH ENTERPRISES", "vpa": null, "direction": "debit", "text": "<sms>" }
→    { "category": "Shopping", "confidence": 0.74 }
```

`confidence` is the model's probability for that option among the allowed categories (e.g.
softmax over option logits). The instance has ~1 GB RAM, so only a very small model (Qwen3 0.6B
quantised) fits next to the app.

## Local development

```powershell
npm run server    # API on http://localhost:8787 (server/.env)
npm run web       # app on http://localhost:8081 (uses .env.development)
npm test
npm run typecheck
```
