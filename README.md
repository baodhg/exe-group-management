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

Render the DSL views (on Git Bash for Windows, prefix the command with `MSYS_NO_PATHCONV=1`):
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
- **Course watchers:** Realtime forwards the caller's access token to Group's course endpoint before subscribing to
  room changes. `GroupService__Address` defaults to `http://group-service:8080/`; the local Realtime launch profile
  uses `http://localhost:5102/`. If access cannot be verified, the subscription is refused.
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
| Background jobs | `BackgroundService` + `PeriodicTimer` through a shared `PeriodicBackgroundService` base: OutboxPublisher (2 s), PhaseScheduler (1 min), OutboxCleanup and ProcessedEventsCleanup (daily), GroupEventsConsumer (continuous) |
| Security | JWT Bearer HS256 (key ≥ 32 bytes, validated at start-up), rotating refresh tokens (reuse revokes the family), PBKDF2-SHA256 password hashes, sign-in rate limit at the gateway |
| API surface | URL versioning (Asp.Versioning 10), JSON and XML (406 for anything else), DataAnnotations + FluentValidation |
| API docs | Swashbuckle 10 (OpenAPI), one document per service, merged Swagger UI with Authorize button at the gateway |
| Logging | Serilog with correlation id; custom request-logging and exception middleware |
| Frontend | React 19, TypeScript 7, Vite 8, React Router 7, TanStack Query 5, `@microsoft/signalr`, Vitest, oxlint, nginx |
| Tests | xUnit v3 on Microsoft.Testing.Platform, Testcontainers (real SQL Server and Redis), NetArchTest; `scripts/smoke-e2e.mjs` for the whole stack |
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
scripts/                 ef.sh / ef.ps1 (migrations), dev-token.mjs (test tokens), seed-demo.mjs (demo data),
                         smoke-e2e.mjs (end-to-end check of a running stack)
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
   SEED_DEMO_PASSWORD=<password of the demo lecturer and students>
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
6. Sign in to the web app with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. In Swagger, sign in with
   `POST /api/v1/auth/login` and paste the `accessToken` into the **Authorize** dialog (or use
   `node scripts/dev-token.mjs Administrator` for a test token).
7. Load the demo data (Node.js 22): `node scripts/seed-demo.mjs`. It creates semester FA26, subjects EXE101 and
   EXE201, majors SE, GD, MKT and IB, four skills, the EXE group type, `lecturer@fpt.edu.vn`, students
   `sv01`…`sv30@fpt.edu.vn` (password `SEED_DEMO_PASSWORD`) and course EXE101 – SE1919 in Setup. It looks everything up
   first, so it can run again. It takes about 3 minutes because the 30 students sign in to rate their skills and the
   gateway allows 10 sign-ins a minute; add `--no-skills` to skip that step.

Run the tests (Docker must be running for the SQL Server and Redis containers):

```bash
dotnet tool restore
dotnet test --solution ExeGroup.sln
cd src/web && npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

Check a running stack end to end: `cd src/web && npm ci && cd ../.. && node scripts/smoke-e2e.mjs`. It signs in as the
administrator and plays the whole demo story on a throwaway course of its own through the gateway (catalog, import,
rooms, publish, join, lock, apply and approve, gRPC suggestions, SignalR chat through the gateway, notifications,
overview, expiry, placements, finalize) and prints one PASS or FAIL line per check. Use it on a local stack, not on the
shared demo server, because it adds data.

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
- Services started outside Docker read `.env.local` (copy `.env.local.example`) in the Development environment only. Real
  environment variables win over the file. Visual Studio needs version 2026 or later; see `CONTRIBUTING.md`.
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
- Background jobs can be switched off with `Jobs__<Name>__Enabled=false` (`OutboxPublisher`, `PhaseScheduler`,
  `OutboxCleanup`, `GroupEventsConsumer`, `ProcessedEventsCleanup`). The clean-ups keep 7 days
  (`Jobs__OutboxCleanup__RetentionDays`, `Jobs__ProcessedEventsCleanup__RetentionDays`). The Group Service finds the
  Recommendation Service at `Recommendation__Address` (`http://recommendation-service:8081` in Docker).

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
  `ASPNETCORE_ENVIRONMENT=Production`, `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the first Administrator: without
  them nobody can sign in, and `SEED_DEMO_PASSWORD` for the demo lecturer and students), never in the repository. Do not
  store real student data on this demo.
- Every successful deployment loads the demo data once: it runs `scripts/seed-demo.mjs --once` in a short-lived container
  on the demo network. When semester FA26 is already in the database the seed changes nothing, so whatever was created
  on the demo afterwards stays as it is. The databases live in the named volumes `exe-group-demo_sqlserver-data` and
  `exe-group-demo_redis-data`, which a deployment never removes. Without `SEED_DEMO_PASSWORD` in `demo.env` the seed is
  skipped; a seed that fails does not fail the deployment, and the next one tries again. The deployment log says
  `Seed done`, `Seed skipped` or `Seed failed`.
- Do not run `scripts/smoke-e2e.mjs` there: it adds a throwaway course.
- Each successful deployment keeps the running and the last good images, and removes build cache unused for 7 days.
- The server hosts other projects: never run `docker system prune` or `docker compose down -v` there.

### Merging into main

`main` accepts pull requests only and nobody can skip the rules, administrators included. A pull request merges when
`dotnet`, `web`, `docker`, `architecture`, `conventions` and `infra-guard` are green. The branch does not have to be up to
date with `main`; CI runs again on `main` after each merge and the demo deploys automatically only when that run is green
(a manual deploy from the Actions tab does not check this). No review is
required, except that `infra-guard` asks the project manager to approve member changes to DevOps files, listed in
`.github/devops-paths.txt` and the guard workflow. See `CONTRIBUTING.md` for what each check verifies.

## 6. Demo script (end-to-end)

About 15 minutes. Before the demo: `docker compose up -d --build`, wait for `docker compose ps` to show every
container healthy, then `node scripts/seed-demo.mjs` (step 7 of the installation guide). Use three browser windows
that do not share sign-ins (for example one normal window, one private window and a second browser): **Admin**,
**A** = `sv01@fpt.edu.vn` (SE) and **B** = `sv19@fpt.edu.vn` (MKT). Students and `lecturer@fpt.edu.vn` use
`SEED_DEMO_PASSWORD`.

| Step | Who | Action | What it demonstrates |
|---|---|---|---|
| 1 | – | `docker compose ps` (8 healthy containers); show the C4 diagrams above and the merged Swagger UI at <http://localhost:8080/swagger> (Identity, Group, Realtime; every endpoint has a summary) | Docker deployment, architecture, API documentation |
| 2 | Admin | Sign in; open **Quản trị** → Học kỳ, Ngành, Skill and Loại nhóm (EXE: at least 1 SE, 1 MKT and 2 majors, allowed in FA26); in Swagger show `GET /api/v1/subjects?search=EXE&sort=-code&page=1&pageSize=5`, a 400 with field errors and a 406 for `Accept: text/plain` | REST, JWT, CRUD, search, sort, paging, validation, versioning, content negotiation |
| 3 | Admin | Course → EXE101 – SE1919: lecturer, sizes 4–6, k = 1.2, 30 students (CSV import is in the "Sinh viên" block). **Sinh phòng** with EXE (⌈30 × 1.2 / 6⌉ = 6 rooms), then **Publish ngay** | Business rules (BR-03), outbox events |
| 4 | A | Skill của tôi (ratings from the seed); open EXE101 → **Room 01** → **Vào phòng** (A becomes the leader) → set the topic → **Khóa phòng** | REST, SignalR room board |
| 5 | B | Open EXE101: the room board (search, "Còn chỗ", sort, pages) and **Phòng gợi ý**, ranked with reasons in Vietnamese | REST → gRPC (Recommendation Service) |
| 6 | B, A | B opens Room 01 → **Gửi đơn xin vào** with a message; A's bell lights up; A sees B's major, skills and message and clicks **Duyệt**: the answer comes back at once. Then `docker compose exec redis redis-cli XRANGE group-events - +` and `docker compose logs \| grep <traceId>` (the `traceId` of the approve response, also in the `X-Correlation-ID` header) | Transactional outbox → Redis Streams → consumer, notifications, tracing across gateway, Group, gRPC and Realtime |
| 7 | A, B | A and B chat in Room 01: each message appears in the other window at once; a student outside the room cannot open the chat | SignalR, Realtime Service |
| 8 | Admin, B | Admin sets **Hạn tìm nhóm (ExpireAt)** two minutes ahead and saves; B applies to another locked room meanwhile. Within about a minute after the deadline the PhaseScheduler expires the course: B's application turns into "Đã hết hạn tìm nhóm" and joining is refused | Background job, events |
| 9 | Admin, lecturer | Admin opens the course: **Tiến độ chia nhóm**, **Xếp người sau hạn** (placement suggestions over gRPC → Áp dụng), **Chốt nhóm** (accept the exceptions shown). `lecturer@fpt.edu.vn` opens the course and sees the progress and the numbered official groups, read-only | gRPC, business rules (BR-12–BR-14), authorization |

Rehearsal without a browser: `node scripts/smoke-e2e.mjs` runs the same story on a throwaway course and prints one
line per check. To start the demo again from scratch on a local machine: `docker compose down -v`, `docker compose up -d
--build`, `node scripts/seed-demo.mjs`.

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
