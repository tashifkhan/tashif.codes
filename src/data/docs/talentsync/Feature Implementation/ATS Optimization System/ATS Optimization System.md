# ATS optimization system

## Introduction
This page describes the ATS Optimization System that evaluates how well a candidate's resume matches a job description using a structured LangChain graph. It explains the keyword analysis and compatibility scoring mechanisms, the integration between resume text and job description processing, the prompts and scoring criteria used by the LangChain graph, and the frontend components for input, evaluation, and visualization. It also documents the data models for ATS scores, keyword matches, and optimization suggestions, and provides guidance on performance and caching strategies for bulk evaluations.

## Project structure
The system spans a FastAPI backend and a Next.js frontend:
- Backend exposes REST endpoints for ATS evaluation, processes resume and job description inputs, orchestrates the LangChain graph, and normalizes outputs.
- Frontend provides user interfaces for selecting a resume (existing or uploaded), entering a job description (text, URL, or file), triggering evaluation, and visualizing results.

```mermaid
graph TB
subgraph "Frontend"
FE_Page["ATS Evaluation Page<br/>page.tsx"]
FE_JD["JobDescriptionForm.tsx"]
FE_RS["ResumeSelection.tsx"]
FE_Res["EvaluationResults.tsx"]
FE_SVC["ats.service.ts"]
end
subgraph "Backend"
BE_Router["Routes: /ats/evaluate<br/>routes/ats.py"]
BE_Service["Service: ats_evaluate_service<br/>services/ats.py"]
BE_Graph["LangGraph: ATSEvaluatorGraph<br/>services/ats_evaluator/graph.py"]
BE_Prompt["Prompt Template: jd_evaluator<br/>data/prompt/jd_evaluator.py"]
end
FE_Page --> FE_JD
FE_Page --> FE_RS
FE_Page --> FE_Res
FE_SVC --> BE_Router
BE_Router --> BE_Service
BE_Service --> BE_Graph
BE_Graph --> BE_Prompt
```

## Core components
- LangChain graph-based evaluator: Orchestrates a single-agent state graph with optional tool binding for web search, invokes an LLM with a structured prompt, and parses JSON output.
- REST endpoints: Accept resume and job description inputs (text, file, or URL), validate payloads, and delegate to the evaluation service.
- Evaluation service: Normalizes outputs into a consistent response model and handles errors.
- Frontend pages and components: Collect inputs, submit requests, and render results with a score visualization and suggestions.

## Architecture overview
The evaluation pipeline integrates frontend input collection, backend routing/validation, service orchestration, and a LangChain graph that executes a prompt-driven LLM chain. The prompt defines a scoring rubric and required JSON schema.

```mermaid
sequenceDiagram
participant FE as "Frontend Page<br/>page.tsx"
participant SVC as "Frontend Service<br/>ats.service.ts"
participant API as "Backend Route<br/>routes/ats.py"
participant SRV as "Evaluation Service<br/>services/ats.py"
participant GR as "LangGraph<br/>services/ats_evaluator/graph.py"
participant PR as "Prompt Template<br/>data/prompt/jd_evaluator.py"
FE->>SVC : Submit evaluation (FormData)
SVC->>API : POST /ats/evaluate
API->>SRV : ats_evaluate_service(resume_text, jd_text/jd_link, company_*)
SRV->>GR : evaluate_ats(...)
GR->>PR : Build prompt with resume and JD
PR-->>GR : ChatPromptTemplate
GR->>GR : Invoke LLM with system + messages
GR-->>SRV : JSON string/dict
SRV-->>API : JDEvaluatorResponse
API-->>SVC : JSON response
SVC-->>FE : Render score and suggestions
```

## Detailed component analysis

### Keyword analysis and compatibility scoring mechanism
- Keyword extraction and normalization: The prompt instructs extracting required and preferred keywords from the job description and mapping synonyms and equivalents. It requires explicit presence of keywords in the resume and penalizes missing required skills.
- Scoring rubric: The prompt defines a 100-point framework across categories such as Technical Skills & Experience Match, Career Progression & Achievements, Education & Credentials, Resume Quality & Customization, Soft Skills & Cultural Fit Indicators, and Stability/Red Flags. Adjustments include bonuses and penalties.
- Output schema: The prompt enforces a strict JSON schema with fields for score, reasons_for_the_score, and suggestions.

```mermaid
flowchart TD
Start(["Inputs: JD, Resume, Company Info"]) --> ParseJD["Parse JD<br/>Extract required/preferred keywords"]
ParseJD --> ParseResume["Parse Resume<br/>Extract skills, roles, achievements"]
ParseResume --> Normalize["Normalize & Map Synonyms"]
Normalize --> Score["Apply 100-point Rubric<br/>Compute Category Scores"]
Score --> Adjust["Apply Bonuses/Penalties"]
Adjust --> Cap["Cap Final Score ≤ 100"]
Cap --> Output["Produce JSON:<br/>score, reasons_for_the_score, suggestions"]
```

### Integration between resume text analysis and job description processing
- Input handling: The backend supports three modes for the job description: raw text, file upload, or URL. If a URL is provided, the system retrieves and converts the page to Markdown for processing.
- Resume handling: The system accepts either a resume ID (existing) or a file upload. The resume is processed into text for evaluation.
- Validation: Pydantic models validate inputs and ensure either JD text or link is provided.

```mermaid
flowchart TD
A["User selects resume (existing or file)"] --> B{"JD provided as text?"}
B -- Yes --> C["Use jd_text"]
B -- No --> D{"JD provided as file?"}
D -- Yes --> E["Process JD file to text"]
D -- No --> F{"JD provided as URL?"}
F -- Yes --> G["Fetch and convert JD URL to Markdown"]
F -- No --> H["Validation error"]
E --> I["Proceed to evaluation"]
G --> I
C --> I
I --> J["Call ats_evaluate_service(...)"]
```

### LangChain graph and prompt execution
- Graph: A single-agent state graph with optional tool binding for web search. The agent composes a system prompt and invokes the LLM with messages.
- Prompt: The prompt template defines operating principles, rubric scoring, normalization rules, and required JSON schema.
- JSON parsing: The evaluator strips code fences and extracts the first valid JSON object from the LLM response.

```mermaid
classDiagram
class ATSEvaluatorGraph {
+config : GraphConfig
+llm
+tools
+llm_with_tools
+system_prompt
+agent(state) dict
+build() StateGraph
}
class GraphConfig {
+model : str
+temperature : float
}
ATSEvaluatorGraph --> GraphConfig : "uses"
```

### Frontend components for ATS evaluation
- ATS Evaluation Page: Coordinates input collection, validation, submission, and result rendering.
- JobDescriptionForm: Supports three input modes (URL, text, file) with drag-and-drop file support and previews.
- ResumeSelection: Allows choosing an existing resume or uploading a new one, with a dropdown and file preview.
- EvaluationResults: Displays the ATS score, reasons, suggestions, and an "Optimize Resume" call-to-action.

```mermaid
graph TB
P["page.tsx"] --> JD["JobDescriptionForm.tsx"]
P --> RSel["ResumeSelection.tsx"]
P --> ER["EvaluationResults.tsx"]
P --> SVC["ats.service.ts"]
```

### Data models for ATS scores, keyword matches, and suggestions
- Request model: Accepts resume_text, jd_text, jd_link, company_name, company_website.
- Response model: Returns success flag, message, score, reasons_for_the_score, and suggestions.
- Internal normalization: The service ensures numeric types and safe defaults for score and lists.

```mermaid
classDiagram
class ATSEvaluationRequest {
+resume_text : str
+jd_text : str
+jd_link : str
+company_name : str
+company_website : str
}
class JDEvaluatorResponse {
+success : bool
+message : str
+score : int
+reasons_for_the_score : str[]
+suggestions : str[]
}
ATSEvaluationRequest --> JDEvaluatorResponse : "validated by"
```

### Examples of how the system identifies missing keywords and suggests improvements
- Missing keywords: The prompt instructs to extract required and preferred keywords from the JD and explicitly mark missing required skills. Partial matches are recognized with synonym mapping.
- Suggestions: The prompt directs generating targeted, actionable suggestions aligned with lost points and the specific JD, prioritizing missing must-haves, stronger quantification, clearer alignment, and red flag fixes.

### Integration with additional company context
- Optional company name and website content can be included to enrich the prompt and tailor the evaluation.

## Dependency analysis
The backend depends on:
- LangChain for prompt templating and LLM invocation.
- LangGraph for stateful orchestration.
- Optional external tools (web search) for JD enrichment.
- Pydantic models for input validation and response shaping.

```mermaid
graph TB
R["routes/ats.py"] --> S["services/ats.py"]
S --> G["services/ats_evaluator/graph.py"]
G --> P["data/prompt/jd_evaluator.py"]
S --> M["models/ats_evaluator/schemas.py"]
```

## Performance considerations
- Bulk evaluations: Batch requests to minimize overhead. Use pagination and concurrency limits appropriate to the LLM provider rate limits.
- Caching strategies:
  - Prompt and tool initialization: Cache the LLM instance and prompt template to avoid repeated construction.
  - Web content retrieval: Cache fetched JD content when URLs are reused to reduce network calls.
  - JSON parsing: Cache normalized results keyed by (resume_hash, jd_hash) to skip recomputation for identical inputs.
  - Frontend: Persist recent evaluations to avoid re-fetching identical inputs.
- Streaming and timeouts: Configure request timeouts and consider streaming responses where supported by the LLM provider.
- Cost control: Monitor token usage and consider summarizing long inputs when feasible.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- JSON parsing failures: The evaluator strips code fences and attempts to extract the first valid JSON object. If parsing fails, the system raises a structured HTTP error.
- Network and service errors: Frontend route wraps fetch errors and returns a standardized failure response with a 503 status.
- Input validation: Ensure either jd_text or jd_link is provided; otherwise, a 400 error is raised.

## Conclusion
The ATS Optimization System combines reliable input handling, a structured LangChain graph, and a precise scoring prompt to deliver accurate ATS match evaluations. The frontend provides intuitive controls for resume and job description inputs, and clear visualization of results and suggestions. Adhering to the documented data models and using caching and batching strategies enables scalable, high-quality evaluations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API definitions
- Endpoint: POST /ats/evaluate
- Request body: multipart/form-data or JSON with fields:
  - resume_text (string) or resumeId (string) and file (binary)
  - jd_text (string) or jd_file (binary) or jd_link (string)
  - company_name (string, optional)
  - company_website (string, optional)
- Response: JDEvaluatorResponse with success, message, score, reasons_for_the_score, suggestions
