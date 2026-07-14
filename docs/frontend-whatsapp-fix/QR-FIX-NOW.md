# WhatsApp QR fix — Qunvert-style linking

## Chno kayn daba

1. **Cloudflare error** — frontend kayrj3 502 → Cloudflare kay7ebssha b HTML page
2. **Evolution URL ghalat** — `sass-botflow_botflow-evolution:8080` ma kaynch
3. **QR ma kayban** — Evolution v2.3.7 kayrj3 format jdid (`code` / nested `qrcode`)

## Fix "Evolution API offline" (QR ma kayban)

Modal kayban = connect OK. **"Evolution API offline"** = frontend Docker **ma kaywslch** l Evolution men dakhel.

Evolution public (`https://evolution.api.botflow.ink`) khdam men browser, walakin **frontend container** khass URL **dakheli** (Docker network).

### Step 1 — L9a smiya dyal container (Easypanel Terminal / SSH)

```bash
docker ps --format '{{.Names}}' | grep -i evolution
```

Example output: `sass-botflow_botflow-evolution-evolution-api-1` or `botflow-evolution_evolution-api`

### Step 2 — Frontend Environment

EasyPanel → **frontend** → Environment:

```env
EVOLUTION_API_URL=http://botflow-evolution_evolution-api:8080
EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY dyal botflow-evolution>
```

Ila `docker ps` 3tak smiya okhra, use:
```env
EVOLUTION_API_URL=http://<container-name-without-port>:8080
```

**Mohim:** `EVOLUTION_API_KEY` = **character b character** nfs `AUTHENTICATION_API_KEY` f `botflow-evolution`.

### Step 3 — Verify frontend 3la nfs network

Frontend w `botflow-evolution` khass ykon 3la network **`easypanel`**.

F Easypanel → frontend → Networks (ila kayn) → verify `easypanel` project network.

### Step 4 — Redeploy frontend

Save → Deploy → jarreb Connect.

### Step 5 — Test connectivity (optional)

Men Easypanel terminal, exec f frontend container:

```bash
docker exec -it $(docker ps -q -f name=frontend | head -1) wget -qO- --header="apikey: YOUR_KEY" http://botflow-evolution_evolution-api:8080/
```

Khass yrj3: `Welcome to the Evolution API`

---

## Fix sri3 — EasyPanel frontend Environment (bla code)

Zid/verify had vars w **Save → Redeploy frontend**:

```env
EVOLUTION_API_URL=https://evolution.api.botflow.ink
EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY dyal botflow-evolution>
BACKEND_API_URL=http://sass-botflow_backend:8000
NEXT_PUBLIC_API_URL=https://api.botflow.ink
```

**Mohim:** `EVOLUTION_API_KEY` = **nfs** `AUTHENTICATION_API_KEY` f `botflow-evolution`.

Jarreb Connect. Ila ba9i error, dir Fix 2.

---

## Fix 2 — Frontend code (QR b7al Qunvert)

Copy files men `docs/frontend-whatsapp-fix/v2/` l `sass-botflow/frontend`:

| File | Destination |
|------|-------------|
| `evolution-server.ts` | `src/lib/whatsapp/evolution-server.ts` |
| `evolution-bff-service.ts` | `src/lib/whatsapp/evolution-bff-service.ts` |
| `whatsapp-bff.ts` | `src/lib/whatsapp/whatsapp-bff.ts` |
| `easypanel.env.example` | `easypanel.env.example` |

Plus f `package.json` zid dependency:
```json
"qrcode": "^1.5.4"
```
devDependency: `"@types/qrcode": "^1.5.5"`

Push l `main` → EasyPanel → **frontend** → Deploy (5 min).

---

## Flow (b7al Qunvert)

1. User → **Connect WhatsApp Business**
2. Frontend → Evolution API → create instance
3. QR modal → scan b WhatsApp (Linked Devices)
4. Status → CONNECTED

---

## Verify

```bash
curl -s https://www.botflow.ink/api/health | python3 -m json.tool
```

Khass:
- `evolutionBff: true`
- `evolutionUrls` fih `https://evolution.api.botflow.ink`

Ba3d Connect, QR ghadi yban f modal.
