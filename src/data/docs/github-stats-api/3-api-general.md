# API endpoints: general

Endpoints for accessing API documentation and interactive exploration.

---

## 1. custom documentation

Provides the custom HTML documentation page for the API.

- **Endpoint**: `GET /`
- **Description**: Returns the main dashboard and integrated documentation page.

### Example request

```bash
curl -X GET https://github-stats.tashif.codes/
```

### Response

Returns an `HTML` response containing the dashboard UI.

---

## 2. swagger UI

Interactive API exploration and testing.

- **Endpoint**: `GET /docs`
- **Description**: Provides a Swagger UI interface to explore endpoints, view models, and test API calls directly in the browser.

---

## 3. ReDoc

Alternative API documentation view.

- **Endpoint**: `GET /redoc`
- **Description**: Offers a clean, three-panel view of the API specification, ideal for reading and understanding the API structure.
