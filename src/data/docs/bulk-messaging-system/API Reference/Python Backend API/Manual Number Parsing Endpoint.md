# Manual Number Parsing Endpoint

<cite>
**Referenced Files in This Document**
- [app.py](file://python-backend/app.py)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx)
- [pyodide.js](file://electron/src/utils/pyodide.js)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Endpoint Overview](#endpoint-overview)
3. [Request Format](#request-format)
4. [Parsing Algorithm](#parsing-algorithm)
5. [Response Schema](#response-schema)
6. [Supported Input Formats](#supported-input-formats)
7. [Validation Rules](#validation-rules)
8. [Edge Cases](#edge-cases)
9. [Error Handling](#error-handling)
10. [Integration Details](#integration-details)
11. [Practical Examples](#practical-examples)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Conclusion](#conclusion)

## Introduction

The `/parse-manual-numbers` endpoint is a core component of the Bulk Messaging System designed to process manually entered phone numbers from users. This endpoint enables users to quickly add contacts by pasting phone numbers directly into the application, supporting various input formats and automatic validation.

The endpoint serves as a bridge between the Electron frontend and Python backend, utilizing Pyodide to execute Python code directly in the browser environment. This allows for immediate processing of phone numbers without requiring a separate server connection.

## Endpoint Overview

The `/parse-manual-numbers` endpoint is implemented as a Flask route that accepts POST requests containing JSON-formatted phone number data. The endpoint is specifically designed for manual number entry scenarios where users paste phone numbers directly into the application interface.

Key characteristics:
- **HTTP Method**: POST
- **Endpoint**: `/parse-manual-numbers`
- **Content-Type**: application/json
- **Processing Engine**: Python backend via Pyodide
- **Primary Use Case**: Manual contact entry in the WhatsApp messaging interface

**Section sources**
- [app.py](file://python-backend/app.py#L282-L341)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L41-L62)

## Request Format

The endpoint expects a JSON payload with a single required field:

### Request Body Structure
```json
{
  "numbers": "string"
}
```

### Field Specifications
- **numbers** (required): String containing one or more phone numbers
  - Can contain multiple numbers separated by newlines, commas, or semicolons
  - Each line can optionally contain a name prefix separated by colon, hyphen, or pipe
  - Supports mixed formatting within the same input string

### Example Request
```json
{
  "numbers": "+1234567890\nJohn Doe: +0987654321\n+1111222333 - Jane Smith"
}
```

**Section sources**
- [app.py](file://python-backend/app.py#L283-L291)

## Parsing Algorithm

The parsing algorithm follows a multi-stage process to extract and validate phone numbers from the input string:

### Stage 1: Input Segmentation
The algorithm first splits the input string using multiple delimiters:
- Newline characters (`\n`)
- Commas (`,`)
- Semicolons (`;`)

This allows users to paste numbers in various formats without worrying about separator consistency.

### Stage 2: Line Processing
Each resulting segment undergoes individual processing:
- Strips whitespace from both ends
- Skips empty lines
- Processes each non-empty line separately

### Stage 3: Name-Number Extraction
For each line, the algorithm attempts to separate name and number components:

#### Format Detection Logic
1. **Colon Separation**: `"Name: Number"` or `"Name : Number"`
2. **Hyphen Separation**: `"Name - Number"` or `"Name - Number"`
3. **Pipe Separation**: `"Name | Number"`
4. **Single Number**: Just a phone number without name

#### Intelligent Assignment
The algorithm uses pattern matching to determine which part contains the phone number:
- Searches for patterns matching phone number format (7+ digits, allowing parentheses, hyphens, spaces)
- Assigns the phone number portion to the validated phone number field
- Assigns the remaining portion as the contact name
- Falls back to treating the entire line as a phone number if no clear separator is detected

### Stage 4: Number Cleaning and Validation
Each extracted phone number undergoes cleaning and validation:
- Removes all non-digit characters except plus signs
- Validates length constraints (minimum 7, maximum 15 digits)
- Adds country code prefix if missing and applicable
- Handles leading zero removal for international formats

### Stage 5: Contact Assembly
Validated contacts are assembled into the final response array with automatic naming for unnamed contacts.

**Section sources**
- [app.py](file://python-backend/app.py#L294-L328)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L22-L54)

## Response Schema

The endpoint returns a standardized JSON response containing the processed contacts and metadata:

### Response Structure
```json
{
  "success": boolean,
  "contacts": [
    {
      "number": "string",
      "name": "string"
    }
  ],
  "count": integer,
  "message": "string"
}
```

### Field Descriptions
- **success** (boolean): Indicates whether the parsing operation completed successfully
- **contacts** (array): Array of contact objects with number and name properties
- **count** (integer): Total number of valid contacts found
- **message** (string): Human-readable status message describing the operation outcome

### Example Response
```json
{
  "success": true,
  "contacts": [
    {
      "number": "+1234567890",
      "name": "Contact 1"
    },
    {
      "number": "+0987654321",
      "name": "John Doe"
    }
  ],
  "count": 2,
  "message": "Successfully parsed 2 contacts"
}
```

**Section sources**
- [app.py](file://python-backend/app.py#L330-L337)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L49-L54)

## Supported Input Formats

The endpoint supports a wide variety of input formats to accommodate different user preferences and data sources:

### Basic Phone Number Formats
- International format: `+1234567890`
- US format: `123-456-7890`
- Dot notation: `123.456.7890`
- Space-separated: `123 456 7890`
- Parentheses: `(123) 456-7890`
- Mixed separators: `123-456.7890`

### Name-Number Combination Formats
- Colon-separated: `John Doe: +1234567890`
- Hyphen-separated: `Jane Smith - +0987654321`
- Pipe-separated: `Bob Johnson | +1111222333`
- Space-separated: `Alice Brown +2222333444`

### Multi-line Input
- Newline-separated: 
  ```
  +1234567890
  +0987654321
  +1111222333
  ```

### Mixed Format Input
- Combined formats in single input:
  ```
  John Doe: +1234567890
  +0987654321 - Jane Smith
  +1111222333
  ```

**Section sources**
- [app.py](file://python-backend/app.py#L294-L328)
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L319-L326)

## Validation Rules

The endpoint applies strict validation rules to ensure data quality and consistency:

### Phone Number Validation
- **Length Constraints**: Minimum 7 digits, maximum 15 digits
- **Format Requirements**: Must contain at least 7 digits (allowing separators)
- **International Format**: Automatically adds plus sign prefix when missing
- **Leading Zero Handling**: Removes leading zeros for international numbers
- **Character Filtering**: Removes all non-digit characters except plus signs

### Input Validation
- **Required Fields**: The `numbers` field is mandatory
- **Empty Input**: Empty or whitespace-only input returns an error
- **Line Processing**: Ignores empty lines and whitespace-only lines
- **Separator Flexibility**: Accepts multiple separator types interchangeably

### Error Scenarios
- Missing `numbers` field: Returns 400 Bad Request
- Malformed JSON: Returns 400 Bad Request
- Processing exceptions: Returns 500 Internal Server Error

**Section sources**
- [app.py](file://python-backend/app.py#L286-L289)
- [app.py](file://python-backend/app.py#L339-L340)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L16-L18)

## Edge Cases

The endpoint handles several edge cases gracefully:

### Empty and Whitespace Input
- Completely empty input returns an error
- Lines with only whitespace are ignored
- Leading/trailing whitespace is automatically stripped

### Ambiguous Separator Detection
- When both name and number parts look like phone numbers, the algorithm prioritizes the part that appears later in the line
- If neither part clearly contains a phone number, the entire line is treated as a phone number

### Invalid Phone Numbers
- Numbers shorter than 7 digits are rejected
- Numbers longer than 15 digits are rejected
- Numbers without any digits are rejected
- Numbers with invalid character sequences are rejected

### Duplicate Processing
- The endpoint does not deduplicate contacts; duplicates are preserved as entered
- Automatic naming assigns sequential numbers to unnamed contacts

### Special Characters
- Parentheses, hyphens, periods, and spaces are removed during cleaning
- Plus signs are preserved for international numbers
- Unicode whitespace characters are handled appropriately

**Section sources**
- [app.py](file://python-backend/app.py#L297-L328)
- [parse_manual_numbers.py](file://python-backend/parse_manual_numbers.py#L25-L48)

## Error Handling

The endpoint implements comprehensive error handling:

### Client-Side Errors (400 Bad Request)
- Missing `numbers` field in request body
- Empty or invalid JSON payload
- Malformed request format

### Server-Side Errors (500 Internal Server Error)
- Unexpected exceptions during processing
- Python runtime errors in the parsing algorithm
- Memory allocation failures for large inputs

### Error Response Format
```json
{
  "error": "string"
}
```

### Error Recovery
- All errors return appropriate HTTP status codes
- Error messages provide context for debugging
- The application continues operating after error handling

**Section sources**
- [app.py](file://python-backend/app.py#L288-L289)
- [app.py](file://python-backend/app.py#L339-L340)

## Integration Details

The endpoint integrates seamlessly with the Electron frontend through Pyodide:

### Frontend Integration
The Electron application loads the Python parsing script dynamically and executes it in the browser using Pyodide. The integration occurs in the WhatsApp messaging interface where users can add contacts manually.

### Data Flow
1. User enters phone numbers in the manual input field
2. Frontend validates input and prepares JSON payload
3. Pyodide loads the Python parsing script
4. Python code processes the input and returns structured results
5. Frontend updates the contact list with parsed results

### Performance Considerations
- Python code runs entirely in the browser using Pyodide
- No network requests required for parsing
- Processing time scales linearly with input size
- Memory usage is proportional to number of contacts

**Section sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L41-L62)
- [pyodide.js](file://electron/src/utils/pyodide.js#L26-L33)

## Practical Examples

### Example 1: Basic Phone Numbers
**Input:**
```
+1234567890
123-456-7890
123.456.7890
```

**Output:**
```json
{
  "success": true,
  "contacts": [
    {"number": "+1234567890", "name": "Contact 1"},
    {"number": "+1234567890", "name": "Contact 2"},
    {"number": "+1234567890", "name": "Contact 3"}
  ],
  "count": 3,
  "message": "Successfully parsed 3 contacts"
}
```

### Example 2: Name-Number Pairs
**Input:**
```
John Doe: +1234567890
Jane Smith - +0987654321
Bob Johnson | +1111222333
```

**Output:**
```json
{
  "success": true,
  "contacts": [
    {"number": "+1234567890", "name": "John Doe"},
    {"number": "+0987654321", "name": "Jane Smith"},
    {"number": "+1111222333", "name": "Bob Johnson"}
  ],
  "count": 3,
  "message": "Successfully parsed 3 contacts"
}
```

### Example 3: Mixed Format Input
**Input:**
```
+1234567890
Alice Brown: +2222333444
+3333444555 - Charlie Davis
```

**Output:**
```json
{
  "success": true,
  "contacts": [
    {"number": "+1234567890", "name": "Contact 1"},
    {"number": "+2222333444", "name": "Alice Brown"},
    {"number": "+3333444555", "name": "Charlie Davis"}
  ],
  "count": 3,
  "message": "Successfully parsed 3 contacts"
}
```

**Section sources**
- [WhatsAppForm.jsx](file://electron/src/components/WhatsAppForm.jsx#L319-L331)

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Numbers not being recognized
**Symptoms**: Empty response or minimal contacts
**Causes**:
- Numbers shorter than 7 digits
- Numbers without any digits
- Invalid separators
- Leading/trailing whitespace

**Solutions**:
- Ensure numbers contain at least 7 digits
- Use standard phone number formats
- Remove extra whitespace
- Use supported separators (colon, hyphen, pipe)

#### Issue: Names not extracted correctly
**Symptoms**: Contacts show as "Contact 1", "Contact 2"
**Causes**:
- Missing name prefixes
- Unsupported separator characters
- Ambiguous format detection

**Solutions**:
- Use colon (:), hyphen (-), or pipe (|) separators
- Place name before the separator
- Ensure phone numbers contain sufficient digits

#### Issue: Processing errors
**Symptoms**: HTTP 500 errors or blank responses
**Causes**:
- Extremely large input files
- Memory limitations
- Python runtime errors

**Solutions**:
- Break large inputs into smaller chunks
- Check browser console for error details
- Verify input format consistency

### Debugging Tips
- Test with simple inputs first (single number)
- Gradually increase complexity (add names, multiple numbers)
- Use the browser developer tools to inspect network requests
- Check the console for Python traceback information

**Section sources**
- [app.py](file://python-backend/app.py#L339-L340)
- [README.md](file://README.md#L412-L447)

## Conclusion

The `/parse-manual-numbers` endpoint provides a robust solution for processing manually entered phone numbers in the Bulk Messaging System. Its flexible parsing algorithm accommodates various input formats while maintaining strict validation standards to ensure data quality.

The endpoint's integration with Pyodide enables seamless browser-side processing without requiring server connectivity, making it highly responsive and reliable. The comprehensive error handling and extensive support for different input formats make it suitable for diverse user scenarios.

Key benefits include:
- **Flexibility**: Supports multiple input formats and separators
- **Validation**: Strict quality checks prevent invalid data entry
- **Integration**: Seamless browser-side execution via Pyodide
- **Scalability**: Handles various input sizes efficiently
- **User Experience**: Immediate feedback and error reporting

This endpoint serves as a crucial component in the overall contact management workflow, enabling users to quickly add contacts through intuitive manual entry while maintaining data integrity and system reliability.