# Getting started

TalentSync HR is the recruiter product. Recruiters parse job descriptions, screen resumes, validate claims against GitHub, LeetCode, Codeforces, and LinkedIn, then rank candidates and generate reports. It is not TalentSync Normies, the job-seeker app.

Repos: [TalentSync-HR](https://github.com/tashifkhan/TalentSync-HR) (API + current Next.js app) and [TalentSync-HR-Dashboard](https://github.com/tashifkhan/TalentSync-HR-Dashboard) (older dashboard UI).

## Prerequisites

- Python 3.12+
- `uv`
- Bun
- Docker and Docker Compose

Gemini, Google OAuth, Proxycurl, GitHub, and SMTP keys are optional until you hit those flows.

## Repository layout

```
TalentSync-HR/
├── backend/          FastAPI, Alembic, FastStream worker
│   ├── app/main.py
│   ├── app/worker_main.py
│   └── alembic/
├── frontend/         Next.js 16 App Router
├── docker-compose.yml
└── docker-compose.prod.yml
```

```mermaid
graph TB
  subgraph "Your machine"
    Git["Git clone"]
    Py["Python 3.12+ / uv"]
    Bun["Bun"]
    Docker["Docker Compose"]
  end
  subgraph "Compose services"
    DB["talentsync_hr_db<br/>postgres 15"]
    ZK["talentsync_hr_zookeeper"]
    Kafka["talentsync_hr_kafka"]
    WorkerOpt["talentsync_hr_worker<br/>optional"]
  end
  subgraph "Local processes"
    API["uvicorn app.main:app :8000"]
    Worker["faststream app.worker_main:stream_app"]
    FE["bun run dev :3000"]
  end
  Git --> Py
  Git --> Bun
  Docker --> DB
  Docker --> ZK
  Docker --> Kafka
  Py --> API
  Py --> Worker
  Bun --> FE
  API --> DB
  Worker --> DB
  Worker --> Kafka
  API --> Kafka
  FE -->|"HTTP + cookies /api/v1"| API
```

## 1. Start local infrastructure

From the repo root:

```bash
docker compose up -d talentsync_hr_db talentsync_hr_zookeeper talentsync_hr_kafka
```

Ports:

- PostgreSQL `localhost:5432` (database `talentsync_hr`)
- Kafka `localhost:9092`
- ZooKeeper `localhost:2181`

Service names are prefixed `talentsync_hr_` so they do not collide with TalentSync Normies containers.

## 2. Configure the backend

From `backend/`:

```bash
cp .env.example .env
uv sync
```

Defaults in `.env.example` match Compose:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/talentsync_hr
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

## 3. Run migrations

From `backend/`:

```bash
uv run alembic upgrade head
```

## 4. Start the API

From `backend/`:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- Health: `GET /api/v1/health`

Routers mount under `settings.api_v1_prefix` (`/api/v1`) in `app.main`.

## 5. Start the worker

Second terminal, from `backend/`:

```bash
uv run faststream run app.worker_main:stream_app
```

Do not run `uv run app/worker_main.py`. That executes the file as a script and raises `ModuleNotFoundError: No module named 'app'`.

Scale with:

```bash
uv run faststream run app.worker_main:stream_app --workers 4
```

Or run the Compose worker after `backend/.env` exists:

```bash
docker compose up -d talentsync_hr_worker
```

The container worker uses `talentsync_hr_db:5432` and `talentsync_hr_kafka:9092`, not `localhost`.

## 6. Start the frontend

Third terminal, from `frontend/`:

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. Axios defaults to `http://localhost:8000/api/v1`. Override with `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## First loop

1. Sign up at `/signup` or log in at `/login`.
2. If you are a platform admin, create an org at `/admin/organizations` (`POST /api/v1/admin/organizations`). `POST /api/v1/orgs` returns 410.
3. Create a hiring request from `/dashboard` or a JD from `/jobs/create-jd`.
4. Share `/apply/{jobId}` or upload a resume against the JD.
5. Watch Kafka: the API publishes `talentsync-resume-processed`, and `PipelineOrchestrator` writes match, validation, ranking, and report rows.
6. Open `/jobs/{jobId}/candidates/{candidateId}/report`.

Without a worker, HTTP create/upload still writes the JD or resume. Matching and reports stay empty until FastStream consumes the topics.
