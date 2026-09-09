# Session management

## Introduction
This page provides a detailed guide to the Session Management component for digital interviews. It explains the interview session lifecycle from creation to termination, including state tracking, progress monitoring, and real-time synchronization. It documents the SessionManager class, session persistence strategies, configuration options, participant management, access control, and frontend integration via React Query hooks. It also covers workflows such as session resumption, timeout handling, and audit trail maintenance for compliance.

## Project structure
The Session Management feature spans backend services and models, FastAPI routes, and frontend React Query hooks:
- Backend Python modules define interview data models, session lifecycle, and orchestration.
- FastAPI routes expose endpoints for session CRUD, answer submission, code execution, and event recording.
- Frontend React Query hooks integrate with the backend to manage interview sessions client-side.

```mermaid
graph TB
subgraph "Backend"
SM["SessionManager<br/>in-memory storage"]
IG["InterviewGraph<br/>orchestrates flow"]
RT["FastAPI Routes<br/>/interview/*"]
MD["Models & Enums<br/>schemas.py, enums.py"]
end
subgraph "Frontend"
RQ["React Query Hooks<br/>use-interviews.ts"]
SVC["Service Layer<br/>interview.service.ts"]
TYP["Types<br/>interview.ts"]
end
RQ --> SVC
SVC --> RT
RT --> IG
IG --> SM
IG --> MD
```

## Core components
- SessionManager: In-memory session and event storage with lifecycle operations (create, start, complete, cancel, delete, list, cleanup).
- InterviewGraph: Orchestrates session creation, question progression, answer evaluation, code execution, and summary generation.
- FastAPI Routes: Expose endpoints for session management, answer submission (streaming and non-streaming), code execution, summary generation, and event recording.
- Models and Enums: Define InterviewSession, InterviewConfig, InterviewEvent, InterviewQuestion, and related enumerations for statuses, event types, and difficulty levels.

Key responsibilities:
- Session lifecycle: creation, start, progress tracking, completion/cancellation, deletion, and cleanup.
- Real-time state synchronization: streaming endpoints for answers and summaries.
- Audit and integrity: event recording for tab switches and focus changes.
- Persistence strategy: current in-memory storage with production extension points to PostgreSQL.

## Architecture overview
The system follows a layered architecture:
- Presentation: FastAPI routes handle HTTP requests and responses, including SSE streaming.
- Application: InterviewGraph coordinates services and manages session state transitions.
- Domain: SessionManager encapsulates session and event persistence.
- Data: Pydantic models define session, config, and event structures.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "FastAPI Routes"
participant IG as "InterviewGraph"
participant SM as "SessionManager"
FE->>API : POST /interview/sessions
API->>IG : create_session(profile, config)
IG->>SM : create(profile, config)
SM-->>IG : InterviewSession
IG-->>API : InterviewSessionResponse
API-->>FE : {session, current_question}
FE->>API : POST /interview/sessions/{id}/answer
API->>IG : submit_answer(session_id, question_id, answer)
IG->>SM : get_session(session_id)
IG-->>API : evaluation + next_question
API-->>FE : {score, feedback, next_question, is_complete}
```

## Detailed component analysis

### SessionManager
Responsibilities:
- Create sessions with initial status and timestamps.
- Persist sessions and maintain event logs per session.
- Track and update session progress (current question index).
- Record InterviewEvents and update derived metrics (e.g., tab switch count).
- Manage lifecycle operations: start, complete, cancel, delete, list, and cleanup old sessions.
- Provide counts and health metrics.

Design highlights:
- In-memory dictionaries for sessions and events keyed by session_id.
- Thread-safe in-process usage; production-grade persistence can be added via PostgreSQL integration.

```mermaid
classDiagram
class SessionManager {
-Dict~str, InterviewSession~ _sessions
-Dict~str, InterviewEvent[]~ _events
+create(profile, config) InterviewSession
+get(session_id) InterviewSession
+save(session) void
+delete(session_id) bool
+list_sessions(status, limit) InterviewSession[]
+record_event(event) void
+get_events(session_id, event_type) InterviewEvent[]
+count_events(session_id, event_type) int
+start_interview(session_id) InterviewSession
+complete_interview(session_id) InterviewSession
+cancel_interview(session_id) InterviewSession
+get_session_count() int
+cleanup_old_sessions(max_age_hours) int
}
```

### InterviewGraph
Responsibilities:
- Orchestrate the interview flow: create session, generate questions, evaluate answers, execute code, and generate summaries.
- Coordinate with SessionManager for state persistence.
- Provide streaming responses for evaluation and summary generation.

Key flows:
- Session creation: generates questions, sets status to in-progress, records start time.
- Answer submission: validates current question, evaluates answer, updates session, advances to next question, completes session if last.
- Code execution: executes code, stores submission, evaluates code, updates session.
- Summary generation: computes final score and recommendations, marks session as completed.

```mermaid
flowchart TD
Start([Start]) --> Create["create_session(profile, config)"]
Create --> GenQ["Generate questions"]
GenQ --> SaveS["Save session (IN_PROGRESS)"]
SaveS --> Submit["submit_answer(session_id, question_id, answer)"]
Submit --> Eval["Evaluate answer"]
Eval --> UpdateQ["Update question (score, feedback, answered_at)"]
UpdateQ --> NextQ{"Next question?"}
NextQ --> |Yes| SaveS
NextQ --> |No| Complete["complete_interview(session_id)"]
Complete --> End([End])
```

### Interview session lifecycle
Lifecycle stages:
- Creation: SessionManager creates a session with PENDING status and initializes events list.
- Start: InterviewGraph starts the session, sets IN_PROGRESS and started_at.
- Progress: Answer submission increments current_question_index; code execution stores submissions.
- Completion: When the last question is processed, the session is marked COMPLETED with completed_at.
- Termination: Sessions can be cancelled or deleted; old sessions can be cleaned up.

```mermaid
stateDiagram-v2
[*] --> Pending
Pending --> InProgress : "start_interview()"
InProgress --> Completed : "complete_interview()"
InProgress --> Cancelled : "cancel_interview()"
Completed --> [*]
Cancelled --> [*]
```

### Session configuration options
InterviewConfig supports:
- Role and optional template/topic.
- Number of questions and difficulty distribution.
- Time limits, coding inclusion, and supported languages.
- Voice settings (enabled/disabled and language).

These options influence question generation and session behavior.

### Participant management and access control
- Session retrieval and mutations require a valid session_id; routes return 404 if not found.
- Event recording requires a valid session_id and supports event type validation.
- No explicit user identity is modeled in the session data; access control can be enforced at the route level using authentication middleware.

### Real-Time state synchronization
Streaming endpoints:
- Answer submission streaming: yields partial evaluation chunks and a final complete event.
- Code execution streaming: yields execution result followed by code review chunks and a final complete event.
- Summary streaming: yields summary chunks and a final complete event.

SSE generator converts async generators to Server-Sent Events with appropriate event types.

### Session persistence strategies
Current implementation:
- In-memory storage via SessionManager dictionaries for sessions and events.

Production extension points:
- Routes demonstrate persistence via SessionManager; production can integrate PostgreSQL using asyncpg or ORM.
- The comment in SessionManager indicates extending persistence to PostgreSQL.

### Audit trail and integrity tracking
- InterviewEvent captures session_id, event_type, timestamp, and metadata.
- Tab switch counting is maintained and exposed; excessive tab switches can be flagged for review.
- Focus gained/lost and other events are supported for integrity tracking.

### Frontend integration with React hooks
Frontend hooks:
- use-interviews.ts integrates with the backend via interview.service.ts to fetch and mutate interview data.
- Types in interview.ts define the shape of interview sessions and requests.

Note: The provided frontend files primarily cover generic interview data fetching and deletion. Specific interview session state management and real-time updates would typically be handled by additional hooks and services aligned with the backend streaming endpoints.

### Examples of session workflows

#### Workflow 1: basic interview from setup to completion
- Create session with profile and config.
- Start interview (status becomes IN_PROGRESS).
- Submit answers; session progresses through questions.
- On last question, session is marked COMPLETED.
- Optionally generate summary.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "FastAPI Routes"
participant IG as "InterviewGraph"
participant SM as "SessionManager"
FE->>API : POST /interview/sessions
API->>IG : create_session(...)
IG->>SM : create(...)
IG-->>API : session
API-->>FE : session
loop For each question
FE->>API : POST /interview/sessions/{id}/answer
API->>IG : submit_answer(...)
IG->>SM : save(session)
IG-->>API : evaluation + next_question
API-->>FE : result
end
FE->>API : GET /interview/sessions/{id}/summary
API->>IG : generate_summary(...)
IG->>SM : save(session)
IG-->>API : summary
API-->>FE : summary
```

#### Workflow 2: timeout handling and cleanup
- Old sessions can be removed after a configurable threshold (hours).
- Health endpoint reports active session count.

```mermaid
flowchart TD
Start([Start]) --> Scan["Scan sessions"]
Scan --> Age{"Age > max_age?"}
Age --> |Yes| Remove["delete(session_id)"]
Age --> |No| Keep["Keep session"]
Remove --> Count["removed++"]
Count --> Scan
Keep --> Scan
Scan --> Done([Done])
```

#### Workflow 3: session resumption
- Current in-memory implementation does not persist state across restarts.
- To support resumption, integrate SessionManager with persistent storage (e.g., PostgreSQL) and restore sessions on startup.

### Concurrent session handling
- SessionManager uses in-memory dictionaries keyed by session_id, enabling concurrent access within a single process.
- For multi-instance deployments, replace in-memory storage with a shared database and add locking or optimistic concurrency controls.

### Session security measures
- Session existence checks are performed before mutating state (routes return 404 if not found).
- Event recording validates session presence.
- No built-in user identity is attached to sessions; enforce access control at the route level using authentication and authorization middleware.

### Compliance and audit trail maintenance
- InterviewEvent captures timestamps and metadata for each event.
- Tab switch counts and other event types enable integrity monitoring.
- Summaries and scores are persisted with the session for final audit records.

## Dependency analysis
The following diagram shows key dependencies among components:

```mermaid
graph LR
RT["Routes (interview.py)"] --> IG["InterviewGraph (graph.py)"]
IG --> SM["SessionManager (session_manager.py)"]
IG --> MD["Models & Enums (schemas.py, enums.py)"]
FE_Hooks["use-interviews.ts"] --> FE_Svc["interview.service.ts"]
FE_Svc --> RT
```

## Performance considerations
- In-memory storage is efficient but not persistent; consider database-backed storage for production.
- Streaming endpoints reduce client wait times; ensure proper buffering and backpressure handling.
- Cleanup_old_sessions helps control memory usage; tune max_age_hours based on retention policies.
- Consider indexing and pagination for list_sessions when scaling.

## Troubleshooting guide
Common issues and resolutions:
- Session not found: Ensure session_id is valid and created before use. Routes return 404 for missing sessions.
- Question mismatch: When submitting answers, the provided question_id must match the current question; otherwise, validation errors are raised.
- Excessive tab switches: Tab switch count is tracked; flag sessions with high counts for review.
- Streaming errors: SSE generator emits error events; inspect client-side event handlers for error payloads.

## Conclusion
The Session Management component provides a reliable foundation for managing interview sessions with clear lifecycle stages, real-time streaming capabilities, and event-driven integrity tracking. While the current implementation uses in-memory storage, the architecture supports straightforward persistence integration for production environments. Frontend integration can be extended to use streaming endpoints and centralized state management for a smooth user experience.

## Appendices

### API reference summary
- Create session: POST /interview/sessions
- Get session: GET /interview/sessions/{session_id}
- Delete session: DELETE /interview/sessions/{session_id}
- List sessions: GET /interview/sessions
- Submit answer (non-streaming): POST /interview/sessions/{session_id}/answer
- Submit answer (streaming): POST /interview/sessions/{session_id}/answer/stream
- Execute code (non-streaming): POST /interview/sessions/{session_id}/code
- Execute code (streaming): POST /interview/sessions/{session_id}/code/stream
- Skip question: POST /interview/sessions/{session_id}/skip
- Get summary (non-streaming): GET /interview/sessions/{session_id}/summary
- Generate summary (streaming): POST /interview/sessions/{session_id}/summary/stream
- Record event: POST /interview/sessions/{session_id}/events
- Get events: GET /interview/sessions/{session_id}/events
- Health: GET /interview/health
