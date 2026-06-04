# CVerify AI Backend Service

Welcome to the CVerify AI Backend Service. This is a high-performance Python microservice built using FastAPI. It is responsible for processing source code repositories, running static analysis, executing clone detection, and orchestrating large language model interactions with Anthropic Claude for developer talent profiling.

## Technology Stack

The AI microservice utilizes a robust set of technologies tailored for asynchronous file operations, AST analysis, and AI orchestration:

* Core Engine: FastAPI using asynchronous routing to handle concurrent stream operations.
* Web Server: Uvicorn ASGI server for local development and production execution.
* AI Orchestration: Anthropic Python SDK to connect with Claude models.
* Caching and Nonces: Redis for distributed state caching and replay-attack protection.
* Document Extraction: MarkItDown for converting PDFs, DOCX files, and images into clean markdown payloads.
* Static Complexity Analysis: Lizard for calculating cyclomatic and cognitive complexity metrics across multi-language Abstract Syntax Trees (AST).
* Clone Detection: DataSketch for near-duplicate code detection via MinHash LSH algorithms.

## Project Structure

The project code is organized into a modular structure:

```
CVerify.AI/
├── app/
│   ├── api/
│   │   └── routes/             # HTTP and SSE endpoint routers
│   ├── core/
│   │   ├── config.py           # Application environment configuration parser
│   │   ├── middleware/         # HMAC request authentication guards
│   │   └── monitoring/         # Observability, structured logs, and UI streaming
│   ├── pipelines/              # Orchestrated workflows (Repository, Candidate, JD matching)
│   │   ├── repository/         # AST complexity analysis and clone detection runs
│   │   ├── candidate/          # Resume validation and candidate profile synthesis
│   │   ├── jd/                 # Job description alignment logic
│   │   └── shared/             # General pipeline runtimes, DAG schedulers, and prompts
│   ├── services/               # Shared domain utilities and Claude integrations
│   └── main.py                 # Application bootstrap and lifespan manager
├── tests/                      # Python automated unit and integration tests
├── .env.example                # Baseline environment configurations template
├── requirements.txt            # Python dependencies manifest
├── bootstrap.ps1               # Environment setup script for Windows PowerShell
└── bootstrap.sh                # Environment setup script for Unix systems
```

## System Responsibilities

The AI microservice handles the following core duties:

1. Repository Analysis: Checks out candidate code, runs static Lizard analysis, parses file contents, and uses datasketch to find near-duplicates or plagiarized blocks.
2. Candidate Assessment: Evaluates candidate CVs against repository analytics to check for claim validity and developer contribution statistics.
3. Job Description Matching: Computes structural matching scores between candidate profiles and job requirements.
4. Token Observability: Structured logging of input and output token consumption per job execution.

## Configuration and Environment Variables

The microservice reads configuration options from a local `.env` file. Copy `.env.example` to `.env` to configure your environment:

```bash
cp .env.example .env
```

The table below outlines the environment keys utilized by the system:

| Environment Key | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| ANTHROPIC_API_KEY | Yes | None | API Key obtained from the Anthropic Console. |
| SHARED_SECRET | Yes | None | Shared secret key used for HMAC signature validation. Must match the CVerify.Core value. |
| CLIENT_ID | No | cverify-core | The identifier for the CVerify backend client. |
| HOST | No | 0.0.0.0 | The host address that the FastAPI application binds to. |
| PORT | No | 8000 | The port that the FastAPI application runs on. |
| REDIS_URL | No | redis://redis:6379/0 | Connection URL for the Redis server. |
| CLAUDE_MODEL | No | claude-haiku-4-5-20251001 | Default Claude model version used for evaluations. |
| BACKEND_API_URL | No | http://cverify-core:8080 | URL pointing to the CVerify.Core backend API gateway. |
| ENABLE_VISION_CERTIFICATE_OCR | No | false | Set to true to utilize Claude Vision as a fallback for image text extraction. |
| CLONE_DETECTION_ENABLED | No | true | Toggles the datasketch MinHash LSH clone-detection module. |
| AI_DEBUG_MODE | No | false | Activates verbose console logging. |
| AI_DEBUG_TOKENS | No | false | Activates token utilization tracking logs. |

## Installation and Setup

Ensure you have the following prerequisites installed on your system:
* Python 3.11
* Redis Server (running on port 6379, or via Docker Compose)
* Tesseract OCR CLI (required for certificate image OCR fallback operations)

### 1. Set Up the Virtual Environment

Navigate to the project root and create a virtual environment:

```bash
cd CVerify.AI
python -m venv .venv
```

Activate the environment:

* Windows (PowerShell):
  ```powershell
  .venv\Scripts\Activate.ps1
  ```
* Windows (CMD):
  ```cmd
  .venv\Scripts\activate.bat
  ```
* Unix / macOS:
  ```bash
  source .venv/bin/activate
  ```

### 2. Install Dependencies

Install all requirements from the manifest file:

```bash
pip install -r requirements.txt
```

### 3. Run the Development Server

Execute Uvicorn in reload mode:

```bash
uvicorn app.main:app --reload
```

The application will bind to `http://localhost:8000` by default. You can inspect the OpenAPI interactive documentation at `http://localhost:8000/docs`.

### 4. Running Automated Tests

Run the unittest discover command:

```bash
python -m unittest discover tests
```

## Security and Authentication

Endpoints are secured using a custom HMAC SHA-256 signature verification handler. The middleware extracts the signature from incoming request headers and validates it against the payload using the `SHARED_SECRET`. Unsigned or incorrectly signed requests are rejected with a 401 Unauthorized response to prevent unauthorized access.

## Troubleshooting

### Redis Connectivity Failures
If you see connection errors on startup, confirm that your Redis service is active and listening on port 6379. If Redis is running on a different port or requires a password, verify that the `REDIS_URL` in your `.env` matches your configuration.

### Anthropic API Key Validation Warning
If the startup logs warn that the Anthropic API key is using a placeholder, verify that `ANTHROPIC_API_KEY` is set correctly in your `.env` file and does not equal the default template value.

### HMAC Authentication Signature Failures
If requests from the CVerify.Core backend fail authentication checks, check that the `SHARED_SECRET` in `CVerify.AI/.env` matches the `AI_SERVICE_SHARED_SECRET` in `CVerify.Core/.env` exactly.
