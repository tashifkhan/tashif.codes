# ATS evaluation components

## Introduction
This page provides detailed technical documentation for the ATS evaluation components in the TalentSync project. It covers five key frontend components used to evaluate resumes against job descriptions: EvaluationResults for displaying ATS scores and recommendations, JobDescriptionForm for job description input and processing, LoadingOverlay for async operation feedback, PageLoader for page-level loading states, and ResumeSelection for resume file upload and selection. The guide explains component props, state management, data flow from resume analysis to ATS scoring, and integration with backend APIs. It also includes usage examples, error handling patterns, and styling approaches.

## Project structure
The ATS evaluation feature spans frontend components and backend services:
- Frontend components are located under frontend/components/ats and are orchestrated by the ATS evaluation page.
- Backend routes and services are under backend/app/routes and backend/app/services, with models defined in backend/app/models/ats_evaluator.
- The frontend communicates with the backend via a dedicated ATS service wrapper.

```mermaid
graph TB
subgraph "Frontend"
Page["ATS Evaluation Page<br/>page.tsx"]
Results["EvaluationResults<br/>EvaluationResults.tsx"]
JDForm["JobDescriptionForm<br/>JobDescriptionForm.tsx"]
Overlay["LoadingOverlay<br/>LoadingOverlay.tsx"]
PGLoader["PageLoader<br/>PageLoader.tsx"]
ResumeSel["ResumeSelection<br/>ResumeSelection.tsx"]
Service["ATS Service<br/>ats.service.ts"]
Types["Types<br/>resume.ts"]
end
subgraph "Backend"
Routes["ATS Routes<br/>routes/ats.py"]
Services["ATS Service<br/>services/ats.py"]
Models["ATS Models<br/>models/ats_evaluator/schemas.py"]
end
Page --> Results
Page --> JDForm
Page --> Overlay
Page --> PGLoader
Page --> ResumeSel
Page --> Service
Service --> Routes
Routes --> Services
Services --> Models
Results --> Types
```

## Core components
This section summarizes the primary components and their responsibilities:
- EvaluationResults: Renders ATS match score, reasons for the score, improvement suggestions, and optional optimization action.
- JobDescriptionForm: Provides three input modes for job descriptions (URL, text, file) with validation and preview.
- LoadingOverlay: Displays a modal overlay during evaluation requests.
- PageLoader: Shows page-level loading indicator on initial render.
- ResumeSelection: Manages resume selection from existing uploads or new file upload with preview and dropdown.

Key props and behaviors:
- Props are passed down from the parent page to each component, enabling centralized state management and controlled updates.
- State transitions are handled locally within components where appropriate, and coordinated via the parent page for cross-component actions.

## Architecture overview
The ATS evaluation workflow integrates frontend components with backend services:
- The frontend page orchestrates user input collection, validates selections, and triggers evaluation.
- The ATS service sends multipart/form-data to the backend, including resume and job description sources.
- Backend routes parse the form, process documents, and delegate evaluation to the ATS service.
- The service normalizes evaluator output into a standardized response model and returns it to the frontend.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "ATS Page<br/>page.tsx"
participant Service as "ATS Service<br/>ats.service.ts"
participant Routes as "ATS Routes<br/>routes/ats.py"
participant Svc as "ATS Service Impl<br/>services/ats.py"
participant Models as "Models<br/>schemas.py"
User->>Page : "Select resume and JD"
Page->>Service : "evaluateResume(formData)"
Service->>Routes : "POST /ats/evaluate"
Routes->>Svc : "process resume/jd and call evaluator"
Svc->>Svc : "normalize output to JDEvaluatorResponse"
Svc-->>Routes : "JDEvaluatorResponse"
Routes-->>Service : "JSON response"
Service-->>Page : "ATSEvaluationResponse"
Page->>Page : "set evaluationResult state"
Page-->>User : "render EvaluationResults"
```

## Detailed component analysis

### EvaluationResults component
Purpose:
- Displays ATS match score, contextual reasons, improvement suggestions, and an optional optimization call-to-action.

Props:
- evaluationResult: Object containing score, reasons_for_the_score, and suggestions; can be null.
- onOptimize: Callback invoked when the user clicks the optimization button.
- canOptimize: Boolean flag controlling whether the optimization CTA is shown.

State and rendering:
- Renders a neutral state when no evaluationResult is present.
- On evaluation completion, renders a score display with animated progress bar and color-coded labels.
- Lists reasons and suggestions with staggered animations.
- Conditionally renders the optimization button based on canOptimize and onOptimize presence.

Styling and UX:
- Uses gradient backgrounds, backdrop blur, and subtle borders for depth.
- Animations use Framer Motion for smooth transitions and entrance effects.

Usage example:
- Rendered by the parent page after receiving evaluation results from the service.

### JobDescriptionForm component
Purpose:
- Accepts job description via URL, raw text, or file upload with validation and preview.

Props:
- formData: Object holding jd_text, jd_link, company_name, company_website.
- handleInputChange: Function to update formData fields.
- jdFile: Current selected file for JD.
- setJdFile: Function to set the selected JD file.

Modes and validation:
- Three modes: URL, text, file. Only one mode is active at a time.
- Clears conflicting fields when switching modes to avoid ambiguous submissions.
- Supports drag-and-drop for file uploads with visual feedback.

Rendering:
- Company name and website fields are optional.
- Animated transitions between modes using AnimatePresence and motion wrappers.
- File mode displays a preview of the selected file and supported extensions.

Usage example:
- Integrated into the parent page's input form and validated before submission.

### LoadingOverlay component
Purpose:
- Provides a modal overlay indicating ongoing evaluation.

Props:
- isEvaluating: Boolean flag controlling visibility.

Behavior:
- Renders only when isEvaluating is true.
- Uses motion transitions for fade-in/fade-out and scaling effects.
- Includes a pulsing loader and descriptive text.

Usage example:
- Controlled by the parent page's mutation state and displayed during evaluation requests.

### PageLoader component
Purpose:
- Shows a page-level loading indicator on initial render.

Props:
- isPageLoading: Boolean flag controlling visibility.

Behavior:
- Renders only when isPageLoading is true.
- Centers a loader with optional text and exits with animation when disabled.

Usage example:
- Used by the parent page to mask initial load until ready.

### ResumeSelection component
Purpose:
- Allows users to choose a resume from existing uploads or upload a new file.

Props:
- resumeSelectionMode: "existing" or "upload".
- setResumeSelectionMode: Switches between modes.
- userResumes: Array of UserResume objects for selection.
- selectedResumeId: Currently selected resume ID.
- setSelectedResumeId: Updates the selected resume.
- isLoadingResumes: Indicates loading state of resume list.
- showResumeDropdown: Controls dropdown visibility.
- setShowResumeDropdown: Toggles dropdown.
- resumeFile: Currently selected file for upload.
- setResumeFile: Sets the selected file.
- resumeText: Preview text for the selected file.

Behavior:
- Mode toggle switches between existing and upload modes.
- Existing mode shows a dropdown with resume cards, including metadata and upload date.
- Upload mode supports file selection with preview and extension hints.
- For text/markdown files, reads file content to provide a short preview.

Usage example:
- Integrated into the parent page's input form and validated alongside job description inputs.

## Architecture overview

### Data flow from input to results
The end-to-end flow from user input to evaluation results:

```mermaid
flowchart TD
Start(["User opens ATS page"]) --> LoadPage["PageLoader renders"]
LoadPage --> Inputs["Collect Inputs:<br/>Resume + Job Description"]
Inputs --> Validate{"Validation Passes?"}
Validate --> |No| ToastErr["Show error toast"]
Validate --> |Yes| BuildFormData["Build FormData<br/>with resume and JD sources"]
BuildFormData --> Submit["Call ATS Service.evaluateResume"]
Submit --> Backend["Backend Routes & Service"]
Backend --> Normalize["Normalize evaluator output"]
Normalize --> Response["Return JDEvaluatorResponse"]
Response --> UpdateState["Set evaluationResult state"]
UpdateState --> RenderResults["Render EvaluationResults"]
RenderResults --> Optimize{"Can optimize?"}
Optimize --> |Yes| ShowCTA["Show 'Optimize Resume' CTA"]
Optimize --> |No| Done(["Done"])
```

### Backend API contracts
Backend expects either:
- Form fields: resume_text, jd_text, jd_link, company_name, company_website.
- Or multipart/form-data with resume_file and optional jd_file/jd_text/jd_link.

Validation ensures exactly one job description source is provided. Responses conform to JDEvaluatorResponse.

## Dependency analysis
Component and module dependencies:
- Parent page depends on all ATS components and the ATS service.
- ATS service depends on the API client and defines the evaluation response shape.
- Backend routes depend on the ATS service and models; the service depends on the evaluator and normalization logic.

```mermaid
graph TB
Page["page.tsx"] --> Results["EvaluationResults.tsx"]
Page --> JD["JobDescriptionForm.tsx"]
Page --> Overlay["LoadingOverlay.tsx"]
Page --> PGL["PageLoader.tsx"]
Page --> ResumeSel["ResumeSelection.tsx"]
Page --> Service["ats.service.ts"]
Service --> Routes["routes/ats.py"]
Routes --> Svc["services/ats.py"]
Svc --> Models["models/ats_evaluator/schemas.py"]
Results --> Types["types/resume.ts"]
```

## Performance considerations
- Minimize re-renders by consolidating state in the parent page and passing only necessary props to child components.
- Use controlled components for inputs to avoid unnecessary updates.
- Debounce or throttle file previews for large documents to reduce UI jank.
- Prefer lazy-loading heavy animations and only mount overlays when needed.
- Cache processed resume and JD text when possible to avoid repeated parsing.

## Troubleshooting guide
Common issues and resolutions:
- Missing inputs: Validation prevents evaluation without a resume and a valid job description source. Ensure at least one of resumeId or resume file is selected and one of jd_text, jd_link, or jd_file is provided.
- Unsupported file types: Backend rejects JD files with unsupported extensions. Ensure JD files are PDF, DOC, DOCX, TXT, or MD.
- Network errors: The service handles generic failures and returns descriptive messages. Inspect toast notifications and backend logs for details.
- Empty or invalid evaluator output: The backend normalizes evaluator output and defaults missing fields; ensure the evaluator returns a valid JSON structure.

Error handling patterns:
- Frontend: Uses toasts for user-friendly error messages and disables the evaluate button during requests.
- Backend: Validates inputs, raises HTTP exceptions with clear messages, and logs detailed context for debugging.

## Conclusion
The ATS evaluation components provide a cohesive, user-friendly workflow for analyzing resume-job description alignment. The frontend components encapsulate input collection, feedback, and result presentation, while the backend enforces validation, processes documents, and returns standardized results. By following the documented props, state management patterns, and integration points, developers can extend or customize the feature with confidence.
