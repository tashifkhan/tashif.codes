# ATS evaluation API

## Introduction
This page describes the Applicant Tracking System (ATS) evaluation functionality exposed by the backend API. It covers:
- Job description processing endpoints (text-based and file-based)
- Resume scanning pipeline and supported formats
- Keyword matching logic and scoring methodology
- ATS scoring schema, compatibility assessment, and suggestions
- Bulk evaluation capabilities, filtering, and result aggregation
- Practical optimization workflows and integration patterns

The system evaluates a candidate's resume against a job description using a structured 100-point rubric, returning a numeric score, reasons, and actionable suggestions.

## Project structure
The ATS evaluation feature spans routing, service orchestration, prompt-driven evaluation, and document processing utilities.

```mermaid
graph TB
subgraph "API Layer"
R["routes/ats.py<br/>Text-based and file-based endpoints"]
end
subgraph "Service Layer"
S["services/ats.py<br/>Validation, orchestration, normalization"]
G["services/ats_evaluator/graph.py<br/>LangGraph evaluation"]
P["services/process_resume.py<br/>Document parsing to text/markdown"]
W["agents/web_content_agent.py<br/>JD link extraction"]
end
subgraph "Models"
M1["models/ats_evaluator/schemas.py<br/>Input/Output models"]
M2["models/schemas.py<br/>Exports for JDEvaluatorResponse"]
end
subgraph "Prompts"
PR["data/prompt/jd_evaluator.py<br/>100-point scoring prompt"]
end
R --> S
S --> G
S --> P
S --> W
G --> PR
M1 --> S
M2 --> R
```

## Core components
- Endpoints
  - Text-based evaluation endpoint: POST /ats/evaluate
  - File-based evaluation endpoint: POST /ats/evaluate (multipart/form-data)
- Input payload fields
  - resume_text: Candidate resume content
  - jd_text or jd_link: One of them must be provided
  - company_name, company_website: Optional enrichment fields
- Output schema
  - success: Boolean flag
  - message: Short status message
  - score: Integer score (0–100)
  - reasons_for_the_score: List of justification bullets
  - suggestions: List of actionable recommendations

Key behaviors:
- Accepts either raw text or uploaded files for both resume and job description
- Supports PDF, DOC, DOCX, TXT, MD for job description uploads
- Fetches job description from a URL if provided
- Normalizes evaluator output into a standardized response

## Architecture overview
The evaluation pipeline:
1. Receive request via FastAPI router
2. Parse and validate payload
3. Optionally fetch job description from a URL
4. Build LangGraph evaluation with a prompt template
5. Invoke LLM to produce JSON and narrative
6. Normalize output to standardized response

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Route /ats/evaluate"
participant S as "Service ats_evaluate_service"
participant P as "process_document"
participant W as "web_content_agent"
participant G as "ATSEvaluatorGraph.evaluate_ats"
participant PR as "jd_evaluator prompt"
C->>R : POST /ats/evaluate (JSON or multipart)
R->>P : Parse resume file (if uploaded)
alt JD provided as link
R->>W : Fetch markdown from jd_link
W-->>R : jd_text
end
R->>S : Validate and forward inputs
S->>G : Run evaluation graph
G->>PR : Format prompt with resume, JD, company metadata
PR-->>G : Prompted messages
G-->>S : JSON result (score, reasons, suggestions)
S-->>C : JDEvaluatorResponse
```

## Detailed component analysis

### Endpoint: POST /ats/evaluate (text-based)
- Accepts JSON body or form-encoded payload
- Validates presence of either jd_text or jd_link
- Supports optional company_name and company_website enrichment
- Processes resume_text directly

Behavior highlights:
- Ensures exactly one source for the job description
- Converts uploaded JD files to text when provided
- Delegates to service layer for evaluation

### Endpoint: POST /ats/evaluate (file-based)
- Accepts multipart/form-data with resume_file and optional jd_file/jd_text/jd_link
- Validates allowed JD file extensions
- Reads and converts resume and optional JD files to text
- Enforces that a job description source is provided

### Service: ats_evaluate_service
Responsibilities:
- Validates inputs using JDEvaluatorRequest schema
- Retrieves JD text from link if needed
- Invokes the evaluation graph
- Normalizes heterogeneous outputs to a dictionary
- Constructs and returns JDEvaluatorResponse

Key validations and error handling:
- HTTP 400 for invalid inputs or missing JD source
- HTTP 500 for retrieval failures or JSON parsing errors

### Evaluation graph: ATSEvaluatorGraph and evaluate_ats
- Initializes LLM (prefers shared provider; falls back to Gemini)
- Optionally binds Tavily search tool if available
- Formats prompt with resume, JD, company name, and company website content
- Executes a single-agent LangGraph with optional tool use
- Parses JSON from model output and returns structured result

```mermaid
classDiagram
class ATSEvaluatorGraph {
+config : GraphConfig
+llm
+tools
+llm_with_tools
+system_prompt
+agent(state) MessagesState
+build() StateGraph
}
class evaluate_ats {
+(resume_text, jd_text, company_name, company_website, llm) dict
}
ATSEvaluatorGraph <.. evaluate_ats : "instantiated and invoked"
```

### Prompt template: jd_evaluator
- Defines a 100-point rubric across categories:
  - Technical Skills & Experience Match (30)
  - Career Progression & Achievements (25)
  - Education & Credentials (15)
  - Resume Quality & Customization (15)
  - Soft Skills & Cultural Fit Indicators (10)
  - Employment Stability & Red Flags (5)
- Includes bonuses and penalties
- Requires valid JSON output with exact schema keys

Scoring methodology:
- Compute category scores with precise point bands
- Apply adjustments (bonuses/penalties)
- Cap final score at 100 and round to integer
- Produce reasons and suggestions aligned to the rubric

### Document processing: process_document
Capabilities:
- Converts PDF, DOC, DOCX to Markdown for parsing
- Falls back to Google GenAI multimodal conversion when needed
- Returns plain text for TXT/MD
- Validates resume content heuristically

Supported formats:
- Resume: TXT, MD, PDF, DOC, DOCX
- Job Description: TXT, MD, PDF, DOC, DOCX

### Web content retrieval: web_content_agent
- Fetches markdown content from a URL using a third-party service
- Returns empty string on failure or empty content

Used when jd_link is provided instead of jd_text.

### Response schema: JDEvaluatorResponse
Fields:
- success: Boolean
- message: String
- score: Integer (0–100)
- reasons_for_the_score: Array of strings
- suggestions: Array of strings

Normalization ensures robustness when evaluator returns JSON or narrative.

## Dependency analysis
- Routes depend on:
  - process_document for file parsing
  - web_content_agent for JD link retrieval
  - ats_evaluate_service for orchestration
- Service depends on:
  - JDEvaluatorRequest/Response models
  - ATSEvaluatorGraph for evaluation
- Graph depends on:
  - LLM provider (shared or Gemini)
  - jd_evaluator prompt template
  - optional Tavily tool binding

```mermaid
graph LR
Routes["routes/ats.py"] --> Service["services/ats.py"]
Routes --> Proc["services/process_resume.py"]
Routes --> Web["agents/web_content_agent.py"]
Service --> Graph["services/ats_evaluator/graph.py"]
Graph --> Prompt["data/prompt/jd_evaluator.py"]
Service --> Models["models/ats_evaluator/schemas.py"]
Models --> Routes
```

## Performance considerations
- LLM invocation cost and latency dominate evaluation time; consider:
  - Using a shared LLM provider to reduce cold-starts
  - Limiting concurrent evaluations during peak loads
  - Caching repeated JDs and company website content
- Document parsing overhead:
  - Prefer preprocessed text when possible
  - Batch resume processing where feasible
- Prompt size impacts token usage; keep resume and JD concise

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing job description source
  - Ensure either jd_text or jd_link is provided
- Unsupported JD file type
  - Allowed: PDF, DOC, DOCX, TXT, MD
- Failed to process JD/resume file
  - Verify file integrity and encoding
  - For PDFs, fallback conversion requires Google provider and API key
- JSON parsing errors from evaluator
  - Model output may be malformed; retry or adjust prompt
- JD link retrieval failures
  - Confirm URL accessibility and network connectivity

Operational logs capture company_name, presence of JD text/link, and raw outputs to aid debugging.

## Conclusion
The ATS evaluation API provides a reliable, extensible pipeline to assess resume-JD alignment using a structured 100-point rubric. It supports flexible input formats, optional enrichment, and produces actionable insights. Integrations can use the standardized response schema to power dashboards, bulk scoring, and automated optimization workflows.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API reference

- Endpoint: POST /ats/evaluate
  - Body (JSON or multipart/form-data)
    - resume_text: string
    - jd_text: string (optional if jd_link provided)
    - jd_link: string (optional if jd_text provided)
    - company_name: string (optional)
    - company_website: string (optional)
  - Response: JDEvaluatorResponse
    - success: boolean
    - message: string
    - score: integer (0–100)
    - reasons_for_the_score: array of strings
    - suggestions: array of strings

- Endpoint: POST /ats/evaluate (file-based)
  - Form fields
    - resume_file: file (TXT, MD, PDF, DOC, DOCX)
    - jd_file: file (optional, TXT, MD, PDF, DOC, DOCX)
    - jd_text: string (optional)
    - jd_link: string (optional)
    - company_name: string (optional)
    - company_website: string (optional)

### Scoring methodology and weight assignment
- Categories and approximate weights:
  - Technical Skills & Experience Match: 30%
  - Career Progression & Achievements: 25%
  - Education & Credentials: 15%
  - Resume Quality & Customization: 15%
  - Soft Skills & Cultural Fit Indicators: 10%
  - Employment Stability & Red Flags: 5%
- Adjustments:
  - Bonuses (up to +5): e.g., awards, publications, relevant volunteerism
  - Penalties (e.g., inconsistencies, unprofessional contact info, obvious misrepresentations)
- Final score capped at 100 and rounded to integer

### Keyword matching logic
- Extract required and preferred keywords from the JD
- Match exact terms and common synonyms/equivalents
- Count close equivalents as partial matches with documented mappings
- Penalize generic resumes; reward customization to the JD
- Provide specific reasons and suggestions for missing or mismatched keywords

### Formatting compatibility checks
- Resume content must include typical sections (e.g., Experience, Education, Skills)
- Resume text validated heuristically to ensure structure
- No specific ATS field enforcement; focus on semantic alignment and presentation quality

### Bulk ATS evaluation and aggregation
- Recommended pattern:
  - Iterate over a batch of resumes and a single job description
  - Store per-resume JDEvaluatorResponse entries
  - Aggregate by computing average score, top suggestions, and common reasons
- Filtering options:
  - Filter by minimum score threshold
  - Filter by presence of specific keywords in suggestions
- Result aggregation:
  - Group by reasons_for_the_score themes
  - Rank by score descending

[No sources needed since this section provides general guidance]

### Practical optimization workflows
- Workflow 1: Tailored Resume Generation
  - Use suggestions to rewrite resume sections
  - Re-run evaluation to measure improvements
- Workflow 2: Keyword Gap Analysis
  - Cross-reference missing_keywords with industry benchmarks
  - Add relevant skills and quantify achievements
- Workflow 3: Customization Audit
  - Ensure JD keywords appear naturally in Summary and Experience
  - Remove generic boilerplate

[No sources needed since this section provides general guidance]

### Integration with external ATS systems
- Use the standardized JDEvaluatorResponse to integrate with:
  - Internal ATS scoring dashboards
  - Pre-screening filters (e.g., minimum score thresholds)
  - Candidate shortlisting and interview scheduling
- Align external rubrics with the 100-point framework for comparability

[No sources needed since this section provides general guidance]
