# Question Generation Engine

<cite>
**Referenced Files in This Document**
- [question_generator.py](file://backend/app/services/interview/question_generator.py)
- [interview_question.py](file://backend/app/data/prompt/interview_question.py)
- [enums.py](file://backend/app/models/interview/enums.py)
- [schemas.py](file://backend/app/models/interview/schemas.py)
- [templates.py](file://backend/app/models/interview/templates.py)
- [graph.py](file://backend/app/services/interview/graph.py)
- [session_manager.py](file://backend/app/services/interview/session_manager.py)
- [interview.py](file://backend/app/routes/interview.py)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py)
- [code_executor.py](file://backend/app/services/interview/code_executor.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
The Question Generation Engine is an AI-powered system that generates interview questions tailored to a candidate’s profile, the target role, and the interview format. It combines a configurable difficulty distribution, optional role-based templates, and LLM prompts to produce diverse, non-repeating questions. The engine supports both technical and behavioral assessments, integrates with coding challenges, and adapts question selection dynamically across interview stages. Anti-cheating safeguards include integrity tracking (e.g., tab switching) and code sandboxing for coding rounds.

## Project Structure
The Question Generation Engine spans several modules:
- Prompt definition for question generation
- Data models for questions, templates, and interview configuration
- Question generation service with template and LLM-backed logic
- Orchestrator that wires generation into the interview flow
- Session management for state and integrity tracking
- Routes exposing interview APIs with streaming support
- Supporting services for answer evaluation and code execution

```mermaid
graph TB
subgraph "Prompt Layer"
PQ["interview_question.py<br/>Prompt Template"]
end
subgraph "Models"
ENUMS["enums.py<br/>Enums"]
MODELS["schemas.py<br/>InterviewQuestion, Config"]
TPL["templates.py<br/>Templates & QuestionBank"]
end
subgraph "Generation"
QGEN["question_generator.py<br/>QuestionGenerator"]
GRAPH["graph.py<br/>InterviewGraph"]
end
subgraph "Runtime"
SM["session_manager.py<br/>SessionManager"]
ROUTES["interview.py<br/>FastAPI Routes"]
EVAL["answer_evaluator.py<br/>AnswerEvaluator"]
CODE["code_executor.py<br/>CodeExecutor"]
end
PQ --> QGEN
ENUMS --> QGEN
MODELS --> QGEN
TPL --> QGEN
QGEN --> GRAPH
GRAPH --> SM
ROUTES --> GRAPH
ROUTES --> SM
GRAPH --> EVAL
GRAPH --> CODE
```

**Diagram sources**
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L1-L60)
- [enums.py](file://backend/app/models/interview/enums.py#L1-L43)
- [schemas.py](file://backend/app/models/interview/schemas.py#L1-L169)
- [templates.py](file://backend/app/models/interview/templates.py#L1-L502)
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L1-L275)
- [graph.py](file://backend/app/services/interview/graph.py#L1-L511)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L1-L257)
- [interview.py](file://backend/app/routes/interview.py#L1-L494)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py#L1-L227)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L1-L278)

**Section sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L1-L275)
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L1-L60)
- [enums.py](file://backend/app/models/interview/enums.py#L1-L43)
- [schemas.py](file://backend/app/models/interview/schemas.py#L1-L169)
- [templates.py](file://backend/app/models/interview/templates.py#L1-L502)
- [graph.py](file://backend/app/services/interview/graph.py#L1-L511)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L1-L257)
- [interview.py](file://backend/app/routes/interview.py#L1-L494)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py#L1-L227)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L1-L278)

## Core Components
- QuestionGenerator: Central class that builds question lists from difficulty distributions, optionally pulls from templates, and falls back to LLM-generated questions. It ensures non-repetition by tracking previously asked questions and selects question types cyclically.
- Prompt Template: Defines the system and human messages guiding the LLM to produce structured, role-appropriate questions with expected keywords and follow-ups.
- Templates: Predefined question banks per role with difficulty, topic, and optional code challenges. These are used to fill gaps when templates are selected.
- InterviewGraph: Integrates generation into the interview lifecycle, passing candidate profile and configuration to the generator.
- SessionManager: Tracks interview state, integrity events (e.g., tab switches), and persists sessions.
- AnswerEvaluator and CodeExecutor: Support evaluation and secure execution for coding questions, complementing question generation.

**Section sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L16-L275)
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L18-L54)
- [templates.py](file://backend/app/models/interview/templates.py#L22-L502)
- [graph.py](file://backend/app/services/interview/graph.py#L49-L85)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L15-L257)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py#L22-L227)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L11-L278)

## Architecture Overview
The engine orchestrates question generation within the broader interview flow. The route handlers create sessions, which trigger the graph to generate questions. The generator uses templates and/or LLM prompts to produce questions, ensuring variety and avoiding repetition. Integrity events are recorded to detect potential cheating, and coding questions are executed in a sandboxed environment.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Routes as "Routes (interview.py)"
participant Graph as "InterviewGraph"
participant Gen as "QuestionGenerator"
participant Prompt as "Prompt Template"
participant LLM as "LLM"
participant SM as "SessionManager"
Client->>Routes : POST /interview/sessions
Routes->>Graph : create_session(profile, config)
Graph->>Gen : generate_questions(role, num, dist, template_id, topic, resume)
alt Template Available
Gen->>Gen : _get_template_question()
Gen-->>Graph : InterviewQuestion[]
else No Template
Gen->>Prompt : format(system, human)
Gen->>LLM : invoke(prompt)
LLM-->>Gen : JSON with question, keywords, follow-ups
Gen-->>Graph : InterviewQuestion[]
end
Graph->>SM : save(session with questions)
Routes-->>Client : InterviewSessionResponse(current_question)
```

**Diagram sources**
- [interview.py](file://backend/app/routes/interview.py#L65-L90)
- [graph.py](file://backend/app/services/interview/graph.py#L49-L85)
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L23-L122)
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L18-L54)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L65-L87)

## Detailed Component Analysis

### QuestionGenerator Class
The QuestionGenerator builds a list of InterviewQuestion objects from:
- Difficulty distribution: Ensures requested counts per difficulty, padding with fallbacks if needed.
- Template selection: Uses predefined templates when provided to fill questions first.
- LLM generation: Falls back to LLM when templates are exhausted or unavailable.
- Non-repetition: Tracks previously asked questions to avoid duplicates.
- Dynamic question types: Cycles through technical, behavioral, and role-based categories.

```mermaid
classDiagram
class QuestionGenerator {
+llm
+prompt
+generate_questions(role, num_questions, difficulty_distribution, template_id, topic, resume_data) InterviewQuestion[]
+generate_single_question(role, difficulty, topic, existing_questions, resume_data) InterviewQuestion
-_get_template_question(template, difficulty, existing_questions) QuestionTemplate
-_generate_llm_question(idx, role, difficulty, topic, resume_data, existing_questions) InterviewQuestion
-_parse_question_response(content) Dict
-_get_fallback_question(idx, role, difficulty, topic) InterviewQuestion
}
class InterviewQuestion {
+id
+index
+question
+difficulty
+source
+topic
+expected_keywords
+follow_up_questions
+code_challenge
+answer
+code_submission
+code_language
+score
+feedback
+strengths
+improvements
+answered_at
}
class DifficultyLevel {
<<enum>>
EASY
MEDIUM
HARD
}
class QuestionSource {
<<enum>>
RESUME_BASED
ROLE_BASED
BEHAVIORAL
TECHNICAL
CODING
}
QuestionGenerator --> InterviewQuestion : "produces"
QuestionGenerator --> DifficultyLevel : "uses"
QuestionGenerator --> QuestionSource : "assigns"
```

**Diagram sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L16-L275)
- [schemas.py](file://backend/app/models/interview/schemas.py#L22-L43)
- [enums.py](file://backend/app/models/interview/enums.py#L6-L31)

**Section sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L16-L275)
- [schemas.py](file://backend/app/models/interview/schemas.py#L22-L43)
- [enums.py](file://backend/app/models/interview/enums.py#L6-L31)

### Prompt Engineering Approach
The prompt template establishes:
- Role and difficulty framing
- Topic focus and question type
- Candidate background context
- Existing questions to avoid repetition
- Expected JSON output with question text, keywords, and follow-ups

```mermaid
flowchart TD
Start(["Build Prompt"]) --> Role["Set Role"]
Role --> Diff["Set Difficulty"]
Diff --> Topic["Set Topic"]
Topic --> Type["Set Question Type"]
Type --> BG["Format Candidate Background"]
BG --> Seen["Format Previously Asked"]
Seen --> Output["Define JSON Output Schema"]
Output --> End(["Invoke LLM"])
```

**Diagram sources**
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L18-L54)

**Section sources**
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L5-L59)

### Parameter Configuration and Question Categorization
- InterviewConfig controls role, number of questions, difficulty distribution, optional template/topic, and coding flags.
- QuestionSource categorizes questions as resume-based, role-based, behavioral, technical, or coding.
- DifficultyLevel drives question selection and pacing.

```mermaid
classDiagram
class InterviewConfig {
+role
+template_id
+topic
+num_questions
+difficulty_distribution
+time_limit_minutes
+includes_coding
+coding_languages
+voice_enabled
+voice_language
}
class QuestionSource {
<<enum>>
RESUME_BASED
ROLE_BASED
BEHAVIORAL
TECHNICAL
CODING
}
InterviewConfig --> QuestionSource : "used by generated questions"
```

**Diagram sources**
- [schemas.py](file://backend/app/models/interview/schemas.py#L55-L70)
- [enums.py](file://backend/app/models/interview/enums.py#L23-L31)

**Section sources**
- [schemas.py](file://backend/app/models/interview/schemas.py#L55-L70)
- [enums.py](file://backend/app/models/interview/enums.py#L23-L31)

### Template-Based Question Selection
Templates define:
- Roles and topics
- Question banks with difficulty and expected keywords
- Optional code challenges
- Coding language preferences

The generator selects template questions matching difficulty and not yet asked, falling back to LLM when needed.

```mermaid
flowchart TD
A["Template Selected?"] --> |Yes| B["Filter Bank by Difficulty and Not Used"]
B --> C{"Matches Found?"}
C --> |Yes| D["Pick Random Match"]
C --> |No| E["Use LLM"]
A --> |No| E
D --> F["Wrap as InterviewQuestion"]
E --> G["_generate_llm_question()"]
G --> F
```

**Diagram sources**
- [templates.py](file://backend/app/models/interview/templates.py#L22-L502)
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L124-L144)

**Section sources**
- [templates.py](file://backend/app/models/interview/templates.py#L42-L478)
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L124-L144)

### Dynamic Question Selection Based on Candidate Responses
While the generator itself does not alter future questions based on a single response, the broader interview graph advances to the next question after evaluation. Integrity events (e.g., tab switches) are tracked and surfaced for review, indirectly influencing the final summary and recommendations.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Routes as "Routes"
participant Graph as "InterviewGraph"
participant Eval as "AnswerEvaluator"
participant SM as "SessionManager"
Client->>Routes : POST /interview/sessions/{id}/answer
Routes->>Graph : submit_answer(session_id, question_id, answer)
Graph->>Eval : evaluate(question, answer, role)
Eval-->>Graph : EvaluationResult
Graph->>SM : update question + move index
Graph-->>Routes : next_question or complete
```

**Diagram sources**
- [interview.py](file://backend/app/routes/interview.py#L154-L186)
- [graph.py](file://backend/app/services/interview/graph.py#L99-L168)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py#L31-L79)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L113-L133)

**Section sources**
- [interview.py](file://backend/app/routes/interview.py#L154-L186)
- [graph.py](file://backend/app/services/interview/graph.py#L99-L168)
- [answer_evaluator.py](file://backend/app/services/interview/answer_evaluator.py#L31-L79)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L113-L133)

### Question Diversity and Anti-Cheating Mechanisms
- Diversity: The generator cycles question types (technical, behavioral, role-based) and avoids repeats by tracking existing questions.
- Anti-cheating:
  - Integrity events recording (e.g., tab switches) are stored and counted.
  - Coding questions execute in a sandbox with language-specific timeouts, output limits, and dangerous-pattern checks.
  - Tab switch thresholds flag sessions for review.

```mermaid
flowchart TD
S(["During Interview"]) --> Evt["Record Event (e.g., Tab Switch)"]
Evt --> Count["Increment Tab Switch Count"]
Count --> Flag{">= Threshold?"}
Flag --> |Yes| Review["Flag for Review"]
Flag --> |No| Continue["Continue Interview"]
subgraph "Coding Safety"
C1["Validate Language"]
C2["Length Check"]
C3["Security Check"]
C4["Timeout + Sandbox"]
end
C1 --> C2 --> C3 --> C4
```

**Diagram sources**
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L113-L133)
- [interview.py](file://backend/app/routes/interview.py#L420-L450)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L35-L152)

**Section sources**
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L113-L133)
- [interview.py](file://backend/app/routes/interview.py#L420-L450)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L14-L30)
- [code_executor.py](file://backend/app/services/interview/code_executor.py#L154-L215)

### Examples of Generated Question Patterns
- Technical coding rounds (e.g., Software Engineer): Algorithmic challenges with code challenges embedded in questions.
- Behavioral assessments: STAR-focused questions aligned with role expectations.
- Panel interviews: Mixed difficulty and type progression to maintain engagement and depth.

These patterns derive from built-in templates and the LLM prompt’s structured output schema.

**Section sources**
- [templates.py](file://backend/app/models/interview/templates.py#L42-L478)
- [interview_question.py](file://backend/app/data/prompt/interview_question.py#L44-L50)

## Dependency Analysis
The QuestionGenerator depends on:
- Prompt template for LLM invocation
- Enums for difficulty and question source
- Models for InterviewQuestion and InterviewConfig
- Templates for pre-defined question banks
- Graph and SessionManager for orchestration and persistence

```mermaid
graph LR
QGEN["QuestionGenerator"] --> PROMPT["Prompt Template"]
QGEN --> ENUMS["DifficultyLevel, QuestionSource"]
QGEN --> MODELS["InterviewQuestion, InterviewConfig"]
QGEN --> TPL["InterviewTemplate/QuestionTemplate"]
QGEN --> GRAPH["InterviewGraph"]
QGEN --> SM["SessionManager"]
```

**Diagram sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L9-L21)
- [enums.py](file://backend/app/models/interview/enums.py#L6-L31)
- [schemas.py](file://backend/app/models/interview/schemas.py#L22-L70)
- [templates.py](file://backend/app/models/interview/templates.py#L10-L38)
- [graph.py](file://backend/app/services/interview/graph.py#L43-L47)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L22-L27)

**Section sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L9-L21)
- [enums.py](file://backend/app/models/interview/enums.py#L6-L31)
- [schemas.py](file://backend/app/models/interview/schemas.py#L22-L70)
- [templates.py](file://backend/app/models/interview/templates.py#L10-L38)
- [graph.py](file://backend/app/services/interview/graph.py#L43-L47)
- [session_manager.py](file://backend/app/services/interview/session_manager.py#L22-L27)

## Performance Considerations
- Prompt construction and LLM invocation are asynchronous; ensure efficient prompt formatting and minimal payload sizes.
- Template-first strategy reduces LLM calls when templates are available.
- Non-repetition tracking uses a list of strings; for very large interviews, consider hashing or indexing for O(1) lookups.
- Streaming evaluation and code execution improve perceived latency; keep prompt sizes reasonable to avoid timeouts.

## Troubleshooting Guide
- LLM generation failures: The generator falls back to curated fallback questions and sets a default behavioral source.
- JSON parsing errors: The parser extracts content as-is when JSON is invalid.
- Session not found or mismatched question: Route handlers raise explicit HTTP errors for invalid states.
- Integrity concerns: Excessive tab switches are flagged for manual review.

**Section sources**
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L211-L215)
- [question_generator.py](file://backend/app/services/interview/question_generator.py#L217-L230)
- [interview.py](file://backend/app/routes/interview.py#L182-L185)
- [interview.py](file://backend/app/routes/interview.py#L420-L450)

## Conclusion
The Question Generation Engine blends structured templates with LLM-driven creativity to produce tailored, non-repeating interview questions. Its integration with integrity tracking and secure code execution ensures robust assessments across technical and behavioral domains. The modular design allows easy extension to new roles, topics, and evaluation modes.