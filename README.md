# CVerify - Developer Source Code Verification & Trust Intelligence Platform

Welcome to **CVerify**, an enterprise-grade developer source code verification and trust intelligence platform. CVerify leverages advanced large language models and static analysis to analyze candidate code repositories, evaluate developer contributions, detect plagiarism or AI-generated segments, and synthesize verified CV profiles. It features a responsive React/Next.js frontend and a resilient, high-performance ASP.NET Core backend.

This repository is structured as a monorepo containing:
*   **Frontend (Client Layer)**: [`/client`](client) — Built on Next.js 16 (App Router), React 19, HeroUI v3, Tailwind CSS v4, and Zustand. Employs a strict **feature-driven folder structure** with a modular design.
*   **Backend (Server Layer)**: [`/CVerify.Core`](CVerify.Core) — Built on ASP.NET Core v10, PostgreSQL, Entity Framework Core, Redis, and Claude AI API. Follows Clean Architecture design principles.

---

## Architecture Blueprint

CVerify uses a decoupled architecture with strict separation of concerns, ensuring maximum scalability, security, and developer efficiency.

```mermaid
graph TD
    %% Frontend (Client) Layer
    subgraph Client ["Frontend (Next.js 16 Client)"]
        UI["UI Layer (HeroUI v3 / Tailwind v4)"]
        Forms["Validation (React Hook Form / Zod)"]
        Store["State (Zustand Global Store)"]
        Axios["API client (Axios w/ Interceptors)"]
        Proxy["Security Proxy (Next.js Edge Middleware)"]
    end

    %% Routing / Proxy flow
    Browser["User Browser"] -->|Requests Page| Proxy
    Proxy -->|Decrypts JWT Edge Verification| UI
    UI -->|Uses State & Validates Forms| Forms
    Forms -->|Dispatches Actions| Store
    Store -->|Invokes HTTP calls| Axios

    %% Backend (Server) Layer
    subgraph Server ["Backend (ASP.NET Core v10 Clean Architecture)"]
        API["API Layer (Controllers & SSE endpoints)"]
        App["Application Layer (Services & DTOs)"]
        Infra["Infrastructure Layer (Persistence & Transports)"]
        Core["Core Domain Layer (Entities & Enums)"]
    end

    %% Network communication
    Axios -->|POST / GET (HttpOnly Cookie Auth)| API
    API -->|App Router Injection| App
    App -->|Dependency Injection| Infra
    Infra -->|Saves & Queries| Db[("PostgreSQL Db")]
    Infra -->|Caches API Calls| Redis[("Redis Caching")]
    Infra -->|hosted sweeps & Outbox| BgJobs["Hosted Services"]
    Infra -->|Failover Transport| Email["SMTP / SendGrid"]
    Infra -->|Code Verification & CV Synthesis| Claude["Claude 3.5 Sonnet (CVerify.AI Service)"]
    App -->|Domain Models| Core
```

---

## 🛠️ Full Project Setup Guide

Follow this guide to get both the frontend and backend running locally on your environment within minutes.

### 📋 Prerequisites

Ensure you have the following environments and database servers installed locally:

| Technology | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.x` (LTS recommended) | Frontend runtime environment |
| **.NET SDK** | `10.0.x` | Backend runtime & development SDK |
| **PostgreSQL** | `>= 15.x` | Core transactional database (Source of Truth) |
| **Redis** | `>= 6.x` | Distributed caching, session sharing, and API cost optimization |

---

### 🚀 Step-by-Step Installation

#### Step 1: Clone the Repository
```bash
git clone <your-repository-url>
cd CVerify
```

#### Step 2: Set Up the Database and Redis
Ensure PostgreSQL and Redis servers are running locally on their default ports:
*   **PostgreSQL**: Port `5432`
*   **Redis**: Port `6379`

Create an empty database named `cverify_db` in PostgreSQL:
```sql
CREATE DATABASE cverify_db;
```

#### Step 3: Configure and Run the Backend
1.  Navigate into the backend project root:
    ```bash
    cd CVerify.Core
    ```
2.  Create your local `.env` configuration file by duplicating the provided template:
    ```bash
    cp .env.example .env
    ```
3.  Open the newly created `.env` file and update your PostgreSQL credentials and JWT secret key:
    ```env
    DB_PASSWORD=your_actual_postgres_password
    JWT_KEY=your_secure_32+_character_jwt_secret_key
    ```
4.  Restore dependencies and launch the server:
    ```bash
    dotnet restore
    dotnet run
    ```
    *   *Note: On startup, the EF Core migrations will automatically execute via `DbInitializer.InitializeAsync` to synchronize and seed the PostgreSQL schema.*

#### Step 4: Configure and Run the Frontend
1.  Open a new terminal session and navigate into the frontend directory:
    ```bash
    cd client
    ```
2.  Create your local `.env.local` configuration file from the template:
    ```bash
    cp .env.example .env.local
    ```
3.  Restore Node dependencies:
    ```bash
    npm install
    ```
4.  Start the Next.js development server in Turbopack mode:
    ```bash
    npm run dev
    ```

---

### 🌐 System Ports & URLs

Once up and running, the system components bind to the following default configurations:

| Component | Service Address | Description |
| :--- | :--- | :--- |
| **Next.js Client** | `http://localhost:3000` | User Web Interface |
| **ASP.NET Core API** | `http://localhost:5247` | REST API Backend Port |
| **OpenAPI / Swagger** | `http://localhost:5247/swagger` | API Documentation Sandbox |
| **PostgreSQL DB** | `localhost:5432` | Primary Database Instance |
| **Redis Cache** | `localhost:6379` | Cache and Distributed State |


#### API Base URL Mapping
The frontend connects to the backend REST API by reading the `NEXT_PUBLIC_API_URL` environment variable inside [`client/.env.local`](client/.env.local):
```env
NEXT_PUBLIC_API_URL=http://localhost:5247/api
```

---

### 🔍 Verification Checklist

Verify that the full-stack setup is fully integrated and functioning by checking the following indicators:

1.  **Health Check Endpoint**: Navigate to `http://localhost:5247/health`. You should receive a status `200 OK` indicating the database, Redis cache, and services are healthy.
2.  **API Status Endpoint**: Navigate to `http://localhost:5247/api/system/status`. This will return basic server details and the system clock.
3.  **Swagger UI**: Navigate to `http://localhost:5247/swagger`. Explore the authenticated endpoints and verify that the bearer security scheme is active.
4.  **Frontend Auth Flow**: Open `http://localhost:3000/register`. Create a new Developer account. You should receive a success toast, write the user data to PostgreSQL, and be prompted to verify your email.
5.  **Multi-Tab Sync**: Log in to `http://localhost:3000/login` in one tab, and open another tab at `http://localhost:3000/dashboard`. Logging out in one tab will immediately terminate the session and redirect all open browser tabs to the `/login` screen via Zustand and the `BroadcastChannel` synchronization.

---

## 📖 Sub-Project Documentations

For detailed deep-dives into specialized layers, refer to:
*   📚 **[Frontend Developer Guide](client/README.md)**: Details on Next.js edge proxies, HeroUI styling variables, Zustand stores, state hydration, and the strict zero-duplication folder modularity.
*   📚 **[Backend Developer Guide](CVerify.Core/README.md)**: Details on Clean Architecture layers, outbox patterns, rate limiter rules, MailKit SMTP transport failovers, and EF Core enum mappings.
