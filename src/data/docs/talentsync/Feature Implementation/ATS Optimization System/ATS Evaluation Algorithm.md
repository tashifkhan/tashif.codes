# ATS evaluation algorithm

## Introduction
This page explains the ATS evaluation algorithm implemented in the backend and how it integrates with the frontend to compare resume content against job descriptions. It covers:
- Keyword matching methodology and scoring mechanisms
- The LangChain graph orchestration
- Prompt engineering techniques used to extract structured insights
- Normalization of raw analysis output into standardized response formats
- Performance optimization and caching strategies for large-scale evaluations

## Project structure
The ATS evaluation spans backend services, prompts, models, routing, and frontend display components. The backend orchestrates the evaluation via a LangGraph state machine, while the frontend renders the resulting score and suggestions.

```mermaid
graph TB
subgraph "Frontend"
FE_UI["EvaluationResults.tsx"]
end
subgraph "Backend"
ROUTER["routes/ats.py"]
SERVICE["services/ats.py"]
EVALUATOR_GRAPH["services/ats_evaluator/graph.py"]
PROMPT_JD["data/prompt/jd_evaluator.py"]
PROMPT_ATS["data/prompt/ats_analysis.py"]
MODELS["models/ats_evaluator/*"]
LLM["core/llm.py"]
end
FE_UI --> ROUTER
ROUTER --> SERVICE
SERVICE --> EVALUATOR_GRAPH
EVALUATOR_GRAPH --> PROMPT_JD
EVALUATOR_GRAPH --> PROMPT_ATS
EVALUATOR_GRAPH --> LLM
SERVICE --> MODELS
```

## Core components
- Input models define the shape of incoming requests and expected responses for ATS evaluation.
- The evaluation service validates inputs, retrieves or enriches the job description, and invokes the evaluator graph.
- The evaluator graph builds a LangGraph state machine that interacts with the LLM and optional tools.
- Prompts guide the LLM to extract keywords, compute scores, and return structured JSON aligned with the response schema.
- Frontend components render the normalized results.

Key responsibilities:
- Input validation and normalization
- Job description retrieval/enrichment
- Structured JSON extraction and parsing
- Rendering of match score and suggestions

## Architecture overview
The system follows a request-driven pipeline:
- The frontend submits a request with resume text and either a raw job description or a link.
- The backend route parses the request, validates it, and delegates to the evaluation service.
- The service ensures a valid job description, normalizes outputs, and returns a standardized response.
- The evaluator graph compiles a LangGraph with an agent node and optional tool nodes, invoking the LLM with a prepared prompt.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "routes/ats.py"
participant SVC as "services/ats.py"
participant EVAL as "services/ats_evaluator/graph.py"
participant LLM as "core/llm.py"
FE->>API : "POST /ats/evaluate"
API->>SVC : "ats_evaluate_service(...)"
SVC->>SVC : "Validate inputs and ensure JD"
SVC->>EVAL : "evaluate_ats(...)"
EVAL->>LLM : "invoke(prompt + messages)"
LLM-->>EVAL : "JSON + narrative"
EVAL-->>SVC : "Parsed JSON"
SVC-->>FE : "Standardized response"
```

## Detailed component analysis

### Keyword matching methodology
The system extracts and compares keywords from the job description against the resume. The prompt defines the categories and metrics used for scoring, including:
- Required and optional keyword coverage
- Found and missing keywords lists
- Recommended keywords derived from the comparison

Implementation highlights:
- The prompt instructs extraction of required and optional keywords from the JD and compares them to the resume content.
- The evaluator returns structured fields for found_keywords, missing_keywords, and recommended_keywords.
- The service normalizes these lists into the final response.

Example behaviors:
- Required keyword coverage is computed as a ratio of matched required keywords to total required keywords.
- Optional keyword coverage reflects partial matches and recommendations for improvement.

### Scoring mechanism and compatibility percentages
The prompt prescribes a composite score calculation that blends multiple dimensions:
- Semantic similarity to the job description
- ATS compatibility (contact info completeness, content quality, structure/formatting)
- Keyword coverage (required and optional)
- Keyword density (keywords per 100 words)

The evaluator returns a composite score (0–100) and per-category scores (0–1). The frontend displays the score out of 100 and provides contextual labels.

Normalization:
- The service ensures numeric types for score and coerces lists for reasons and suggestions.
- The response schema aligns with the frontend expectations.

### LangChain graph orchestration
The evaluator graph composes a minimal state machine:
- Nodes: agent (invokes the LLM with a prepared system prompt)
- Optional: tools (search tool bound to the LLM)
- Edges: START → agent → END; conditional edges to tools if available

Key elements:
- System prompt is built from resume, job description, company name, and optional website content.
- The graph enforces JSON-first output by sending a directive message to the LLM.
- JSON parsing is reliable, handling fenced code blocks and partial extractions.

```mermaid
flowchart TD
Start(["Invoke Graph"]) --> Prep["Prepare system prompt<br/>+ messages"]
Prep --> Agent["Agent node<br/>LLM invoke"]
Agent --> Decision{"Tools available?"}
Decision --> |Yes| Tools["ToolNode<br/>Tavily search"]
Decision --> |No| End(["Return JSON"])
Tools --> Agent
Agent --> End
```

### Prompt engineering techniques
Two complementary prompts are used:
- JD Evaluator prompt: A 100-point rubric with explicit scoring categories, synonym normalization rules, and strict JSON schema requirements.
- ATS Analysis prompt: A broader analysis focused on ATS compatibility, keyword coverage, and recommendations.

Techniques:
- Explicit rubrics and scoring bands for each dimension
- Controlled synonym mapping to expand matches
- Strict JSON schema enforcement with examples
- Directive to return JSON first to simplify parsing

These prompts guide the LLM to produce structured, comparable outputs suitable for downstream normalization.

### Normalization to standardized response formats
The service normalizes raw LLM outputs into a standardized response:
- Ensures presence of success flag, message, score, reasons_for_the_score, and suggestions
- Coerces types and formats lists appropriately
- Wraps the result in a validated response model

This guarantees consistent consumption by the frontend and downstream systems.

### Examples: keyword matches, weights, and compatibility scores
Below are representative examples of how the system operates conceptually:
- Keyword identification: Required and preferred keywords are extracted from the job description and compared to the resume text.
- Weighted coverage: Required keywords carry higher weight than optional ones; missing required keywords reduce the composite score more than missing optional keywords.
- Compatibility score: The composite score blends per-category scores (semantic similarity, ATS compatibility, contact completeness, content quality, structure, keyword coverage, keyword density).

Note: The exact numerical calculations are produced by the LLM guided by the prompt and are normalized by the service into the final response.

## Dependency analysis
The evaluation pipeline depends on:
- LLM provider configuration and instantiation
- Route-level input validation and job description retrieval
- Prompt templates and response models
- Optional tool integration for web search

```mermaid
graph LR
ROUTES["routes/ats.py"] --> SERVICE["services/ats.py"]
SERVICE --> EVALUATOR["services/ats_evaluator/graph.py"]
EVALUATOR --> PROMPTS["data/prompt/*.py"]
EVALUATOR --> LLM["core/llm.py"]
SERVICE --> MODELS["models/ats_evaluator/*"]
FRONTEND["frontend/components/ats/EvaluationResults.tsx"] --> ROUTES
```

## Performance considerations
- Minimize LLM calls: The graph uses a single invocation with a JSON-first directive to reduce retries.
- Reduce prompt size: Build the system prompt with concise resume and job description segments.
- Tool availability: Optional tool binding is gated behind availability checks to avoid unnecessary overhead.
- Caching strategies:
  - LRU cache for text extraction helpers in related refiners to avoid recomputation across runs.
  - Consider memoizing repeated comparisons keyed by resume hash and job description hash at the service boundary.
  - Cache parsed JSON outputs when identical inputs are evaluated frequently.
- Concurrency: Batch multiple evaluations asynchronously and cap concurrent LLM invocations to respect provider limits.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- JSON parsing failures: The evaluator strips code fences and attempts partial extraction; if parsing fails, the service raises a structured HTTP error.
- Missing job description: The service requires either raw text or a link; absence triggers a 400 error.
- LLM initialization: If the default provider key is missing, LLM instances are not created; fall back to defaults or configure environment variables.
- Frontend rendering: Ensure the response contains score, reasons_for_the_score, and suggestions; the component expects arrays and numeric scores.

## Conclusion
The ATS evaluation algorithm combines structured prompts, a LangGraph orchestrator, and reliable normalization to deliver accurate, standardized compatibility assessments. By focusing on explicit keyword coverage, semantic alignment, and presentation quality, it produces actionable insights and a clear match score suitable for both automated workflows and human review.
