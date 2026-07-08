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
   curl http://localhost:8080/health
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
| `DOCKER_NETWORK_NAME` | `evolution-net` | Docker bridge network name |
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

Evolution API exposes a health endpoint at `/health`. Docker Compose uses it to report container health:

```bash
docker compose ps
curl http://localhost:8080/health
```

## Easypanel deployment

This compose file is designed for Easypanel and similar platforms that merge a `docker-compose.override.yml` at deploy time.

- The base `docker-compose.yml` uses `expose: 8080` only — no host port binding.
- Configure the public domain and proxy in Easypanel under **Domain & Proxy**.
- Set `SERVER_URL` in `.env` to your Easypanel public URL.
- Do not copy `docker-compose.override.example.yml` on Easypanel.

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
