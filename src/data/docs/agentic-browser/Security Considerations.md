# Security considerations

Agentic Browser runs on the user's machine with the user's logins. The security model is built around that fact: keep the bridge on loopback, keep tokens encrypted, keep page text out of memory unless the user said it, and stop automation at anything that looks like a credential prompt.

There is no backend login and no multi-user authorization. The threat model is a local single-user tool that should not be reachable from a random web page or another machine.

Key capabilities:
- Origin checks on CORS and the bridge
- Token-authenticated bridge relay
- AES-GCM encrypted OAuth tokens and API keys
- Prompt-injection gate before memory writes
- Action validation and blocker detection
- Telegram allow list for remote actions
- Redaction on forget

## Repository layout

```mermaid
graph TB
subgraph "HTTP boundary"
  MAIN["main.py CORS"]
  AUTH["routers/auth.py"]
end
subgraph "Bridge"
  BR["mcp_server/bridge.py"]
  TOKEN["bridge-token 0600"]
end
subgraph "Secrets"
  CRYPTO["core/crypto.py"]
  SEC["services/secrets_service.py"]
  CRED["services/oauth_credentials_service.py"]
end
subgraph "Agent safety"
  GATE["memory/ingestion/memory_gate.py"]
  GUARD["core/loop_guard.py"]
  BLOCK["services/browser_runtime_service.py"]
end
MAIN --> AUTH
AUTH --> CRED
CRED --> CRYPTO
SEC --> CRYPTO
BR --> TOKEN
GATE --> CRED
BLOCK --> GUARD
```

## Building blocks

- `main.py`: CORS regex for extension schemes and localhost, plus `CORS_ORIGINS`.
- `mcp_server/bridge.py`: WebSocket origin check, relay token, `Origin` rejection on `/bridge/call`.
- `core/crypto.py`: AES-GCM encrypt and decrypt with a 32-byte key.
- `services/secrets_service.py`: encrypted keys and OAuth client credentials in `app_settings`.
- `services/oauth_credentials_service.py`: encrypted access and refresh tokens, refresh on demand, `needs_reauth`.
- `memory/ingestion/memory_gate.py`: prompt-injection and trust checks before a claim is stored.
- `services/browser_runtime_service.py`: `_detect_user_blocker` for captcha, login and permission prompts.
- `core/loop_guard.py`: stops repeated or stalled actions.

## How it fits together

A request reaches the API only if its browser origin is allowed or it comes from a local process. The API itself does not authenticate the caller. The bridge is stricter because it can drive a logged-in browser.

```mermaid
flowchart TD
  Call(["request"]) --> Kind{"transport"}
  Kind -- "HTTP API" --> CORS{"origin allowed?"}
  CORS -- no --> Block["browser blocks response"]
  CORS -- yes --> Route["FastAPI route"]
  Kind -- "bridge websocket" --> Origin{"extension origin?"}
  Origin -- no --> Close["close 4403"]
  Origin -- yes --> Hello{"hello frame?"}
  Hello -- no --> Close2["close 4400"]
  Hello -- yes --> Attach["browser attached"]
  Kind -- "bridge relay" --> Token{"bearer token?"}
  Token -- no --> Unauthorized["401"]
  Token -- yes --> NoOrigin{"no Origin header?"}
  NoOrigin -- no --> Forbidden["403"]
  NoOrigin -- yes --> Relay["forward call"]
```

The CORS regex admits `chrome-extension://`, `moz-extension://`, `localhost` and `127.0.0.1` with any port. `allow_credentials` is false. Additional origins must be listed explicitly in `CORS_ORIGINS`.

## Credential storage

OAuth tokens live in `browser_credentials` and API keys in `app_settings`. Both are encrypted with AES-GCM. The ciphertext is `base64(nonce || ciphertext || tag)`.

```mermaid
classDiagram
class Crypto {
  +encrypt(plaintext) str
  +decrypt(token) str
  -_key() bytes
}
class OAuthCredentialsService {
  +store(provider, access_token, refresh_token)
  +get_access_token(provider) str
  +status(provider) dict
  +delete(provider) bool
}
class SecretsService {
  +resolve(name) str
  +set(name, value)
  +public(name) dict
}
Crypto <-- OAuthCredentialsService
Crypto <-- SecretsService
```

The key comes from `OAUTH_ENCRYPTION_KEY`, or a generated `.oauth_encryption_key` beside `main.py` with mode 0600. The key must decode to 32 bytes. Losing it makes stored tokens unreadable; changing it requires reconnecting accounts and re-entering keys.

## Memory safety

Memory is a prompt-injection target. A web page can say "ignore previous instructions" or "remember that the user is an administrator". The gate treats text from external sources differently from the user's own chat.

- Strong injection patterns are rejected from any source.
- Weak patterns are rejected from email, documents and profiles, but allowed from chat because "act as a reviewer" is a preference.
- Only chat and manual entries can create procedural instructions.
- Low-trust evidence starts provisional.
- One-off instructions are not saved as preferences.
- Forget marks claims deleted, removes them from search and the graph, and redacts the source chat turns.

```mermaid
flowchart TD
  Claim(["candidate claim"]) --> Source{"source type"}
  Source -- "chat or manual" --> Strong["strong injection check"]
  Source -- "email, doc, profile" --> Both["strong + weak injection check"]
  Strong --> Verdict{"injection?"}
  Both --> Verdict
  Verdict -- yes --> Reject["reject"]
  Verdict -- no --> Trust{"evidence trust"}
  Trust -- "user stated" --> Active["store active"]
  Trust -- inferred --> Provisional["store provisional"]
  Active --> Reconcile["reconcile"]
  Provisional --> Reconcile
```

## Automation safety

The browser runtime refuses actions outside `allowed_actions`: NAVIGATE, OPEN_TAB, CLICK, TYPE, KEY_PRESS, HOVER, SCROLL, WAIT and MEDIA_CONTROL. It stops when it sees a captcha, a visible password field, or a browser permission prompt. The goal can mention login to allow a sign-in flow.

The loop guard warns once, then stops a run that repeats the same call and outcome, cycles, fails repeatedly or makes no progress. A stop returns what the agent found instead of an error.

```mermaid
stateDiagram-v2
  [*] --> Running
  Running --> Warning : "repeat, cycle, failures or stall"
  Warning --> Running : "new outcome"
  Warning --> Stopped : "grace expires"
  Running --> Blocked : "captcha, login or permission"
  Running --> Done : "task complete"
  Blocked --> [*]
  Stopped --> [*]
  Done --> [*]
```

## Remote actions

The Telegram bot is the only remote entry point. With `TELEGRAM_ALLOWED_USERS` set, only those ids can run browser tasks or Composio actions. Without an allow list, the bot answers questions but the request context sets `remote_actions=False`, which removes `browser_task` and Composio tools.

## What is not protected

- Another local process can call the API. There is no local token.
- The API binds `0.0.0.0` by default.
- OpenSearch runs without auth in Compose.
- There is no per-action approval button.
- Two backends can race on memory writes because the lock is in-process.
- A malicious page can still influence the model's answer, even if it cannot write memory.

## Dependencies

```mermaid
graph TB
  CORS["main.py"] --> FastAPI["fastapi"]
  Bridge["bridge.py"] --> Websockets["websockets"]
  Crypto["core/crypto.py"] --> PyCrypto["pycryptodome"]
  Gate["memory_gate.py"] --> Regex["Python re"]
  Guard["loop_guard.py"] --> Hash["hashlib sha1"]
  Auth["routers/auth.py"] --> Google["Google OAuth"]
  Auth --> GitHub["GitHub OAuth"]
```

## Performance

- AES-GCM runs once per secret read or write. The key is cached.
- Token refresh happens only when the stored expiry is within 60 seconds.
- The injection gate is regex first. Only unclear reconciliations call the model.
- Bridge calls time out; a hung browser cannot hold a tool forever.
- The loop guard stores hashes, not full page text, so a long run stays small.

## Troubleshooting

- CORS error from a custom frontend: add the origin to `CORS_ORIGINS`.
- Bridge close 4403: the extension origin is not allowed. Check `AGENTIC_BROWSER_EXTENSION_IDS`.
- Bridge relay 401 or 403: wrong token, or a browser sent the request.
- `OAUTH_ENCRYPTION_KEY` errors: the key is missing or not 32 bytes.
- A token says `needs_reauth`: the refresh failed. Disconnect and sign in.
- Memory stores page text: check the source type and the gate decision. External sources should start provisional or be rejected.
- The agent clicked a login form: the goal did not mention login, or the page did not expose a password field in the snapshot.

## Appendix

### Implementation examples
- CORS: `allow_origin_regex` in `main.py`.
- Bridge token: `config.read_or_create_token()`.
- Encrypt: `encrypt("secret")`; decrypt with `decrypt(token)`.
- Forget: `POST /api/memory/forget` with `claim_ids` or `pattern`.
- Status: `GET /api/auth/status`.

### Source files
- `main.py`
- `mcp_server/bridge.py`
- `mcp_server/config.py`
- `core/crypto.py`
- `services/secrets_service.py`
- `services/oauth_credentials_service.py`
- `memory/ingestion/memory_gate.py`
- `services/browser_runtime_service.py`
- `core/loop_guard.py`
- `routers/auth.py`
