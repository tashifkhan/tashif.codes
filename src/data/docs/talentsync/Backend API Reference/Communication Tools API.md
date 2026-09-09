# Communication tools API

## Introduction
This page provides detailed API documentation for AI-powered communication tools focused on cold email generation, cover letter creation, LinkedIn post generation, and job description editing. It explains request/response schemas, personalization parameters, prompt engineering approaches, content optimization strategies, brand consistency enforcement, bulk generation capabilities, template management, approval workflows, and quality assurance measures.

## Project structure
The communication tools are implemented as FastAPI routes backed by LangChain-based services and prompts. Each tool has:
- Route handlers that accept form or JSON payloads
- Pydantic models defining request/response schemas
- Service functions orchestrating LLM chains, optional document processing, and company research
- Prompt builders that construct LangChain chains for content generation and editing

```mermaid
graph TB
subgraph "Routes"
CMR["cold_mail.py"]
CLR["cover_letter.py"]
LIR["linkedin.py"]
JDR["jd_editor.py"]
end
subgraph "Models"
CMS["cold_mail/schemas.py"]
CLMS["cover_letter/schemas.py"]
LIS["linkedin_post/schemas.py"]
JDS["jd_editor/schemas.py"]
COMS["common/schemas.py"]
end
subgraph "Services"
CMSV["services/cold_mail.py"]
end
subgraph "Prompts"
CMG["data/prompt/cold_mail_gen.py"]
CMED["data/prompt/cold_mail_editor.py"]
end
subgraph "Support Services"
HAR["services/hiring_assiatnat.py"]
PR["services/process_resume.py"]
DP["services/data_processor.py"]
end
CMR --> CMSV
CLR --> CLMS
LIR --> LIS
JDR --> JDS
CMSV --> CMG
CMSV --> CMED
CMSV --> HAR
CMSV --> PR
CMSV --> DP
```

## Core components
- Cold Email Generation and Editing: Two variants support file upload and raw text inputs, with optional company URL research and key points personalization.
- Cover Letter Generation and Editing: Accepts resume text, job description, and personalization parameters; supports language selection.
- LinkedIn Post Generation and Editing: Generates multiple posts with hashtags and CTAs; supports editing existing posts.
- Job Description Editing: Aligns resume content with a specific job description, returning detailed changes and ATS metrics.

## Architecture overview
The system follows a layered architecture:
- Routes: Define endpoints and bind request/response models
- Services: Implement business logic, orchestrate LLM chains, and integrate external services
- Prompts: Provide LangChain chains for generation and editing
- Support Services: Handle document processing, company research, and text formatting

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "Route Handler"
participant Service as "Service Function"
participant Prompt as "Prompt Chain"
participant LLM as "BaseChatModel"
participant Ext as "External Services"
Client->>Route : "POST /cold-mail/generator/"
Route->>Service : "Invoke generator service"
Service->>Ext : "Optional : Company research"
Service->>Prompt : "Build chain and invoke"
Prompt->>LLM : "Generate content"
LLM-->>Prompt : "Response"
Prompt-->>Service : "Parsed JSON {subject, body}"
Service-->>Route : "ColdMailResponse"
Route-->>Client : "200 OK with subject/body"
```

## Detailed component analysis

### Cold email generation and editing
Endpoints:
- POST /cold-mail/generator/ (file-based)
- POST /cold-mail/generator/ (text-based)
- POST /cold-mail/editor/ (file-based)
- POST /cold-mail/edit/ (text-based)

Request parameters:
- Recipient and sender details: recipient_name, recipient_designation, company_name, sender_name, sender_role_or_goal
- Personalization: key_points_to_include, additional_info_for_llm, company_url
- For editing: generated_email_subject, generated_email_body, edit_inscription

Response:
- ColdMailResponse with success flag, message, subject, and body

Processing logic:
- File-based endpoints save temporary files, process documents, and optionally reformat resume text via LLM
- Both generation and editing use LangChain chains built from prompt modules
- Optional company research enriches prompts with company-specific context
- Reliable JSON parsing handles various LLM output formats

```mermaid
flowchart TD
Start(["Request Received"]) --> Mode{"File or Text?"}
Mode --> |File| SaveTemp["Save temp file"]
SaveTemp --> ProcDoc["Process document"]
ProcDoc --> MaybeFormat{"Text needs formatting?"}
MaybeFormat --> |Yes| FormatLLM["Format resume with LLM"]
MaybeFormat --> |No| SkipFormat["Skip formatting"]
Mode --> |Text| UseText["Use provided resume_text"]
ProcDoc --> ValidRes{"Valid resume?"}
SkipFormat --> ValidRes
UseText --> ValidRes
ValidRes --> |No| Err["HTTP 400 Invalid resume"]
ValidRes --> |Yes| Research{"company_url provided?"}
Research --> |Yes| CompResearch["Get company research"]
Research --> |No| NoResearch["Empty research"]
CompResearch --> GenChain["Build generation chain"]
NoResearch --> GenChain
GenChain --> ParseJSON["Parse JSON response"]
ParseJSON --> ReturnResp["Return ColdMailResponse"]
```

### Cover letter creation and editing
Endpoints:
- POST /cover-letter/generator/
- POST /cover-letter/edit/

Request parameters:
- Resume text and job description: resume_text, job_description, jd_url
- Personalization: recipient_name, company_name, sender_name, sender_role_or_goal, key_points_to_include, additional_info_for_llm, company_url
- Language selection: language (default en)

Response:
- CoverLetterResponse with success flag, message, and body

Processing logic:
- Uses dedicated generation and editing functions
- Supports language localization
- Integrates optional company URL for context

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "cover_letter.py"
participant Service as "generate/edit_cover_letter"
participant LLM as "BaseChatModel"
Client->>Route : "POST /cover-letter/generator/"
Route->>Service : "Call generate_cover_letter"
Service->>LLM : "Generate cover letter"
LLM-->>Service : "Content"
Service-->>Route : "Body text"
Route-->>Client : "CoverLetterResponse"
```

### LinkedIn post generation and editing
Endpoints:
- POST /linkedin/generate-posts
- POST /linkedin/edit-post
- POST /linkedin/generate-page

Request parameters:
- Generate posts: topic, tone, audience, length, hashtags_option, cta_text, mimic_examples, language, post_count, emoji_level, github_project_url, enable_research
- Edit post: arbitrary payload with post content and instruction
- Generate page: detailed request for profile, posts, and engagement strategy

Response:
- PostGenerationResponse with success flag, message, list of posts, and timestamp
- Individual post includes text, hashtags, CTA suggestion, token info, sources, and GitHub project name
- Edit post returns updated post content

Processing logic:
- Supports multiple posts per request with configurable counts and lengths
- Optional GitHub project analysis for insights and hooks
- Web research can be enabled for topic insights

```mermaid
classDiagram
class PostGenerationRequest {
+string topic
+string? tone
+string[]? audience
+string length
+string hashtags_option
+string? cta_text
+string? mimic_examples
+string? language
+int post_count
+int emoji_level
+HttpUrl? github_project_url
+bool enable_research
}
class GeneratedPost {
+string text
+string[]? hashtags
+string? cta_suggestion
+Dict? token_info
+Source[]? sources
+string? github_project_name
}
class PostGenerationResponse {
+bool success
+string message
+GeneratedPost[] posts
+string timestamp
}
PostGenerationRequest --> PostGenerationResponse : "produces"
GeneratedPost <-- PostGenerationResponse : "contains"
```

### Job description editing (resume alignment)
Endpoint:
- POST /resume/edit-by-jd

Request parameters:
- resume_text and structured resume data
- job_description and optional jd_url, company_name
- language selection

Response:
- JDEditResponse with success flag, message, edited resume, changes, diff summary, ATS scores, keyword analysis, and warnings

Processing logic:
- Aligns resume content with job description using targeted edits
- Provides detailed diffs and ATS metrics before/after
- Highlights addressed and missing keywords

```mermaid
flowchart TD
Start(["Receive JDEditRequest"]) --> Analyze["Analyze resume vs JD"]
Analyze --> Changes["Compute targeted changes"]
Changes --> Diff["Generate diff summary"]
Diff --> Score["Calculate ATS scores"]
Score --> Keywords["Identify addressed/missing keywords"]
Keywords --> Respond["Return JDEditResponse"]
```

## Dependency analysis
Key dependencies and relationships:
- Routes depend on service functions for business logic
- Services depend on LangChain prompt modules for chain construction
- Cold email services optionally depend on company research and resume processing utilities
- Common schemas define reusable data structures across models

```mermaid
graph LR
RCM["routes/cold_mail.py"] --> SCM["services/cold_mail.py"]
RCL["routes/cover_letter.py"] --> CLS["models/cover_letter/schemas.py"]
RLI["routes/linkedin.py"] --> LIS["models/linkedin_post/schemas.py"]
RJD["routes/jd_editor.py"] --> JDS["models/jd_editor/schemas.py"]
SCM --> PGEN["data/prompt/cold_mail_gen.py"]
SCM --> PED["data/prompt/cold_mail_editor.py"]
SCM --> HAR["services/hiring_assiatnat.py"]
SCM --> PR["services/process_resume.py"]
SCM --> DP["services/data_processor.py"]
COM["models/common/schemas.py"] --> JDS
```

## Performance considerations
- File processing: Temporary file handling and cleanup to avoid disk bloat; consider streaming and size limits
- LLM invocation: Batch multiple posts in a single request to reduce overhead (supported by post_count)
- Optional research: Enable company research only when company_url is provided to minimize latency
- Resume formatting: Apply LLM-based formatting selectively for non-trivial formats to balance accuracy and speed
- JSON parsing: Reliable parsing accommodates varied LLM outputs; ensure prompt consistency to reduce retries

## Troubleshooting guide
Common issues and resolutions:
- Invalid resume format: Ensure uploaded files are supported and contain readable text; validation checks will reject malformed content
- JSON parsing failures: Verify prompt outputs are valid JSON; adjust prompt instructions to enforce strict formatting
- Company research errors: Confirm company_url validity and network connectivity; handle empty results gracefully
- Unsupported file types: Supported formats include common document types; plain text and Markdown are accepted without reformatting
- Rate limiting and timeouts: Configure LLM provider settings and consider retry/backoff strategies

## Conclusion
The Communication Tools API provides a cohesive set of endpoints for generating and refining professional communications. By using structured schemas, reliable prompt engineering, optional research, and quality checks, the system ensures personalized, consistent, and effective content across cold emails, cover letters, LinkedIn posts, and resume alignment to job descriptions. Extending these patterns enables scalable bulk generation, template management, and approval workflows tailored to organizational needs.
