# Feature implementation

## Introduction
This page provides feature implementation details for the core capabilities of TalentSync-Normies:
- Resume analysis engine: text processing pipeline, NLP integration, and result structuring
- ATS optimization system: keyword analysis, formatting recommendations, and compatibility scoring
- Interview preparation system: question generation logic, answer evaluation criteria, and interview analytics
- Communication tools: cold email generation, cover letter creation, and LinkedIn post generator
- User management, role-based access control, and authentication integration
- Feature-specific UI components, state management, and API integrations

The platform combines a Next.js frontend with a FastAPI backend, integrating LangChain-based NLP prompts and Pydantic models for structured outputs. The backend exposes REST APIs organized by feature domains, while the frontend consumes these APIs and renders domain-specific UI components.

## Project structure
The repository follows a clear separation of concerns:
- Backend (FastAPI): routes, services, models, prompts, and core infrastructure
- Frontend (Next.js): pages, components, services, and UI state management
- Shared data models and prompts under backend for consistent schema enforcement
- Authentication via NextAuth integration in the frontend

```mermaid
graph TB
subgraph "Frontend (Next.js)"
FE_Dashboard["Dashboard Pages"]
FE_Components["Feature Components"]
FE_Services["API Services"]
FE_Auth["Auth Options"]
end
subgraph "Backend (FastAPI)"
BE_Routers["Routers (/api/v1, /api/v2)"]
BE_Services["Services (analysis, ATS, interview)"]
BE_Models["Pydantic Models"]
BE_Prompts["Prompt Templates"]
end
FE_Dashboard --> FE_Services
FE_Components --> FE_Services
FE_Services --> BE_Routers
BE_Routers --> BE_Services
BE_Services --> BE_Models
BE_Services --> BE_Prompts
FE_Auth --> FE_Services
```

## Core components
This section outlines the primary building blocks powering each feature area.

- Resume Analysis Engine
  - Routes: file-based and text-based endpoints for resume analysis and formatting
  - Service: orchestrates document processing, LLM-driven extraction, validation, and cleanup
  - Models: detailed analysis data structures and typed responses
  - Prompts: structured prompt template for extracting rich, UI-ready data

- ATS Optimization System
  - Routes: evaluation endpoints supporting both file-based and text-based inputs
  - Service: validates inputs, retrieves JD content (link or file), and normalizes evaluator output
  - Models: request/response schemas for structured evaluation results
  - Prompts: ATS analysis prompt defining keyword coverage, compatibility, and recommendations

- Interview Preparation System
  - Routes: session lifecycle, answer submission (streaming and non-streaming), code execution, summary generation, and event recording
  - Services: graph orchestration, session management, question generation, answer evaluation, and summary generation
  - Models: interview configuration, templates, and event enums

- Communication Tools
  - Cold email: form and panel components with selection and generation flows
  - Cover letter: form and panel components with selection and generation flows
  - LinkedIn post: generator UI components

- User Management and Authentication
  - NextAuth integration in frontend with Prisma adapter
  - Role-based access control via database schema and frontend guards

## Architecture overview
The system architecture integrates frontend UI components with backend APIs, which delegate to services and prompts orchestrated by LangChain. The backend centralizes routing, middleware, and logging, while the frontend manages user interactions, state, and API consumption.

```mermaid
graph TB
FE_UI["Frontend UI Components<br/>Pages, Forms, Panels"]
FE_API["Frontend Services<br/>HTTP clients"]
BE_Main["FastAPI App<br/>Middleware, Routers"]
BE_Svc["Services<br/>Analysis, ATS, Interview"]
BE_Models["Pydantic Models<br/>Requests/Responses"]
BE_Prompts["Prompt Templates<br/>LangChain"]
LLM["LLM Provider"]
FE_UI --> FE_API
FE_API --> BE_Main
BE_Main --> BE_Svc
BE_Svc --> BE_Models
BE_Svc --> BE_Prompts
BE_Svc --> LLM
```

## Detailed component analysis

### Resume analysis engine
The resume analysis engine processes uploaded or formatted resume content, cleans and structures it, and produces a detailed profile suitable for UI rendering and downstream ATS scoring.

- Text Processing Pipeline
  - File-based analysis reads the uploaded file, writes a temporary file, extracts text, removes the temp file, validates content, and optionally formats text via LLM before JSON extraction.
  - Text-based analysis accepts pre-formatted text, validates it, and performs detailed analysis.
  - Formatting and analysis endpoint returns cleaned text plus structured analysis.

- NLP Integration
  - Detailed analysis prompt instructs the LLM to produce a JSON object conforming to the ComprehensiveAnalysisData model, covering skills, languages, education, work experience, projects, publications, positions of responsibility, certifications, achievements, and personal links.
  - Structured extraction ensures consistent schema compliance and UI rendering.

- Result Structuring
  - Responses include typed models for resume analysis, detailed analysis, and formatted-and-analyzed results.
  - Portfolio links are normalized across multiple potential field aliases.

```mermaid
sequenceDiagram
participant Client as "Frontend"
participant API as "Resume Analysis Routes"
participant Service as "Resume Analysis Service"
participant Processor as "Document Processor"
participant LLM as "LLM"
participant Model as "Pydantic Models"
Client->>API : "POST /api/v2/resume/analysis"
API->>Service : "analyze_resume_v2_service(formated_resume, llm)"
Service->>Processor : "process_document(bytes, filename)"
Processor-->>Service : "resume_text"
Service->>LLM : "comprehensive_analysis_llm(text, llm)"
LLM-->>Service : "analysis_dict"
Service->>Model : "ComprehensiveAnalysisData(**analysis_dict)"
Model-->>Service : "analysis_data"
Service-->>API : "ComprehensiveAnalysisData"
API-->>Client : "200 OK with analysis"
```

### ATS optimization system
The ATS optimization system evaluates a resume against a job description, computes keyword coverage, compatibility scores, and actionable recommendations.

- Input Handling
  - Accepts either raw JD text or a JD link; supports optional company context.
  - Validates payload to ensure at least one source of the job description is provided.

- Evaluation Workflow
  - Retrieves JD content from a link if needed.
  - Normalizes evaluator output to a structured response with success flag, message, score, reasons, and suggestions.

- Scoring and Recommendations
  - The prompt defines metrics such as semantic similarity, contact completeness, content quality, formatting, keyword coverage, and density.
  - Outputs composite score, strengths, areas for improvement, recommended keywords, and structured recommendations.

```mermaid
sequenceDiagram
participant Client as "Frontend"
participant API as "ATS Routes"
participant Service as "ATS Service"
participant Agent as "Web Content Agent"
participant Graph as "ATS Evaluator Graph"
participant Model as "JDEvaluatorResponse"
Client->>API : "POST /api/v2/ats/evaluate"
API->>Service : "ats_evaluate_service(resume_text, jd_text|jd_link, ...)"
alt "JD link provided"
Service->>Agent : "return_markdown(jd_link)"
Agent-->>Service : "jd_text"
end
Service->>Graph : "evaluate_ats(resume_text, jd_text, ...)"
Graph-->>Service : "analysis_output (dict or JSON string)"
Service->>Model : "JDEvaluatorResponse(**normalized_payload)"
Model-->>Service : "structured response"
Service-->>API : "JDEvaluatorResponse"
API-->>Client : "200 OK with score and suggestions"
```

### Interview preparation system
The interview preparation system provides a full lifecycle: session creation, question delivery, answer evaluation (with streaming), code execution, and summary generation.

- Session Lifecycle
  - Create session with profile and configuration; returns current question.
  - Retrieve, list, and delete sessions; filter by status.
  - Record interview events (e.g., tab switches) for integrity tracking.

- Answer Evaluation
  - Non-streaming and streaming endpoints for answer submission.
  - Streaming uses Server-Sent Events to simulate typing and deliver final evaluation.

- Code Execution
  - Execute candidate code for coding questions and stream execution results followed by review.

- Summary Generation
  - Generate final interview summary (non-streaming and streaming).

```mermaid
sequenceDiagram
participant Client as "Frontend"
participant API as "Interview Routes"
participant Graph as "Interview Graph"
participant SM as "Session Manager"
participant LLM as "LLM"
Client->>API : "POST /interview/sessions"
API->>Graph : "create_session(profile, config)"
Graph-->>API : "session_id + current_question"
API-->>Client : "InterviewSessionResponse"
Client->>API : "POST /interview/sessions/{session_id}/answer"
API->>Graph : "submit_answer(session_id, question_id, answer)"
Graph->>LLM : "evaluate answer"
LLM-->>Graph : "evaluation result"
Graph-->>API : "score, feedback, next_question"
API-->>Client : "Evaluation result"
Client->>API : "GET /interview/sessions/{session_id}/summary"
API->>Graph : "generate_summary(session_id)"
Graph-->>API : "final_score, strengths, weaknesses, recommendations"
API-->>Client : "Summary response"
```

### Communication tools
Communication tools enable generating cold emails, cover letters, and LinkedIn posts. The frontend provides dedicated forms and panels, while backend routes handle generation and persistence.

- Cold Email Generation
  - UI components: EmailDetailsForm and GeneratedEmailPanel
  - Selection and generation flows handled by frontend services

- Cover Letter Creation
  - UI components: CoverLetterDetailsForm and GeneratedLetterPanel

- LinkedIn Post Generator
  - UI components for post generation

```mermaid
flowchart TD
Start(["User initiates generation"]) --> Select["Select resume and context"]
Select --> FillForm["Fill details form"]
FillForm --> Submit["Submit to backend"]
Submit --> Process["Backend processes and generates content"]
Process --> Render["Render generated content in panel"]
Render --> End(["User reviews and exports"])
```

### User management, role-based access control, and authentication
The platform integrates NextAuth with a Prisma adapter for secure user authentication and session management. Role-based access control is enforced via database schema and frontend guards.

- Authentication Integration
  - NextAuth configuration with Prisma adapter
  - Auth routes for registration, verification, password reset, and role updates

- Role-Based Access Control
  - Database schema defines roles and relationships
  - Frontend guards restrict access to admin and seeker dashboards

```mermaid
graph TB
FE_Auth["Auth Options<br/>NextAuth"]
FE_Routes["Auth Routes<br/>/api/auth/*"]
DB["Prisma Schema<br/>User, Role, Session"]
FE_Guards["Frontend Guards<br/>Admin/Seeker Pages"]
FE_Auth --> FE_Routes
FE_Routes --> DB
FE_Guards --> FE_Routes
```

## Dependency analysis
The backend organizes features into routers, services, models, and prompts. The frontend composes UI components and consumes services that call backend endpoints.

```mermaid
graph TB
BE_Main["app/main.py<br/>Routers included"]
RA_Router["routes/resume_analysis.py"]
RA_Service["services/resume_analysis.py"]
RA_Models["models/resume/schemas.py"]
RA_Prompt["data/prompt/comprehensive_analysis.py"]
ATS_Router["routes/ats.py"]
ATS_Service["services/ats.py"]
ATS_Models["models/ats_evaluator/schemas.py"]
ATS_Prompt["data/prompt/ats_analysis.py"]
INT_Router["routes/interview.py"]
INT_Graph["services/interview/graph.py"]
INT_SM["services/interview/session_manager.py"]
BE_Main --> RA_Router
RA_Router --> RA_Service
RA_Service --> RA_Models
RA_Service --> RA_Prompt
BE_Main --> ATS_Router
ATS_Router --> ATS_Service
ATS_Service --> ATS_Models
ATS_Service --> ATS_Prompt
BE_Main --> INT_Router
INT_Router --> INT_Graph
INT_Graph --> INT_SM
```

## Performance considerations
- Asynchronous processing: All major services operate asynchronously to avoid blocking I/O and LLM calls.
- Temporary file handling: Writes to disk are minimized and removed immediately after processing to reduce I/O overhead.
- Payload normalization: Reliable input validation and normalization prevent repeated parsing and reduce error handling costs.
- Streaming responses: Interview answer and summary endpoints use Server-Sent Events to provide responsive UX and incremental feedback.
- Caching and reuse: Consider caching processed documents and LLM outputs where appropriate to reduce redundant computations.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Resume Analysis
  - Unsupported file type or processing errors: Ensure the file format is supported and readable; verify LLM availability.
  - Validation errors: Confirm extracted data conforms to expected schema; check alias normalization for portfolio links.
  - Empty or invalid resume text: Validate content presence and structure before analysis.

- ATS Evaluation
  - Missing job description: Provide either JD text or a valid JD link; ensure link accessibility.
  - JSON decoding failures: Validate evaluator output format; handle non-dictionary outputs gracefully.
  - Web retrieval errors: Confirm external link availability and network connectivity.

- Interview System
  - Session not found: Verify session identifiers and lifecycle states.
  - Streaming errors: Ensure client supports SSE and network stability.
  - Code execution failures: Validate language support and test inputs.

- Authentication and Authorization
  - NextAuth configuration: Verify provider settings and Prisma adapter configuration.
  - Role mismatches: Confirm user roles in the database and frontend guards.

## Conclusion
TalentSync-Normies delivers a cohesive set of AI-powered features spanning resume analysis, ATS optimization, interview preparation, and communication tools. The backend's modular design with clear separation of concerns, combined with the frontend's domain-specific UI components and reliable API integrations, enables a scalable and maintainable solution. By using structured prompts, typed models, and streaming capabilities, the platform provides both accuracy and responsiveness for users across job-seeking and hiring scenarios.

[No sources needed since this section summarizes without analyzing specific files]
