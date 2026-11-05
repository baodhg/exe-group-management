# EXE Group Management System

PRN232 – Building Cross-Platform Back-End Application with .NET · Final Assignment

## 1. Project description

Students in EXE (Experiential Entrepreneurship) subjects such as EXE101 work in project groups of four to six members
from at least two majors. Today the groups form across chat groups and spreadsheets, so the staff find students
without a group, groups that miss a major and late changes only at the end.

The EXE Group Management System runs the process described in the lecturer's feedback (design v3.2):

- The **Admin** (academic staff, role `Administrator`) prepares semesters, subjects, majors, skills and group types,
  creates courses (subject + class + semester), imports the students with their major, generates the rooms of a
  course (`ceil(students / MaxGroupSize × k)`, k = 1.2) and publishes them.
- **Students** rate their strengths (1–5), browse rooms or ask for suggestions, join open rooms or apply to locked
  ones. The first member leads the room: sets the topic, locks it, approves applications and may remove members.
- At the **deadline** (`ExpireAt`, enforced by a background job) the rooms freeze; the Admin places the remaining
  students with suggestions and **finalizes** numbered, read-only official groups.
- **Lecturers** follow their own classes read-only; every room has its own **chat**, and everyone gets in-app
  **notifications**.

The full design is in [`docs/PRN232_v3.pdf`](docs/PRN232_v3.pdf) / [`docs/PRN232_v3.docx`](docs/PRN232_v3.docx):
business rules, REST API list, events, jobs, gRPC contract and physical databases. The DDL is
[`database/schema.sql`](database/schema.sql). The assignment brief and the two labs the team builds on are in
[`docs/`](docs/).

## 2. System architecture

Microservices documented with the C4 model. Level 1 and Level 2 below are generated from
[`docs/diagrams`](docs/diagrams); components, the deployment views and two dynamic views are modelled as code in
[`docs/architecture/workspace.dsl`](docs/architecture/workspace.dsl).

| Level 1 – System Context | Level 2 – Container |
|---|---|
| ![System Context](docs/diagrams/fig1_c4_l1_context.png) | ![Container](docs/diagrams/fig2_c4_l2_container.png) |

Render the DSL views (components marked [Planned] are designed but not implemented yet):
`docker run --rm -v "$PWD/docs/architecture:/usr/local/structurizr" structurizr/structurizr export -workspace /usr/local/structurizr/workspace.dsl -format plantuml/c4plantuml -output /usr/local/structurizr/diagrams`, then render with `plantuml/plantuml -tpng`.

| Container | Technology | Responsibility |
|---|---|---|
| Single-Page App | React 19, TypeScript, Vite, served by nginx | UI for all roles; nginx forwards `/api`, `/hubs` and `/swagger` to the gateway (same origin, no CORS) |
| API Gateway | ASP.NET Core 10 + YARP 2.3 | Single entry point, JWT check at the edge, path routing, WebSocket pass-through, merged Swagger UI, sign-in rate limit |
| Identity Service | ASP.NET Core 10 Web API | Sign-in, JWT access and refresh tokens, users, roles |
| Group Service | ASP.NET Core 10 Web API | Semesters, subjects, majors, skills, group types, courses, rosters, rooms, memberships, applications, finalize; outbox, phase scheduler and cleanup jobs |
| Recommendation Service | ASP.NET Core 10 gRPC (HTTP/2 only, 8081) | Ranks rooms for a student and placements for students without a room; stateless, no database |
| Realtime Service | ASP.NET Core 10 Web API + SignalR | Group chat and notifications; consumes the group events |
| IdentityDb / GroupDb / ChatDb | SQL Server 2022 (EF Core 10) | One database per service |
| Group Events | Redis 7 Stream `group-events` | Course phases, room members, leaders and applications, from Group Service to Realtime Service |

How the services talk to each other:

- **REST:** browser → web (nginx) → gateway → services. Every route is versioned (`/api/v1/...`) and every response,
  including errors, uses one envelope:
  `{ "success", "message", "data", "errors": [{ "code", "field", "message" }], "traceId", "pagination" }`.
- **gRPC:** Group Service → Recommendation Service: `SuggestRooms` and `SuggestPlacements`, 2 s deadline, unranked
  fallback. Contract: `recommendation.proto` in `src/Contracts/ExeGroup.Contracts` (design section 6.7).
- **Redis Streams:** Group Service publishes through a Transactional Outbox (`OutboxEvents`). Realtime Service reads
  with `XREADGROUP` (consumer group `realtime`), acknowledges with `XACK` after commit, re-claims stuck messages with
  `XAUTOCLAIM` and skips duplicates through `ProcessedEvents`.
- **Applications:** join requests live in GroupDb next to the rooms, so `POST /api/v1/join-requests/{id}/approve`
  checks the seat and the majors and adds the member in one transaction.
- **Real time:** the browser keeps a SignalR connection to `/hubs/realtime` (through nginx and the gateway) for chat
  messages, notifications and room changes.
- **Tracing:** the gateway assigns an `X-Correlation-ID`; it travels through HTTP headers, gRPC metadata and the event
  envelope, appears in every log line and comes back as `traceId` in every response.

## 3. Technology stack

| Area | Technology |
|---|---|
| Runtime | .NET 10 (SDK pinned in `global.json`), C# latest, nullable enabled, warnings as errors |
| Backend | ASP.NET Core 10, three projects per service: API → Services → Repositories (enforced by architecture tests) |
| Data | Entity Framework Core 10, SQL Server 2022, code-first migrations (`scripts/ef`) matching `database/schema.sql` |
| Gateway | YARP 2.3 |
| Sync communication | gRPC (Grpc.AspNetCore / Grpc.Net.ClientFactory 2.85, Protobuf over HTTP/2): Group → Recommendation |
| Messaging | Redis 7 Streams (StackExchange.Redis 3.x), transactional outbox, idempotent consumer |
| Real time | ASP.NET Core SignalR: chat, notifications, live room board |
| Background jobs | `BackgroundService` + `PeriodicTimer` through a shared `PeriodicBackgroundService` base |
| Security | JWT Bearer HS256 (key ≥ 32 bytes, validated at start-up), refresh tokens, ASP.NET Core `PasswordHasher` |
| API surface | URL versioning (Asp.Versioning 10), JSON and XML (406 for anything else), DataAnnotations + FluentValidation |
| API docs | Swashbuckle 10 (OpenAPI), one document per service, merged Swagger UI with Authorize button at the gateway |
| Logging | Serilog with correlation id; custom request-logging and exception middleware |
| Frontend | React 19, TypeScript 7, Vite 8, React Router 7, TanStack Query 5, Vitest, oxlint, nginx |
| Tests | xUnit v3 on Microsoft.Testing.Platform, Testcontainers (real SQL Server), NetArchTest |
| Deployment | Docker, Docker Compose (8 containers), GitHub Actions CI |

## 4. Installation guide

### Prerequisites

- Docker Desktop (with Docker Compose v2)
- .NET 10 SDK and Node.js 22 – only for running or testing outside Docker
- Git

### Repository layout

```text
src/
  BuildingBlocks/        shared envelope, errors, paging, JWT, Swagger, health, jobs (ExeGroup.BuildingBlocks[.Web])
  Contracts/             recommendation.proto (gRPC Group → Recommendation, client + server code)
  ApiGateway/            YARP gateway (REST routes and the SignalR hub)
  IdentityService/       ExeGroup.Identity.API / .Services / .Repositories         (IdentityDb)
  GroupService/          ExeGroup.Group.API / .Services / .Repositories            (GroupDb, outbox → Redis)
  RecommendationService/ ExeGroup.Recommendation.API / .Services / .Repositories   (gRPC :8081, no database)
  RealtimeService/       ExeGroup.Realtime.API / .Services / .Repositories         (ChatDb, SignalR /hubs/realtime)
  web/                   React single-page app + nginx.conf
tests/                   architecture, building-block, gateway and integration tests
docker/                  shared Dockerfile for the .NET services
database/schema.sql      reference DDL (EF Core migrations are the runtime source of truth)
docs/                    brief, labs, design document, diagrams, C4 workspace
scripts/                 ef.sh / ef.ps1 (migrations), dev-token.mjs (test tokens)
```

### Steps

1. Clone the repository and open the root folder.
2. Copy `.env.example` to `.env` and set the secrets (never commit `.env`):

   ```env
   SA_PASSWORD=<strong SQL Server password>
   JWT_SIGNING_KEY=<output of: openssl rand -base64 48>
   JWT_ISSUER=exe-group-system
   JWT_AUDIENCE=exe-group-clients
   SEED_ADMIN_EMAIL=<e-mail of the first Administrator>
   SEED_ADMIN_PASSWORD=<initial password>
   SQL_HOST_PORT=14330
   REDIS_HOST_PORT=16379
   GATEWAY_HOST_PORT=8080
   WEB_HOST_PORT=3000
   ```

   Change a `*_HOST_PORT` if that port is already used on your machine (for example a local SQL Server on 1433).
3. Build and start everything:

   ```bash
   docker compose up -d --build
   ```

4. Wait until the containers are healthy (`docker compose ps`). Each service applies its EF Core migrations at
   start-up in Development; `/health/ready` stays `503` until that has finished, and the gateway starts only after the
   Identity, Group and Realtime services are ready.
5. Open the apps:
   - Web app: <http://localhost:3000>
   - Swagger UI (Identity, Group and Realtime; Recommendation speaks gRPC only): <http://localhost:8080/swagger>
6. For a test token while sign-in is being built: `node scripts/dev-token.mjs Administrator` and paste it into the
   Swagger **Authorize** dialog.

Run the tests (Docker must be running for the SQL Server containers):

```bash
dotnet tool restore
dotnet test --solution ExeGroup.sln
cd src/web && npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

## 5. Deployment instructions

| Service | Image / build | Ports | Depends on (healthy) |
|---|---|---|---|
| web | `src/web/Dockerfile` (node:22 build → nginx:1.27-alpine) | `${WEB_HOST_PORT:-3000}` → 80 | gateway |
| gateway | `docker/dotnet-service.Dockerfile` (`ExeGroup.ApiGateway`) | `${GATEWAY_HOST_PORT:-8080}` → 8080 | identity, group, realtime |
| identity-service | `docker/dotnet-service.Dockerfile` | internal 8080 | sqlserver |
| group-service | `docker/dotnet-service.Dockerfile` | internal 8080 | sqlserver, redis |
| recommendation-service | `docker/dotnet-service.Dockerfile` | internal 8080 (health), 8081 (gRPC, HTTP/2 only) | – |
| realtime-service | `docker/dotnet-service.Dockerfile` | internal 8080 (REST and SignalR) | sqlserver, redis |
| sqlserver | `mcr.microsoft.com/mssql/server:2022-latest` | internal 1433 (host `${SQL_HOST_PORT:-14330}` in development) | – |
| redis | `redis:7-alpine` (`appendonly yes`) | internal 6379 (host `${REDIS_HOST_PORT:-16379}` in development) | – |

Notes:

- `docker-compose.yml` is the only file a developer needs. SQL Server and Redis publish their ports on `127.0.0.1` so `dotnet run`
  and database tools can reach them.
- The gateway checks the JWT for every route except `/api/v1/auth/login`, `/api/v1/auth/refresh-token`, `/api/v1/auth/logout`, `/swagger/**`,
  `/health/**` and `/hubs/**`; each service checks it again and applies the business permissions. The hub is passed through
  because a browser cannot add the header to a WebSocket: the Realtime Service authenticates the connection itself.
- Only the Group Service calls the Recommendation Service (gRPC on 8081, inside the network); the gateway never routes to it.
- Configuration comes from `appsettings.json`, overridden by environment variables such as
  `ConnectionStrings__GroupDb`, `ConnectionStrings__ChatDb`, `Jwt__SigningKey`, `Redis__Connection`, `Ports__Grpc`.
- Health checks: `/health/live` and `/health/ready` on every service (ready = own database, Redis where used, and
  migrations applied; the Recommendation Service has no database and is ready once started).
- Logs: `docker compose logs -f group-service realtime-service`; follow one request with its correlation id:
  `docker compose logs | grep <traceId>`.
- gRPC from inside the network (reflection is on in Development):
  `docker run --rm --network exe-group_default fullstorydev/grpcurl -plaintext recommendation-service:8081 list`.
- Stream inspection: `docker compose exec redis redis-cli XRANGE group-events - +` and
  `docker compose exec redis redis-cli XINFO GROUPS group-events`.

### Demo on the shared server

Merging into `main` redeploys the demo at `https://exe.qizhub.com`. After `ci` turns green on `main`, the `deploy-demo`
workflow asks the server to deploy that commit. The server builds it, runs the smoke checks and returns to the last good
version if anything fails. Follow it in the **Actions** tab; a failed deployment never blocks pull requests.

- `deploy/docker-compose.demo.yml` is an overlay on `docker-compose.yml`: project `exe-group-demo`, Production, migrations on
  start-up, no host ports, memory and CPU limits. `node scripts/check-demo-compose.mjs` verifies this in CI.
- Traffic goes through Cloudflare and the server's reverse proxy to the `web` container, the only container on the shared
  network.
- The deploy key can only run `scripts/demo-deploy-entry.sh` for a commit that is on `main`. It lives in the `demo`
  GitHub environment, which only `main` can use, so pull requests cannot read it.
- Secrets stay in `demo.env` on the server (`SA_PASSWORD`, `JWT_SIGNING_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`,
  `ASPNETCORE_ENVIRONMENT=Production`), never in the repository. Do not store real student data on this demo.
- Each successful deployment keeps the running and the last good images, and removes build cache unused for 7 days.
- The server hosts other projects: never run `docker system prune` or `docker compose down -v` there.

### Merging into main

`main` accepts pull requests only and nobody can skip the rules, administrators included. A pull request merges when
`dotnet`, `web`, `docker`, `architecture`, `conventions` and `infra-guard` are green on a branch that is up to date with
`main`. No review is required, except that `infra-guard` asks the project manager to approve member changes outside the
areas listed in `.github/member-paths.txt`. See `CONTRIBUTING.md` for what each check verifies.

## 6. Demo script (end-to-end)

| Step | Action | What it demonstrates |
|---|---|---|
| 1 | `docker compose ps` – all containers healthy; show the C4 diagrams and the merged Swagger UI | Docker deployment, system architecture, API documentation |
| 2 | Admin signs in, creates semester FA26, subject EXE101, majors, skills and a group type (at least 1 SE, 1 MKT and 2 majors), then course EXE101 – SE1919 with its lecturer, and imports the students | REST API, JWT, CRUD, validation, versioning |
| 3 | Admin generates the rooms (`ceil(n / 6 × 1.2)`) and publishes the course | Business rules, outbox events |
| 4 | Students rate their skills; student A joins Room 01, becomes its leader, sets the topic and locks the room | REST, notifications over SignalR |
| 5 | Student B lists the rooms (`search`, `sort`, `page`) and opens the suggested rooms, ranked with reasons | REST → gRPC (Recommendation Service) |
| 6 | B applies to Room 01 and A approves in one transaction; B's other applications are cancelled; both get a notification. Show `XRANGE group-events - +` and the logs with one correlation id | Message publishing and consuming, tracing |
| 7 | The members chat in the room | SignalR, Realtime Service |
| 8 | Set `ExpireAt` one or two minutes ahead and wait: PhaseScheduler expires the course and rejects the pending applications (`GROUPING_EXPIRED`) | Background job, events |
| 9 | Admin opens the course overview, places the remaining students with the placement suggestions and finalizes; the lecturer sees the official groups | gRPC, business rules, authorization |

## 7. Team members & responsibilities

| No. | Full name | Student ID | Responsibilities |
|---|---|---|---|
| 1 | _Member 1 (PM)_ | _SExxxxxx_ | Project management and platform: architecture and standards, building blocks, API Gateway, Docker Compose, CI, web app shell, Recommendation Service (gRPC), design documents, README, seed data and demo script |
| 2 | _Member 2_ | _SExxxxxx_ | Identity Service (sign-in, JWT, refresh tokens, users, roles, student import) and the room actions of Group Service: join, leave, lock, applications, approve and reject, remove members, leadership |
| 3 | _Member 3_ | _SExxxxxx_ | Group Service academic data and course life cycle: subjects, majors, skills, group types, courses and rosters, room generation, publish and expire, placements, finalize, lecturer view |
| 4 | _Member 4_ | _SExxxxxx_ | Transactional Outbox and Redis Streams, Realtime Service (SignalR chat, notifications, event consumer), background jobs |
| 5 | _Member 5_ | _SExxxxxx_ | React screens for all roles on the shared web app shell |

How to contribute: [`CONTRIBUTING.md`](CONTRIBUTING.md) (Vietnamese) – structure, rules, the step-by-step guide to
add an endpoint following the `Semesters` reference implementation, tests, branches and pull requests.
