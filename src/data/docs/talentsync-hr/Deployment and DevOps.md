# Deployment and DevOps

Local runbook is `RUNNING.md`. Compose files prefix every service `talentsync_hr_` so they never share names with TalentSync Normies.

## Local Compose (`docker-compose.yml`)

```bash
docker compose up -d talentsync_hr_db talentsync_hr_zookeeper talentsync_hr_kafka
```

| Service | Image | Ports |
|---|---|---|
| `talentsync_hr_db` | postgres:15-alpine | 5432, volume `./data/postgres` |
| `talentsync_hr_zookeeper` | cp-zookeeper:7.6.1 | 2181 |
| `talentsync_hr_kafka` | cp-kafka:7.6.1 | 9092, advertised `localhost:9092` |
| `talentsync_hr_worker` | uv python 3.12, optional | `uv run faststream run app.worker_main:stream_app` |

Worker env inside Compose:

```
DATABASE_URL=postgresql+psycopg://postgres:postgres@talentsync_hr_db:5432/talentsync_hr
KAFKA_BOOTSTRAP_SERVERS=talentsync_hr_kafka:9092
```

A host-side worker must use `localhost:5432` and `localhost:9092`.

## Process commands

From `backend/`:

```bash
uv sync
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "describe_change"
uv run uvicorn app.main:app --reload --port 8000
uv run faststream run app.worker_main:stream_app
uv run pytest
```

From `frontend/`:

```bash
bun install
bun run dev
bun run lint
bun run build
```

Backend image (`backend/Dockerfile`): `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`, `uv sync --frozen --no-dev`, `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

## Production Compose (`docker-compose.prod.yml`)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Project name `talentsync_hr`. Services: `talentsync_hr_db` (postgres 16), one-shot `talentsync_hr_migrate` (`alembic upgrade head`), `talentsync_hr_backend`, `talentsync_hr_worker`. Kafka is the shared TalentSync broker (`talentsync_kafka:9092` on external network `talentsync_internal`). Frontend URL `https://hr.talentsync.tashif.codes`. `AUTH_COOKIE_SECURE=true`, `DEBUG=false`.

```mermaid
flowchart TB
  subgraph "Prod compose"
    DB["talentsync_hr_db postgres 16"]
    Mig["talentsync_hr_migrate alembic"]
    BE["talentsync_hr_backend uvicorn"]
    W["talentsync_hr_worker faststream"]
  end
  Kafka["talentsync_kafka (shared)"]
  FE["Next.js behind proxy"]
  Mig --> DB
  BE --> DB
  BE --> Kafka
  W --> DB
  W --> Kafka
  FE --> BE
```

## Env that actually matters

Copy `backend/.env.example`. Minimum for a local screen:

- `DATABASE_URL`
- `KAFKA_BOOTSTRAP_SERVERS`
- `JWT_SECRET_KEY`, `MAGIC_LINK_SECRET`
- `GOOGLE_API_KEY` for Gemini extract/match/report
- `FRONTEND_BASE_URL`

Add Google OAuth client, SMTP, `PROXYCURL_API_KEY`, and `GITHUB_TOKEN` when those features run.

`validate_critical_settings()` refuses empty JWT and magic-link secrets at API boot.

## Worker scaling

```bash
uv run faststream run app.worker_main:stream_app --workers 4
```

Each replica is a consumer on the `talentsync-*` topics. Do not also start the Compose worker on the same topics unless you want shared consumption.
