# Usage guide

## Introduction
This guide explains how to use the Assignment Solver browser extension for MOOC platforms like NPTEL and SWAYAM. It covers both Manual Mode (recommended for learning) and Auto Mode (full automation), including step-by-step workflows, supported question types, configuration options, and best practices.

## Project structure
The extension consists of:
- A side panel UI (React-like structure in HTML/CSS/JS) for user controls
- A background service worker orchestrating tasks and messaging
- A content script interacting with the assignment page
- Services for Gemini AI integration and local storage
- Platform adapters for cross-browser compatibility

```mermaid
graph TB
UI["UI (sidepanel.html)<br/>Controllers, Elements, State"] --> BG["Background Worker<br/>(service worker)"]
BG --> CS["Content Script<br/>(DOM interaction)"]
BG --> Gemini["Gemini Service<br/>(AI requests)"]
CS --> Page["Assignment Page DOM"]
UI --> Settings["Settings Modal<br/>(API key, model prefs)"]
UI --> Progress["Progress Steps<br/>(Extract → Analyze → Fill → Submit)"]
```

## Core components
- UI entry and initialization: Sets up logging, adapters, services, state, and controllers; waits for background readiness; initializes event listeners and assignment detection.
- Controllers:
  - Solve controller: Orchestrates extraction, AI solving, answer filling, and optional submission.
  - Settings controller: Manages API key and model preferences.
  - Detection controller: Determines if the current page is an assignment and updates UI accordingly.
- Background worker: Routes messages to appropriate handlers, manages panel behavior, and coordinates with content script.
- Content script: Extracts page HTML/images, applies answers, and submits forms.
- Gemini service: Builds prompts, attaches images/screenshots, and calls the Gemini API.
- Platform adapters: Unified browser API access for Chrome/Firefox.

## Architecture overview
End-to-end flow from UI to page automation:

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "UI Controller"
participant BG as "Background Worker"
participant CS as "Content Script"
participant Gemini as "Gemini Service"
participant Page as "Assignment Page"
User->>UI : Click "Solve Assignment"
UI->>BG : Request EXTRACT_HTML
BG->>CS : GET_PAGE_HTML
CS-->>BG : Page HTML + Images + IDs
BG-->>UI : Page data
UI->>BG : CAPTURE_FULL_PAGE (screenshots)
BG-->>UI : Screenshots (optional)
UI->>Gemini : EXTRACT (HTML + Images + Screenshots)
Gemini-->>UI : Structured questions + IDs
UI->>Gemini : SOLVE (with reasoning)
Gemini-->>UI : Correct answers + confidence
loop For each question
UI->>BG : APPLY_ANSWERS (one by one)
BG->>CS : APPLY_ANSWERS
CS->>Page : Click/Type answers
end
alt Auto-submit enabled
UI->>BG : SUBMIT_ASSIGNMENT
BG->>CS : SUBMIT_ASSIGNMENT
CS->>Page : Click submit
else Manual submission
UI->>User : Show results, prompt manual submit
end
```

## Detailed component analysis

### Manual mode (recommended for learning)
Manual Mode lets you review each question, get hints, choose answers, and apply them one by one.

Basic steps:
1. Navigate to an assignment page on a supported MOOC platform.
2. Open the extension side panel.
3. Click Extract Questions to scan the page.
4. Click on a question to view details.
5. Click Get Study Hints to receive:
   - Key concepts being tested
   - Elimination tips for wrong answers
   - Common traps to avoid
   - What to verify before answering
6. Select your answer in the side panel.
7. Click Apply Answer to Page to fill it on the actual page.
8. Click Back to List and repeat for other questions.
9. When done, click Submit Assignment Only.

Supported question types:
- Single Choice: Radio button questions
- Multi Choice: Checkbox questions
- Fill-in-the-Blank: Text/number input fields

```mermaid
flowchart TD
Start(["Open Assignment Page"]) --> OpenPanel["Open Extension Panel"]
OpenPanel --> Extract["Click Extract Questions"]
Extract --> ViewDetails["Click a Question"]
ViewDetails --> GetHints["Click Get Study Hints"]
GetHints --> ChooseAnswer["Select Answer in Side Panel"]
ChooseAnswer --> ApplyOne["Click Apply Answer to Page"]
ApplyOne --> NextQ{"More Questions?"}
NextQ --> |Yes| ViewDetails
NextQ --> |No| SubmitOnly["Click Submit Assignment Only"]
SubmitOnly --> End(["Review Results"])
```

### Auto mode (full automation)
Auto Mode automatically solves all questions, fills answers, and submits (optional).

Basic steps:
1. Navigate to an assignment page.
2. Open the extension side panel.
3. Click Extract Questions to scan the page.
4. Click Solve All + Submit.
5. Confirm the action when prompted.
6. Wait for the process to complete:
   - AI analyzes each question
   - Answers are filled on the page
   - Submit button is clicked automatically
7. Review the summary and check the page.

```mermaid
flowchart TD
Start(["Open Assignment Page"]) --> OpenPanel["Open Extension Panel"]
OpenPanel --> Extract["Click Extract Questions"]
Extract --> SolveAll["Click Solve All + Submit"]
SolveAll --> Confirm["Confirm Action"]
Confirm --> Process["Processing: Extract → Analyze → Fill → Submit"]
Process --> Results["Show Results Summary"]
Results --> End(["Done"])
```

### Supported question types and application
- Single Choice: The content script clicks the correct radio button.
- Multi Choice: The content script checks all correct checkboxes and unchecks wrong ones.
- Fill-in-the-Blank: The content script types the answer and triggers input/change events.

```mermaid
classDiagram
class Applicator {
+applyAnswers(answers)
+applySingleChoice(answer)
+applyMultiChoice(answer)
+applyFillBlank(answer)
+submitAssignment(submitButtonId, confirmButtonIds)
}
class Extractor {
+extractPageHTML()
+extractImages(container)
+getPageInfo()
}
Applicator <.. Extractor : "works with DOM"
```

### Configuration options
- API Key Management:
  - Store your Gemini API key in the Settings modal.
  - The key is persisted locally and never sent to third-party servers.
- Model Selection:
  - Choose extraction and solving models from the Settings modal.
  - Adjust reasoning levels for extraction and solving.
- Auto-Submit:
  - Toggle Auto-submit answers in the main panel.

```mermaid
flowchart LR
Settings["Settings Modal"] --> API["Save API Key"]
Settings --> Models["Select Models"]
Settings --> Reasoning["Set Reasoning Levels"]
UI["Main Panel"] --> AutoSubmit["Toggle Auto-Submit"]
```

### Best practices for optimal results
- Use Manual Mode for learning: Review AI hints and reasoning to understand concepts.
- Keep the assignment page fully loaded before extracting.
- Prefer stable models for extraction and higher-performance models for solving.
- If rate limits occur, reduce concurrent operations or upgrade your API quota.
- For platforms with custom UI components, apply answers one by one to isolate issues.

## Dependency analysis
- UI depends on:
  - State manager for processing flags and extraction data
  - Settings controller for API key and model preferences
  - Progress controller for step tracking
  - Detection controller for assignment presence
- Background worker depends on:
  - Message routing to handlers
  - Panel adapter for opening the side panel
  - Gemini service for AI requests
  - Content script handlers for DOM operations
- Content script depends on:
  - Extractor for page HTML and images
  - Applicator for applying answers and submitting

```mermaid
graph TB
UI["UI Index"] --> State["State Manager"]
UI --> SettingsCtrl["Settings Controller"]
UI --> ProgressCtrl["Progress Controller"]
UI --> DetectionCtrl["Detection Controller"]
UI --> SolveCtrl["Solve Controller"]
SolveCtrl --> Gemini["Gemini Service"]
SolveCtrl --> Runtime["Runtime Adapter"]
SolveCtrl --> Storage["Storage Service"]
BG["Background Worker"] --> Handlers["Handlers"]
BG --> Panel["Panel Adapter"]
BG --> Gemini
CS["Content Script"] --> Extractor["Extractor"]
CS --> Applicator["Applicator"]
```

## Performance considerations
- Rate limiting:
  - 500 ms delay between answer API calls
  - 200 ms delay between DOM operations
- Recursive splitting:
  - Extraction and solving are retried with smaller chunks when exceeding token limits.
- Image and screenshot handling:
  - Large images are skipped to avoid API size limits.
- Model selection:
  - Choose models aligned with your needs and quotas.

## Troubleshooting guide
Common issues and resolutions:
- Could not get page HTML:
  - Ensure you are on an actual assignment page and it is fully loaded.
  - Refresh the page and re-extract.
- Question container not found:
  - Re-extract questions; check console for detailed error info.
- API Key invalid:
  - Verify your key at Google AI Studio and ensure it has Gemini API access enabled.
- Answers not being applied:
  - Some platforms use custom input components; check browser console for errors.
  - Apply answers one at a time to identify problematic questions.
- Rate limit errors:
  - Wait a few minutes before retrying.
  - Consider upgrading your API quota or reducing the number of questions per session.

## Conclusion
The Assignment Solver extension automates MOOC assignment completion while offering Manual Mode for deeper learning. By configuring your API key and models, you can tailor the extension to your workflow, either reviewing AI hints and answers step-by-step or fully automating extraction, solving, and submission.

## Appendices

### Installation and setup
- Install the extension from the Chrome Web Store or load it manually from GitHub releases.
- After installation, open the side panel, go to Settings, enter your Gemini API key, and save.

### UI controls reference
- Main panel:
  - Solve Assignment: Start the full automation pipeline.
  - Auto-submit answers: Toggle automatic submission.
- Settings modal:
  - Gemini API Key: Enter your API key.
  - Extraction Model and Solving Model: Choose models and reasoning levels.
- Progress steps:
  - Extract → Analyze → Fill → Submit
