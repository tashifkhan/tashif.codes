# Contact Management System

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [extract_contacts.py](file://python-backend/extract_contacts.py)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py)
- [validate_number.py](file://python-backend/validate_number.py)
- [app.py](file://python-backend/app.py)
- [pyodide.js](file://electron/src/utils/pyodide.js)
- [parse_manual_numbers.py](file://electron/dist-react/py/parse_manual_numbers.py)
- [parse_manual_numbers.py](file://electron/public/py/parse_manual_numbers.py)
- [main.js](file://electron/src/electron/main.js)
- [preload.js](file://electron/src/electron/preload.js)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx)
- [App.jsx](file://electron/src/ui/App.jsx)
- [cli_functions.py](file://localhost/cli_functions.py)
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
This document describes the contact management and processing system for importing, validating, normalizing, and managing contacts for bulk messaging. It covers:
- Multi-format contact import (CSV, Excel, and text files) with automatic format detection
- Phone number validation and normalization including country code handling
- Manual contact entry interface with real-time validation feedback
- Duplicate detection and removal algorithms
- Pyodide runtime integration for browser-based Python execution
- Comprehensive error handling for invalid formats, encoding issues, and malformed data
- Export capabilities for processed contacts and validation results
- Performance considerations for large contact lists and memory optimization strategies

## Project Structure
The system is composed of:
- Electron desktop application with React UI
- Python backend utilities for contact extraction and validation
- Pyodide integration for browser-side Python execution
- Local CLI utilities for prototyping and development

```mermaid
graph TB
subgraph "Electron App"
UI["React UI<br/>App.jsx"]
WM["WhatsAppForm.jsx"]
BM["BulkMailer.jsx"]
PY["pyodide.js"]
end
subgraph "Python Backend"
APP["Flask API<br/>app.py"]
EX["extract_contacts.py"]
PN["parse_manual_numbers.py"]
VN["validate_number.py"]
end
subgraph "Electron Main Process"
MJ["main.js"]
PL["preload.js"]
end
UI --> WM
UI --> BM
WM --> PY
BM --> PY
PY --> PN
MJ --> APP
APP --> EX
APP --> PN
APP --> VN
```

**Diagram sources**
- [App.jsx](file://electron/src/ui/App.jsx#L1-L13)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L1-L609)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L1-L482)
- [pyodide.js](file://electron/src/utils/pyodide.js#L1-L33)
- [app.py](file://python-backend/app.py#L1-L378)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L1-L177)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L1-L61)
- [validate_number.py](file://python-backend/validate_number.py#L1-L27)
- [main.js](file://electron/src/electron/main.js#L1-L371)
- [preload.js](file://electron/src/electron/preload.js#L1-L41)

**Section sources**
- [README.md](file://README.md#L198-L236)
- [App.jsx](file://electron/src/ui/App.jsx#L1-L13)
- [main.js](file://electron/src/electron/main.js#L1-L371)
- [app.py](file://python-backend/app.py#L1-L378)

## Core Components
- Contact extraction utilities:
  - CSV, Excel, and text file parsers with automatic column detection and phone number cleaning
- Manual number parser:
  - Parses user-entered text with optional names and cleans phone numbers
- Phone number validator:
  - Validates and returns normalized numbers
- Pyodide integration:
  - Loads Python runtime and executes number parsing in the browser
- Electron IPC:
  - Exposes APIs for contact import, validation, and WhatsApp messaging
- React UI:
  - Provides manual entry interface, import controls, and real-time feedback

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L25-L177)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L61)
- [validate_number.py](file://python-backend/validate_number.py#L6-L27)
- [pyodide.js](file://electron/src/utils/pyodide.js#L5-L33)
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L41-L62)

## Architecture Overview
The system supports two primary flows:
- Desktop import via Electron main process (CSV/Excel/TXT) with local parsing
- Browser-based manual entry via Pyodide (Python executed in the renderer)

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "WhatsAppForm.jsx"
participant Py as "pyodide.js"
participant PyMod as "parse_manual_numbers.py"
participant Util as "validate_number.py"
User->>UI : Paste numbers in manual input
UI->>Py : parseManualNumbers(text)
Py->>PyMod : runPythonAsync(parse_manual_numbers)
PyMod-->>Py : contacts array
Py-->>UI : contacts array
UI->>Util : validate individual numbers (optional)
Util-->>UI : validation results
UI-->>User : display contacts with validation feedback
```

**Diagram sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L41-L62)
- [pyodide.js](file://electron/src/utils/pyodide.js#L26-L33)
- [parse_manual_numbers.py](file://electron/dist-react/py/parse_manual_numbers.py#L22-L61)
- [validate_number.py](file://python-backend/validate_number.py#L22-L27)

## Detailed Component Analysis

### Contact Import Pipeline (Desktop)
The Electron main process handles file selection and parsing for CSV and TXT. Excel support is present but not used in the current UI flow.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "BulkMailer.jsx"
participant Main as "main.js"
participant Parser as "parse_manual_numbers.py"
participant Util as "validate_number.py"
User->>UI : Click Import File
UI->>Main : importWhatsAppContacts()
Main-->>UI : File picker dialog
UI->>UI : Read file content
UI->>Parser : parseManualNumbers(content)
Parser-->>UI : contacts
UI->>Util : validate individual numbers (optional)
Util-->>UI : validation results
UI-->>User : Display contacts preview
```

**Diagram sources**
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L323-L366)
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L61)
- [validate_number.py](file://python-backend/validate_number.py#L22-L27)

**Section sources**
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L323-L366)
- [main.js](file://electron/src/electron/main.js#L215-L262)

### Phone Number Validation and Normalization
Phone numbers are normalized by removing separators, ensuring a leading plus for international numbers, and enforcing digit-only length constraints. The same logic is applied in both Python utilities and the browser via Pyodide.

```mermaid
flowchart TD
Start(["Input phone number"]) --> Clean["Remove separators and non-digits except '+'"]
Clean --> Normalize["Strip leading zeros if not international"]
Normalize --> Prefix{"Starts with '+'?"}
Prefix --> |No| LongEnough{"Length > 10?"}
Prefix --> |Yes| ValidateLen["Extract digits only"]
LongEnough --> |Yes| PrefixPlus["+ prefix added"]
LongEnough --> |No| Skip["Invalid length"]
PrefixPlus --> ValidateLen
ValidateLen --> LenOK{"7 <= digits <= 15?"}
LenOK --> |Yes| Valid["Normalized number"]
LenOK --> |No| Skip
Skip --> End(["Return None"])
Valid --> End
```

**Diagram sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L9-L22)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L6-L19)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L9-L22)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L6-L19)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

### Manual Contact Entry Interface
The manual entry interface supports:
- Text area input with examples for formats
- Real-time validation feedback
- Immediate addition to the contact list with normalized numbers

```mermaid
sequenceDiagram
participant User as "User"
participant Form as "WhatsAppForm.jsx"
participant Py as "pyodide.js"
participant Mod as "parse_manual_numbers.py"
User->>Form : Enter numbers (with optional names)
Form->>Py : parseManualNumbers(text)
Py->>Mod : runPythonAsync(parse_manual_numbers)
Mod-->>Py : {success, contacts, count}
Py-->>Form : contacts
Form->>Form : Append to waContacts
Form-->>User : Show preview and success message
```

**Diagram sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L41-L62)
- [pyodide.js](file://electron/src/utils/pyodide.js#L26-L33)
- [parse_manual_numbers.py](file://electron/dist-react/py/parse_manual_numbers.py#L22-L61)

**Section sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L315-L361)
- [pyodide.js](file://electron/src/utils/pyodide.js#L26-L33)

### Duplicate Detection and Removal
The system does not implement explicit duplicate detection in the provided code. To maintain data integrity, consider:
- Using a set keyed by normalized phone numbers for deduplication
- Optional name-aware deduplication if names are present
- Preprocessing before adding to the contact list

[No sources needed since this section provides general guidance]

### Pyodide Runtime Integration
Pyodide is dynamically loaded and used to execute Python scripts in the renderer process. The loader fetches the script and runs it asynchronously.

```mermaid
sequenceDiagram
participant UI as "pyodide.js"
participant CDN as "Pyodide CDN"
participant Py as "Pyodide Runtime"
participant Mod as "parse_manual_numbers.py"
UI->>CDN : Fetch pyodide.js
CDN-->>UI : Script loaded
UI->>Py : loadPyodide(indexURL)
UI->>Py : runPythonAsync(fetch script)
Py->>Mod : Execute parse_manual_numbers
Mod-->>Py : Return JSON result
Py-->>UI : JSON string
UI-->>Caller : Parsed result
```

**Diagram sources**
- [pyodide.js](file://electron/src/utils/pyodide.js#L5-L33)
- [parse_manual_numbers.py](file://electron/dist-react/py/parse_manual_numbers.py#L22-L61)

**Section sources**
- [pyodide.js](file://electron/src/utils/pyodide.js#L5-L33)

### Export Capabilities
The system currently focuses on ingestion and validation. Export functionality for processed contacts and validation results is not implemented in the provided code. To add export:
- Provide CSV/JSON download options for the current contact list
- Include validation status and normalized numbers in exports

[No sources needed since this section provides general guidance]

## Dependency Analysis
The contact processing pipeline depends on:
- Electron main process for file I/O and IPC
- Python utilities for robust parsing and validation
- Pyodide for browser-side Python execution
- React components for UI and user interaction

```mermaid
graph LR
UI["WhatsAppForm.jsx"] --> PY["pyodide.js"]
PY --> PM["parse_manual_numbers.py"]
BM["BulkMailer.jsx"] --> MJ["main.js"]
MJ --> APP["app.py"]
APP --> EX["extract_contacts.py"]
APP --> PN["parse_manual_numbers.py"]
APP --> VN["validate_number.py"]
```

**Diagram sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L1-L609)
- [pyodide.js](file://electron/src/utils/pyodide.js#L1-L33)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L1-L482)
- [main.js](file://electron/src/electron/main.js#L1-L371)
- [app.py](file://python-backend/app.py#L1-L378)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L1-L177)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L1-L61)
- [validate_number.py](file://python-backend/validate_number.py#L1-L27)

**Section sources**
- [main.js](file://electron/src/electron/main.js#L1-L371)
- [app.py](file://python-backend/app.py#L1-L378)

## Performance Considerations
- Large CSV/Excel parsing:
  - Prefer streaming parsers for very large files to reduce memory usage
  - Validate and normalize incrementally
- Browser-based parsing:
  - Pyodide adds overhead; batch processing and progress indicators improve UX
  - Limit concurrent parsing operations
- Memory optimization:
  - Deduplicate contacts early using normalized keys
  - Avoid storing intermediate unprocessed rows
- I/O and network:
  - Use buffered reads and writes
  - Implement timeouts for external services

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Unsupported file types:
  - Ensure CSV, TXT, XLSX, or XLS formats
- Encoding problems:
  - Use UTF-8 encoded files
- Malformed phone numbers:
  - Validate numbers before import; rely on normalization rules
- Pyodide loading failures:
  - Confirm CDN availability and correct index URL
- Electron IPC errors:
  - Verify preload exposure and handler registration

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L160-L177)
- [app.py](file://python-backend/app.py#L232-L280)
- [pyodide.js](file://electron/src/utils/pyodide.js#L5-L24)
- [main.js](file://electron/src/electron/main.js#L1-L371)

## Conclusion
The contact management system provides robust ingestion and validation of phone numbers across multiple formats, with flexible manual entry and browser-based Python execution via Pyodide. While explicit duplicate detection is not implemented, the normalized phone number approach supports efficient deduplication strategies. Extending the system with export capabilities and enhancing duplicate handling would further improve usability and data quality.