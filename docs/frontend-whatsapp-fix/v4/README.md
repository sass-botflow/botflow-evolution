# WhatsApp profile picture — frontend patch v4

Shows the connected user's **WhatsApp profile photo** (not the green WhatsApp logo).

## Merge

Create PR on `sass-botflow/frontend` from branch `cursor/whatsapp-profile-picture-1434`
or copy these files into the frontend repo:

| Patch file | Target path |
|------------|-------------|
| `evolution-server.ts` | `src/lib/whatsapp/evolution-server.ts` |
| `evolution-bff-service.ts` | `src/lib/whatsapp/evolution-bff-service.ts` |
| `evolution-types.ts` | `src/lib/whatsapp/evolution-types.ts` |
| `evolution-api.ts` | `src/lib/whatsapp/evolution-api.ts` |
| `use-whatsapp-evolution.ts` | `src/hooks/use-whatsapp-evolution.ts` |
| `whatsapp-channel-dashboard-card.tsx` | `src/components/channels/whatsapp-channel-dashboard-card.tsx` |
| `whatsapp-qr-modal.tsx` | `src/components/channels/whatsapp-qr-modal.tsx` |

## How it works

1. After connect, BFF calls Evolution `POST /chat/fetchProfilePictureUrl/{instance}`
2. Returns `profilePictureUrl` in channels + status API
3. UI shows Avatar with WhatsApp badge (same pattern as Instagram)

## Deploy

Easypanel → frontend → Deploy (5–10 min build)
