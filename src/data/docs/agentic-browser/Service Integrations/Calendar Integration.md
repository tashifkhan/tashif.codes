# Calendar integration

## Introduction
This page explains the Google Calendar service integration implemented in the project. It covers calendar operations (event listing and creation), the OAuth2 authentication flow for Google Calendar API, scope configuration, request/response handling, and operational guidelines. It also documents date/time handling, timezone behavior, and practical guidance for performance and troubleshooting.

## Project structure
The calendar integration spans three layers:
- Frontend extension: handles OAuth2 login, token storage, and token refresh.
- Backend API: exposes endpoints to list and create calendar events using an access token.
- Tools layer: wraps Google Calendar API calls (HTTP requests) for listing and creating events.

```mermaid
graph TB
subgraph "Extension (Browser)"
UA["useAuth.ts<br/>OAuth2 flow, token refresh"]
end
subgraph "Backend API"
API["FastAPI app<br/>main.py"]
R["Calendar router<br/>routers/calendar.py"]
S["CalendarService<br/>services/calendar_service.py"]
end
subgraph "Tools Layer"
T1["get_calendar_events<br/>tools/calendar/get_calender_events.py"]
T2["create_calendar_event<br/>tools/calendar/create_calender_events.py"]
end
UA --> API
API --> R
R --> S
S --> T1
S --> T2
```

## Core components
- CalendarService: orchestrates calendar operations by delegating to tools that call Google Calendar API.
- Routers: FastAPI endpoints validating inputs and invoking CalendarService.
- Tools: HTTP clients to Google Calendar API for listing and creating events.
- Extension auth hook: manages OAuth2 login, token refresh, and storage.

Key responsibilities:
- Event listing: fetches upcoming primary calendar events with pagination and ordering.
- Event creation: posts a new event to the primary calendar with ISO 8601 timestamps and UTC timezone.
- Authentication: obtains and refreshes access tokens via browser identity APIs and backend token exchange endpoints.

## Architecture overview
The integration follows a layered architecture:
- Extension frontend authenticates the user and stores tokens.
- Backend routes accept validated requests and delegate to the service layer.
- Service layer invokes tools that call Google Calendar API.
- Tools encapsulate HTTP calls and error handling.

```mermaid
sequenceDiagram
participant Ext as "Extension UI"
participant Auth as "useAuth.ts"
participant BE as "FastAPI Router"
participant SVC as "CalendarService"
participant Tool as "Tools (HTTP)"
participant GCAL as "Google Calendar API"
Ext->>Auth : "Initiate login"
Auth->>BE : "Exchange authorization code for tokens"
BE-->>Auth : "Access/Refresh tokens"
Ext->>BE : "POST /api/calendar/events {access_token, max_results}"
BE->>SVC : "list_events()"
SVC->>Tool : "get_calendar_events()"
Tool->>GCAL : "GET /calendar/v3/calendars/primary/events"
GCAL-->>Tool : "200 + events"
Tool-->>SVC : "events"
SVC-->>BE : "events"
BE-->>Ext : "{events}"
Ext->>BE : "POST /api/calendar/create {access_token, summary, start_time, end_time}"
BE->>SVC : "create_event()"
SVC->>Tool : "create_calendar_event()"
Tool->>GCAL : "POST /calendar/v3/calendars/primary/events"
GCAL-->>Tool : "200 + event"
Tool-->>SVC : "event"
SVC-->>BE : "event"
BE-->>Ext : "{result : created, event}"
```

## Detailed component analysis

### CalendarService
- Responsibilities:
  - List events: delegates to the listing tool with access token and max results.
  - Create event: delegates to the creation tool with access token, summary, start/end times, and optional description.
- Error handling: logs exceptions and re-raises to the caller.

```mermaid
classDiagram
class CalendarService {
+list_events(access_token, max_results) list
+create_event(access_token, summary, start_time, end_time, description) dict
}
class GetCalendarEvents {
+get_calendar_events(access_token, max_results) list
}
class CreateCalendarEvent {
+create_calendar_event(access_token, summary, start_time, end_time, description) dict
}
CalendarService --> GetCalendarEvents : "delegates"
CalendarService --> CreateCalendarEvent : "delegates"
```

### Routers: calendar endpoints
- GET-style endpoints (POST with request bodies) for:
  - Listing events: validates presence of access token and max results; forwards to service.
  - Creating events: validates presence of access token, summary, and ISO 8601 start/end times; forwards to service.
- Request validation:
  - Enforces ISO 8601 format for start_time and end_time.
  - Returns HTTP 400 for invalid or missing fields.
- Response:
  - Listing returns a list of events.
  - Creation returns a result and the created event object.

```mermaid
flowchart TD
Start(["POST /api/calendar/events"]) --> CheckAT["Validate access_token present"]
CheckAT --> ATOK{"access_token OK?"}
ATOK --> |No| E400["HTTP 400"]
ATOK --> |Yes| CallSvc["Call CalendarService.list_events()"]
CallSvc --> Done(["Return {events}"])
Start2(["POST /api/calendar/create"]) --> Vars["Validate access_token, summary, start_time, end_time"]
Vars --> VOK{"All required fields?"}
VOK --> |No| E400_2["HTTP 400"]
VOK --> |Yes| ISO["Validate ISO 8601 for start_time and end_time"]
ISO --> ISOOK{"ISO valid?"}
ISOOK --> |No| E400_3["HTTP 400"]
ISOOK --> |Yes| CallSvc2["Call CalendarService.create_event()"]
CallSvc2 --> Done2(["Return {result: created, event}"])
```

### Tools: Google calendar API wrappers
- Listing events:
  - Endpoint: primary calendar events.
  - Query parameters: max results, order by start time, single events, minimum time from now.
  - Timeout: short-lived GET.
- Creating events:
  - Endpoint: primary calendar events.
  - Payload: summary, description, start/end with dateTime and timezone set to UTC.
  - Timeout: moderate POST.
- Error handling: raises exceptions on non-200 responses.

```mermaid
sequenceDiagram
participant Svc as "CalendarService"
participant ToolGet as "get_calendar_events"
participant ToolPost as "create_calendar_event"
participant GCAL as "Google Calendar API"
Svc->>ToolGet : "GET /calendar/v3/calendars/primary/events"
ToolGet->>GCAL : "GET with params"
GCAL-->>ToolGet : "200 + items"
Svc->>ToolPost : "POST /calendar/v3/calendars/primary/events"
ToolPost->>GCAL : "POST with event body"
GCAL-->>ToolPost : "200 + event"
```

### Authentication flow (OAuth2)
- Extension login:
  - Uses browser identity APIs to launch web auth flow with configured client ID and scopes.
  - Scopes include Google Calendar and Gmail scopes.
  - Exchanges authorization code for tokens via backend endpoints.
  - Stores access and refresh tokens, along with metadata.
- Token refresh:
  - Automatically refreshes access tokens when nearing expiration if a refresh token exists.
  - Provides manual refresh capability in UI.

```mermaid
sequenceDiagram
participant UI as "Extension UI"
participant ExtAuth as "useAuth.ts"
participant BE as "Backend"
participant Google as "Google OAuth"
UI->>ExtAuth : "handleLogin()"
ExtAuth->>Google : "Launch auth flow with client_id + scopes"
Google-->>ExtAuth : "Authorization code"
ExtAuth->>BE : "POST /exchange-code {code, redirect_uri}"
BE-->>ExtAuth : "access_token, refresh_token, expires_in"
ExtAuth->>Google : "GET /oauth2/v2/userinfo?access_token"
Google-->>ExtAuth : "User info"
ExtAuth-->>UI : "Store tokens and status"
```

### Agent tool integration
- React agent tools define Pydantic models for calendar operations:
  - CalendarToolInput: access token and max results.
  - CalendarCreateEventInput: summary, start_time, end_time, description, optional access token.
- Tools:
  - _calendar_tool: fetches events via get_calendar_events.
  - _calendar_create_event_tool: creates events via create_calendar_event.
- Behavior:
  - Bounds max_results to a safe range.
  - Uses provided token or a default token when available.

## Dependency analysis
- API wiring:
  - FastAPI app registers the calendar router under /api/calendar.
- Router-to-service:
  - Routers depend on CalendarService instances.
- Service-to-tools:
  - CalendarService depends on tools for listing and creating events.
- Frontend-to-backend:
  - Extension uses backend endpoints to exchange code and manage tokens.

```mermaid
graph LR
Main["api/main.py"] --> CalR["routers/calendar.py"]
CalR --> Svc["services/calendar_service.py"]
Svc --> TGet["tools/calendar/get_calender_events.py"]
Svc --> TPost["tools/calendar/create_calender_events.py"]
Ext["extension/useAuth.ts"] --> Main
```

## Performance considerations
- Timeouts:
  - Listing events uses a short timeout for responsiveness.
  - Creating events uses a slightly longer timeout to accommodate network variability.
- Pagination and ordering:
  - Listing events orders by start time and returns single events only, reducing payload size.
- Rate limits:
  - No explicit quota handling is implemented in the code. When interacting with Google Calendar API, observe per-user and per-project quotas. Consider batching operations and adding retry/backoff logic if needed.
- Timezone handling:
  - Event creation sets timezone to UTC in the request payload. Ensure callers supply ISO 8601 timestamps in the intended local time; the API will interpret them accordingly.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing or invalid access token:
  - Ensure the access token is present and not expired. Use the extension's token display and refresh controls.
- Invalid ISO 8601 timestamps:
  - Verify start_time and end_time conform to ISO 8601. The router enforces this and returns HTTP 400 otherwise.
- Network timeouts:
  - Listing and creation endpoints specify timeouts. Retry after verifying connectivity and token validity.
- Token refresh failures:
  - If automatic refresh fails, use the manual refresh button in the extension UI to obtain a new access token.
- Backend endpoint errors:
  - The router catches exceptions and returns HTTP 500 with the error message. Check backend logs for details.

Operational checks:
- Confirm backend is running and reachable.
- Verify the calendar router is registered under /api/calendar.
- Ensure the extension has stored a valid access token and refresh token when available.

## Conclusion
The calendar integration provides a clean separation of concerns: the extension manages authentication and token lifecycle, the backend exposes typed endpoints with validation, the service layer coordinates operations, and the tools encapsulate Google Calendar API interactions. By adhering to ISO 8601 timestamps, UTC timezone semantics, and reliable error handling, the system supports reliable calendar operations. For production deployments, consider adding quota awareness, retry/backoff strategies, and improved logging for diagnostics.
