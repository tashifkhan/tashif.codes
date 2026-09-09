# Answer evaluation system

## Introduction
The Answer Evaluation System evaluates candidate responses during digital interviews using a multi-dimensional scoring framework. It integrates natural language understanding with structured prompts to assess technical competency, communication effectiveness, and cultural fit indicators. The system supports both non-streaming and streaming evaluation modes, enabling real-time feedback delivery via Server-Sent Events (SSE). It also incorporates code execution results for technical challenges, ensuring holistic evaluation across different question types.

## Project structure
The Answer Evaluation System spans several modules:
- Services orchestrate the interview flow and evaluation logic.
- Data prompts define the evaluation criteria and output formats.
- Models encapsulate schemas for questions, answers, and evaluation results.
- Routes expose APIs for submitting answers, streaming evaluations, and managing sessions.

```mermaid
graph TB
subgraph "Routes"
R1["/interview/sessions/{session_id}/answer"]
R2["/interview/sessions/{session_id}/answer/stream"]
end
subgraph "Services"
G["InterviewGraph"]
AE["AnswerEvaluator"]
SG["SummaryGenerator"]
CE["CodeExecutor"]
SM["SessionManager"]
end
subgraph "Prompts"
EP["Interview Evaluator Prompt"]
SP["Interview Summary Prompt"]
end
subgraph "Models"
IQ["InterviewQuestion"]
ER["EvaluationResult"]
IS["InterviewSession"]
end
R1 --> G
R2 --> G
G --> AE
G --> CE
G --> SG
G --> SM
AE --> EP
SG --> SP
AE --> ER
G --> IQ
G --> IS
```

## Core components
- AnswerEvaluator: Orchestrates evaluation of textual answers and code submissions, parses structured outputs, and supports streaming responses.
- InterviewGraph: Coordinates session lifecycle, question flow, and integrates evaluation and code execution.
- SummaryGenerator: Produces detailed interview summaries with cultural fit and communication insights.
- CodeExecutor: Safely executes candidate code and returns execution metrics for contextual evaluation.
- SessionManager: Manages interview sessions and events in memory, tracking tab switches and integrity signals.
- Prompts: Define evaluation rubrics and output formats for both evaluation and summary generation.
- Schemas: Define data models for questions, answers, evaluation results, and session state.

## Architecture overview
The system follows a layered architecture:
- API Layer: FastAPI routes handle requests and stream responses.
- Orchestration Layer: InterviewGraph manages state transitions and delegates tasks.
- Evaluation Layer: AnswerEvaluator and SummaryGenerator produce structured results.
- Execution Layer: CodeExecutor validates and runs candidate code.
- Persistence Layer: SessionManager stores sessions and events.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "FastAPI Route"
participant Graph as "InterviewGraph"
participant Eval as "AnswerEvaluator"
participant LLM as "LLM Provider"
participant Store as "SessionManager"
Client->>Route : POST /interview/sessions/{session_id}/answer
Route->>Graph : submit_answer(session_id, question_id, answer)
Graph->>Eval : evaluate(question, answer, role)
Eval->>LLM : invoke(prompt with question, answer, keywords)
LLM-->>Eval : structured evaluation JSON/markdown
Eval-->>Graph : EvaluationResult(score, feedback, strengths, improvements)
Graph->>Store : update question and session state
Store-->>Graph : saved session
Graph-->>Route : evaluation result + next question
Route-->>Client : JSON response
```

## Detailed component analysis

### AnswerEvaluator
The AnswerEvaluator class encapsulates the evaluation logic:
- Non-streaming evaluation: Builds a LangChain prompt with role, difficulty, topic, question, expected keywords, and candidate answer; invokes the LLM; parses JSON or markdown to produce an EvaluationResult.
- Streaming evaluation: Formats a streaming prompt and yields tokens incrementally for SSE.
- Code streaming: Uses a specialized prompt incorporating execution results (success, stdout/stderr, execution time) to provide code review feedback.
- Parsing utilities: Extract structured fields (score, strengths, improvements) from both JSON and markdown outputs.

```mermaid
classDiagram
class AnswerEvaluator {
+llm
+prompt
+streaming_prompt
+code_review_prompt
+evaluate(question, answer, role) EvaluationResult
+evaluate_streaming(question, answer, role) AsyncGenerator
+evaluate_code_streaming(question, code, language, execution_result) AsyncGenerator
+_parse_evaluation_response(content) Dict
+parse_score_from_streaming(full_response) int
+parse_full_streaming_response(full_response) Dict
}
class EvaluationResult {
+int score
+string feedback
+string[] strengths
+string[] improvements
}
AnswerEvaluator --> EvaluationResult : "produces"
```

### InterviewGraph
InterviewGraph orchestrates the end-to-end interview flow:
- Creates sessions, generates questions, and updates state upon answer submission.
- Streams evaluation tokens to clients via SSE and parses final results.
- Executes code, streams execution results, and then streams code review.
- Generates final interview summaries with cultural fit and communication assessments.

```mermaid
flowchart TD
Start(["Submit Answer"]) --> LoadSession["Load Session"]
LoadSession --> ValidateState["Validate Current Question"]
ValidateState --> Found{"Question matches?"}
Found --> |No| Error["Raise Validation Error"]
Found --> |Yes| Evaluate["Call AnswerEvaluator.evaluate()"]
Evaluate --> Update["Update Question: answer, score, feedback, timestamps"]
Update --> NextQ["Advance to Next Question"]
NextQ --> Complete{"Any questions left?"}
Complete --> |No| Finish["Mark Session Completed"]
Complete --> |Yes| AwaitNext["Await Next Question"]
Finish --> End(["Return Evaluation + Next Question"])
AwaitNext --> End
Error --> End
```

### SummaryGenerator
The SummaryGenerator produces detailed interview summaries:
- Calculates a final score as a percentage from question scores.
- Formats questions and events for context.
- Parses structured outputs (JSON or markdown) to extract strengths, weaknesses, recommendations, hiring recommendation, cultural fit notes, technical proficiency, and communication skills.

```mermaid
flowchart TD
Start(["Generate Summary"]) --> FormatQ["Format Questions Summary"]
FormatQ --> CalcScore["Calculate Final Score (%)"]
CalcScore --> CallLLM["Invoke Summary Prompt"]
CallLLM --> Parse["Parse Structured Output"]
Parse --> UpdateSession["Update Session with Summary Fields"]
UpdateSession --> End(["Return Summary Data"])
```

### CodeExecutor
The CodeExecutor safely executes candidate code:
- Validates language support and enforces length limits.
- Performs basic security checks to prevent dangerous patterns.
- Runs code with timeouts and captures stdout/stderr.
- Supports batch test execution and aggregates results.

```mermaid
flowchart TD
Start(["Execute Code"]) --> ValidateLang["Validate Language Support"]
ValidateLang --> LengthCheck["Check Code Length"]
LengthCheck --> Security["Security Pattern Check"]
Security --> TempFile["Write Code to Temporary File"]
TempFile --> SpawnProc["Spawn Subprocess with Timeout"]
SpawnProc --> Capture["Capture stdout/stderr and compute execution time"]
Capture --> Cleanup["Cleanup Temporary File"]
Cleanup --> Result(["Return CodeExecutionResult"])
```

### SessionManager
SessionManager maintains in-memory state for sessions and events:
- Stores sessions and events keyed by session_id.
- Tracks tab switches and other integrity events.
- Provides CRUD operations and listing with filtering.

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
}
class InterviewSession {
+string session_id
+InterviewStatus status
+InterviewQuestion[] questions
+int current_question_index
+int tab_switch_count
+Dict[] events
}
SessionManager --> InterviewSession : "manages"
```

## Dependency analysis
The system exhibits clear separation of concerns:
- Routes depend on InterviewGraph for orchestration.
- InterviewGraph depends on AnswerEvaluator, CodeExecutor, SummaryGenerator, and SessionManager.
- AnswerEvaluator and SummaryGenerator depend on prompt templates and LLM providers.
- Models define the data contracts used across services.

```mermaid
graph LR
Routes["routes/interview.py"] --> Graph["services/interview/graph.py"]
Graph --> AnswerEvaluator["services/interview/answer_evaluator.py"]
Graph --> CodeExecutor["services/interview/code_executor.py"]
Graph --> SummaryGenerator["services/interview/summary_generator.py"]
Graph --> SessionManager["services/interview/session_manager.py"]
AnswerEvaluator --> PromptsEval["data/prompt/interview_evaluator.py"]
SummaryGenerator --> PromptsSum["data/prompt/interview_summary.py"]
AnswerEvaluator --> Models["models/interview/schemas.py"]
SummaryGenerator --> Models
Graph --> Models
SessionManager --> Models
```

## Performance considerations
- Streaming evaluation reduces perceived latency by delivering partial feedback incrementally.
- Code execution timeouts and output truncation prevent resource exhaustion.
- In-memory session storage simplifies deployment but requires persistence planning for production.
- Prompt templates standardize evaluation criteria, aiding consistency across LLM invocations.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and mitigations:
- Evaluation service unavailable: The system returns a neutral default score and feedback when the LLM provider is unreachable.
- Parsing failures: The parser attempts JSON extraction first, falling back to markdown parsing; ensure prompts consistently produce one of these formats.
- Streaming interruptions: SSE endpoints wrap errors into structured messages for client handling.
- Session validation errors: The graph validates current question state and raises explicit errors if mismatched.
- Code execution errors: Security checks and timeouts guard against malicious or excessive code; results include stderr for diagnostics.

## Conclusion
The Answer Evaluation System provides a reliable, extensible framework for multi-dimensional candidate assessment. By combining structured prompts, streaming feedback, and contextual code evaluation, it delivers consistent, transparent scoring aligned with technical competency, communication effectiveness, and cultural fit indicators. The modular design enables incremental enhancements, such as integrating external LLM providers, expanding rubrics, and adding bias mitigation strategies.
