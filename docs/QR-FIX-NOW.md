# QR FIX NOW — "Generating QR code..." b la fin

## L-mochkil 7a9i9i

Evolution **khdama** ✅ walakin Baileys **ma kaygenerich QR** — connect kayrja3 `count: 0`.

Hadchi m3rouf f Evolution API: **CONFIG_SESSION_PHONE_VERSION** khasso ykon s7i7.

---

## FIX f Easypanel (5 d9aya)

### 1. botflow-evolution → Environment → ZID:

```env
CONFIG_SESSION_PHONE_VERSION=2.3000.1043159177
```

> Ila ma khdamch: curl `https://evolution.api.botflow.ink/` w copy `whatsappWebVersion`

### 2. frontend → Environment → **7YED** had line ila kayna:

```env
EVOLUTION_WEBHOOK_URL=...
```

Backend 502 — webhook kayblocki QR.

### 3. frontend → Environment → verify:

```env
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY>
```

### 4. Redeploy **botflow-evolution** (restart)

### 5. Redeploy **frontend** (merge PR jdid ila kayn)

Frontend PR: `cursor/fix-evolution-qr-generation-1434` (copy `evolution-server.ts`)

---

## Ila mazal count:0

Zid f **botflow-evolution** env:

```env
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_HISTORIC=false
DATABASE_SAVE_DATA_LABELS=false
```

Redeploy evolution → test QR.

---

## Test

1. `botflow.ink/dashboard/channels` → Connect WhatsApp
2. QR khass yban f **10-30 sec**
3. Verif: `curl -s https://www.botflow.ink/api/channels/whatsapp/diagnostics`
