# Extension Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://assignment-solver/README.md)
- [package.json](file://assignment-solver/package.json)
- [manifest.json](file://assignment-solver/manifest.json)
- [index.js](file://assignment-solver/src/content/index.js)
- [index.js](file://assignment-solver/src/background/index.js)
- [sidepanel.html](file://assignment-solver/public/sidepanel.html)
- [index.js](file://assignment-solver/src/services/gemini/index.js)
- [extractor.js](file://assignment-solver/src/content/extractor.js)
- [applicator.js](file://assignment-solver/src/content/applicator.js)
- [detection.js](file://assignment-solver/src/ui/controllers/detection.js)
- [solve.js](file://assignment-solver/src/ui/controllers/solve.js)
- [messages.js](file://assignment-solver/src/core/messages.js)
- [router.js](file://assignment-solver/src/background/router.js)
- [browser.js](file://assignment-solver/src/platform/browser.js)
- [runtime.js](file://assignment-solver/src/platform/runtime.js)
- [tabs.js](file://assignment-solver/src/platform/tabs.js)
- [index.js](file://assignment-solver/src/services/storage/index.js)
- [state.js](file://assignment-solver/src/ui/state.js)
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
The Assignment Solver is a browser extension designed to assist with online assignments on MOOC platforms such as NPTEL and Coursera. It integrates with Google’s Gemini AI to extract, analyze, and solve assessment questions. The extension supports dual modes—Study Hints and Auto-Solve—and handles multiple question types (single-choice, multi-choice, fill-in-the-blank, and image-based). It emphasizes privacy by keeping processing client-side and allowing users to bring their own API key (BYOK). Additional capabilities include full-page screenshot capture, export functionality, and cross-browser compatibility for Chrome and Firefox.

## Project Structure
The extension follows a modular architecture organized by responsibility:
- src/background: Service worker and message routing
- src/content: Content script for DOM extraction and answer application
- src/ui: Side panel UI and controllers
- src/services: Business logic (Gemini integration, storage)
- src/platform: Cross-browser adapters and runtime utilities
- src/core: Shared types, messages, and logging
- public: Static assets (side panel HTML/CSS/icons)

```mermaid
graph TB
subgraph "Browser Extension"
BG["Background (service worker)"]
CS["Content Script"]
SP["Side Panel UI"]
end
subgraph "Platform Adapters"
RT["Runtime Adapter"]
TB["Tabs Adapter"]
BR["Browser Adapter"]
end
subgraph "Services"
GS["Gemini Service"]
ST["Storage Service"]
end
SP --> RT
SP --> ST
SP --> GS
BG --> RT
BG --> TB
BG --> BR
BG --> GS
CS --> RT
CS --> GS
```

**Diagram sources**
- [index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [index.js](file://assignment-solver/src/content/index.js#L1-L99)
- [sidepanel.html](file://assignment-solver/public/sidepanel.html#L1-L392)
- [runtime.js](file://assignment-solver/src/platform/runtime.js#L1-L32)
- [tabs.js](file://assignment-solver/src/platform/tabs.js#L1-L53)
- [browser.js](file://assignment-solver/src/platform/browser.js#L1-L86)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)
- [index.js](file://assignment-solver/src/services/storage/index.js#L1-L119)

**Section sources**
- [README.md](file://assignment-solver/README.md#L142-L160)
- [package.json](file://assignment-solver/package.json#L1-L30)
- [manifest.json](file://assignment-solver/manifest.json#L1-L44)

## Core Components
- Dual-mode operation:
  - Study Hints: Retrieve explanations and reasoning without revealing direct answers.
  - Auto-Solve: Automatically extract, analyze, fill, and submit assignments.
- Supported question types:
  - Single-choice (radio)
  - Multi-choice (checkbox)
  - Fill-in-the-blank (text/number input)
  - Image-based (full-page screenshots and embedded images are included in prompts)
- Privacy-first client-side processing:
  - API key stored locally and never sent to third-party servers.
  - All AI requests are made directly to Google’s Gemini endpoints.
- BYOK and export:
  - Users configure their own Gemini API key in the side panel.
  - Export options include full extraction and answer-only exports.
- Cross-browser compatibility:
  - Unified browser API via webextension-polyfill.
  - Separate manifests for Chrome (side panel) and Firefox (sidebar action).

**Section sources**
- [README.md](file://assignment-solver/README.md#L5-L14)
- [README.md](file://assignment-solver/README.md#L134-L141)
- [README.md](file://assignment-solver/README.md#L240-L257)
- [README.md](file://assignment-solver/README.md#L291-L311)
- [sidepanel.html](file://assignment-solver/public/sidepanel.html#L192-L380)
- [index.js](file://assignment-solver/src/services/storage/index.js#L87-L116)

## Architecture Overview
The extension communicates through a well-defined message bus between the side panel, background service worker, and content script. The background worker coordinates tasks, captures screenshots, and orchestrates Gemini API calls. The content script interacts with the assignment page to extract HTML and apply answers. The side panel provides user controls and displays progress/results.

```mermaid
sequenceDiagram
participant User as "User"
participant SidePanel as "Side Panel UI"
participant BG as "Background Worker"
participant CS as "Content Script"
participant Gemini as "Gemini API"
User->>SidePanel : "Click Solve Assignment"
SidePanel->>BG : "EXTRACT_HTML"
BG->>CS : "GET_PAGE_HTML"
CS-->>BG : "Page HTML + Images"
SidePanel->>BG : "CAPTURE_FULL_PAGE"
BG-->>SidePanel : "Screenshots"
SidePanel->>BG : "GEMINI_REQUEST (Extract)"
BG->>Gemini : "Generate Content (Extraction)"
Gemini-->>BG : "Structured Questions"
SidePanel->>BG : "GEMINI_REQUEST (Solve)"
BG->>Gemini : "Generate Content (Solve)"
Gemini-->>BG : "Answers with Confidence"
SidePanel->>BG : "APPLY_ANSWERS"
BG->>CS : "APPLY_ANSWERS"
CS-->>BG : "Success"
SidePanel->>BG : "SUBMIT_ASSIGNMENT (optional)"
BG->>CS : "SUBMIT_ASSIGNMENT"
CS-->>BG : "Success"
SidePanel-->>User : "Results and Summary"
```

**Diagram sources**
- [messages.js](file://assignment-solver/src/core/messages.js#L5-L23)
- [index.js](file://assignment-solver/src/background/index.js#L44-L113)
- [index.js](file://assignment-solver/src/content/index.js#L20-L96)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L145-L217)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L228-L297)

**Section sources**
- [README.md](file://assignment-solver/README.md#L162-L202)

## Detailed Component Analysis

### Side Panel UI and Controllers
The side panel provides a guided workflow:
- Assignment detection and display of title/count
- Solve button with auto-submit toggle
- Progress steps (Extract → Analyze → Fill → Submit)
- Results display with AI reasoning and confidence
- Settings modal for API key and model selection

```mermaid
flowchart TD
Start(["Open Side Panel"]) --> Detect["Detect Assignment on Page"]
Detect --> IsDetected{"Assignment Found?"}
IsDetected --> |Yes| ShowInfo["Show Title + Question Count"]
IsDetected --> |No| ShowEmpty["Show Empty State"]
ShowInfo --> Ready["Ready to Solve"]
ShowEmpty --> Ready
Ready --> ClickSolve["Click Solve Assignment"]
ClickSolve --> Extract["Extract HTML + Images"]
Extract --> Screenshots["Capture Full-Page Screenshots"]
Screenshots --> GeminiExtract["Call Gemini Extract"]
GeminiExtract --> GeminiSolve["Call Gemini Solve"]
GeminiSolve --> Apply["Apply Answers to Page"]
Apply --> AutoSubmit{"Auto-Submit Enabled?"}
AutoSubmit --> |Yes| Submit["Submit Assignment"]
AutoSubmit --> |No| ManualSubmit["Review and Submit Manually"]
Submit --> Results["Show Results"]
ManualSubmit --> Results
Results --> End(["Done"])
```

**Diagram sources**
- [detection.js](file://assignment-solver/src/ui/controllers/detection.js#L22-L108)
- [solve.js](file://assignment-solver/src/ui/controllers/solve.js#L44-L240)
- [sidepanel.html](file://assignment-solver/public/sidepanel.html#L45-L175)

**Section sources**
- [sidepanel.html](file://assignment-solver/public/sidepanel.html#L45-L175)
- [detection.js](file://assignment-solver/src/ui/controllers/detection.js#L22-L108)
- [solve.js](file://assignment-solver/src/ui/controllers/solve.js#L44-L240)

### Background Service Worker
The background worker initializes platform adapters, registers message handlers, and manages extension lifecycle:
- Health checks, page info retrieval, screenshot capture
- Routing messages to appropriate handlers
- Opening/closing the side panel and responding to icon clicks

```mermaid
classDiagram
class BackgroundWorker {
+initializeAdapters()
+registerHandlers()
+openPanel()
+handleMessage()
}
class MessageRouter {
+onMessage(handler)
}
class GeminiService {
+extract()
+solve()
+directAPICall()
}
class ScreenshotService {
+capture()
}
BackgroundWorker --> MessageRouter : "routes"
BackgroundWorker --> GeminiService : "uses"
BackgroundWorker --> ScreenshotService : "uses"
```

**Diagram sources**
- [index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [router.js](file://assignment-solver/src/background/router.js#L1-L59)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)

**Section sources**
- [index.js](file://assignment-solver/src/background/index.js#L21-L135)
- [router.js](file://assignment-solver/src/background/router.js#L14-L58)

### Content Script
The content script runs on assignment pages and handles DOM interactions:
- Extracts page HTML and images
- Captures scroll info and scrolls to positions for screenshots
- Applies answers (radio, checkbox, text input)
- Submits assignments and relays debug info

```mermaid
flowchart TD
Init["Content Script Loaded"] --> Listen["Listen for Messages"]
Listen --> OnExtract["GET_PAGE_HTML"]
OnExtract --> ReturnHTML["Return HTML + Images + IDs"]
Listen --> OnApply["APPLY_ANSWERS"]
OnApply --> ApplyLogic["Apply Single/Multi/Fill"]
Listen --> OnSubmit["SUBMIT_ASSIGNMENT"]
OnSubmit --> ClickSubmit["Click Submit Button"]
Listen --> OnDebug["GEMINI_DEBUG"]
OnDebug --> ConsoleLog["Console Log Debug Payload"]
```

**Diagram sources**
- [index.js](file://assignment-solver/src/content/index.js#L19-L96)
- [extractor.js](file://assignment-solver/src/content/extractor.js#L21-L96)
- [applicator.js](file://assignment-solver/src/content/applicator.js#L21-L217)

**Section sources**
- [index.js](file://assignment-solver/src/content/index.js#L19-L96)
- [extractor.js](file://assignment-solver/src/content/extractor.js#L12-L238)
- [applicator.js](file://assignment-solver/src/content/applicator.js#L12-L221)

### Gemini Service
The Gemini service constructs prompts and payloads, manages thinking budgets, and performs direct API calls:
- Builds content parts from HTML, images, screenshots, and extracted data
- Configures reasoning levels and thinking budgets per model family
- Calls Gemini with extraction and solving schemas
- Parses responses and surfaces errors

```mermaid
flowchart TD
Start(["Gemini Request"]) --> BuildParts["Build Content Parts<br/>HTML + Images + Screenshots"]
BuildParts --> BuildPayload["Build Payload with System Prompt + Generation Config"]
BuildPayload --> ThinkConfig["Build Thinking Config (if supported)"]
ThinkConfig --> APICall["Direct API Call or Background Proxy"]
APICall --> Parse["Parse Response"]
Parse --> Done(["Return Structured Data"])
```

**Diagram sources**
- [index.js](file://assignment-solver/src/services/gemini/index.js#L66-L132)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L189-L217)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L269-L297)

**Section sources**
- [index.js](file://assignment-solver/src/services/gemini/index.js#L145-L217)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L228-L297)

### Storage and Export
The storage service persists keys, caches extractions, and supports export:
- API key storage in local storage
- Extraction cache with timestamps
- Export formats: full extraction and answer-only export

```mermaid
flowchart TD
SaveKey["Save API Key"] --> LocalStore["Persist in Local Storage"]
CacheExtraction["Save Extraction"] --> CacheStore["Cache with Timestamp"]
ExportFull["Export Full Extraction"] --> JSONFull["Return Full JSON"]
ExportAnswers["Export Answer Only"] --> JSONAnswers["Return QID + Answer Fields"]
```

**Diagram sources**
- [index.js](file://assignment-solver/src/services/storage/index.js#L16-L85)
- [index.js](file://assignment-solver/src/services/storage/index.js#L87-L116)

**Section sources**
- [index.js](file://assignment-solver/src/services/storage/index.js#L16-L85)
- [index.js](file://assignment-solver/src/services/storage/index.js#L87-L116)

## Dependency Analysis
- Cross-browser compatibility is achieved via webextension-polyfill and platform adapters.
- Message routing centralizes background handlers and ensures async responses are handled safely.
- UI state management tracks processing state and current extraction for rendering.

```mermaid
graph LR
SP["Side Panel"] --> MSG["Messages"]
BG["Background"] --> MSG
CS["Content Script"] --> MSG
MSG --> BG
MSG --> CS
BG --> GS["Gemini Service"]
BG --> ST["Storage Service"]
BG --> RT["Runtime Adapter"]
BG --> TB["Tabs Adapter"]
CS --> RT
SP --> ST
SP --> GS
```

**Diagram sources**
- [messages.js](file://assignment-solver/src/core/messages.js#L5-L23)
- [router.js](file://assignment-solver/src/background/router.js#L14-L58)
- [runtime.js](file://assignment-solver/src/platform/runtime.js#L12-L31)
- [tabs.js](file://assignment-solver/src/platform/tabs.js#L12-L52)
- [index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)
- [index.js](file://assignment-solver/src/services/storage/index.js#L1-L119)

**Section sources**
- [browser.js](file://assignment-solver/src/platform/browser.js#L19-L86)
- [messages.js](file://assignment-solver/src/core/messages.js#L47-L95)
- [state.js](file://assignment-solver/src/ui/state.js#L9-L41)

## Performance Considerations
- Rate limiting and delays:
  - 500ms delay between answer API calls
  - 200ms delay between DOM operations
- Recursive splitting:
  - Automatic splitting of HTML and question sets to avoid MAX_TOKENS errors
- Thinking budgets:
  - Configurable reasoning levels mapped to token budgets per model family
- Screenshot capture:
  - Full-page screenshots are captured and sent to Gemini to improve accuracy for image-based questions

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Could not get page HTML: Ensure you are on a valid assignment page and refresh.
- Question container not found: Re-extract questions; check console for details.
- API Key invalid: Verify the key at Google AI Studio and ensure it has Gemini access.
- Answers not being applied: Some platforms use custom components; inspect console and apply answers individually.
- Rate limit errors: Wait before retrying, consider upgrading quota, or reduce concurrent questions.

**Section sources**
- [README.md](file://assignment-solver/README.md#L259-L289)

## Conclusion
The Assignment Solver extension provides a robust, privacy-focused solution for automated assignment assistance on MOOC platforms. Its dual-mode operation, multi-format question support, and client-side processing with BYOK make it suitable for both learning and automation. The modular architecture, cross-browser compatibility, and thoughtful error handling contribute to a reliable user experience.