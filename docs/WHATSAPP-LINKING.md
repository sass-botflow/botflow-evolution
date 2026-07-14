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
curl -s https://www.botflow.ink/api/health | python3 -m json.tool  # buildTime jdid?
```

---

## ⚠️ QR ma kaytl3ach — 3lach deploy 11 sec ma kayfixich

Ila katban **"Evolution API offline"** + **"Generating QR code..."** bqa twila:

| Check | Daba | Khass |
|-------|------|-------|
| Evolution public | ✅ 200 | OK |
| Frontend build | ❌ `5b209f3` (9dim) | Build jdid |
| Deploy time | ❌ 11 sec = restart | **5–10 d9aya** |
| Frontend PR #66 | ❌ ma mergedch | **Merge obligatoire** |
| `qrcode` npm | ❌ ma kaynach f main | PR #66 kayzidha |
| URL order f code | ❌ public URL lwl | PR #66 kaybdl l internal |

**Deploy 11 secondes = ma tbdlch code.** Frontend mazal kayst3mel version 9dima li:
1. Katjarreb `https://evolution.api.botflow.ink` **qbel** internal Docker URL → Cloudflare HTML/timeout → **"Evolution API offline"**
2. Ma 3ndha `qrcode` package → Evolution pairing code `2@...` ma kaytrenderch QR image

**Ma kaynach fix b env ghir** — khass **merge PR #66** + **deploy ma9ad**.

### Fix (3 clics + stana 10 d9aya)

1. **Merge:** https://github.com/sass-botflow/frontend/pull/66
2. **Easypanel → frontend → Environment:**

   ```env
   EVOLUTION_API_URL=http://evolution-api:8080
   EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY dyal botflow-evolution>
   BACKEND_API_URL=http://sass-botflow_backend:8000
   ```

3. **Easypanel → frontend → Deploy** (Source = GitHub) — **stana 5–10 d9aya**
   - Ila tssala f < 1 min → ma deployatich build jdid
4. Verif:

   ```bash
   curl -s https://www.botflow.ink/api/health | python3 -m json.tool
   ```

   `buildTime` khass ykon **daba** (mashi 30h 9dim)

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
