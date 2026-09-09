# Extraction system

## Introduction
This page describes the extraction system that identifies and parses assignment questions from NPTEL and SWAYAM pages. It explains the HTML parsing algorithms, question type detection strategies, DOM traversal approaches, and the end-to-end pipeline from raw HTML to structured question data. It also covers dynamic content handling, iframe scenarios, platform-specific variations, error handling, performance optimizations, and integration with the Gemini AI system.

## Project structure
The extraction system spans three layers:
- Content script: runs on the assignment page to extract HTML and images, and to apply answers.
- Background service worker: orchestrates message routing, injection of the content script, and calls to the Gemini API.
- Services: Gemini integration for parsing and validating AI responses, and schemas for structured output.

```mermaid
graph TB
subgraph "UI"
SP["Side Panel<br/>sidepanel.html"]
end
subgraph "Extension"
BG["Background Worker<br/>background/index.js"]
RT["Message Router<br/>background/router.js"]
EH["Extraction Handler<br/>background/handlers/extraction.js"]
GH["Gemini Handler<br/>background/handlers/gemini.js"]
GS["Gemini Service<br/>services/gemini/index.js"]
end
subgraph "Page Context"
CS["Content Script<br/>content/index.js"]
EX["Extractor<br/>content/extractor.js"]
AP["Applicator<br/>content/applicator.js"]
end
SP --> BG
BG --> RT
RT --> EH
EH --> CS
CS --> EX
BG --> GH
GH --> GS
CS --> AP
BG --> GS
```

## Core components
- Extractor: Finds assignment containers, extracts HTML, collects images, and gathers UI identifiers for submission.
- Content Script: Exposes message handlers for extraction, answer application, and scrolling.
- Background Router: Routes messages to appropriate handlers and ensures async response semantics.
- Extraction Handler: Manages content script injection, readiness checks, and HTML retrieval.
- Gemini Service: Builds prompts, sends requests, validates responses, and parses JSON.
- Applicator: Applies answers back to the page and submits the assignment.

## Architecture overview
The system follows a message-driven architecture:
- The UI triggers extraction or solving.
- The background worker injects or verifies the content script.
- The content script extracts HTML and images and returns structured data.
- The background worker forwards requests to Gemini via a dedicated handler.
- Gemini returns structured JSON validated against predefined schemas.
- The content script applies answers and submits the assignment.

```mermaid
sequenceDiagram
participant UI as "Side Panel"
participant BG as "Background Worker"
participant RT as "Message Router"
participant EH as "Extraction Handler"
participant CS as "Content Script"
participant EX as "Extractor"
participant GH as "Gemini Handler"
participant GS as "Gemini Service"
UI->>BG : "EXTRACT_HTML"
BG->>RT : Route message
RT->>EH : Dispatch
EH->>CS : "PING" (verify loaded)
alt Not loaded
EH->>CS : Inject content script
end
EH->>CS : "GET_PAGE_HTML"
CS->>EX : extractPageHTML()
EX-->>CS : {html, images, ids}
CS-->>EH : Page data
EH-->>BG : Page data
BG-->>UI : Page data
UI->>BG : "GEMINI_REQUEST"
BG->>GH : Forward request
GH->>GS : directAPICall()
GS-->>GH : Gemini response
GH-->>BG : Gemini response
BG-->>UI : Gemini response
```

## Detailed component analysis

### HTML extraction pipeline
The extractor locates the assignment container, falls back to the main content area if needed, and collects images. It also discovers submit and confirmation button identifiers.

```mermaid
flowchart TD
Start(["extractPageHTML"]) --> Selectors["Try platform selectors"]
Selectors --> Found{"Container found?"}
Found --> |Yes| UseContainer["Use container.outerHTML"]
Found --> |No| Fallback["Fallback to main/content/body"]
UseContainer --> Images["extractImages(container)"]
Fallback --> Images
Images --> Buttons["Find submit and confirm button IDs"]
Buttons --> Return(["Return {html, images, ids}"])
```

Key behaviors:
- Platform selectors target known NPTEL/SWAYAM classes and forms.
- Fallback ensures extraction even if selectors miss.
- Image extraction filters small or unloaded images, converts via canvas, and attaches context metadata.

### Question type detection and DOM traversal
The extractor does not infer question types itself. Instead, it relies on the Gemini service to classify questions and return a structured schema. The content script's applicator supports:
- Single choice: radio inputs identified by ID/value/name heuristics.
- Multiple choice: checkboxes matched by question ID and option IDs.
- Fill-in-the-blank: text inputs/textarea matched by IDs and question context.

```mermaid
flowchart TD
QType["Question Type from Gemini"] --> SC{"single_choice?"}
SC --> |Yes| Radio["applySingleChoice()"]
SC --> |No| MC{"multi_choice?"}
MC --> |Yes| Checkbox["applyMultiChoice()"]
MC --> |No| FB{"fill_blank?"}
FB --> |Yes| Text["applyFillBlank()"]
FB --> |No| Unknown["Log unknown type"]
```

### Gemini integration and structured output
The Gemini service composes prompts and content parts (HTML, images, screenshots), enforces response schemas, and parses responses reliably.

```mermaid
sequenceDiagram
participant BG as "Background Worker"
participant GH as "Gemini Handler"
participant GS as "Gemini Service"
participant API as "Gemini API"
BG->>GH : "GEMINI_REQUEST"
GH->>GS : directAPICall(payload, model)
GS->>API : POST generateContent
API-->>GS : Response
GS->>GS : parseGeminiResponse()
GS-->>GH : Parsed JSON
GH-->>BG : Parsed JSON
```

Supported question types returned by Gemini:
- single_choice
- multi_choice
- fill_blank

### Dynamic content and iframe scenarios
- Dynamic rendering: The extraction handler pings the content script and injects it if absent, ensuring readiness before extraction.
- Iframes: The extractor operates within the page context and cannot access cross-origin iframes. Screenshots can be used to supplement visual context for questions rendered in iframes.
- Cross-browser: The system uses a browser API polyfill and adjusts timing for Firefox initialization.

### Supported question formats
- Single choice: Radio button groups with unique option IDs.
- Multiple choice: Checkbox groups with multiple correct answers.
- Fill-in-the-blank: Text inputs or textareas with associated input IDs.

These formats are applied by the applicator using reliable DOM matching strategies.

## Dependency analysis
The system exhibits clear separation of concerns:
- Background worker depends on platform adapters and message routing.
- Content script depends on extractor and applicator.
- Gemini service depends on schemas and parser.

```mermaid
graph LR
BG["background/index.js"] --> RT["background/router.js"]
BG --> EH["background/handlers/extraction.js"]
BG --> GH["background/handlers/gemini.js"]
BG --> GS["services/gemini/index.js"]
CS["content/index.js"] --> EX["content/extractor.js"]
CS --> AP["content/applicator.js"]
GS --> SCH["services/gemini/schema.js"]
GS --> PAR["services/gemini/parser.js"]
BG --> MSG["core/messages.js"]
BG --> BR["platform/browser.js"]
```

## Performance considerations
- Selector prioritization: The extractor tries the most specific selectors first to minimize DOM traversal.
- Image filtering: Skips tiny or unloaded images to reduce payload size and avoid CORS errors.
- Canvas conversion: Converts only visible, loaded images to base64; large images are skipped to stay under API limits.
- Retry logic: Message retries with exponential backoff improve reliability on Firefox.
- Thinking budgets: Configurable reasoning budgets balance accuracy and cost.

Recommendations:
- Limit images per request to under 4 MB base64-equivalent.
- Prefer targeted selectors to avoid scanning large subtrees.
- Use screenshots sparingly; include only when HTML lacks sufficient context.

## Troubleshooting guide
Common issues and mitigations:
- Content script not loaded: The extraction handler injects and verifies readiness; reload the page if still failing.
- No assignment container found: The extractor falls back to main/content/body; verify the page URL includes NPTEL/SWAYAM and assessment-related terms.
- Missing submit/confirmation buttons: The extractor searches by ID, type, and click handlers; ensure the page is fully interactive.
- CORS on images: Images that fail canvas conversion are skipped; use screenshots to capture visuals.
- Gemini blocked or empty response: Parser throws explicit errors; check API key and quotas.
- Firefox message channel timeouts: The Gemini service makes direct API calls from the background to avoid long delays.

## Conclusion
The extraction system provides a reliable, cross-browser solution for identifying and parsing NPTEL/SWAYAM assignment questions. By combining targeted DOM traversal, resilient image extraction, and structured AI-driven parsing with strict schemas, it supports single-choice, multiple-choice, and fill-in-the-blank formats. The design emphasizes reliability, performance, and maintainability through modular components and clear message boundaries.

## Appendices

### Supported question types and fields
- question_id: Unique identifier for the question.
- question_type: single_choice | multi_choice | fill_blank.
- question: Question text.
- choices: Array of {option_id, text}.
- inputs: Array of {input_id, input_type}.
- answer: Object with answer_text, answer_option_ids, confidence, reasoning (when solving).

### UI integration notes
- Side panel provides controls for extraction, solving, and settings.
- Auto-submit toggle enables automatic answer application and submission.
