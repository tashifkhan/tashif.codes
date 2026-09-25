# Auth

Router: `app/api/v1/auth.py`, prefix `/auth`. Tokens are JWTs (`type=access` or `refresh`) set as httpOnly cookies `talentsync_access_token` and `talentsync_refresh_token`. Cookie flags come from `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_DOMAIN`, `AUTH_COOKIE_SAMESITE`.

## Endpoints

| Method | Path | Status notes |
|---|---|---|
| POST | `/auth/email/request-link` | **410 Gone.** Passwordless login is disabled. |
| POST | `/auth/signup` | 202. Creates a magic-link record and emails it. Body: email, password, optional `full_name`, `invitation_token`. |
| POST | `/auth/login` | Email + password. Sets cookies, returns `AuthTokensResponse`. |
| GET | `/auth/email/verify` | Query `token`. Consumes magic link, sets cookies. |
| GET | `/auth/google/login` | Redirect to Google. Signed state for CSRF. |
| GET | `/auth/google/callback` | Code exchange, upsert `AuthAccount` (`provider=google`), set cookies. |
| POST | `/auth/refresh` | Cookie refresh JWT in, new access (+ refresh) out. |
| POST | `/auth/switch-org` | Body `organization_id`. Reissues JWT with that `org_id`. |
| GET | `/auth/session` | Current tokens / memberships from cookies. |
| POST | `/auth/logout` | Clears cookies. |
| GET | `/auth/google/connect` | Link Google to an existing logged-in user. |
| GET | `/auth/google/connect/callback` | Connect callback. |

Signup still uses `MagicLinkService`. `POST /auth/email/request-link` is explicitly gone.

```mermaid
sequenceDiagram
  participant B as Browser
  participant FE as /login or /signup
  participant API as FastAPI /auth
  participant Google as Google OAuth
  participant SMTP as SMTP
  participant DB as users / auth_accounts / magic_links

  alt Email password
    FE->>API: POST /auth/login
    API->>DB: verify password_hash + pepper
    API-->>B: Set-Cookie access + refresh
  else Signup magic link
    FE->>API: POST /auth/signup
    API->>DB: MagicLink row
    API->>SMTP: mail with FRONTEND_BASE_URL/auth/magic-link
    B->>API: GET /auth/email/verify?token=
    API->>DB: consume MagicLink, create User
    API-->>B: cookies
  else Google
    B->>API: GET /auth/google/login
    API->>Google: authorize
    Google->>API: GET /auth/google/callback
    API->>DB: User + AuthAccount
    API-->>B: cookies
  end
```

Frontend: `frontend/services/auth.service.ts`, callback pages `/auth/google/callback` and `/auth/magic-link`. Axios interceptor calls `POST /auth/refresh` on 401 except for `/auth/` URLs.
