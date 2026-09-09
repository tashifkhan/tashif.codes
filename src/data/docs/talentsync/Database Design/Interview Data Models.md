# Interview data models

## Introduction
This page provides detailed documentation for the Interview data models and workflows in the system. It focuses on:
- InterviewRequest and InterviewAnswer models and their relationships with user models
- InterviewRequest model fields for role specification, company information, user knowledge context, word limits, and JSON-stored question arrays
- InterviewAnswer model for capturing candidate responses with question-answer pair relationships and temporal tracking
- Interview workflow integration with AI-generated questions, answer evaluation processes, and session management
- JSON field usage for dynamic question structures
- Interview session lifecycle management, answer submission tracking, and evaluation workflows
- Data privacy considerations for interview content, response storage strategies, and integration with the AI interview system
- Structured approach to interview analytics and performance tracking through stored data relationships

## Project structure
The interview system spans backend Pydantic models, FastAPI routes, LangGraph orchestration, and frontend data types. The database schema defines InterviewRequest and InterviewAnswer entities with foreign keys to the User model.

```mermaid
graph TB
subgraph "Backend"
R["Routes<br/>interview.py"]
G["Graph Orchestrator<br/>graph.py"]
SM["Session Manager<br/>session_manager.py"]
QG["Question Generator<br/>question_generator.py"]
AE["Answer Evaluator<br/>answer_evaluator.py"]
S["Schemas & Enums<br/>schemas.py, enums.py"]
T["Templates<br/>templates.py"]
end
subgraph "Frontend"
FT["Types<br/>interview.ts"]
PRISMA["Prisma Schema<br/>schema.prisma"]
end
R --> G
G --> SM
G --> QG
G --> AE
QG --> T
G --> S
R --> S
FT --> PRISMA
PRISMA --> |"Foreign Keys"| FT
```

## Core components
This section documents the primary data models and their responsibilities.

- InterviewRequest (database model)
  - Purpose: Stores user interview requests with role, company info, user knowledge context, word limits, and JSON-stored questions
  - Fields: id, userId, role, questions (JSON), companyName, userKnowledge (optional), companyUrl (optional), wordLimit, createdAt
  - Relationship: Belongs to User; has many InterviewAnswer
  - Notes: Uses JSON for dynamic question arrays; integrates with user models

- InterviewAnswer (database model)
  - Purpose: Captures candidate responses to specific questions
  - Fields: id, requestId, question, answer, createdAt
  - Relationship: Belongs to InterviewRequest
  - Notes: Temporal tracking via createdAt; pairs with InterviewRequest

- InterviewSession (Pydantic model)
  - Purpose: Runtime session representation for AI-driven interviews
  - Fields: session_id, status, profile, config, questions, current_question_index, final_score, summary, strengths, weaknesses, recommendations, hiring_recommendation, tab_switch_count, events, timestamps
  - Notes: Central runtime model for streaming and evaluation workflows

- InterviewQuestion (Pydantic model)
  - Purpose: Individual question with optional answer and evaluation
  - Fields: id, index, question, difficulty, source, topic, expected_keywords, follow_up_questions, code_challenge, answer, code_submission, code_language, score, feedback, strengths, improvements, answered_at
  - Notes: Supports coding challenges and evaluation metadata

- CandidateProfile (Pydantic model)
  - Purpose: Candidate identity and resume context
  - Fields: name, email, phone, resume_text, resume_data (JSON)
  - Notes: JSON resume_data enables flexible candidate background

- InterviewConfig (Pydantic model)
  - Purpose: Interview configuration
  - Fields: role, template_id, topic, num_questions, difficulty_distribution, time_limit_minutes, includes_coding, coding_languages, voice_enabled, voice_language
  - Notes: Controls question generation and behavior

- Enums
  - DifficultyLevel: easy, medium, hard
  - InterviewStatus: pending, in_progress, completed, cancelled
  - QuestionSource: resume_based, role_based, behavioral, technical, coding
  - InterviewEventType: tab_switch, focus_lost, focus_gained, code_executed, question_skipped, session_paused, session_resumed

- Templates
  - InterviewTemplate: role-specific templates with question banks, topics, coding flags, and difficulty distributions
  - QuestionTemplate: reusable question entries with metadata

## Architecture overview
The interview workflow integrates FastAPI routes, a LangGraph orchestrator, and service components for question generation, evaluation, and code execution. Sessions are managed in-memory but designed for persistence.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Routes as "FastAPI Routes<br/>interview.py"
participant Graph as "InterviewGraph<br/>graph.py"
participant SM as "SessionManager<br/>session_manager.py"
participant QG as "QuestionGenerator<br/>question_generator.py"
participant AE as "AnswerEvaluator<br/>answer_evaluator.py"
Client->>Routes : POST /interview/sessions
Routes->>Graph : create_session(profile, config)
Graph->>SM : create(profile, config)
Graph->>QG : generate_questions(role, num, dist, template, topic, resume_data)
QG-->>Graph : List[InterviewQuestion]
Graph->>SM : save(session)
Routes-->>Client : InterviewSessionResponse
Client->>Routes : POST /interview/sessions/{session_id}/answer
Routes->>Graph : submit_answer(session_id, question_id, answer)
Graph->>AE : evaluate(question, answer, role)
AE-->>Graph : EvaluationResult
Graph->>SM : save(session)
Routes-->>Client : {score, feedback, strengths, improvements, next_question, is_complete}
```

## Detailed component analysis

### InterviewRequest model
- Purpose: Encapsulates user interview requests with structured fields for role, company, knowledge context, and JSON-stored questions
- Key fields:
  - role: specifies the job role for the interview
  - questions: JSON array storing dynamic question structures
  - companyName: company name associated with the request
  - userKnowledge: optional free-text context about the candidate's knowledge
  - companyUrl: optional company website
  - wordLimit: integer limit for response length
  - createdAt: timestamp for auditability
- Relationship: belongs to User; has many InterviewAnswer
- JSON usage: questions field stores dynamic arrays enabling flexible question structures without rigid schema constraints

```mermaid
erDiagram
USER {
string id PK
}
INTERVIEW_REQUEST {
string id PK
string userId FK
string role
json questions
string companyName
string userKnowledge
string companyUrl
int wordLimit
timestamp createdAt
}
INTERVIEW_ANSWER {
string id PK
string requestId FK
string question
string answer
timestamp createdAt
}
USER ||--o{ INTERVIEW_REQUEST : "has many"
INTERVIEW_REQUEST ||--o{ INTERVIEW_ANSWER : "has many"
```

### InterviewAnswer model
- Purpose: Captures individual candidate answers to specific questions
- Key fields:
  - question: the question text
  - answer: the candidate's response
  - createdAt: timestamp for temporal tracking
- Relationship: belongs to InterviewRequest
- Notes: Supports temporal tracking and pairing with InterviewRequest for analytics

### InterviewSession and InterviewQuestion (runtime models)
- InterviewSession
  - Tracks session lifecycle, current question index, evaluation results, and events
  - Includes timestamps for created_at, started_at, completed_at
  - Maintains events list for integrity tracking (e.g., tab switches)
- InterviewQuestion
  - Supports coding challenges with code_submission and code_language
  - Stores evaluation metadata: score, feedback, strengths, improvements, answered_at

```mermaid
classDiagram
class InterviewSession {
+string session_id
+InterviewStatus status
+CandidateProfile profile
+InterviewConfig config
+InterviewQuestion[] questions
+int current_question_index
+int final_score
+string summary
+string[] strengths
+string[] weaknesses
+string[] recommendations
+string hiring_recommendation
+int tab_switch_count
+dict[] events
+datetime created_at
+datetime started_at
+datetime completed_at
}
class InterviewQuestion {
+string id
+int index
+string question
+DifficultyLevel difficulty
+QuestionSource source
+string topic
+string[] expected_keywords
+string[] follow_up_questions
+string code_challenge
+string answer
+string code_submission
+string code_language
+int score
+string feedback
+string[] strengths
+string[] improvements
+datetime answered_at
}
InterviewSession "1" o-- "*" InterviewQuestion : "contains"
```

### Interview workflow integration
- Question Generation
  - Uses QuestionGenerator to produce InterviewQuestion lists based on InterviewConfig and templates
  - Supports template-based and LLM-based question generation with fallbacks
- Answer Evaluation
  - AnswerEvaluator provides synchronous and streaming evaluation with structured results
  - Parses LLM responses and supports code review streaming
- Code Execution
  - Executes candidate code submissions and streams results and reviews
- Session Management
  - SessionManager maintains in-memory sessions and events; designed for persistence extension
  - Updates status transitions and tracks tab switches and other events

```mermaid
flowchart TD
Start(["Create Session"]) --> Gen["Generate Questions"]
Gen --> Submit["Submit Answer"]
Submit --> Eval["Evaluate Answer"]
Eval --> Update["Update Session"]
Update --> Next{"More Questions?"}
Next --> |Yes| Submit
Next --> |No| Summary["Generate Summary"]
Summary --> Complete(["Mark Completed"])
```

### Frontend data models and relationships
- Frontend types define InterviewSession and InterviewRequest for UI consumption
- These align conceptually with backend models and database entities
- InterviewSession includes id, role, companyName, createdAt, and questionsAndAnswers
- InterviewRequest mirrors backend InterviewRequest fields for user input

## Dependency analysis
The backend components depend on each other to orchestrate the interview lifecycle. The routes depend on the graph, which depends on session management, question generation, and evaluation services.

```mermaid
graph LR
Routes["routes/interview.py"] --> Graph["services/interview/graph.py"]
Graph --> SM["services/interview/session_manager.py"]
Graph --> QG["services/interview/question_generator.py"]
Graph --> AE["services/interview/answer_evaluator.py"]
QG --> Templates["models/interview/templates.py"]
Graph --> Schemas["models/interview/schemas.py"]
Routes --> Schemas
```

## Performance considerations
- Streaming evaluation and code review reduce perceived latency and improve UX
- In-memory session storage is efficient for small-scale usage; consider persistence for production
- JSON fields enable flexibility but may require careful indexing and validation strategies
- Template-based question generation reduces LLM invocation overhead when applicable

## Troubleshooting guide
- Session not found errors indicate invalid session_id or expired sessions
- Question mismatch errors occur when submitted question_id does not match current session state
- Evaluation failures return default scores and feedback; check LLM availability and prompt formatting
- Tab switch counting helps detect potential misconduct; monitor counts for integrity

## Conclusion
The Interview data models and workflows provide a reliable foundation for AI-driven interviews. InterviewRequest and InterviewAnswer integrate with user models and JSON fields for dynamic question structures. The runtime models (InterviewSession, InterviewQuestion) support streaming evaluation, code execution, and detailed analytics. Session lifecycle management, answer submission tracking, and evaluation workflows are orchestrated through LangGraph services, ensuring scalability and maintainability.

## Appendices
- Interview templates support role-specific question banks and coding challenges
- Enums standardize difficulty levels, statuses, sources, and event types
- Frontend types align with backend models for smooth UI integration
