# PDF resume generation components

## Introduction
This page explains the PDF resume generation system, focusing on the frontend components that enable users to customize, preview, and export professional resumes. It covers the configuration options, export formats, LaTeX generation process, template system, styling options, and integration with backend APIs. The goal is to help developers and technical users understand how the resume generation pipeline works from UI interactions to backend processing and final output delivery.

## Project structure
The resume generation feature is organized into reusable React components and supporting utilities, with clear separation between UI, data orchestration, and LaTeX generation logic. The frontend components communicate with Next.js API routes, which act as bridges to the backend services responsible for resume tailoring and PDF generation.

```mermaid
graph TB
subgraph "Frontend Components"
CFG["ConfigurationForm.tsx"]
EXP["ExportTab.tsx"]
PREV["ResumePreview.tsx"]
LTX["LatexOutput.tsx"]
TAIL["TailoringForm.tsx"]
SRCSEL["ResumeSourceSelector.tsx"]
end
subgraph "Utilities"
GEN["latexGenerator.ts"]
ESC["latexEscape.ts"]
SVC["resume-gen.service.ts"]
end
subgraph "API Routes"
BRIDGE["tailored-resume/route.ts"]
end
subgraph "Backend Services"
PIPE["graph.py"]
end
EXP --> CFG
EXP --> TAIL
EXP --> PREV
EXP --> LTX
EXP --> SVC
SVC --> BRIDGE
BRIDGE --> PIPE
LTX --> GEN
GEN --> ESC
```

## Core components
This section introduces the primary components involved in the resume generation workflow:

- ConfigurationForm: Allows users to choose a resume template, color scheme, and font size.
- TailoringForm: Enables job-specific customization by providing job role, company details, and job description.
- ExportTab: Orchestrates the entire export process, including resume tailoring, preview generation, LaTeX code generation, and PDF download.
- ResumePreview: Renders a human-readable preview of the resume data.
- LatexOutput: Displays generated LaTeX code and provides actions to copy or open in Overleaf.
- ResumeSourceSelector: Lets users select an existing resume or upload a new one.
- latexGenerator: Provides LaTeX templates and generation utilities.
- latexEscape: Ensures safe LaTeX compilation by escaping special characters.
- resume-gen.service: Frontend service for interacting with backend resume generation endpoints.
- tailored-resume/route.ts: Next.js API route that bridges frontend requests to backend services.
- graph.py: Backend service orchestrating resume tailoring with LLMs and tools.

## Architecture overview
The resume generation architecture follows a clear separation of concerns:
- Frontend components collect user preferences and trigger actions.
- ExportTab coordinates state and orchestrates API calls.
- Next.js API routes validate requests, enforce authentication, and forward to backend services.
- Backend services perform resume tailoring and prepare data for LaTeX generation.
- LaTeX utilities transform structured resume data into compilable LaTeX documents.

```mermaid
sequenceDiagram
participant User as "User"
participant Export as "ExportTab"
participant Service as "resume-gen.service"
participant Bridge as "tailored-resume/route.ts"
participant Backend as "graph.py"
participant Utils as "latexGenerator.ts"
User->>Export : "Configure options and click Export"
Export->>Service : "Tailor resume (FormData)"
Service->>Bridge : "POST /api/tailored-resume"
Bridge->>Backend : "Call resume tailoring pipeline"
Backend-->>Bridge : "Structured resume data"
Bridge-->>Service : "Resume data response"
Service-->>Export : "Resume data"
Export->>Service : "Generate LaTeX"
Service->>Bridge : "POST /api/generate-latex"
Bridge-->>Service : "LaTeX code"
Service-->>Export : "LaTeX code"
Export->>Utils : "Render LaTeX output"
Utils-->>Export : "Formatted LaTeX"
Export-->>User : "Preview and download options"
```

## Detailed component analysis

### ConfigurationForm
ConfigurationForm provides three customization controls:
- Template selection: Professional or Modern.
- Color scheme: Gray, Blue, Green, Red.
- Font size: Slider from 8pt to 12pt.

These options influence the LaTeX output styling and structure.

```mermaid
flowchart TD
Start(["Open ConfigurationForm"]) --> ChooseTemplate["Select Template"]
ChooseTemplate --> ChooseColor["Select Color Scheme"]
ChooseColor --> AdjustFont["Adjust Font Size (8–12pt)"]
AdjustFont --> Apply["Apply Changes"]
Apply --> End(["Options Ready"])
```

### TailoringForm
TailoringForm enables job-specific resume tailoring:
- Toggle for enabling tailoring.
- Required job role.
- Optional company name, website, and job description.

When enabled, these inputs are sent to the backend to tailor the resume data.

```mermaid
flowchart TD
Start(["Enable Tailoring"]) --> EnterRole["Enter Job Role (required)"]
EnterRole --> OptionalFields["Optionally enter Company Details<br/>and Job Description"]
OptionalFields --> Submit["Submit Tailoring Request"]
Submit --> End(["Tailored Data Returned"])
```

### ExportTab
ExportTab is the central orchestrator:
- Manages state for configuration, tailoring, preview, and LaTeX output.
- Handles preview generation, LaTeX generation, and PDF download.
- Integrates with API mutations for tailor, LaTeX generation, and PDF download.
- Displays loading overlays during generation and shows success/error notifications.

Key flows:
- Preview: Calls tailor mutation, sets parsed data, and renders ResumePreview.
- LaTeX: Builds PdfGenerationRequest with selected template and options, calls generate LaTeX mutation, and displays LatexOutput.
- PDF: Builds PdfGenerationRequest, calls download mutation, handles Blob download, and falls back to LaTeX if PDF service is unavailable.

```mermaid
sequenceDiagram
participant User as "User"
participant Tab as "ExportTab"
participant Tailor as "Tailor Mutation"
participant Latex as "LaTeX Mutation"
participant PDF as "PDF Mutation"
participant Preview as "ResumePreview"
participant Output as "LatexOutput"
User->>Tab : "Click Preview"
Tab->>Tailor : "Fetch tailored resume data"
Tailor-->>Tab : "Resume data"
Tab->>Preview : "Render preview"
User->>Tab : "Click LaTeX"
Tab->>Latex : "Generate LaTeX"
Latex-->>Tab : "LaTeX code"
Tab->>Output : "Display LaTeX"
User->>Tab : "Click Download PDF"
Tab->>PDF : "Download PDF"
alt PDF success
PDF-->>Tab : "Blob"
Tab-->>User : "Save file"
else PDF unavailable
PDF-->>Tab : "Fallback with LaTeX"
Tab->>Output : "Display LaTeX"
end
```

### ResumePreview
ResumePreview renders a readable preview of the resume data:
- Header with name and contact information.
- Sections for Education, Skills, Languages, Experience, Projects, Publications, Positions of Responsibility, Certifications, and Achievements.
- Uses markdown rendering for rich text display.

```mermaid
flowchart TD
Start(["Receive ResumeData"]) --> Header["Render Header"]
Header --> Sections["Render Sections"]
Sections --> Skills["Skills and Languages"]
Sections --> Experience["Work Experience"]
Sections --> Projects["Projects"]
Sections --> Education["Education"]
Sections --> Other["Publications, Positions,<br/>Certifications, Achievements"]
Skills --> End(["Preview Complete"])
Experience --> End
Projects --> End
Education --> End
Other --> End
```

### LatexOutput
LatexOutput presents the generated LaTeX code:
- Provides buttons to copy LaTeX to clipboard and open in Overleaf.
- Includes a textarea with the full LaTeX code.
- Offers manual compilation instructions.

```mermaid
flowchart TD
Start(["LaTeX Generated"]) --> Display["Display LaTeX Code"]
Display --> Copy["Copy to Clipboard"]
Display --> Open["Open in Overleaf"]
Display --> Manual["Manual Compilation Instructions"]
Copy --> End(["Done"])
Open --> End
Manual --> End
```

### ResumeSourceSelector
ResumeSourceSelector allows users to choose a resume source:
- Toggle between "Use Existing Resume" and "Upload New Resume".
- Dropdown to select from user's resumes with metadata.
- Drag-and-drop upload area for new resumes.

```mermaid
flowchart TD
Start(["Open Selector"]) --> Toggle["Toggle Input Mode"]
Toggle --> Existing{"Existing?"}
Existing --> |Yes| Dropdown["Open Resume Dropdown"]
Existing --> |No| Upload["Open Upload Area"]
Dropdown --> Select["Select Resume"]
Upload --> Choose["Choose File"]
Select --> End(["Resume Selected"])
Choose --> End
```

### LaTeX generation process and template system
The LaTeX generation pipeline transforms structured resume data into compilable LaTeX:
- Templates: Professional and Modern, each with distinct styling and packages.
- Options: Font size, margins, and color scheme.
- Escaping: Special characters are escaped to ensure LaTeX compilation safety.
- Utilities: Helper functions format lists, sanitize headers, and escape text.

```mermaid
classDiagram
class LatexTemplate {
+string id
+string name
+generate(data, options) string
}
class ProfessionalTemplate {
+generate(data, options) string
}
class ModernTemplate {
+generate(data, options) string
}
class EscapeUtils {
+escapeLatex(text) string
+sanitizeForHeader(text) string
+formatLatexList(items, escape) string
}
LatexTemplate <|.. ProfessionalTemplate
LatexTemplate <|.. ModernTemplate
ProfessionalTemplate --> EscapeUtils : "uses"
ModernTemplate --> EscapeUtils : "uses"
```

### Backend integration and resume tailoring
The frontend communicates with backend services through Next.js API routes:
- Authentication: Session-based checks ensure authorized access.
- Tailoring: Two pathways, file upload (v1) or existing resume text (v2).
- Validation: Ensures required fields and prevents conflicting inputs.
- Error handling: Graceful handling of timeouts, non-JSON responses, and access restrictions.
- Pipeline: Backend orchestrates LLM-based tailoring and returns structured data.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "tailored-resume/route.ts"
participant BE as "graph.py"
participant LLM as "LLM Tools"
FE->>API : "POST /api/tailored-resume"
API->>API : "Validate request and session"
API->>BE : "Forward to backend tailor endpoint"
BE->>LLM : "Run tailoring pipeline"
LLM-->>BE : "Structured resume data"
BE-->>API : "Return data"
API-->>FE : "Success response"
```

## Dependency analysis
The components and utilities depend on each other as follows:
- ExportTab depends on TailoringForm, ConfigurationForm, ResumePreview, LatexOutput, and resume-gen.service.
- LatexOutput depends on latexGenerator and latexEscape.
- ExportTab also integrates with Next.js API routes for backend communication.
- ResumeSourceSelector supports input modes for existing resumes and uploads.

```mermaid
graph TB
Export["ExportTab.tsx"] --> Tailor["TailoringForm.tsx"]
Export --> Config["ConfigurationForm.tsx"]
Export --> Preview["ResumePreview.tsx"]
Export --> LtxOut["LatexOutput.tsx"]
Export --> Service["resume-gen.service.ts"]
LtxOut --> Generator["latexGenerator.ts"]
Generator --> Escape["latexEscape.ts"]
Export --> API["tailored-resume/route.ts"]
API --> Pipeline["graph.py"]
```

## Performance considerations
- Timeout handling: Backend requests use extended timeouts suitable for long-running LLM operations.
- Error resilience: Non-JSON responses and HTML error pages are handled gracefully with user-friendly messages.
- Large payloads: Ensure resume text length is sufficient before tailoring to avoid unnecessary processing.
- UI responsiveness: Loading overlays and disabled states prevent concurrent operations and improve UX.

## Troubleshooting guide
Common issues and resolutions:
- Authentication failures: Verify session validity; ensure proper sign-in.
- Missing job role: Tailoring requires a non-empty job role; provide it before enabling tailoring.
- Access denied to resume: Confirm ownership or administrative privileges for selected resume.
- Backend connectivity: Timeouts or service unavailability trigger fallback behavior; retry later or use LaTeX output.
- PDF download failures: When PDF service is unavailable, the system returns LaTeX code for manual compilation.

## Conclusion
The PDF resume generation system combines intuitive UI components with reliable backend processing to deliver customizable, ATS-friendly resumes. Users can tailor resumes to specific jobs, preview the results, generate LaTeX code, and download PDFs. The modular design ensures maintainability, while the backend pipeline uses LLMs and tools to produce high-quality, structured resume data ready for LaTeX compilation.
