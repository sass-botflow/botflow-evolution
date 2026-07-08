# WhatsApp QR fix — Qunvert-style linking

## Chno kayn daba

1. **Cloudflare error** — frontend kayrj3 502 → Cloudflare kay7ebssha b HTML page
2. **Evolution URL ghalat** — `sass-botflow_botflow-evolution:8080` ma kaynch
3. **QR ma kayban** — Evolution v2.3.7 kayrj3 format jdid (`code` / nested `qrcode`)

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
