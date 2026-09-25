# Saved profiles

The dashboard works without login. Supabase is only for Google sign-in, claiming a username, and `https://codetrace.xyz/{name}`.

## Schema

`supabase/migrations/` creates:

- `public_profiles` — claimed usernames and display metadata
- `profile_configs` — saved platform handle maps
- unique username constraints and reserved route-name checks (`app`, `login`, `profile`, platform names, …)
- RLS: public read, owner-only write

## Env

```dotenv
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Local Google OAuth for the Supabase CLI:

```dotenv
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

If those Vite vars are missing, `/$profileUsername` renders "Saved profiles are not configured" instead of a 404.

## Flow

1. Stack handles on `/app` or `/profile`.
2. Sign in at `/login?next=…`.
3. `/account` claims a username and writes `profile_configs`.
4. Public page loads the config, then the same unified fetch loop as `/profile`.

Saving from `/app` can also upsert the primary config for the signed-in user without going through account first.
