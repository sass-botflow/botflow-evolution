# WhatsApp Linking — Sass Botflow (Qunvert-style QR scan)

Complete fix for **Evolution API offline** + QR not showing.

## Architecture

```
User → botflow.ink (frontend) → Evolution API → WhatsApp Web QR → Scan → CONNECTED
```

## Current status check

```bash
curl -s https://evolution.api.botflow.ink/                    # Evolution OK?
curl -s https://www.botflow.ink/api/channels/whatsapp/diagnostics  # Frontend → Evolution?
curl -s https://api.botflow.ink/health                        # Backend OK?
```

---

## Step 1 — Redeploy botflow-evolution (network aliases)

Pull latest `docker-compose.yml` from this repo. It adds Docker network aliases:

- `evolution-api`
- `sass-botflow-evolution-api`

EasyPanel → **botflow-evolution** → Redeploy (with latest compose).

Verify env:

```env
SERVER_URL=https://evolution.api.botflow.ink
AUTHENTICATION_API_KEY=<your-secure-key>
```

---

## Step 2 — Frontend Environment (CRITICAL)

EasyPanel → **frontend** → Environment:

```env
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<EXACT same as AUTHENTICATION_API_KEY in botflow-evolution>
BACKEND_API_URL=http://sass-botflow_backend:8000
NEXT_PUBLIC_API_URL=https://api.botflow.ink
JWT_SECRET=<same as backend>
```

**Do NOT use** `https://evolution.api.botflow.ink` for `EVOLUTION_API_URL` on frontend — use internal Docker URL.

Remove or comment out `EVOLUTION_WEBHOOK_URL` until backend is running.

---

## Step 3 — Restart backend (api.botflow.ink)

Backend is currently **DOWN** (502). EasyPanel → **backend** → **Restart** or **Deploy**.

Minimum env:

```env
JWT_SECRET=<32+ chars>
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<same as AUTHENTICATION_API_KEY>
```

---

## Step 4 — Deploy frontend (real build)

EasyPanel → **frontend**:

1. Source → **GitHub** → `sass-botflow/frontend` → branch `main`
2. **Deploy** — wait **5–10 minutes** (not 2 seconds)
3. Verify:

```bash
curl -s https://www.botflow.ink/api/health | python3 -m json.tool
```

Expected:

```json
{
  "evolutionBff": true,
  "evolution": { "ok": true, "baseUrl": "http://evolution-api:8080" }
}
```

---

## Step 5 — Test linking (b7al Qunvert)

1. Open `https://botflow.ink/dashboard/channels`
2. Click **Connect WhatsApp Business**
3. QR code appears in modal
4. Phone → WhatsApp → Settings → Linked Devices → Scan QR
5. Status → **CONNECTED**

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Evolution API offline | Set `EVOLUTION_API_URL=http://evolution-api:8080` on frontend, redeploy evolution compose |
| Evolution API key invalid | `EVOLUTION_API_KEY` must match `AUTHENTICATION_API_KEY` exactly |
| Generating QR forever | Deploy latest frontend (generates QR from pairing code) |
| Cloudflare gateway error | Use internal URLs, not public HTTPS for server-side calls |
| Backend 502 | Restart backend service in Easypanel |

## Diagnostics URL

```
https://www.botflow.ink/api/channels/whatsapp/diagnostics
```

Should show `"evolution": { "ok": true }`.
