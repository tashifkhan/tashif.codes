# Manual contact entry interface

## Introduction
This page describes the manual contact entry system used to add phone numbers directly into the application. It covers multi-format input parsing that supports various separators (newlines, commas, semicolons, pipes), intelligent detection of name-number pairs, real-time validation feedback, error handling for malformed entries, supported input formats with examples, optimal formatting guidance, and performance considerations for large batches.

## Project structure
The manual contact entry spans the Electron frontend and Python backend:
- Frontend: React component manages user input and displays real-time feedback.
- Backend: Python module parses and validates manual entries.
- Bridge: Pyodide loads and executes Python code from the Electron renderer process.

```mermaid
graph TB
UI["WhatsAppForm.jsx<br/>Manual input UI"] --> Bridge["pyodide.js<br/>Pyodide bridge"]
Bridge --> Parser["parse_manual_numbers.py<br/>Parser & validator"]
Parser --> Validator["validate_number.py<br/>Number cleaning"]
UI --> Logger["Activity Log<br/>Real-time feedback"]
```

## Core components
- Manual input UI: Text area for entering contacts with examples and live count.
- Pyodide bridge: Loads Pyodide runtime and Python script, executes parsing.
- Parser: Splits input by multiple separators, detects name-number pairs, cleans numbers.
- Validator: Cleans and validates individual numbers with length checks.

Key behaviors:
- Multi-separator splitting: newline, comma, semicolon.
- Intelligent pair detection: colon, dash, pipe delimiters separate name from number.
- Real-time feedback: success counts, errors, and clearing actions.
- Batch processing: processes all lines in a single operation.

## Architecture overview
The manual entry flow connects the UI to Python parsing via Pyodide.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "WhatsAppForm.jsx"
participant Bridge as "pyodide.js"
participant Parser as "parse_manual_numbers.py"
participant Validator as "validate_number.py"
User->>UI : "Enter contacts in textarea"
UI->>Bridge : "parseManualNumbers(text)"
Bridge->>Bridge : "loadPyodideAndScript()"
Bridge->>Parser : "runPythonAsync(parse_manual_numbers)"
Parser->>Validator : "clean_phone_number(number)"
Validator-->>Parser : "cleaned number or None"
Parser-->>Bridge : "JSON result {success, contacts, count}"
Bridge-->>UI : "Parsed contacts"
UI->>UI : "Update contacts list and log"
```

## Detailed component analysis

### Manual input UI (React)
Responsibilities:
- Render textarea with examples and live line count.
- Trigger parsing on submit.
- Display success/error logs and update contact list.
- Clear input and hide manual panel after successful addition.

Validation and feedback:
- Prevents submission when input is empty.
- Adds success/error log entries.
- Clears input and closes panel upon success.

Batch processing:
- Processes all lines in one call to the parser.

### Pyodide bridge
Responsibilities:
- Dynamically loads Pyodide runtime from CDN if not present.
- Fetches and runs the Python parser script.
- Escapes special characters for safe Python string injection.
- Executes Python code asynchronously and returns JSON results.

### Parser: parse_manual_numbers.py
Parsing algorithm:
- Split input by newline and comma/semicolon separators to get raw entries.
- For each entry:
  - Strip whitespace.
  - Split by delimiter once (colon, dash, pipe) to detect name-number pairs.
  - If a pair is detected, validate whichever part looks like a number.
  - If no pair, treat the whole entry as a number candidate.
  - Clean and validate the number; if valid, append to contacts with optional name or auto-generated label.

Intelligent detection:
- Uses regex to identify numeric candidates within entries.
- Tries to infer which part is the name vs. number based on structure.

Real-time feedback:
- Returns structured result with success flag, contacts array, count, and message.

### Validator: validate_number.py
Number cleaning and validation:
- Removes separators and non-digit characters except plus sign.
- Normalizes leading zeros and country codes.
- Enforces digit-only length bounds suitable for international numbers.
- Returns cleaned number or None if invalid.

### Supported input formats and examples
Supported separators:
- Newlines: one contact per line.
- Commas: comma-separated entries.
- Semicolons: semicolon-separated entries.
- Pipes: pipe-separated entries.

Name-number pair formats:
- Colon-delimited: "Name: +1234567890".
- Dash-delimited: "+1234567890 - Name".
- Pipe-delimited: "Name | +1234567890".

Mixed format inputs:
- The parser splits by multiple separators and tries to detect pairs intelligently.

Examples (conceptual):
- Single number per line:
  ```
  +1234567890
  +0987654321
  ```
- Mixed separators:
  ```
  +1234567890,+0987654321
  +1111222333;+2222333444
  ```
- With names:
  ```
  John Doe: +1234567890
  +0987654321 - Jane Smith
  ```

Optimal formatting guidance:
- Prefer one contact per line for readability.
- Use consistent separators within a batch.
- Include names alongside numbers when available for better labeling.
- Avoid extra spaces around separators to reduce ambiguity.

### Real-time validation feedback and error handling
Frontend feedback:
- Logs success messages with contact counts.
- Displays error messages for empty input or parsing failures.
- Shows QR code loading states and connection status.

Backend validation:
- Cleans and validates numbers; invalid entries are filtered out.
- Returns structured results indicating success and counts.

Error handling:
- Empty input prevents submission.
- Exceptions during parsing are caught and logged as errors.
- Invalid numbers are ignored; only valid ones are included in the result.

### Algorithm flowchart
```mermaid
flowchart TD
Start(["Input received"]) --> Split["Split by separators:<br/>newline, comma, semicolon"]
Split --> Loop["For each entry"]
Loop --> Trim["Strip whitespace"]
Trim --> PairCheck{"Contains name-number delimiter?<br/>colon, dash, pipe"}
PairCheck --> |Yes| SplitPair["Split once into name and number"]
SplitPair --> ValidatePair["Validate numeric candidate"]
PairCheck --> |No| TreatAsNumber["Treat as number"]
TreatAsNumber --> ValidateNumber["Validate number"]
ValidatePair --> AddOrSkip{"Valid?"}
ValidateNumber --> AddOrSkip
AddOrSkip --> |Yes| Append["Append to contacts<br/>with name or auto-label"]
AddOrSkip --> |No| Skip["Skip entry"]
Append --> Next["Next entry"]
Skip --> Next
Next --> Done{"More entries?"}
Done --> |Yes| Loop
Done --> |No| Return["Return success with contacts and count"]
```

## Dependency analysis
- UI depends on the Pyodide bridge for Python execution.
- Pyodide bridge depends on the Python parser script.
- Parser depends on the validator for number cleaning and validation.
- No external Python dependencies are required for manual parsing.

```mermaid
graph LR
UI["WhatsAppForm.jsx"] --> BR["pyodide.js"]
BR --> PARSER["parse_manual_numbers.py"]
PARSER --> VALIDATOR["validate_number.py"]
```

## Performance considerations
- Parsing complexity: Linear in the number of input lines and characters.
- Regex operations: Applied per entry; minimal overhead for typical batch sizes.
- Memory usage: Stores validated contacts in memory; consider clearing old lists to manage growth.
- Large batches: The UI processes all entries in one call; performance scales with input size.
- Recommendations:
  - Keep entries on separate lines for clarity and easier validation.
  - Avoid extremely long single lines with many entries.
  - Periodically clear the contact list to prevent memory bloat.
  - Use consistent separators to reduce parsing ambiguity.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Empty input submission:
  - The UI prevents submission when input is blank; ensure entries are present.
- Malformed numbers:
  - Numbers outside the accepted digit length range are ignored; verify formatting.
- Mixed separators causing ambiguity:
  - Prefer one primary separator per batch; avoid mixing multiple separators excessively.
- Real-time feedback:
  - Check the activity log for success or error messages; use them to refine input.

## Conclusion
The manual contact entry system provides a flexible, real-time way to add contacts using multiple separators and intelligent name-number pair detection. The UI offers immediate feedback, while the Python backend ensures reliable number cleaning and validation. Following the recommended formatting practices helps achieve reliable parsing and optimal performance, especially for larger batches.
