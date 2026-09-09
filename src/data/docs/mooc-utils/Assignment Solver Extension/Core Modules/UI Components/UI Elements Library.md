# UI elements library

## Introduction
This page describes the UI elements library and utility functions across two distinct UI systems in the repository:
- A browser extension side panel UI built with vanilla JavaScript and a dependency injection pattern.
- A Next.js website UI built with React components and Tailwind CSS utility functions.

It explains the element factory pattern for DOM element acquisition, DOM selection strategies, component composition approaches, utility functions for UI helpers and event handling, styling and responsive design patterns, accessibility considerations, examples of element creation and dynamic UI updates, error handling, performance optimization, and cross-browser compatibility strategies.

## Project structure
The UI systems are organized as follows:
- Browser extension side panel:
  - UI entry point initializes controllers and wiring.
  - Element registry centralizes DOM queries.
  - Controllers encapsulate UI logic and state.
  - Utilities provide escaping and formatting helpers.
- Website (Next.js):
  - Shared utility for Tailwind class merging.
  - Reusable React UI primitives (Button, Input, Dialog, Card).
  - Example page-level component demonstrating composition.

```mermaid
graph TB
subgraph "Extension UI"
UIEntry["UI Entry<br/>index.js"]
Elements["Element Registry<br/>elements.js"]
StateMgr["State Manager<br/>state.js"]
CtlProgress["Progress Controller<br/>progress.js"]
CtlSettings["Settings Controller<br/>settings.js"]
CtlSolve["Solve Controller<br/>solve.js"]
CtlDetection["Detection Controller<br/>detection.js"]
UtilsJS["Utilities<br/>utils.js"]
end
subgraph "Website UI"
UtilsTS["Tailwind Utility<br/>utils.ts"]
Btn["Button Component<br/>button.tsx"]
Inp["Input Component<br/>input.tsx"]
Dlg["Dialog Component<br/>dialog.tsx"]
CardComp["Card Component<br/>card.tsx"]
Hero["Hero Page Component<br/>hero.tsx"]
end
UIEntry --> Elements
UIEntry --> StateMgr
UIEntry --> CtlProgress
UIEntry --> CtlSettings
UIEntry --> CtlSolve
UIEntry --> CtlDetection
CtlSolve --> UtilsJS
CtlSettings --> UtilsJS
UtilsTS --> Btn
UtilsTS --> Inp
UtilsTS --> Dlg
UtilsTS --> CardComp
Hero --> Btn
Hero --> CardComp
```

## Core components
- Element factory pattern: Centralized DOM retrieval via a single function returning a map of element references. This improves maintainability and testability by isolating DOM queries.
- State manager: Encapsulated state with getters/setters and reset capability, enabling predictable UI state transitions.
- Controller factory pattern: Each controller exposes initialization and lifecycle methods, promoting separation of concerns and DI-friendly wiring.
- Utilities:
  - HTML escaping for safe innerHTML insertion.
  - Question type formatting for display.
  - Tailwind class merging utility for React components.

Examples of element creation and dynamic updates are covered in the detailed component analysis.

## Architecture overview
The extension UI follows a dependency injection pattern:
- UI entry initializes adapters, services, state, and controllers.
- Controllers receive shared dependencies (elements, state, storage, runtime, logger).
- Event listeners are bound in controller initialization methods.
- Controllers update the DOM via the element registry and manage progress/status.

```mermaid
sequenceDiagram
participant Doc as "DOM"
participant Entry as "UI Entry<br/>index.js"
participant Elem as "Elements<br/>elements.js"
participant State as "State<br/>state.js"
participant CtlSolve as "Solve Controller<br/>solve.js"
participant CtlProg as "Progress Controller<br/>progress.js"
participant CtlSet as "Settings Controller<br/>settings.js"
Doc->>Entry : DOMContentLoaded
Entry->>Elem : getElements()
Entry->>State : createStateManager()
Entry->>CtlSolve : createSolveController(...)
Entry->>CtlProg : createProgressController(...)
Entry->>CtlSet : createSettingsController(...)
CtlSolve->>Doc : bind click to solveBtn
CtlSet->>Doc : bind clicks to settingsBtn/close/save
CtlSolve->>CtlProg : setStatus()/setProgress()/showProgress()
CtlSet->>Elem : populate form fields
CtlSolve->>CtlSolve : handleSolve() -> extract -> solve -> fill -> submit
```

## Detailed component analysis

### Element factory pattern and DOM selection strategies
- Centralized element retrieval: All DOM queries are consolidated in a single function returning a named map of elements. This reduces duplication and makes refactoring easier.
- Safe nested queries: Uses chained getElementById and querySelector to access nested nodes (e.g., status text inside status bar).
- Modal and form elements: Captures inputs, selects, and buttons for settings and progress UI.
- Selection strategies:
  - Prefer getElementById for unique identifiers.
  - Use querySelector for scoped children to avoid global conflicts.
  - Guard against missing elements to prevent runtime errors.

```mermaid
flowchart TD
Start(["Call getElements()"]) --> Collect["Collect top-level elements by ID"]
Collect --> Nested["Query nested elements under parent containers"]
Nested --> ReturnMap["Return named element map"]
ReturnMap --> End(["Ready for controller use"])
```

### State management
- Encapsulated state with explicit getters/setters and reset.
- Tracks processing flag, extraction object, and current step.
- Used by controllers to coordinate UI updates and guard concurrent operations.

```mermaid
classDiagram
class StateManager {
-state : Object
+getIsProcessing() boolean
+setIsProcessing(value) void
+getExtraction() any
+setExtraction(value) void
+getCurrentStep() string
+setCurrentStep(value) void
+reset() void
}
```

### Progress controller
- Updates status bar text and styling based on status type (normal/loading/error).
- Manages step indicators via data attributes.
- Controls progress bar count, width, and determinate/indeterminate modes.
- Toggles visibility of progress/results/empty states.

```mermaid
flowchart TD
Init(["setStatus(message,type)"]) --> HasText{"Has statusText?"}
HasText --> |Yes| UpdateText["Update textContent"]
HasText --> |No| SkipText["Skip"]
UpdateText --> HasBar{"Has statusBar?"}
HasBar --> |Yes| ApplyClass["Add/remove classes and set dot style"]
HasBar --> |No| SkipBar["Skip"]
ApplyClass --> End(["Done"])
subgraph "Step Management"
S1["setStep(name,status)"] --> Query["Query steps by data-step"]
Query --> Loop["Loop and set data-state"]
end
```

### Settings controller
- Loads stored API key and model preferences into form controls.
- Shows/hides modal with transitions.
- Saves settings to storage and validates presence of required fields.
- Initializes event listeners for opening/closing and saving.

```mermaid
sequenceDiagram
participant UI as "UI"
participant Ctl as "Settings Controller<br/>settings.js"
participant Elem as "Elements<br/>elements.js"
participant Store as "Storage Service"
UI->>Ctl : show()
Ctl->>Store : getApiKey(), getModelPreferences()
Ctl->>Elem : populate inputs/selects
UI->>Ctl : hide()
Ctl->>Elem : animate out and hide modal
UI->>Ctl : save()
Ctl->>Elem : read inputs
Ctl->>Store : saveApiKey(), saveModelPreferences()
Ctl-->>UI : return success/failure
```

### Solve controller
- Orchestrates the end-to-end flow: extract HTML/screenshots, AI extraction, AI solving, filling answers, optional auto-submit, and results rendering.
- Implements recursive splitting on MAX_TOKENS errors to handle long inputs.
- Uses progress controller for status and progress updates.
- Uses utilities for HTML escaping and question type formatting.
- Relays debug info to background via messaging.

```mermaid
sequenceDiagram
participant User as "User"
participant Solve as "Solve Controller<br/>solve.js"
participant Prog as "Progress Controller<br/>progress.js"
participant Store as "Storage Service"
participant Gemini as "Gemini Service"
participant Runtime as "Runtime Adapter"
User->>Solve : click solveBtn
Solve->>Store : getApiKey(), getModelPreferences()
alt missing API key
Solve->>Prog : setStatus("error")
Solve->>Solve : settings.show()
else proceed
Solve->>Prog : showProgress(), resetSteps()
Solve->>Runtime : EXTRACT_HTML
Solve->>Solve : captureFullPageScreenshots()
Solve->>Gemini : extract() with recursive split
Solve->>Prog : setIndeterminate(), markStepDone("extract")
Solve->>Gemini : solve() with recursive split
Solve->>Prog : resetProgress(), setProgress(i,total)
Solve->>Runtime : APPLY_ANSWERS per question
alt autoSubmit checked
Solve->>Runtime : SUBMIT_ASSIGNMENT
end
Solve->>Solve : showResults(questions)
end
```

### Detection controller
- Checks current page for assignments and toggles UI states accordingly.
- Listens for background tab update events to refresh detection.

```mermaid
flowchart TD
Init(["init()"]) --> Load["checkCurrentPage()"]
Load --> IsAssig{"isAssignment?"}
IsAssig --> |Yes| ShowInfo["Show assignment info"]
IsAssig --> |No| ShowEmpty["Show empty state"]
ShowInfo --> Listen["Listen for TAB_UPDATED"]
ShowEmpty --> Listen
Listen --> Reload["Re-check on update"]
```

### Website UI components and utilities
- Tailwind utility: Merges and deduplicates Tailwind classes safely.
- Button component: Variants and sizes with Base UI primitive and class variance authority.
- Input component: Base UI input with consistent styling and accessibility props.
- Dialog component: Portal-backed overlay with optional close button and slots for header/footer/title/description.
- Card component: Flexible card with header/content/footer/title/action and size variants.
- Hero page component: Demonstrates composition of UI primitives and responsive layout.

```mermaid
classDiagram
class TailwindUtils {
+cn(...inputs) string
}
class Button {
+variant : enum
+size : enum
+className : string
}
class Input {
+type : string
+className : string
}
class Dialog {
+DialogRoot
+DialogTrigger
+DialogPortal
+DialogOverlay
+DialogContent
+DialogHeader
+DialogFooter
+DialogTitle
+DialogDescription
}
class Card {
+size : "default"|"sm"
+className : string
}
TailwindUtils <.. Button : "cn()"
TailwindUtils <.. Input : "cn()"
TailwindUtils <.. Dialog : "cn()"
TailwindUtils <.. Card : "cn()"
```

### Utility functions for UI helpers
- HTML escaping: Prevents XSS when injecting dynamic text into the DOM.
- Question type formatting: Maps internal types to display-friendly abbreviations.

### Event handling and user interaction management
- Event delegation and listener initialization are centralized in controller init methods.
- Modal interactions (open/close/save) are handled with clear separation of concerns.
- Dynamic UI updates (progress bars, status text, step indicators) occur in response to controller actions.

### Styling approaches and responsive design patterns
- Extension UI:
  - Uses CSS variables for accent colors and status dot styling.
  - Applies classes conditionally to reflect loading/error states.
  - Progress bar width and pulse animation are toggled dynamically.
- Website UI:
  - Tailwind utilities for responsive spacing, typography, and layout.
  - Component-level variants (size/variant) and data attributes for styling hooks.
  - Responsive breakpoints and fluid typography via clamp and grid layouts.

### Accessibility considerations
- Focus management and keyboard navigation are supported by underlying Base UI primitives.
- Semantic roles and labels are applied via data-slot attributes for assistive technologies.
- Proper contrast and color usage for status indicators (success/warning/error).
- Hidden elements and transitions are handled to preserve screen reader semantics.

### Examples of element creation, event binding, and dynamic UI updates
- Element creation: Centralized in element registry; controllers consume the map.
- Event binding: Controllers initialize listeners in dedicated methods.
- Dynamic UI updates: Progress controller updates text, classes, and progress bar; solve controller renders results with escaped HTML.

## Dependency analysis
- UI entry depends on adapters/services/state and controllers.
- Controllers depend on the element registry and shared services.
- Utilities are pure functions injected into controllers where needed.
- Website components depend on the Tailwind utility for class composition.

```mermaid
graph LR
Entry["index.js"] --> Elements["elements.js"]
Entry --> State["state.js"]
Entry --> CtlSolve["solve.js"]
Entry --> CtlProg["progress.js"]
Entry --> CtlSet["settings.js"]
Entry --> CtlDet["detection.js"]
CtlSolve --> UtilsJS["utils.js"]
CtlSet --> UtilsJS
Btn["button.tsx"] --> UtilsTS["utils.ts"]
Inp["input.tsx"] --> UtilsTS
Dlg["dialog.tsx"] --> UtilsTS
CardComp["card.tsx"] --> UtilsTS
```

## Performance considerations
- Minimize DOM queries: Use the element registry to fetch once and reuse.
- Batch UI updates: Group DOM writes and avoid forced synchronous layouts.
- Debounce or throttle rapid events (e.g., progress updates) to reduce repaint cost.
- Conditional animations: Toggle CSS classes instead of animating properties in JS loops.
- Recursive splitting: Limit maximum depth to prevent exponential work and stack growth.
- Message retries: Use retry mechanisms with exponential backoff for background communication.
- Virtualization: For large lists, consider virtualizing results rendering.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Missing elements: Guard DOM queries and log warnings when elements are absent.
- Background readiness: Wait for background script readiness before proceeding, especially on Firefox.
- Error propagation: Surface errors to UI with setStatus and optionally relay to background for debugging.
- Storage failures: Validate required settings (API key) before starting flows.
- Cross-tab operations: Pin target tab ID early to ensure subsequent messages route correctly.

## Conclusion
The UI library combines a clean element factory pattern, DI-driven controllers, and reliable utilities to deliver a maintainable and extensible UI system. The extension UI emphasizes resilient DOM manipulation and progress feedback, while the website UI uses React components and Tailwind utilities for consistent, accessible, and responsive design. Together, they demonstrate best practices in component composition, event handling, styling, and cross-browser compatibility.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Cross-browser compatibility:
  - Use Base UI primitives for standardized behavior.
  - Feature-detect and polyfill where necessary (e.g., message passing APIs).
  - Test modal overlays and transitions across browsers.
- Accessibility checklist:
  - Ensure focus order and visible focus indicators.
  - Provide ARIA labels and roles where custom elements are used.
  - Maintain sufficient color contrast for status indicators.

[No sources needed since this section provides general guidance]
