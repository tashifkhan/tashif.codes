# File Import and Processing

<cite>
**Referenced Files in This Document**
- [extract_contacts.py](file://python-backend/extract_contacts.py)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py)
- [validate_number.py](file://python-backend/validate_number.py)
- [app.py](file://python-backend/app.py)
- [requirements.txt](file://python-backend/requirements.txt)
- [main.js](file://electron/src/electron/main.js)
- [preload.js](file://electron/src/electron/preload.js)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx)
- [pyodide.js](file://electron/src/utils/pyodide.js)
- [README.md](file://README.md)
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
This document explains the file import and contact extraction system used to process CSV, Excel (.xlsx/.xls), and text files for bulk messaging applications. It covers automatic file type detection, fallback parsing strategies, column detection for phone numbers and names, robust error handling, supported formats and naming conventions, performance considerations for large files, and security measures for file processing.

## Project Structure
The system spans two primary environments:
- Electron desktop application (frontend) with IPC handlers for file operations
- Python backend service for robust contact extraction and validation

```mermaid
graph TB
subgraph "Electron Frontend"
UI["WhatsAppForm.jsx"]
BM["BulkMailer.jsx"]
Preload["preload.js"]
MainProc["main.js"]
end
subgraph "Python Backend"
FlaskApp["app.py"]
ExtCSV["extract_contacts.py"]
ParseNum["parse_manual_numbers.py"]
ValNum["validate_number.py"]
Req["requirements.txt"]
end
UI --> BM
BM --> Preload
Preload --> MainProc
MainProc --> FlaskApp
FlaskApp --> ExtCSV
FlaskApp --> ParseNum
FlaskApp --> ValNum
Req --> FlaskApp
```

**Diagram sources**
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [preload.js](file://electron/src/electron/preload.js#L4-L40)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L1-L609)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L323-L366)
- [app.py](file://python-backend/app.py#L232-L280)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L160-L177)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L57-L61)
- [validate_number.py](file://python-backend/validate_number.py#L22-L27)
- [requirements.txt](file://python-backend/requirements.txt#L1-L7)

**Section sources**
- [README.md](file://README.md#L198-L236)
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [app.py](file://python-backend/app.py#L232-L280)

## Core Components
- File type detection and routing: Electron detects file extension and routes to appropriate parsers.
- CSV/Excel extraction: Python backend uses pandas to parse structured spreadsheets and applies keyword-based column detection.
- Text file parsing: Python backend splits lines and attempts to extract phone numbers and names using regex heuristics.
- Manual number parsing: Python backend parses free-form text with name-number pairs and standalone numbers.
- Phone number cleaning/validation: Standardized normalization and length validation across all components.
- Error handling: Graceful fallbacks and safe defaults when parsing fails.

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L25-L81)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L84-L118)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L121-L157)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L54)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)
- [app.py](file://python-backend/app.py#L232-L280)

## Architecture Overview
The system integrates Electron IPC with a Python backend Flask service for robust file processing.

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant BM as "BulkMailer.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant Flask as "app.py"
participant Ext as "extract_contacts.py"
participant Num as "parse_manual_numbers.py"
UI->>BM : "User selects file"
BM->>Preload : "invoke('whatsapp-import-contacts')"
Preload->>Main : "IPC invoke"
Main->>Main : "Detect file extension"
alt CSV/TXT
Main->>Flask : "POST /upload with file"
Flask->>Ext : "extract_contacts_from_csv/excel/txt"
Ext-->>Flask : "contacts[]"
Flask-->>Main : "JSON {success, contacts}"
Main-->>Preload : "contacts[]"
Preload-->>BM : "contacts[]"
BM-->>UI : "Update contact list"
else XLSX/XLS
Main-->>Preload : "Unsupported file type"
Preload-->>BM : "Empty contacts"
BM-->>UI : "Show unsupported message"
end
```

**Diagram sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L323-L366)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L323-L366)
- [preload.js](file://electron/src/electron/preload.js#L27-L39)
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [app.py](file://python-backend/app.py#L232-L280)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L160-L177)

## Detailed Component Analysis

### File Type Detection and Routing
- Electron detects file extension and routes to either:
  - Python backend via HTTP POST for CSV/TXT/XLSX/XLS
  - Native CSV parser for CSV/TXT within Electron for manual parsing
- Unsupported formats (e.g., XLSX/XLS) currently return empty results in the Electron-managed import flow.

**Section sources**
- [main.js](file://electron/src/electron/main.js#L215-L262)
- [BulkMailer.jsx](file://electron/src/components/BulkMailer.jsx#L323-L366)

### CSV Extraction Pipeline
- Uses pandas to read CSV files.
- Keyword-based column detection:
  - Phone columns: look for keywords such as phone, number, mobile, cell, tel.
  - Name columns: look for keywords such as name, contact, person.
- Fallback strategy:
  - If pandas parsing fails, falls back to manual CSV reader with UTF-8 encoding.
  - Defaults to first column as phone and second as name if no matches found.

```mermaid
flowchart TD
Start(["Start CSV Extraction"]) --> ReadPandas["Try read_csv(file_path)"]
ReadPandas --> PandasOK{"Pandas succeeded?"}
PandasOK --> |Yes| DetectCols["Detect phone/name columns<br/>by keyword matching"]
DetectCols --> UseCols["Select phone_col, name_col"]
UseCols --> IterateRows["Iterate rows"]
IterateRows --> CleanPhone["clean_phone_number()"]
CleanPhone --> ValidPhone{"Valid phone?"}
ValidPhone --> |Yes| GetName["Get name from name_col or None"]
GetName --> BuildContact["Build contact {number,name}"]
BuildContact --> AddToList["Append to contacts[]"]
ValidPhone --> |No| NextRow["Next row"]
NextRow --> IterateRows
PandasOK --> |No| Fallback["Open with UTF-8 and csv.reader"]
Fallback --> IterateCSV["Iterate rows"]
IterateCSV --> CleanPhoneFallback["clean_phone_number()"]
CleanPhoneFallback --> ValidPhoneFallback{"Valid phone?"}
ValidPhoneFallback --> |Yes| GetNameFallback["Get name from row[1] or None"]
GetNameFallback --> BuildContactFallback["Build contact {number,name}"]
BuildContactFallback --> AddToList
ValidPhoneFallback --> |No| NextRowFallback["Next row"]
NextRowFallback --> IterateCSV
AddToList --> Done(["Return contacts[]"])
```

**Diagram sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L25-L81)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L25-L81)

### Excel (.xlsx/.xls) Extraction Pipeline
- Uses pandas to read Excel files.
- Applies identical keyword-based column detection as CSV.
- Fallback strategy:
  - If pandas parsing fails, returns empty contacts silently.

```mermaid
flowchart TD
Start(["Start Excel Extraction"]) --> ReadExcel["Try read_excel(file_path)"]
ReadExcel --> ExcelOK{"Excel read succeeded?"}
ExcelOK --> |Yes| DetectCols["Keyword-based phone/name column detection"]
DetectCols --> UseCols["Select phone_col, name_col"]
UseCols --> IterateRows["Iterate rows"]
IterateRows --> CleanPhone["clean_phone_number()"]
CleanPhone --> ValidPhone{"Valid phone?"}
ValidPhone --> |Yes| GetName["Get name from name_col or None"]
GetName --> BuildContact["Build contact {number,name}"]
BuildContact --> AddToList["Append to contacts[]"]
ValidPhone --> |No| NextRow["Next row"]
NextRow --> IterateRows
ExcelOK --> |No| ReturnEmpty["Return []"]
AddToList --> Done(["Return contacts[]"])
ReturnEmpty --> Done
```

**Diagram sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L121-L157)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L121-L157)

### Text File Parsing Pipeline
- Reads file as UTF-8 text.
- Splits lines and attempts to split by common separators (comma, semicolon, tab, pipe).
- Heuristic to detect phone numbers:
  - Look for segments containing digits and common separators (+, -, (), spaces).
  - If no clear split, regex match for phone-like strings in the entire line.
- Name extraction:
  - First non-empty segment that does not look like a phone number.
- Cleans and validates phone numbers using the shared validator.

```mermaid
flowchart TD
Start(["Start TXT Extraction"]) --> ReadLines["Read lines with UTF-8"]
ReadLines --> ForEachLine["For each non-empty line"]
ForEachLine --> SplitParts["Split by , ; \\t |"]
SplitParts --> FindPhone["Find first segment that looks like phone"]
FindPhone --> FoundPhone{"Found phone candidate?"}
FoundPhone --> |Yes| AssignName["Assign remaining segment as name"]
FoundPhone --> |No| RegexMatch["Regex match phone-like pattern in line"]
RegexMatch --> RegexFound{"Regex matched?"}
RegexFound --> |Yes| ExtractFromLine["Extract phone and remaining as name"]
RegexFound --> |No| SkipLine["Skip line"]
AssignName --> Validate["clean_phone_number()"]
ExtractFromLine --> Validate
Validate --> Valid{"Valid phone?"}
Valid --> |Yes| AddContact["Add {number,name} to contacts[]"]
Valid --> |No| SkipLine
AddContact --> NextLine["Next line"]
SkipLine --> NextLine
NextLine --> Done(["Return contacts[]"])
```

**Diagram sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L84-L118)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L84-L118)

### Manual Number Parsing (Free-form Text)
- Parses free-form text entries with optional name-number pairs.
- Supports separators: newline, comma, semicolon.
- Tries to split by colon or dash/pipe to separate name and number.
- Falls back to treating the entire entry as a phone number.
- Validates and formats numbers using the shared validator.

```mermaid
flowchart TD
Start(["Start Manual Numbers"]) --> SplitEntries["Split by newline/comma/semicolon"]
SplitEntries --> ForEachEntry["For each non-empty entry"]
ForEachEntry --> SplitPair["Split by : or -/| (max 1 split)"]
SplitPair --> HasPair{"Has name-number pair?"}
HasPair --> |Yes| CheckOrder["Check which part looks like phone"]
CheckOrder --> ValidPair{"Valid phone?"}
ValidPair --> |Yes| BuildPair["Build {number,name}"]
ValidPair --> |No| TreatAsPhone["Treat as phone only"]
HasPair --> |No| TreatAsPhone
TreatAsPhone --> Validate["clean_phone_number()"]
BuildPair --> Validate
Validate --> Valid{"Valid phone?"}
Valid --> |Yes| AddContact["Add to contacts[]"]
Valid --> |No| SkipEntry["Skip entry"]
AddContact --> NextEntry["Next entry"]
SkipEntry --> NextEntry
NextEntry --> Done(["Return contacts[]"])
```

**Diagram sources**
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L54)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L54)

### Phone Number Cleaning and Validation
- Removes separators and non-digit characters except plus sign.
- Normalizes leading zeros and adds country prefix when applicable.
- Validates digit count to ensure realistic phone lengths.
- Used consistently across CSV, Excel, TXT, and manual parsing.

```mermaid
flowchart TD
Start(["Input phone"]) --> Strip["Strip whitespace"]
Strip --> RemoveSep["Remove separators (-\\s()\\.)"]
RemoveSep --> KeepDigits["+ allowed; remove others"]
KeepDigits --> NormalizeZero{"Starts with 0?"}
NormalizeZero --> |Yes| RemoveLeading["Remove leading zero"]
NormalizeZero --> |No| CheckPlus{"Starts with +?"}
CheckPlus --> |No| LongerIntl{"Length > 10?"}
LongerIntl --> |Yes| AddPlus["+ prefix"]
LongerIntl --> |No| KeepNoPlus["Keep as-is"]
CheckPlus --> |Yes| KeepPlus["Keep as-is"]
AddPlus --> DigitsOnly["Extract digits only"]
KeepNoPlus --> DigitsOnly
KeepPlus --> DigitsOnly
DigitsOnly --> LengthCheck{"7 <= digits <= 15?"}
LengthCheck --> |Yes| ReturnClean["Return cleaned number"]
LengthCheck --> |No| ReturnNone["Return None"]
```

**Diagram sources**
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

**Section sources**
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

### Upload Validation and Security Measures
- Electron file import dialog restricts accepted file types for WhatsApp contacts.
- Python backend validates file extensions and rejects unsupported types.
- File uploads are saved temporarily and removed after processing to prevent accumulation.
- Maximum content length enforced to limit upload size.
- Secure filename handling prevents path traversal.

**Section sources**
- [main.js](file://electron/src/electron/main.js#L215-L222)
- [app.py](file://python-backend/app.py#L24-L25)
- [app.py](file://python-backend/app.py#L232-L280)

## Dependency Analysis
The system relies on:
- Python libraries: Flask, pandas, openpyxl, xlrd, werkzeug
- Electron IPC for secure communication between frontend and main process
- Pyodide for running Python code in the browser for manual number parsing

```mermaid
graph TB
Flask["Flask app.py"] --> Pandas["pandas"]
Flask --> Openpyxl["openpyxl"]
Flask --> Xlrd["xlrd"]
Flask --> Werkzeug["werkzeug"]
ElectronMain["Electron main.js"] --> Flask
ElectronPreload["preload.js"] --> ElectronMain
ElectronUI["WhatsAppForm.jsx"] --> ElectronPreload
Pyodide["pyodide.js"] --> ParseManual["parse_manual_numbers.py"]
ElectronUI --> Pyodide
```

**Diagram sources**
- [requirements.txt](file://python-backend/requirements.txt#L1-L7)
- [app.py](file://python-backend/app.py#L1-L11)
- [main.js](file://electron/src/electron/main.js#L1-L11)
- [preload.js](file://electron/src/electron/preload.js#L1-L40)
- [pyodide.js](file://electron/src/utils/pyodide.js#L1-L33)

**Section sources**
- [requirements.txt](file://python-backend/requirements.txt#L1-L7)
- [app.py](file://python-backend/app.py#L1-L11)

## Performance Considerations
- CSV fallback parsing reads files line-by-line, which is memory-efficient for large files.
- Excel parsing uses pandas; for very large Excel files, consider chunked reading or limiting rows.
- Phone number validation runs per row; keep regex patterns minimal and reuse compiled patterns if scaling.
- File uploads are removed after processing to avoid disk pressure.
- Electron-managed CSV/TXT import avoids heavy backend calls for small files processed in the renderer.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Unsupported file type: Ensure file extension is CSV, TXT, XLSX, or XLS. XLSX/XLS are not supported in the Electron-managed import flow.
- Encoding errors: Files should be UTF-8 encoded. The system attempts UTF-8 decoding; non-UTF-8 files may fail.
- Malformed data: Phone numbers must contain 7–15 digits after cleaning. Entries with invalid phone formats are skipped.
- Large files: CSV fallback parsing is designed for streaming; Excel files may require optimization or smaller chunks.
- Column naming: Use keywords like phone, number, mobile, cell, tel for phone columns; name, contact, person for names.

**Section sources**
- [extract_contacts.py](file://python-backend/extract_contacts.py#L25-L81)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L84-L118)
- [extract_contacts.py](file://python-backend/extract_contacts.py#L121-L157)
- [validate_number.py](file://python-backend/validate_number.py#L6-L19)

## Conclusion
The file import and contact extraction system provides a robust, multi-format pipeline with automatic detection and fallback strategies. It supports CSV, Excel, and text files, with keyword-based column detection for phone numbers and names. Phone number cleaning and validation ensure consistent formats, while error handling and security measures protect against malformed inputs and unsupported formats. For large files, streaming and fallback parsing minimize memory usage and improve reliability.