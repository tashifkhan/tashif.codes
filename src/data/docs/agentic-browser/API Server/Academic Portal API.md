# Academic portal API

## Introduction
This page describes the Academic Portal API for integrating with the JIIT Webportal. It covers authentication, session lifecycle, and endpoints for retrieving academic data such as attendance, exam events and schedules, registered subjects, and grades. It also documents request/response schemas, authentication requirements, and practical integration patterns for educational automation.

## Project structure
The Academic Portal API is implemented as a FastAPI application with a dedicated router for JIIT integration. The router exposes endpoints under the /api/pyjiit prefix. The service layer encapsulates the JIIT Webportal integration via a wrapper class that handles HTTP requests, session headers, and authentication.

```mermaid
graph TB
Client["Client Application"] --> API["FastAPI App"]
API --> Router["PyJIIT Router (/api/pyjiit)"]
Router --> Service["PyJIIT Service"]
Service --> Wrapper["Webportal Wrapper"]
Wrapper --> JIIT["JIIT Webportal API<br/>https://webportal.jiit.ac.in:6011/StudentPortalAPI"]
```

## Core components
- Router: Defines endpoints for login, semesters, and attendance.
- Service: Orchestrates session creation, data retrieval, and normalization.
- Wrapper: Encapsulates JIIT Webportal HTTP calls, session headers, and authentication.
- Models: Pydantic models for login responses and session payloads.

Key responsibilities:
- Authentication: Username/password login with a prevalidated captcha token.
- Session: Bearer token-based session with LocalName header.
- Data Retrieval: Attendance, exam events, schedules, registered subjects, and grades.

## Architecture overview
The API follows a layered architecture:
- Presentation: FastAPI router defines endpoints and request/response models.
- Application: Service translates API requests into Webportal operations.
- Domain: Wrapper abstracts JIIT Webportal specifics and session management.
- External System: JIIT Webportal API accessed over HTTPS.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "PyJIIT Router"
participant S as "PyJIIT Service"
participant W as "Webportal Wrapper"
participant J as "JIIT Webportal API"
C->>R : POST /api/pyjiit/login
R->>S : login(username, password)
S->>W : student_login(username, password, captcha)
W->>J : POST /StudentPortalAPI/token/pretoken-check
J-->>W : pre-token
W->>J : POST /StudentPortalAPI/token/generate-token1
J-->>W : session payload
W-->>S : WebportalSession
S-->>R : session payload
R-->>C : {raw_response, token, ...}
C->>R : POST /api/pyjiit/attendence
R->>S : get_attendance(session_payload, registration_code?)
S->>W : get_attendance_meta()
W->>J : POST /StudentPortalAPI/StudentClassAttendance/...
J-->>W : attendance data
W-->>S : normalized attendance
S-->>R : [{subjectcode, subjectcode_code, LTpercantage}, ...]
R-->>C : attendance list
```

## Detailed component analysis

### Authentication and session management
- Endpoint: POST /api/pyjiit/login
- Purpose: Authenticate student credentials against the JIIT Webportal and return a session payload.
- Request body:
  - username: string
  - password: string
- Response body:
  - raw_response: includes regdata and client identifiers
  - regdata: top-level copy of registration data
  - institute, instituteid, memberid, userid, token, expiry, clientid, membertype, name
- Authentication requirements:
  - Uses a prevalidated captcha token for login.
  - On success, the response includes a JWT-like token and session metadata.
- Notes:
  - The wrapper constructs Authorization headers with a Bearer token and LocalName.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant S as "Service"
participant W as "Wrapper"
participant J as "JIIT API"
C->>R : POST /api/pyjiit/login {username,password}
R->>S : login(username, password)
S->>W : student_login(username, password, captcha)
W->>J : GET /token/getcaptcha
J-->>W : captcha
W->>J : POST /token/pretoken-check
J-->>W : pre-token
W->>J : POST /token/generate-token1
J-->>W : session payload
W-->>S : WebportalSession
S-->>R : {raw_response, regdata, token, ...}
R-->>C : session payload
```

### Semesters discovery
- Endpoint: POST /api/pyjiit/semesters
- Purpose: Retrieve the list of semesters registered for the authenticated student.
- Request body: session_payload (full login response or raw response dict)
- Response body: array of objects with registration_id and registration_code
- Authentication: Requires a valid session (Bearer token and LocalName header).
- Notes: Accepts either the full login response or the raw response dict.

```mermaid
flowchart TD
Start(["POST /api/pyjiit/semesters"]) --> Parse["Parse session_payload"]
Parse --> BuildSession["Build WebportalSession"]
BuildSession --> CallWP["Call Webportal.get_registered_semesters()"]
CallWP --> Return["Return [{registration_id, registration_code}, ...]"]
Return --> End(["Done"])
```

### Attendance retrieval
- Endpoint: POST /api/pyjiit/attendence
- Purpose: Fetch attendance for a specific semester.
- Request body:
  - session_payload: session payload (wrapper or raw)
  - registration_code: optional string (e.g., "2025ODDSEM"); if omitted, a hardcoded value is used
- Response body: array of objects with subject details and attendance percentage
- Authentication: Requires a valid session.
- Notes:
  - The implementation hardcodes a specific registration code and ID mapping.
  - Normalizes subject names by removing bracketed codes.

```mermaid
flowchart TD
Start(["POST /api/pyjiit/attendence"]) --> Parse["Parse session_payload"]
Parse --> BuildSession["Build WebportalSession"]
BuildSession --> Meta["get_attendance_meta()"]
Meta --> Hardcode["Select hardcoded registration code and ID"]
Hardcode --> GetAtt["get_attendance(header, semester)"]
GetAtt --> Normalize["Normalize subject names and codes"]
Normalize --> Return["Return normalized attendance list"]
Return --> End(["Done"])
```

### Exam schedules and academic data
While the primary router endpoints focus on login, semesters, and attendance, the underlying wrapper supports additional academic data retrieval. These capabilities are available for integration but are not exposed via the current router endpoints.

Available operations (not exposed by router):
- Registered subjects and faculties for a semester
- Exam events discovery
- Exam schedule retrieval
- Marks download (PDF)
- Grade card retrieval
- SGPA/CGPA data
- Fee summary and pending charges
- Subject choices

These operations rely on authenticated sessions and use the same header scheme (Bearer token + LocalName).

## Dependency analysis
The API components depend on each other as follows:
- Router depends on PyJIIT Service for business logic.
- Service depends on Webportal Wrapper for external API calls.
- Wrapper depends on shared models for captcha and session headers.
- Models define the shapes of login responses and session payloads.

```mermaid
graph LR
Router["routers/pyjiit.py"] --> Service["services/pyjiit_service.py"]
Service --> Wrapper["tools/pyjiit/wrapper.py"]
Wrapper --> Tokens["tools/pyjiit/tokens.py"]
Router --> Models["models/requests/pyjiit.py"]
```

## Performance considerations
- Network latency dominates performance; minimize round-trips by batching related operations where feasible.
- Reuse sessions: avoid repeated logins; persist and reuse the session payload.
- Caching: cache normalized attendance lists and semesters for short intervals to reduce load.
- Rate limiting: respect external API rate limits; implement retries with exponential backoff.
- Streaming: for large downloads (e.g., marks PDF), stream responses to reduce memory usage.

## Troubleshooting guide
Common issues and resolutions:
- Session expired or unauthorized:
  - Symptom: 401 Unauthorized or session expiration errors.
  - Action: Re-authenticate using /api/pyjiit/login and obtain a fresh session payload.
- Invalid or missing session payload:
  - Symptom: Errors when calling semesters or attendance endpoints.
  - Action: Ensure the session_payload is passed correctly (full login response or raw response dict).
- Attendance not returned:
  - Symptom: Empty attendance list.
  - Action: Verify the hardcoded registration code mapping and that the student has attendance records for the selected semester.
- Captcha-related login failures:
  - Symptom: Login errors during token generation.
  - Action: Confirm the prevalidated captcha token is included in the login flow.

## Conclusion
The Academic Portal API provides a focused interface for JIIT Webportal integration, enabling secure session-based access to academic data. By centralizing authentication and normalizing responses, it simplifies client integrations for attendance monitoring, exam scheduling, and broader academic workflows. Extending the router to expose additional endpoints (e.g., exam schedules, registered subjects) would further enable detailed automation scenarios.

## Appendices

### Endpoint reference

- POST /api/pyjiit/login
  - Description: Authenticate and return a session payload.
  - Request: { username: string, password: string }
  - Response: { raw_response, regdata, token, expiry,... }

- POST /api/pyjiit/semesters
  - Description: List registered semesters for the authenticated student.
  - Request: { session_payload: object }
  - Response: [{ registration_id: string, registration_code: string }]

- POST /api/pyjiit/attendence
  - Description: Retrieve attendance for a semester.
  - Request: { session_payload: object, registration_code?: string }
  - Response: [{ subjectcode: string, subjectcode_code: string, LTpercantage: string }]

Notes:
- The attendance endpoint intentionally uses the misspelled "attendence" to match user expectations.
- The semesters endpoint accepts either the full login response or the raw response dict.

### Authentication details
- Header scheme:
  - Authorization: Bearer <token>
  - LocalName: generated value
- Token parsing:
  - The session payload includes a JWT-like token; the service extracts expiry from the payload when available.

### Data privacy and limitations
- Privacy:
  - Credentials and tokens are transmitted over HTTPS; handle tokens securely and avoid logging sensitive data.
  - Minimize retention of session payloads; invalidate on logout or after use.
- Limitations:
  - The attendance endpoint currently uses a hardcoded registration code mapping; adjust as needed for different semesters.
  - Some endpoints require a valid session; ensure proper error handling for unauthorized or expired sessions.

### Client integration patterns
- Automated attendance monitoring:
  - Periodically call /api/pyjiit/login to refresh session, then /api/pyjiit/attendence to retrieve and compare attendance lists.
- Academic workflow automation:
  - Use /api/pyjiit/semesters to discover semesters, then integrate with additional wrapper operations (e.g., exam events, schedules) to build a dashboard.
- Error resilience:
  - Implement retry logic for transient network errors and handle 401 responses by re-authenticating.

[No sources needed since this section provides general guidance]
