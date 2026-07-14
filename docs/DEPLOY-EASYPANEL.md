# Easypanel Deploy — 5 secondes vs deploy ma9ad

## Résumé b Darija

| Service | Deploy 5–6 sec | Wach normal? | Chno khass |
|---------|----------------|--------------|-----------|
| **botflow-evolution** | ✅ Normal | Iyyeh | Image Docker jahza — ma kaynch build |
| **frontend** | ❌ Mashi normal | La | Khass **5–10 d9aya** (build Next.js) |
| **backend** | ❌ Mashi normal | La | Khass **5–10 d9aya** (build Go/Node) |

**Deploy sarih = restart ghir.** Ma kaybdlch code, ma kaybni image jdid.

---

## botflow-evolution — 5–6 sec = deploy s7i7 ✅

Had service kayst3mel **image jahza** mn Docker Hub:

```yaml
image: evoapicloud/evolution-api:v2.3.7
```

Easypanel kaydir:

1. Pull `docker-compose.yml` mn GitHub
2. `docker compose up -d` (restart containers)
3. **Ma kaynch build** → 5–30 secondes normal

### Kifach t3ref deploy t9ad?

```bash
# Evolution khdama?
curl -s https://evolution.api.botflow.ink/

# Network aliases (ba3d PR #3)?
# f VPS: docker network inspect easypanel | grep evolution-api
```

Ila Evolution kayrj3 `200` + service **ACTIVE** f Easypanel → **deploy sali**, même si 5 sec.

### Ila bghiti force pull dyal image

Easypanel → botflow-evolution → **Deploy** (compose fih `pull_policy: always`).

---

## frontend — deploy 5 sec = MASHI ma9ad ❌

### Symptôme

```bash
curl -s https://www.botflow.ink/api/health | python3 -m json.tool
```

Ila katban:

```json
"deployHint": "Build 9dim (30h). EasyPanel Deploy f 2s = restart ghir..."
```

→ **Ma deployitch build jdid.**

### Deploy ma9ad (5–10 d9aya)

1. Easypanel → **frontend** → **Source**
2. Type = **GitHub** (mashi Docker Image ghir)
3. Repo = `sass-botflow/frontend`, branch = `main`
4. **Merge PR #66** l9bel: https://github.com/sass-botflow/frontend/pull/66
5. **Environment** — zid/zid:

   ```env
   EVOLUTION_API_URL=http://evolution-api:8080
   EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY>
   BACKEND_API_URL=http://sass-botflow_backend:8000
   NEXT_PUBLIC_API_URL=https://api.botflow.ink
   JWT_SECRET=<nfs backend>
   ```

6. **Deploy** → **Clear build cache** (ila kayn checkbox)
7. **Stana 5–10 d9aya** — ila tssala f 2–5 sec, ma tssed — ma deployatich
8. Verif:

   ```bash
   curl -s https://www.botflow.ink/api/health | python3 -m json.tool
   ```

   Khass `buildTime` jdid (daba) + `evolutionBff: true`

---

## backend — deploy 5 sec = MASHI ma9ad ❌

Daba: `https://api.botflow.ink/health` → **502**

### Deploy ma9ad

1. Easypanel → **backend** → **Source** = GitHub `sass-botflow/backend` branch `main`
2. **Environment**:

   ```env
   JWT_SECRET=<32+ chars>
   DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
   EVOLUTION_API_URL=http://evolution-api:8080
   EVOLUTION_API_KEY=<nfs AUTHENTICATION_API_KEY>
   ```

3. **Deploy** + **Clear build cache**
4. Stana 5–10 d9aya
5. Verif:

   ```bash
   curl -s https://api.botflow.ink/health | python3 -m json.tool
   ```

   Khass `buildCommit` jdid (mashi `v1.0.0-mr84xgy9`)

---

## Checklist — ordre s7i7

```
1. botflow-evolution  → redeploy (5–30 sec OK)     ✅ déjà fait
2. backend            → deploy ma9ad (5–10 min)    ❌ 502
3. frontend env       → EVOLUTION_API_URL internal
4. frontend           → merge PR #66 + deploy ma9ad (5–10 min)
5. Test QR            → botflow.ink/dashboard/channels
```

---

## FAQ

**Q: 3lach botflow-evolution sarih w frontend la?**  
A: Evolution = image jahza. Frontend = kaybni Next.js mn source → build twil.

**Q: Deploy sarih w "Success" vert — wach t9ad?**  
A: Evolution: iyyeh. Frontend/Backend: la, ghir restart.

**Q: Kifach nforcer rebuild?**  
A: Source = GitHub + Dockerfile, Deploy + Clear build cache, stana 10 d9aya.
