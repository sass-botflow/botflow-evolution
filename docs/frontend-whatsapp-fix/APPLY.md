# Frontend fix — WhatsApp QR bla backend redeploy

Production backend (`v1.0.0-mr84xgy9`) ma 3andoch `POST /api/channels/whatsapp/connect`.

Kay supporti Evolution b:
- `POST /api/whatsapp/sessions`
- `GET /api/whatsapp/sessions/:id/qr`
- `GET /api/whatsapp/sessions/:id/status`

Had fix kaybeddel **frontend BFF** bach ysta3mel had routes — **ma khassakch redeploy backend**.

## Files to copy into `sass-botflow/frontend`

| From this folder | To frontend repo |
| --- | --- |
| `whatsapp-sessions-compat.ts` | `src/lib/backend/whatsapp-sessions-compat.ts` |
| `connect-route.ts` | `src/app/api/channels/whatsapp/connect/route.ts` |
| `qr-route.ts` | `src/app/api/channels/whatsapp/[instanceId]/qr/route.ts` |
| `status-route.ts` | `src/app/api/channels/whatsapp/[instanceId]/status/route.ts` |
| `disconnect-route.ts` | `src/app/api/channels/whatsapp/[instanceId]/route.ts` |
| `channels-route.ts` | `src/app/api/channels/route.ts` |
| `evolution-types.ts` | `src/lib/whatsapp/evolution-types.ts` |

## Easypanel — deploy frontend ghir

1. Push changes to `sass-botflow/frontend` → branch `main`
2. EasyPanel → project `sass-botflow` → service **frontend**
3. **Deploy** (frontend build ~3–5 min)
4. Test: `botflow.ink` → Connect → Connect WhatsApp Business

## Verify backend has Evolution env

EasyPanel → **backend** → Environment:

```env
EVOLUTION_API_URL=https://evolution.api.botflow.ink
EVOLUTION_API_KEY=<same as botflow-evolution AUTHENTICATION_API_KEY>
```

Backend ma khassouch redeploy ila had vars deja set (`evolution: true` f `/health`).

## Fix "Cloudflare gateway returned an error page"

Had error kayban mlli **frontend** (server-side) kay7awel ywsal l `https://api.botflow.ink` **3abr Cloudflare** w Cloudflare kayrj3 HTML (502) bla JSON.

### Fix A — internal URL (recommended)

EasyPanel → **frontend** → Environment → zid:

```env
BACKEND_API_URL=http://sass-botflow_backend:8000
NEXT_PUBLIC_API_URL=https://api.botflow.ink
```

- `BACKEND_API_URL` = server-side calls (BFF) — **bypass Cloudflare**
- `NEXT_PUBLIC_API_URL` = browser calls — public URL

**Save** → **Redeploy frontend**.

### Fix B — Cloudflare DNS only

Cloudflare → `api.botflow.ink` → **DNS only** (grey cloud, mashi orange).

B7al `evolution.api.botflow.ink`.

### Verify

```bash
curl -s https://www.botflow.ink/api/health
```

Ba3d redeploy, jarreb **Connect WhatsApp** — ma khassch tban Cloudflare error.
