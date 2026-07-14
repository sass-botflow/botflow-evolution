# Botflow Evolution API

Production-ready Docker deployment for [Evolution API](https://github.com/EvolutionAPI/evolution-api) v2.3.7 with Redis cache and an external PostgreSQL database.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Evolution API     │────────▶│  External PostgreSQL │
│   (port 8080)       │         │  (managed separately) │
└─────────┬───────────┘         └──────────────────────┘
          │
          ▼
┌─────────────────────┐
│       Redis         │
│   (internal only)   │
└─────────────────────┘
```

This repository deploys only Evolution API and Redis. PostgreSQL must be provisioned and reachable from the Docker network before starting the stack.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2
- External PostgreSQL 14+ database
- At least 2 GB RAM available for containers

## Quick start

1. Clone the repository:

   ```bash
   git clone https://github.com/sass-botflow/botflow-evolution.git
   cd botflow-evolution
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set at minimum:

   - `AUTHENTICATION_API_KEY` — a strong, random API key
   - `SERVER_URL` — the public URL where Evolution API is reachable
   - `DATABASE_CONNECTION_URI` — connection string to your external PostgreSQL instance

   Example `DATABASE_CONNECTION_URI`:

   ```env
   DATABASE_CONNECTION_URI=postgresql://evolution_user:secure_password@postgres.example.com:5432/evolution_db?schema=evolution_api
   ```

4. For **local development**, expose the API port on the host:

   ```bash
   cp docker-compose.override.example.yml docker-compose.override.yml
   ```

   Skip this step on **Easypanel** — it injects its own `docker-compose.override.yml` with proxy routing. Binding port 8080 in both files causes a "port is already allocated" error.

5. Start the stack:

   ```bash
   docker compose up -d
   ```

6. Verify the deployment:

   ```bash
   curl http://localhost:8080/
   ```

## Configuration

### External PostgreSQL

Evolution API connects to PostgreSQL using `DATABASE_CONNECTION_URI`. The database host must be resolvable from inside the Evolution API container — use a DNS hostname, not a hardcoded IP address.

Ensure the database exists and the user has sufficient privileges. Evolution API runs Prisma migrations automatically on startup.

### Configurable Docker hostnames

Service hostnames and container names are configurable via environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `EVOLUTION_HOSTNAME` | `evolution-api` | Hostname inside the Evolution API container |
| `EVOLUTION_CONTAINER_NAME` | `evolution-api` | Docker container name |
| `REDIS_HOSTNAME` | `redis` | Hostname inside the Redis container |
| `REDIS_HOST` | `redis` | DNS alias used by Evolution API to reach Redis |
| `REDIS_CONTAINER_NAME` | `evolution-redis` | Docker container name |
| `DOCKER_NETWORK_NAME` | `evolution-net` | Internal Redis/API bridge network |
| `EASYPANEL_PROJECT_NETWORK` | `easypanel` | External Easypanel project network (Postgres) |
| `EASYPANEL_PROJECT_NAME` | — | Easypanel project name (used in Postgres hostname) |
| `EVOLUTION_PORT` | `8080` | Host port for local dev (`docker-compose.override.yml` only) |

`CACHE_REDIS_URI` is assembled automatically in `docker-compose.yml` from `REDIS_HOST`, `REDIS_PORT`, and `REDIS_DB`.

### Volumes

| Volume | Mount point | Purpose |
| --- | --- | --- |
| `evolution_instances` | `/evolution/instances` | WhatsApp session data |
| `evolution_redis_data` | `/data` | Redis persistence (AOF) |

## Operations

### View logs

```bash
docker compose logs -f evolution-api
docker compose logs -f redis
```

### Stop the stack

```bash
docker compose down
```

### Stop and remove volumes (destructive)

```bash
docker compose down -v
```

### Update to a new image version

```bash
docker compose pull
docker compose up -d
```

## Health check

Evolution API v2.3.7 responds on the root path `/` (not `/health`). Docker Compose uses it to report container health:

```bash
docker compose ps
curl http://localhost:8080/
```

Expected response:

```json
{"status":200,"message":"Welcome to the Evolution API, it is working!"}
```

## Easypanel deployment

This compose file is designed for Easypanel and similar platforms that merge a `docker-compose.override.yml` at deploy time.

- The base `docker-compose.yml` uses `expose: 8080` only — no host port binding.
- `evolution-api` joins the compose `default` network so Easypanel Traefik can route traffic to it.
- Configure the public domain and proxy in Easypanel under **Domain & Proxy** (target port **8080**, compose service **`evolution-api`**).
- Set `SERVER_URL` in `.env` to your Easypanel public URL (or use `https://$(PRIMARY_DOMAIN)` in the Easypanel UI).
- Do not copy `docker-compose.override.example.yml` on Easypanel.

### Connect to Easypanel PostgreSQL

Compose stacks run on an isolated Docker network. Easypanel Postgres runs on the shared **project network**. Evolution API joins that network via `easypanel-project` in `docker-compose.yml`.

1. In Easypanel, open your **Postgres** service → **Credentials** and copy the internal connection details.
2. Set these in the compose service **Environment**:

   ```env
   EASYPANEL_PROJECT_NAME=sass-botflow
   EASYPANEL_PROJECT_NETWORK=easypanel
   DATABASE_CONNECTION_URI=postgresql://postgres:YOUR_PASSWORD@sass-botflow_postgres:5432/postgres?schema=evolution_api
   ```

   Easypanel internal hostname pattern: `{project}_{service}` → `sass-botflow_postgres` for project `sass-botflow` and service `postgres`.

3. Redeploy the compose service.

### Domain shows "Service is not reachable"

| Check | Action |
| --- | --- |
| Compose Service empty | Set to `evolution-api` in the domain settings |
| Traefik cannot reach container | Redeploy after pulling latest `docker-compose.yml` (adds `default` network) |
| Cloudflare Proxied | Set `evolution.api.botflow.ink` to **DNS only** (grey cloud) |
| Wrong service | Configure domain on **`botflow-evolution`**, not a standalone app service |

### Troubleshooting `P1001: Can't reach database server`

| Check | Action |
| --- | --- |
| Wrong hostname | Use `sass-botflow_postgres`, not `localhost` or a public IP |
| Wrong password | Match the Postgres password from Easypanel Credentials |
| Network isolation | Ensure `EASYPANEL_PROJECT_NETWORK` matches your server network (default: `easypanel`). Run `docker network ls` on the VPS to confirm |
| Postgres not running | Start the Postgres service in Easypanel before deploying Evolution API |

Test connectivity from the Evolution API container after deploy:

```bash
docker exec -it evolution-api wget -qO- --timeout=3 sass-botflow_postgres:5432 || echo "TCP check done"
```

Or from the Easypanel server:

```bash
docker network inspect easypanel --format '{{range .Containers}}{{.Name}} {{end}}'
```

Both `sass-botflow_postgres` and `evolution-api` should appear on the same network.

## Connect BotFlow backend (WhatsApp QR scan)

Evolution API alone is not enough for `botflow.ink` users to scan QR codes. The **BotFlow backend** (`api.botflow.ink`) must be redeployed with the latest Evolution integration.

### Symptom

Frontend shows:

```text
Cannot POST /api/channels/whatsapp/connect
```

Evolution API at `https://evolution.api.botflow.ink/` works, but the backend is still running an **old image** (`buildCommit: v1.0.0-mr84xgy9`) that only supports Meta OAuth (`GET /connect`), not Evolution (`POST /connect`).

### Fix in Easypanel

1. Open **sass-botflow** → **backend** service.
2. **Source** → confirm `sass-botflow/backend` branch `main` or image `ghcr.io/sass-botflow/backend:latest`.
3. **Environment** → add or update:

   ```env
   EVOLUTION_API_URL=https://evolution.api.botflow.ink
   EVOLUTION_API_KEY=<same value as AUTHENTICATION_API_KEY in botflow-evolution>
   EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
   ```

   Use the public Evolution URL above unless backend and `botflow-evolution` share the same Docker network; then you may use `http://botflow-evolution_evolution-api:8080` (verify with `docker network inspect easypanel`).

4. **Deploy** with **Clear build cache** (wait 5–10 minutes for a real rebuild).
5. Verify:

   ```bash
   curl -s https://api.botflow.ink/health | python3 -m json.tool
   ```

   Expected after redeploy:

   | Field | Expected |
   | --- | --- |
   | `buildCommit` | New value (not `v1.0.0-mr84xgy9`) |
   | `whatsappReady` | `true` |
   | `modules.whatsapp` | `true` |

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
   ```

   Expected: **401** (route exists, needs JWT) — **not 404**.

6. In BotFlow dashboard → **Connect** → **Connect WhatsApp Business** → QR modal should appear.

## Security notes

- Never commit `.env` to version control.
- Replace the default `AUTHENTICATION_API_KEY` before deploying.
- Restrict port `8080` at the firewall or place Evolution API behind a reverse proxy with TLS.
- Use strong PostgreSQL credentials and enable SSL on the database connection when possible.

## What's not included

This deployment intentionally excludes:

- PostgreSQL (use an external managed or self-hosted instance)
- RabbitMQ
- MinIO / S3
- Typebot
- Chatwoot
- n8n

## References

- [Evolution API documentation](https://doc.evolution-api.com/v2/en/install/docker)
- [Environment variables](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/.env.example)
- [Official Docker image](https://hub.docker.com/r/evoapicloud/evolution-api)
