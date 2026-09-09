# Excel file extraction

## Introduction
This page explains the Excel file contact extraction pipeline powered by pandas integration. It covers how the system detects phone number and name columns in Excel files (.xlsx and.xls), processes pandas DataFrames, handles NaN values and data types, and manages encoding considerations. It also documents fallback mechanisms when pandas encounters corrupted Excel files and provides examples of supported formats, column naming variations, and common issues.

## Project structure
The Excel extraction feature is implemented in two primary locations:
- A standalone CLI script that extracts contacts from CSV, TXT, and Excel files
- A Flask API that accepts uploads, routes to the same extraction logic, and returns structured results

```mermaid
graph TB
subgraph "Python Backend"
EC["extract_contacts.py<br/>CLI extractor"]
APP["app.py<br/>Flask API"]
REQ["requirements.txt<br/>Dependencies"]
VN["validate_number.py<br/>Phone validator"]
end
subgraph "Local Prototypes"
CLIF["cli_functions.py<br/>Excel usage examples"]
BETA["beta_pandas.py<br/>DataFrame usage demo"]
end
EC --> VN
APP --> EC
REQ --> APP
CLIF --> APP
BETA --> APP
```

## Core components
- Phone number cleaning and normalization
  - Removes separators and validates digit count
  - Adds international prefix when applicable
- Column detection algorithm
  - Keyword-based matching for phone and name columns
  - Fallback selection when keywords are absent
- pandas DataFrame processing
  - Reading Excel files with pandas
  - Iterating rows and handling NaN values
- Fallback mechanisms
  - Graceful handling of exceptions during Excel parsing
  - Minimal return when extraction fails

Key implementation references:
- Phone cleaning: `clean_phone_number`
- Excel extraction: `extract_contacts_from_excel`
- Column detection: `keyword matching loop`
- Row iteration and NaN handling: `row processing`

## Architecture overview
The system integrates pandas for Excel parsing and applies a consistent column detection and phone cleaning workflow across formats.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Flask app.py"
participant Extractor as "extract_contacts.py"
participant Pandas as "pandas.read_excel"
participant Cleaner as "clean_phone_number"
Client->>API : "POST /upload with Excel file"
API->>Extractor : "extract_contacts_from_excel(file_path)"
Extractor->>Pandas : "pd.read_excel(file_path)"
Pandas-->>Extractor : "DataFrame"
Extractor->>Extractor : "Detect phone/name columns by keywords"
loop "For each row"
Extractor->>Cleaner : "clean_phone_number(value)"
Cleaner-->>Extractor : "Normalized phone or None"
Extractor->>Extractor : "Handle NaN and build contact dict"
end
Extractor-->>API : "List of contacts"
API-->>Client : "JSON response with contacts"
```

## Detailed component analysis

### Excel column detection algorithm
The algorithm identifies phone and name columns using keyword matching against column names:
- Phone keywords: ["phone", "number", "mobile", "cell", "tel"]
- Name keywords: ["name", "contact", "person"]

Selection logic:
- If any phone column is found, the first match is used
- Otherwise, the first column is used as phone
- If any name column is found, the first match is used
- Otherwise, the second column is used as name (if available)

```mermaid
flowchart TD
Start(["Start"]) --> ReadExcel["Read Excel with pandas"]
ReadExcel --> IterateCols["Iterate columns"]
IterateCols --> CheckPhone{"Keyword contains 'phone'|'number'|'mobile'|'cell'|'tel'?"}
CheckPhone --> |Yes| AddPhone["Add to phone_columns"]
CheckPhone --> |No| CheckName{"Keyword contains 'name'|'contact'|'person'?"}
CheckName --> |Yes| AddName["Add to name_columns"]
CheckName --> |No| NextCol["Next column"]
AddPhone --> NextCol
AddName --> NextCol
NextCol --> DoneCols["Columns collected"]
DoneCols --> SelectPhone{"Any phone columns?"}
SelectPhone --> |Yes| UseFirstPhone["Use first phone column"]
SelectPhone --> |No| UseFirst["Use first column as phone"]
UseFirstPhone --> SelectName{"Any name columns?"}
UseFirst --> SelectName
SelectName --> |Yes| UseFirstName["Use first name column"]
SelectName --> |No| UseSecond{"Has second column?"}
UseFirstName --> BuildRows["Build rows"]
UseSecond --> |Yes| UseSecondCol["Use second column as name"]
UseSecond --> |No| UseNone["Use None as name"]
UseSecondCol --> BuildRows
UseNone --> BuildRows
BuildRows --> End(["End"])
```

### pandas DataFrame processing workflow
- Reading Excel files
  - Uses pandas to load.xlsx and.xls files
  - Internally relies on installed engines (openpyxl for.xlsx, xlrd for.xls)
- Iterating rows
  - Iterates over DataFrame rows to extract values
- Handling NaN values
  - Checks for numeric NaN types and skips invalid entries
- Data type conversion
  - Converts values to string before stripping and cleaning
- Encoding considerations
  - The extraction logic does not enforce encoding; pandas defaults apply

References:
- DataFrame creation: `pd.read_excel`
- Row iteration and NaN checks: `row processing`
- Dependencies for engines: `requirements.txt`

### Automatic phone number and name column identification
- Phone column identification
  - Keywords searched in lowercase column names
  - First matching column is selected; otherwise first column
- Name column identification
  - Keywords searched in lowercase column names
  - First matching column is selected; otherwise second column if available
- Fallback behavior
  - If no columns match, the algorithm falls back to first/second columns

References:
- Keyword matching: `phone and name detection`

### Phone number cleaning and validation
- Removes separators and non-digits except plus sign
- Strips leading zeros when not international
- Adds plus sign for international-like numbers
- Validates digit count to ensure realistic lengths

References:
- Cleaning logic: `clean_phone_number`

### Fallback mechanisms for corrupted excel files
- The Excel extraction function wraps pandas loading in a try-except block
- On failure, the function returns an empty list without raising errors
- This prevents API crashes and allows graceful degradation

References:
- Exception handling: `try-except around pd.read_excel`

### Supported excel formats and column naming variations
- Supported formats
  -.xlsx and.xls are supported via pandas read_excel
  - Engines: openpyxl for.xlsx, xlrd for.xls
- Column naming variations
  - Phone columns: "phone", "number", "mobile", "cell", "tel" (case-insensitive)
  - Name columns: "name", "contact", "person" (case-insensitive)
- Practical examples
  - Column names like "Mobile Number", "Tel", "Contact Person" are recognized
  - If none match, the algorithm uses the first column as phone and second as name (if present)

References:
- Engines: `requirements.txt`
- Keyword matching: `column detection`

### Common issues with excel file processing
- Empty or malformed Excel files
  - pandas may raise errors; the extractor catches and returns empty results
- Missing expected columns
  - The algorithm falls back to first/second columns; ensure data layout aligns with expectations
- Mixed data types
  - Values are coerced to strings before cleaning; ensure phone numbers are readable text or numbers
- Encoding and locale differences
  - The extractor does not enforce encoding; rely on pandas defaults

References:
- Error handling: `exception handling`
- Engine-related errors: `EmptyDataError and KeyError examples`

## Dependency analysis
The Excel extraction depends on pandas and its engines for reading Excel files.

```mermaid
graph TB
EX["extract_contacts.py"] --> PD["pandas"]
EX --> OP["openpyxl"]
EX --> XL["xlrd"]
APP["app.py"] --> EX
REQ["requirements.txt"] --> PD
REQ --> OP
REQ --> XL
```

## Performance considerations
- Large Excel files
  - Reading and iterating rows scales linearly with the number of rows
  - Consider chunking or limiting rows for very large datasets
- Keyword matching
  - Linear scan over columns; negligible overhead compared to IO
- Memory usage
  - Entire DataFrame is loaded into memory; consider streaming alternatives for extremely large files
- Engine choice
  - openpyxl is efficient for.xlsx; xlrd for.xls; ensure correct engine is installed

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Excel file not readable
  - Verify file format and engine installation
  - Confirm that the file is not password-protected or corrupted
- Unexpected empty results
  - Check column names for expected keywords
  - Ensure phone numbers are present and not entirely blank
- Phone number validation failures
  - Confirm the number meets digit count requirements after cleaning
  - Review separator characters and prefixes

References:
- Engine installation: `requirements.txt`
- Validation logic: `clean_phone_number`

## Conclusion
The Excel contact extraction pipeline uses pandas to read.xlsx and.xls files, applies reliable keyword-based column detection, and cleans phone numbers consistently. It gracefully handles exceptions and provides fallback behavior for corrupted or misformatted files. By aligning column names with supported keywords and ensuring proper engine installation, users can reliably extract contacts from Excel spreadsheets.
