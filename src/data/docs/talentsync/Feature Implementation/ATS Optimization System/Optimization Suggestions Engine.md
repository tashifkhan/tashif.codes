# Optimization suggestions engine

## Introduction
This page explains the Optimization Suggestions Engine responsible for generating actionable, ATS-compatible recommendations to improve resumes. It covers:
- How the system extracts job requirements and aligns resume content
- The suggestion categorization system for grouping recommendations by priority and impact
- Natural language generation prompts that produce human-readable optimization advice
- The personalized suggestion engine that adapts recommendations based on individual resume profiles
- Examples of common suggestion patterns such as keyword insertion, experience reformatting, and skill alignment
- The suggestion validation process and confidence scoring for each recommendation
- The integration between suggestion generation and resume editing workflows

## Project structure
The engine spans backend services, prompts, models, and frontend integration:
- Backend routes expose endpoints for resume improvement and refinement
- Services orchestrate keyword extraction, resume tailoring, refinement passes, and diff calculation
- Prompts define structured instructions for LLMs to maintain truthfulness and improve ATS compatibility
- Models define request/response schemas and refinement statistics
- Frontend integrates via typed service calls

```mermaid
graph TB
FE["Frontend Service<br/>improvement.service.ts"] --> API["FastAPI Routes<br/>resume_improvement.py"]
API --> SVC_MAIN["Main Workflow<br/>resume_improvement.py"]
SVC_MAIN --> SVC_IMP["Improver Service<br/>improver.py"]
SVC_MAIN --> SVC_REF["Refiner Service<br/>refiner.py"]
SVC_IMP --> PROMPTS["Prompts & Truthfulness Rules<br/>resume_improvement.py"]
SVC_REF --> PROMPTS_REF["Refinement Prompts<br/>resume_refinement.py"]
SVC_IMP --> MODELS_I["Models: Improvement<br/>schemas.py"]
SVC_REF --> MODELS_R["Models: Refinement<br/>schemas.py"]
```

## Core components
- Resume Improvement Orchestration: Coordinates keyword extraction, resume tailoring, refinement, and diff calculation
- Improver Service: Generates tailored resume content using structured prompts and validates output
- Refiner Service: Performs multi-pass refinement to inject keywords safely, remove AI-generated phrases, and validate master resume alignment
- Prompt Templates: Define truthfulness rules, prompt variants, and keyword extraction instructions
- Schemas: Define request/response models, suggestion records, diffs, and refinement statistics
- Frontend Integration: Typed service calls to trigger improvement and refinement

Key responsibilities:
- Extract job keywords from job descriptions
- Tailor resume content to match keywords and job requirements while preserving truthfulness
- Compute confidence scores for suggested changes
- Validate that tailored content does not fabricate information absent from the master resume
- Provide actionable suggestions grouped by impact and priority

## Architecture overview
The system follows a pipeline:
1. Frontend triggers improvement or refinement via typed service calls
2. FastAPI routes resolve the LLM dependency and delegate to the orchestration service
3. The orchestration service:
   - Extracts job keywords if not provided
   - Calls the Improver to tailor the resume using prompt variants
   - Optionally runs Refiner passes to inject keywords, remove AI phrases, and validate alignment
   - Computes diffs and builds improvement suggestions
4. Responses include tailored resume, suggestions, diffs, and refinement statistics

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "FastAPI Route"
participant SVC as "Orchestration Service"
participant IMP as "Improver"
participant REF as "Refiner"
participant LLM as "LLM"
FE->>API : POST /api/resume-improve
API->>SVC : improve_resume_with_refinement(payload, llm)
SVC->>IMP : extract_job_keywords(job_description, llm)
IMP-->>SVC : job_keywords
SVC->>IMP : improve_resume(original, job_description, job_keywords, llm)
IMP->>LLM : prompt (variant + truthfulness rules)
LLM-->>IMP : tailored resume JSON
SVC->>REF : refine_resume(initial_tailored, master, job_description, job_keywords, llm)
REF->>LLM : optional keyword injection
LLM-->>REF : refined resume JSON
SVC-->>FE : ResumeImproveResponse (tailored, suggestions, diffs, stats)
```

## Detailed component analysis

### Resume improvement orchestration
Responsibilities:
- Validate inputs and handle missing job keywords
- Call Improver to tailor the resume
- Optionally refine the result against the master resume
- Preserve personal information from the original resume
- Compute diffs and generate improvement suggestions

Key behaviors:
- Personal info preservation warns if original data is unavailable or invalid
- Refinement attempts only if master resume data is provided
- Diff calculation compares master and improved data to surface changes
- Improvement suggestions are generated from extracted job keywords

### Improver service
Responsibilities:
- Extract job keywords from job descriptions
- Tailor resume content using prompt variants:
  - Nudge: minimal edits
  - Keyword improve: weave in relevant keywords
  - Full tailor: detailed tailoring
- Enforce critical truthfulness rules per variant
- Validate output structure and sanitize inputs
- Compute diffs between original and improved data

Truthfulness rules:
- Do not add unmentioned skills, tools, certifications, or companies
- Do not invent achievements or timelines
- Preserve role, industry, and seniority levels
- Preserve original bullet counts and ordering

Confidence scoring:
- Medium confidence for modified entries
- High confidence for added/removed entries
- Low confidence for removed experience entries

### Refiner service
Responsibilities:
- Multi-pass refinement:
  - Keyword injection: inject safe, missing keywords from the master resume
  - AI phrase removal: strip generic AI-generated phrases
  - Master alignment check: detect and fix fabrications compared to the master resume
- Keyword gap analysis: compute current vs. potential match percentages
- Final keyword match calculation and alignment report

Validation and safety:
- Ensures resume structure remains intact after refinement
- Fixes critical violations by removing fabricated content
- Tracks passes completed and actions taken

### Prompt templates and natural language generation
Prompt variants:
- Nudge: minimal, conservative edits preserving structure and content
- Keyword improve: rephrase bullet points to include relevant keywords
- Full tailor: detailed tailoring with emphasis on quantifiable achievements

Truthfulness rules:
- Strict constraints to avoid fabrication and preserve facts
- Variants adjust the degree of permissible expansion

Keyword extraction:
- Dedicated prompt extracts required skills, preferred skills, experience requirements, education requirements, key responsibilities, and keywords

### Suggestion categorization and confidence scoring
Suggestion generation:
- Builds improvement suggestions from job keywords (top required skills and key responsibilities)
- Provides human-readable summaries without line numbers for broad guidance

Confidence scoring:
- Added/removed entries: high confidence
- Modified entries: medium confidence
- Removed experience entries: low confidence

Diff computation:
- Compares skills, experiences, educations, projects, and bullet points
- Produces detailed change records and summary statistics

### Personalized suggestion engine
Personalization uses:
- Master resume profile to ensure truthfulness and prevent fabrication
- Job description and extracted keywords to tailor content
- Refinement configuration to control pass types and limits

Safety mechanisms:
- Master alignment validation prevents introducing fabricated skills, certifications, or companies
- AI phrase removal improves readability and ATS friendliness
- Keyword injection only adds terms present in the master resume

### Common suggestion patterns
Examples of actionable patterns surfaced by the system:
- Keyword insertion: Weave relevant keywords into existing bullet points where evidence already exists
- Experience reformatting: Rephrase descriptions to emphasize quantifiable achievements and match job responsibilities
- Skill alignment: Highlight overlapping skills and certifications already present in the resume
- Truthful expansion: Elaborate on existing work without inventing new responsibilities

These patterns are derived from prompt variants and enforced by truthfulness rules.

### Integration with resume editing workflows
Frontend integration:
- Typed service methods call backend endpoints for improvement and refinement
- Requests include resume identifiers, job descriptions, optional job keywords, and refinement configuration

Backend endpoints:
- /api/resume-improve: orchestrates improvement and optional refinement
- /api/resume-refine: performs refinement on an already tailored resume

Responses:
- Improved or refined resume data
- Improvement suggestions
- Detailed diffs and summary statistics
- Refinement stats (passes completed, keywords injected, violations fixed)

## Dependency analysis
The system exhibits clear separation of concerns:
- Routes depend on orchestration service
- Orchestration service depends on Improver and Refiner
- Improver depends on prompt templates and LLM helpers
- Refiner depends on prompt templates and LLM helpers
- Models define contracts for requests, responses, and statistics

```mermaid
graph TB
R["Routes<br/>resume_improvement.py"] --> O["Orchestration<br/>resume_improvement.py"]
O --> I["Improver<br/>improver.py"]
O --> F["Refiner<br/>refiner.py"]
I --> P["Prompts<br/>resume_improvement.py"]
F --> PR["Refinement Prompts<br/>resume_refinement.py"]
I --> M1["Models: Improvement<br/>schemas.py"]
F --> M2["Models: Refinement<br/>schemas.py"]
```

## Performance considerations
- Token limits: Prompts specify maximum tokens for LLM responses to manage cost and latency
- Structured JSON output: Reduces parsing overhead and ensures reliable validation
- Multi-pass refinement: Controlled via configuration to balance quality and performance
- Caching: Text extraction for keyword matching uses caching to reduce repeated computations
- Input sanitization: Injection patterns are redacted to prevent prompt injection attacks

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and mitigations:
- Empty job description or resume text: Validation returns failure with explanatory messages
- Missing original resume data: Personal info preservation warns and may generate AI-derived info
- Refinement failures: Logged warnings and graceful fallback to improved resume without refinement
- Truncated LLM output: Validation checks for required sections and raises errors if missing
- Fabrication detected: Critical violations are removed during alignment fixes

## Conclusion
The Optimization Suggestions Engine combines structured prompting, multi-pass refinement, and strict truthfulness rules to generate actionable, ATS-friendly recommendations. It preserves personal information, validates alignment with the master resume, and provides confidence-aware suggestions. The modular architecture supports integration with resume editing workflows, enabling iterative improvement guided by job requirements and keyword alignment.
