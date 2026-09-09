# Pyodide runtime integration

## Introduction
This page explains how the project integrates Pyodide to enable browser-based Python execution for contact processing. It covers the WebAssembly-based Python interpreter setup, script loading mechanisms, dynamic import system for Python modules, and IPC communication between JavaScript and Python contexts. It also documents the file processing workflow that uses Pyodide for manual number parsing without server dependencies, along with performance considerations, memory limitations, optimization strategies, build process for embedding Python scripts, distribution of Pyodide runtime assets, error handling, and debugging approaches.

## Project structure
The Pyodide integration is primarily implemented in the Electron renderer process. The key elements are:
- A utility module that dynamically loads Pyodide and executes Python scripts
- A Python script that parses manual phone numbers and returns structured results
- React components that trigger the parsing workflow
- Electron main/preload processes that manage IPC and application lifecycle

```mermaid
graph TB
subgraph "Electron Renderer (React)"
WF["WhatsAppForm.jsx"]
BM["BulkMailer.jsx"]
PYU["pyodide.js"]
end
subgraph "Electron Main Process"
MAIN["main.js"]
PRE["preload.js"]
end
subgraph "Build & Assets"
VITE["vite.config.js"]
PKG["package.json"]
HTML["index.html"]
DIST["dist-react/py/parse_manual_numbers.py"]
PUB["public/py/parse_manual_numbers.py"]
end
WF --> PYU
BM --> PYU
PYU --> DIST
PYU --> PUB
WF --> MAIN
BM --> MAIN
MAIN --> PRE
VITE --> DIST
PKG --> HTML
```

## Core components
- Pyodide loader and executor: Dynamically loads the Pyodide runtime from a CDN, initializes it with a specific index URL, and runs a Python script to register functions in the Python namespace.
- Python parser: Implements phone number cleaning and parsing logic, returning a structured result compatible with JSON serialization.
- React UI integration: Provides manual number input and triggers parsing via the Pyodide utility, displaying results and errors in the UI.
- IPC bridge: Exposes Electron APIs to the renderer process and manages WhatsApp-related IPC channels.

Key responsibilities:
- Pyodide loader: Ensures the runtime is loaded once, initializes it, and injects the Python script into the Python interpreter.
- Python parser: Validates and formats phone numbers, splits name-number pairs, and returns a normalized contact list.
- UI integration: Handles user input, error reporting, and updates the contact list upon successful parsing.
- IPC bridge: Enables secure communication between the renderer and main process for non-Python tasks (e.g., WhatsApp operations).

## Architecture overview
The system uses a hybrid architecture:
- Electron renderer (React) handles UI and user interactions.
- Pyodide runtime runs inside the renderer to execute Python code for contact parsing.
- Electron main/preload manage IPC for non-Python tasks (e.g., WhatsApp client).
- Build pipeline places Python scripts into the renderer's static assets so they can be fetched and executed by Pyodide.

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant Loader as "pyodide.js"
participant Py as "Python Interpreter"
participant Script as "parse_manual_numbers.py"
participant Main as "main.js"
UI->>Loader : parseManualNumbers(numbersText)
Loader->>Loader : loadPyodideAndScript()
alt Pyodide not loaded
Loader->>Py : window.loadPyodide(indexURL)
Loader->>Script : fetch("py/parse_manual_numbers.py")
Loader->>Py : runPythonAsync(scriptText)
end
Loader-->>UI : parseManualNumbers(numbersText)
UI->>Py : runPythonAsync(import json; result = parse_manual_numbers(...); json.dumps(result))
Py-->>UI : JSON string result
UI-->>UI : JSON.parse(result)
UI->>UI : update contacts and logs
UI->>Main : (other operations via IPC)
```

## Detailed component analysis

### Pyodide loader and executor
The loader ensures the Pyodide runtime is available, initializes it with a specific index URL, and injects the Python script into the interpreter. It also provides a convenience function to parse manual numbers by escaping special characters and invoking the Python function, returning a structured result.

Implementation highlights:
- Dynamic script injection for Pyodide runtime from a CDN
- Initialization with a specific index URL for WebAssembly assets
- Fetching and executing the Python script once per session
- Safe string escaping for triple-quoted Python strings
- Returning JSON-parsed results to the caller

```mermaid
flowchart TD
Start(["Call parseManualNumbers"]) --> CheckLoaded["Check if Pyodide is loaded"]
CheckLoaded --> |Not loaded| LoadRuntime["Dynamically load pyodide.js from CDN"]
CheckLoaded --> |Already loaded| PrepareCode["Prepare Python code with escaped text"]
LoadRuntime --> InitPyodide["Initialize Pyodide with indexURL"]
InitPyodide --> FetchScript["Fetch 'py/parse_manual_numbers.py'"]
FetchScript --> RunScript["Run Python script via runPythonAsync"]
RunScript --> PrepareCode
PrepareCode --> EscapeText["Escape triple quotes and backslashes"]
EscapeText --> BuildPyCode["Build Python code to call parse_manual_numbers and serialize with json"]
BuildPyCode --> RunPy["Execute code via runPythonAsync"]
RunPy --> ParseJSON["Parse JSON result"]
ParseJSON --> Return(["Return structured result"])
```

### Python parser implementation
The Python script implements phone number cleaning and parsing logic:
- Cleans phone numbers by removing separators and validating length
- Supports name-number pairs separated by colon, dash, or pipe
- Normalizes numbers and assigns default names when missing
- Returns a structured dictionary with success status, contacts, count, and message

```mermaid
flowchart TD
Start(["parse_manual_numbers(numbers_text)"]) --> SplitLines["Split by newline and semicolon"]
SplitLines --> Loop["For each raw number"]
Loop --> Strip["Strip whitespace"]
Strip --> EmptyCheck{"Empty?"}
EmptyCheck --> |Yes| Next["Continue"]
EmptyCheck --> |No| SplitParts["Split by colon/dash/pipe once"]
SplitParts --> PartsCheck{"Has two parts?"}
PartsCheck --> |Yes| TryNumber["Check if number part looks like a number"]
PartsCheck --> |No| TryDirect["Clean and validate raw number"]
TryNumber --> NumberValid{"Valid number?"}
NumberValid --> |Yes| AssignNumber["Assign phone from number part<br/>Name from name part"]
NumberValid --> |No| TryName["Check if name part looks like a number"]
TryName --> NameValid{"Valid number?"}
NameValid --> |Yes| AssignName["Assign phone from name part<br/>Name from number part"]
NameValid --> |No| TryDirect
AssignNumber --> AddContact["Add to contacts"]
AssignName --> AddContact
TryDirect --> DirectValid{"Valid number?"}
DirectValid --> |Yes| AddContact
DirectValid --> |No| Skip["Skip"]
AddContact --> Next
Next --> End(["Return success dict with contacts and count"])
```

### React UI integration
The UI components orchestrate the user experience:
- Manual number input and validation
- Triggering the Pyodide-based parsing
- Updating contact lists and logs
- Handling errors and displaying feedback

```mermaid
sequenceDiagram
participant User as "User"
participant Form as "WhatsAppForm.jsx"
participant Loader as "pyodide.js"
participant Py as "Python Interpreter"
User->>Form : Enter manual numbers
User->>Form : Click "Add Numbers"
Form->>Form : Validate input
Form->>Loader : parseManualNumbers(numbersText)
Loader->>Py : runPythonAsync(...)
Py-->>Loader : JSON result
Loader-->>Form : Parsed contacts
Form->>Form : Update contacts state and logs
Form-->>User : Show success message
```

### IPC communication bridge
The preload script exposes a controlled API to the renderer, enabling secure IPC with the main process. While Pyodide runs in the renderer, other features (e.g., WhatsApp client) communicate via IPC channels.

```mermaid
sequenceDiagram
participant Renderer as "Renderer (React)"
participant Preload as "preload.js"
participant Main as "main.js"
Renderer->>Preload : window.electronAPI.startWhatsAppClient()
Preload->>Main : ipcRenderer.invoke('whatsapp-start-client')
Main-->>Preload : Promise resolves with result
Preload-->>Renderer : Result forwarded
Renderer->>Preload : window.electronAPI.onWhatsAppStatus(callback)
Preload->>Main : ipcRenderer.on('whatsapp-status', callback)
Main-->>Preload : Emitted status updates
Preload-->>Renderer : Callback invoked with status
```

## Dependency analysis
- Build-time dependencies: Vite builds the React app and outputs to dist-react, placing Python scripts alongside the built assets.
- Runtime dependencies: The renderer dynamically loads Pyodide from a CDN and fetches the Python script from the built assets.
- IPC dependencies: The preload bridge exposes Electron APIs to the renderer, while Pyodide remains isolated within the renderer.

```mermaid
graph LR
VITE["vite.config.js"] --> DIST["dist-react/py/parse_manual_numbers.py"]
PKG["package.json"] --> HTML["index.html"]
HTML --> RENDERER["Renderer (React)"]
RENDERER --> CDN["CDN: pyodide.js"]
RENDERER --> SCRIPT["dist-react/py/parse_manual_numbers.py"]
RENDERER --> PRE["preload.js"]
PRE --> MAIN["main.js"]
```

## Performance considerations
- Pyodide initialization cost: The first-time load of the Pyodide runtime and the Python script incurs network latency and initialization overhead. Subsequent calls reuse the initialized interpreter.
- Memory footprint: WebAssembly-based Python has memory constraints in browsers. Large input sets may increase memory pressure; consider batching or streaming input.
- Network reliability: Loading from a CDN introduces potential failures; implement retries and offline fallbacks where feasible.
- JSON serialization overhead: Converting between Python and JavaScript via JSON adds CPU overhead; minimize unnecessary conversions.
- Regex complexity: Phone number parsing uses multiple regex operations; keep input sizes reasonable to avoid long processing times.
- UI responsiveness: Long-running parsing should be offloaded to worker threads or scheduled to avoid blocking the UI thread.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Pyodide not loaded: Ensure the CDN URL is reachable and the script injection completes successfully.
- Python script not found: Verify the path to the Python script in the built assets matches the fetch URL.
- JSON serialization errors: Confirm the Python function returns a serializable structure and that the result is parsed correctly in JavaScript.
- CORS or asset serving: Confirm the built assets are served correctly by the development server or production static hosting.
- Error handling in UI: Wrap parsing calls in try/catch blocks and display user-friendly messages.

## Conclusion
The project successfully integrates Pyodide to enable browser-based Python execution for contact processing. The loader initializes the runtime, injects the Python script, and exposes a simple API to parse manual numbers. The React UI smoothly orchestrates user input and displays results, while Electron's IPC bridge manages non-Python tasks. The build pipeline embeds Python scripts into the renderer's static assets, and the CDN-hosted runtime provides a portable execution environment. Proper error handling, performance awareness, and optimization strategies ensure reliable operation in production.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Build process for embedding Python scripts
- Vite configuration outputs the React app to dist-react with a base path suitable for Electron packaging.
- Python scripts are placed under dist-react/py and public/py to ensure availability at runtime.
- The loader fetches the script from the built assets path, ensuring it is bundled with the renderer.

### Distribution of pyodide runtime assets
- The loader initializes Pyodide with a specific index URL pointing to the CDN-hosted runtime assets.
- Ensure the CDN endpoint is accessible and the index URL matches the intended runtime version.

### Error handling and debugging approaches
- Wrap Pyodide calls in try/catch blocks and surface meaningful error messages to users.
- Use the Electron DevTools for debugging the renderer process and inspect network requests for asset loading.
- Validate input before passing to Python to reduce runtime errors.
- Monitor memory usage and consider chunking large inputs to prevent excessive memory consumption.
