# Troubleshooting and FAQ

Commands below are from `RUNNING.md`. Run backend commands from `backend/`.

## `ModuleNotFoundError: No module named 'app'`

You ran a file as a script. Use module entrypoints:

```bash
uv run uvicorn app.main:app --reload --port 8000
uv run faststream run app.worker_main:stream_app
```

Not `uv run app/worker_main.py`.

## Database connection refused

```bash
docker compose ps talentsync_hr_db
```

Host processes:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/talentsync_hr
```

Compose worker must use host `talentsync_hr_db`, not `localhost`.

Healthcheck is `pg_isready -U postgres -d talentsync_hr`. Logs:

```bash
docker compose logs -f talentsync_hr_db
```

Migrations not applied: `uv run alembic upgrade head` from `backend/`. Empty match tables after a resume upload often mean you skipped this, not Kafka.

## Worker cannot connect to Kafka

```bash
docker compose ps talentsync_hr_zookeeper talentsync_hr_kafka
docker compose logs -f talentsync_hr_kafka
```

Host worker: `KAFKA_BOOTSTRAP_SERVERS=localhost:9092`. Docker worker: `talentsync_hr_kafka:9092`. Local Kafka advertises `PLAINTEXT://localhost:9092`, which is why a container worker talking to `localhost` is wrong.

No shortlist after apply: the API returned 201 but `PipelineOrchestrator` never ran. Confirm the worker process is up and subscribed to `talentsync-resume-processed`.

## Auth cookies never stick

- Axios must use `withCredentials: true` (already in `api-client.ts`).
- FastAPI CORS must include the frontend origin. `main.py` allows `FRONTEND_BASE_URL` and localhost 3000/3001.
- Production needs `AUTH_COOKIE_SECURE=true` and HTTPS.
- `POST /auth/email/request-link` is 410. Use password login or signup's emailed verify link.

## 403 No organization access / 400 multiple organizations

Set `x-org-id` or call `POST /auth/switch-org`. Platform orgs are created only at `POST /admin/organizations`. `POST /orgs` is 410. You need `PlatformRoleAssignment` (`app_admin`) for that UI at `/admin/organizations`.

## Gemini or validation empty

Extract and match need `GOOGLE_API_KEY`. LinkedIn needs `PROXYCURL_API_KEY`. GitHub unauthenticated rate limit is 60 req/hr unless `GITHUB_TOKEN` is set. Adapter timeout is 8 seconds (`VALIDATION_HTTP_TIMEOUT_SECONDS`).

## FAQ

**Is this the job-seeker TalentSync app?** No. Job-seeker docs are `talentsync/`. This tree is recruiter screening.

**Can I skip Kafka?** HTTP create still writes JD/resume rows. Matrix, validation, ranking, and reports wait for `on_resume_processed` or the matching/report POST endpoints.

**Public apply auth?** `POST /api/v1/jds/public/{jd_id}/apply` is unauthenticated. The JD must be `active`.

**Dashboard sidebar 404s?** Links to `/dashboard/jobs` are stale. Use `/jobs`.

**Which Python?** `requires-python = ">=3.12"` in `backend/pyproject.toml`.

```mermaid
flowchart TD
  Fail["Something broke"]
  Import["ImportError app"]
  DB["Connection refused"]
  Kafka["Worker idle"]
  Auth["401 / no cookie"]
  Org["403 / 400 org"]
  Fail --> Import
  Fail --> DB
  Fail --> Kafka
  Fail --> Auth
  Fail --> Org
  Import --> Fix1["uvicorn / faststream module paths"]
  DB --> Fix2["compose ps db + DATABASE_URL host"]
  Kafka --> Fix3["compose ps kafka + bootstrap host"]
  Auth --> Fix4["CORS + Secure cookie + not 410 magic link"]
  Org --> Fix5["x-org-id or /admin/organizations"]
```
