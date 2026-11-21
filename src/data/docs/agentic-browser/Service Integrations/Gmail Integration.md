# Gmail integration

The Gmail integration gives the app four mail operations: list unread, fetch recent messages, mark one as read, and send a plain-text email. `routers/gmail.py` exposes them under `/api/gmail`, and `services/gmail_service.py` wraps the small request functions in `tools/gmail/`.

Three of the four routes use a Google access token. The unread route is the exception: it calls the `gmail_list_unread` agent tool without binding a token, so it takes the Composio branch. The other three routes resolve the stored Google credential and call the Gmail REST API directly.

Key capabilities:
- Unread listing with a default of 10 and a positive value guard.
- Recent inbox listing with a default of 5.
- Mark read by message id through label modification.
- Plain-text send with base64url encoding.
- One Google credential shared with Calendar, YouTube, and Google Search.
- Agent tools for read, send, list, and mark, with Composio fallbacks.

## Repository layout

The route module holds the request models and token resolution. The service is a thin error-logging layer over four tool functions.

```mermaid
graph TB
  subgraph Routes
    Unread["POST /api/gmail/unread"]
    Latest["POST /api/gmail/latest"]
    Mark["POST /api/gmail/mark_read"]
    Send["POST /api/gmail/send"]
    Auth["routers/auth.py"]
  end
  subgraph Service
    Svc["services/gmail_service.py<br/>GmailService"]
  end
  subgraph Tools
    ListUnread["tools/gmail/list_unread_emails.py"]
    Fetch["tools/gmail/fetch_latest_mails.py"]
    Read["tools/gmail/mark_email_read.py"]
    SendTool["tools/gmail/send_email.py"]
    Agent["agents/react_tools.py<br/>gmail_agent and friends"]
  end
  subgraph AuthStore
    Token["_token()"]
    Creds["OAuthCredentialsService"]
    Row["browser_credentials google"]
  end
  Unread --> Agent
  Latest --> Token
  Mark --> Token
  Send --> Token
  Token --> Creds
  Creds --> Row
  Latest --> Svc
  Mark --> Svc
  Send --> Svc
  Svc --> Fetch
  Svc --> Read
  Svc --> SendTool
  Agent --> ListUnread
  Agent --> Fetch
  Agent --> Read
  Agent --> SendTool
  Agent --> Composio["Composio gmail"]
  Auth --> Creds
```

## Building blocks

- `UnreadRequest`: `max_results` defaults to 10.
- `LatestRequest`: `max_results` defaults to 5.
- `MarkReadRequest`: required `message_id`.
- `SendEmailRequest`: `to`, `subject`, and `body` with an empty default.
- `_token`: calls `get_access_token("gmail")` and maps `NeedsReauth` to HTTP 401.
- `GmailService`: wraps `list_unread`, `get_latest_emails`, `mark_read`, and `send_email` with logging and re-raise.
- `list_unread`: searches with `q=is:unread`, then fetches metadata headers for each id.
- `get_latest_emails`: searches the inbox with `labelIds=["INBOX"]` and `q=is:inbox`.
- `mark_read`: POSTs `{"removeLabelIds": ["UNREAD"]}` to the message modify endpoint.
- `send_email`: builds a `To`, `Subject`, `Content-Type` message and posts `{"raw": ...}`.

## How it fits together

A request arrives with a small JSON body. Routes that need the REST API resolve the token first. The service logs and re-raises any tool error, and the route turns it into a 500 unless it is already an HTTP error.

```mermaid
sequenceDiagram
  participant C as Client
  participant R as routers/gmail.py
  participant T as _token
  participant S as GmailService
  participant G as gmail.googleapis.com
  C->>R: POST /send with to, subject, body
  R->>R: require to and subject
  R->>T: await _token()
  T-->>R: decrypted Google access token
  R->>S: send_message(token, to, subject, body)
  S->>G: POST messages/send with raw
  G-->>S: message JSON with id
  S-->>R: result
  R-->>C: result sent and details
```

The unread route skips the service. It awaits `gmail_list_unread_agent.ainvoke({"max_results": ...})` and returns the tool text in `answer`. The agent tool has no token in this call, so it goes straight to Composio and returns either formatted messages, `No unread messages found.`, or a failure string.

## Listing messages

Unread and latest use different Gmail queries. Both cap their per-message detail requests with an 8 second timeout and skip a message when the detail request fails, so a partial list is possible.

```mermaid
flowchart TD
  A["POST /api/gmail/unread"] --> B["max_results default 10"]
  B --> C["gmail_list_unread_agent with no token"]
  C --> D["Composio gmail fetch"]
  D --> E{"ok?"}
  E -- yes --> F["formatted unread rows"]
  E -- no --> G["failure text in answer"]
  H["POST /api/gmail/latest"] --> I["_token()"]
  I --> J["get_latest_emails token, max_results"]
  J --> K["GET messages q=is:inbox labelIds=INBOX"]
  K --> L["GET each message, read Subject, From, Date"]
  L --> M["messages array"]
```

`list_unread` asks for `format=metadata` and the three display headers. `get_latest_emails` fetches each full message and reads the same headers from `payload.headers`, then adds `snippet`. Neither tool downloads message bodies or attachments.

The route guards are permissive: any value above zero is used as given, and a missing or non-positive value falls back to the default. There is no upper clamp in the route. The agent tool clamps unread to 50 and recent to 25.

## Marking and sending

`mark_read` is a label change, not a delete. It removes `UNREAD` from the message and accepts status 200 or 204. An empty response body becomes `{}`. The route returns `{"result": "ok", "details": ...}`.

`send_email` builds a minimal RFC 2822-like message with CRLF line endings, base64url-encodes the UTF-8 bytes, and posts it to `messages/send`. The sender is always the authenticated account. There is no CC, BCC, HTML body, or attachment support in this tool.

```mermaid
sequenceDiagram
  participant R as send_message route
  participant T as tools/gmail/send_email.py
  participant B as build_raw_message
  participant G as Gmail send endpoint
  R->>T: send_email(token, to, subject, body)
  T->>B: build To, Subject, Content-Type and body
  B-->>T: base64url raw string
  T->>G: POST users/me/messages/send
  G-->>T: JSON with id, threadId, labelIds
  T-->>R: JSON
  R-->>R: result sent
```

The send tool raises on any status other than 200 with the status and response text. The route does not retry. A missing `to` or `subject` returns 400 before the token is read.

## Token resolution

Gmail is an alias for the shared Google credential. `_canon("gmail")` returns `google`, so the route reads the row that `/api/auth/google/start` created. The OAuth scopes requested are `gmail.readonly` and `gmail.send`, alongside `openid`, `email`, `profile`, `calendar`, and `youtube.readonly`.

```mermaid
flowchart TD
  A["_token()"] --> B["get_access_token('gmail')"]
  B --> C["canonical provider = google"]
  C --> D{"row exists?"}
  D -- no --> E["NeedsReauth not_connected"]
  D -- yes --> F{"status needs_reauth?"}
  F -- yes --> G["NeedsReauth"]
  F -- no --> H{"expires within 60 s?"}
  H -- no --> I["decrypt access token"]
  H -- yes --> J["_refresh_google"]
  J --> K{"refresh ok?"}
  K -- yes --> I
  K -- no --> L["flag row, raise"]
  I --> M["bearer token"]
  E --> N["401 needs_reauth"]
  G --> N
  L --> N
```

The 60 second skew avoids handing out a token that expires during the request. If refresh fails, the row status becomes `needs_reauth` and the user must reconnect. Agent turns use `resolve_google_token_optional`, which returns `None` instead of raising, so a missing Gmail connection does not stop the turn. The shared credential rules are in [Secret Storage](Secret%20Storage).

## Agent integration

`build_agent_tools` always includes the four Gmail tools. With a Google token it wraps each one with `_default_token`, so the model does not pass a token. Without one, the tools use Composio and may return a failure string instead of raising.

`gmail_agent` lists recent messages and accepts `max_results` plus an optional `composio_account_id`. `gmail_send_email` requires `to`, `subject`, and `body`. `gmail_list_unread` accepts a count and clamps it to 50. `gmail_mark_read` requires a message id and searches Composio actions with required term `read` and preferred terms `mark`, `message`, `gmail`, and `modify`.

Tool errors are returned as text with a `Failed to ...` prefix. The agent can recover in the same run instead of aborting the turn.

## Dependencies

```mermaid
graph TB
  Router["routers/gmail.py"] --> Service["services/gmail_service.py"]
  Router --> Agent["agents/react_tools.py"]
  Router --> OAuth["services/oauth_credentials_service.py"]
  Service --> List["tools/gmail/list_unread_emails.py"]
  Service --> Latest["tools/gmail/fetch_latest_mails.py"]
  Service --> Read["tools/gmail/mark_email_read.py"]
  Service --> Send["tools/gmail/send_email.py"]
  List --> Requests["requests"]
  Latest --> Requests
  Read --> Requests
  Send --> Requests
  Agent --> Composio["services/composio_service.py"]
  OAuth --> Crypto["core/crypto.py"]
```

## Performance and limits

- Every Gmail REST call uses an 8 second timeout.
- Listing fetches message metadata with one request per message. A list of 50 is 51 requests.
- Unread defaults to 10 and latest to 5. The agent tool clamps unread to 50 and recent to 25.
- The unread route depends on Composio availability even when Google is connected.

## Troubleshooting

- 401 with `needs_reauth`: reconnect Google in settings. A plain retry keeps raising.
- `to and subject are required`: the send body was missing one of them.
- `message_id is required`: the mark route got an empty id.
- Send returns 403: the `gmail.send` scope was not granted. Reconnect and check consent.
- Unread returns `Failed to list unread messages via Composio`: the route does not bind a Google token, so there is no REST fallback.
- Latest returns an empty list: the inbox query found nothing, or each detail request failed and was skipped.
- Mark read returns 404: the id is not in the authenticated mailbox.

## Appendix

### API endpoints

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/gmail/unread` | `{"max_results": 10}` | `{"answer": str}` |
| POST | `/api/gmail/latest` | `{"max_results": 5}` | `{"messages": [...]}` |
| POST | `/api/gmail/mark_read` | `{"message_id": "..."}` | `{"result": "ok", "details": {...}}` |
| POST | `/api/gmail/send` | `{"to", "subject", "body"}` | `{"result": "sent", "details": {...}}` |

### Implementation examples

- `list_unread(token, 10)` returns id, subject, from, date, and snippet rows.
- `get_latest_emails(token, 5)` returns the same shape for the inbox.

### Source files

- `routers/gmail.py`
- `services/gmail_service.py`
- `tools/gmail/list_unread_emails.py`
- `tools/gmail/fetch_latest_mails.py`
- `tools/gmail/mark_email_read.py`
- `tools/gmail/send_email.py`
- `agents/react_tools.py`
