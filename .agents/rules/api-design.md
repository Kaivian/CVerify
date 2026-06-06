---
trigger: model_decision
description: Apply when designing, reviewing, implementing, documenting, or modifying REST APIs. Ensure consistent resource naming, HTTP semantics, response contracts, pagination, filtering, validation, versioning, and error handling.
---

# REST API Design Rules

## Core Principles

APIs must be:

- Resource-oriented
- Predictable
- Consistent
- Stateless
- Self-descriptive

Clients should be able to infer API behavior from established REST conventions without consulting implementation details.

---

## Resource Naming

Use nouns, not verbs.

Good:

```http
GET    /users
GET    /users/{id}
POST   /users
PUT    /users/{id}
DELETE /users/{id}
```

Bad:

```http
GET    /getUsers
POST   /createUser
POST   /deleteUser
```

Resources should be plural whenever possible.

Good:

```http
/users
/repositories
/projects
/organizations
```

Bad:

```http
/user
/repository
/project
```

---

## HTTP Methods

Use HTTP methods according to their intended semantics.

### GET

Retrieve data.

```http
GET /users
GET /users/{id}
```

Must not modify state.

---

### POST

Create resources or trigger business operations.

```http
POST /users
POST /repositories/sync
```

---

### PUT

Replace an entire resource.

```http
PUT /users/{id}
```

---

### PATCH

Partially update a resource.

```http
PATCH /users/{id}
```

Preferred over PUT for most user-driven updates.

---

### DELETE

Delete a resource.

```http
DELETE /users/{id}
```

---

## URL Structure

Use hierarchical resource relationships.

Good:

```http
/users/{userId}/repositories
/organizations/{orgId}/members
/projects/{projectId}/issues
```

Bad:

```http
/getRepositoriesForUser
/getProjectIssues
```

URLs should identify resources, not actions.

---

## Query Parameters

Use query parameters for:

- Filtering
- Searching
- Sorting
- Pagination

Examples:

```http
GET /repositories?page=1&pageSize=20
GET /repositories?visibility=public
GET /repositories?search=java
GET /repositories?sort=createdAt
GET /repositories?sort=-createdAt
```

Do not use request bodies with GET requests.

---

## Pagination

Collection endpoints must support pagination.

Example:

```http
GET /repositories?page=1&pageSize=20
```

Response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 250,
  "totalPages": 13
}
```

Large collections must never return all records by default.

---

## Standard Response Format

Successful responses should follow a consistent contract.

Example:

```json
{
  "success": true,
  "data": {}
}
```

Collection example:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "totalItems": 100
  }
}
```

---

## Error Responses

All errors must use a standardized format.

Example:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found."
  }
}
```

Validation example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": {
      "email": [
        "Email is required."
      ]
    }
  }
}
```

Error responses must be machine-readable.

---

## HTTP Status Codes

Use appropriate status codes.

### Success

```http
200 OK
201 Created
202 Accepted
204 No Content
```

### Client Errors

```http
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
```

### Server Errors

```http
500 Internal Server Error
503 Service Unavailable
```

Do not return 200 for failed operations.

---

## Resource Creation

Successful creation should return:

```http
201 Created
```

And include:

```http
Location: /users/123
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "123"
  }
}
```

---

## Idempotency

The following operations should be idempotent:

```http
GET
PUT
DELETE
```

Calling them multiple times should produce the same result.

Critical POST operations should support idempotency when duplicate requests are possible.

Examples:

- Payment processing
- Email sending
- Verification requests

---

## Validation

Validate all external input.

Validation should occur:

- At API boundaries
- Before business logic execution

Never trust client-provided data.

Return detailed validation errors whenever possible.

---

## Authentication

Authentication must be enforced at the API layer.

Examples:

```http
Authorization: Bearer <token>
```

Never accept user identity from:

```json
{
  "userId": "123"
}
```

when the authenticated user context already exists.

User identity should be derived from the authenticated principal.

---

## Authorization

Every protected resource must verify permissions.

Do not rely on frontend authorization.

Examples:

- Ownership checks
- Role checks
- Scope checks
- Resource access checks

---

## API Versioning

Public APIs should be versioned.

Example:

```http
/api/v1/users
/api/v1/repositories
```

Avoid breaking changes within an existing version.

Introduce a new version when contracts change.

---

## Sorting

Sorting should be explicit.

Examples:

```http
GET /repositories?sort=name
GET /repositories?sort=-createdAt
```

Use:

```text
sort=field
sort=-field
```

for ascending and descending order.

---

## Search

Search endpoints should remain resource-oriented.

Good:

```http
GET /repositories?search=java
```

Bad:

```http
POST /searchRepositories
```

---

## Consistency Rules

Use the same conventions across the entire API.

Examples:

- Consistent naming
- Consistent response contracts
- Consistent pagination
- Consistent error structures
- Consistent status code usage

The same operation should behave the same way across all resources.

---

## Documentation Requirements

Every endpoint should document:

- Purpose
- Authentication requirements
- Request parameters
- Request body
- Response schema
- Error responses
- Example requests
- Example responses

APIs should be understandable without reading source code.

---

## AI-Specific Requirements

When generating or modifying APIs:

- Follow existing API conventions before introducing new patterns.
- Prefer consistency over personal preference.
- Reuse existing response contracts.
- Reuse existing pagination structures.
- Reuse existing error formats.
- Avoid introducing breaking changes without explicit approval.
- Design APIs from the consumer perspective, not the implementation perspective.

If an endpoint does not clearly map to a resource, challenge the design and propose a more RESTful resource-oriented alternative before implementation.