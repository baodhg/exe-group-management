# EXE Group Management System

PRN232 – Building Cross-Platform Back-End Application with .NET · Final Assignment

> **Draft.** The installation and deployment sections describe the planned repository layout and Docker Compose
> setup from the design document (section 7.3). Check every command against the code before submission.

## 1. Project description

Students in EXE (Experiential Entrepreneurship) courses must form project groups inside their class. Today this
happens across chat groups and spreadsheets, so open slots, pending join requests and students without a group are
hard to track.

The EXE Group Management System centralizes group formation:

- Students search groups, create a group or send join requests in the classes they are enrolled in.
- Team Leaders approve or reject the requests for their own group, remove members and transfer leadership.
- Lecturers monitor grouping progress, under-filled groups and ungrouped students.
- Administrators manage users, semesters, courses, classes (MinMembers, MaxMembers, Deadline) and class rosters.

The backend enforces the class rules: enrollment required, one group per student per class, capacity and deadline.

The full design is in [`docs/PRN232_v2.pdf`](docs/PRN232_v2.pdf) / [`docs/PRN232_v2.docx`](docs/PRN232_v2.docx).

## 2. System architecture

Microservices documented with the C4 model (Level 1 and Level 2).

| Level 1 – System Context | Level 2 – Container |
|---|---|
| ![System Context](docs/diagrams/fig1_c4_l1_context.png) | ![Container](docs/diagrams/fig2_c4_l2_container.png) |

| Container | Technology | Responsibility |
|---|---|---|
| Single-Page App | React 18, TypeScript, served by nginx | UI for all roles; nginx also forwards `/api` and `/swagger` to the gateway (same origin, no CORS) |
| API Gateway | ASP.NET Core 8 + YARP | Single entry point, JWT validation, path routing, Swagger UI |
| Identity Service | ASP.NET Core 8 Web API | Sign-in, JWT, users, roles |
| Group Service | ASP.NET Core 8 Web API + gRPC server | Semesters, courses, classes, rosters, groups; outbox, deadline and cleanup jobs |
| Join Request Service | ASP.NET Core 8 Web API + gRPC client | Join-request lifecycle; event consumer, reconciler and cleanup jobs |
| IdentityDb / GroupDb / RequestDb | SQL Server 2022 (EF Core 8) | One database per service |
| Group Events | Redis 7 Stream `group-events` | `GroupMemberAdded`, `GroupClosed` from Group Service to Join Request Service |

How the services talk to each other:

- **REST:** browser → web (nginx) → gateway → services.
- **gRPC:** Join Request Service → Group Service. `GroupMembership.GetGroupContext` checks eligibility and leadership;
  `AddMemberIfEligible` adds the member in one transaction and is idempotent by `request_id` (table
  `AddMemberRequests`). Contract: [`contracts/group_membership.proto`](contracts/group_membership.proto).
- **Redis Streams:** Group Service publishes through a Transactional Outbox (`OutboxEvents`). Join Request Service
  reads with `XREADGROUP` in a polling loop (consumer group `join-request-service`), acknowledges with `XACK` after
  commit, re-claims stuck messages with `XAUTOCLAIM`, and skips duplicates through the `ProcessedEvents` table.
- **Approve flow:** `POST /api/join-requests/{id}/approve` returns `202 Accepted` (status Processing); the request
  becomes Approved when the `GroupMemberAdded` event is consumed, and the web app polls `GET /api/join-requests/{id}`.

## 3. Technology stack

| Area | Technology |
|---|---|
| Backend | ASP.NET Core 8 (.NET 8 LTS), layered Controllers → Services → Repositories, DI, Options, Serilog, ProblemDetails |
| Data | Entity Framework Core 8, SQL Server 2022 |
| Gateway | YARP 2.x |
| Sync communication | gRPC (Grpc.AspNetCore / Grpc.Net.Client, Protobuf over HTTP/2) |
| Messaging | Redis 7 Streams (StackExchange.Redis 2.7+) |
| Background jobs | BackgroundService + PeriodicTimer (5 jobs) |
| Security | JWT Bearer (HS256), ASP.NET Core PasswordHasher |
| API docs | Swashbuckle (Swagger / OpenAPI 3) |
| Frontend | React 18, TypeScript, Vite, nginx |
| Deployment | Docker, Docker Compose |

## 4. Installation guide

### Prerequisites

- Docker Desktop (with Docker Compose v2)
- .NET 8 SDK and Node.js 20 – only for running services outside Docker
- Git

### Planned repository layout

```text
src/
  ApiGateway/            YARP gateway
  IdentityService/       REST, IdentityDb
  GroupService/          REST + gRPC server, GroupDb, outbox/deadline/cleanup jobs
  JoinRequestService/    REST + gRPC client, RequestDb, consumer/reconciler/cleanup jobs
  Contracts/             group_membership.proto (shared)
  web/                   React single-page app + nginx.conf
database/schema.sql      reference DDL (EF Core migrations are the runtime source of truth)
docs/                    design document (PDF/DOCX) and diagrams; docs/diagrams/spec.py is the design data
docker-compose.yml
.env.example
```

### Steps

1. Clone the repository and open the root folder.
2. Copy `.env.example` to `.env` and set the secrets. `docker-compose.yml` passes them to the services as
   configuration keys (for example `Jwt__SigningKey: ${JWT_SIGNING_KEY}`):

   ```env
   SA_PASSWORD=<strong SQL Server password>
   JWT_SIGNING_KEY=<at least 32 random characters>
   JWT_ISSUER=exe-group-system
   JWT_AUDIENCE=exe-group-clients
   SEED_ADMIN_EMAIL=<e-mail of the first Administrator>
   SEED_ADMIN_PASSWORD=<initial password, change it after the first sign-in>
   ```

3. Build and start everything:

   ```bash
   docker compose up -d --build
   ```

4. Wait until all containers are healthy (`docker compose ps`). With `ASPNETCORE_ENVIRONMENT=Development` the
   services apply their EF Core migrations at start-up, and Identity Service seeds the three roles (Student,
   Lecturer, Administrator) and the first Administrator account from the `SEED_ADMIN_*` values.
5. Open the apps:
   - Web app: <http://localhost:3000>
   - Swagger UI (all three services): <http://localhost:8080/swagger> (also reachable through <http://localhost:3000/swagger>)

To create the databases manually instead, run
`sqlcmd -S localhost,1433 -U sa -P <password> -C -I -i database/schema.sql` (`-C` trusts the container's
self-signed certificate; `-I` turns on quoted identifiers, which filtered indexes need).

## 5. Deployment instructions

| Service | Image / build | Ports | Depends on |
|---|---|---|---|
| web | nginx:1.27-alpine + React build | 3000 → 80 | gateway |
| gateway | src/ApiGateway | 8080 → 8080 | identity-service, group-service, join-request-service |
| identity-service | src/IdentityService | internal 8080 | sqlserver |
| group-service | src/GroupService | internal 8080 (REST), 8081 (gRPC, HTTP/2 only) | sqlserver, redis |
| join-request-service | src/JoinRequestService | internal 8080 | sqlserver, redis, group-service |
| sqlserver | mcr.microsoft.com/mssql/server:2022-latest | 1433 (development only) | – |
| redis | redis:7-alpine (`appendonly yes`) | internal 6379 | – |

Notes:

- Only `web` and `gateway` publish ports to the host (SQL Server only in development); every other container stays
  on the internal Docker network.
- The local Compose setup uses plain HTTP. In production, TLS terminates at nginx and the gateway.
- Group Service exposes gRPC on a separate HTTP/2-only Kestrel endpoint (`http://group-service:8081`), because gRPC
  without TLS (h2c) cannot share an HTTP/1.1 endpoint.
- Gateway routes: `/api/auth/login` (anonymous) and `/api/auth/**`, `/api/users/**` → identity-service;
  `/api/semesters/**`, `/api/courses/**`, `/api/classes/**`, `/api/groups/**` → group-service;
  `/api/join-requests/**` → join-request-service; `/swagger/{identity|group|join-request}/**` → OpenAPI documents.
- Configuration comes from `appsettings.json` and is overridden by environment variables. Examples:
  `ConnectionStrings__GroupDb`, `Jwt__SigningKey`, `Redis__Connection`, `GrpcClients__GroupService`.
  Never commit `.env`.
- Health checks: `/health/live` and `/health/ready` on every service; readiness checks the service's own database,
  plus Redis for group-service and join-request-service.
- Logs: `docker compose logs -f group-service join-request-service`. Follow one request across services with its
  `X-Correlation-ID`.
- Stream inspection: `docker compose exec redis redis-cli XRANGE group-events - +` and
  `docker compose exec redis redis-cli XINFO GROUPS group-events`.

## 6. Demo script (end-to-end)

| Step | Action | What it demonstrates |
|---|---|---|
| 1 | `docker compose ps` – all containers healthy; show Figures 1–2 | Docker deployment, system architecture |
| 2 | Administrator signs in (Swagger), creates a semester, a course and a class (MinMembers, MaxMembers, Deadline), then enrolls students | REST API, JWT, CRUD |
| 3 | Student A creates a group and becomes Team Leader (`GroupMemberAdded` with an empty requestId) | REST, outbox |
| 4 | Student B searches groups (filter, sort, paging) and submits a join request – Pending | REST, gRPC `GetGroupContext` |
| 5 | Team Leader approves – 202 Processing; OutboxPublisher publishes, GroupEventsConsumer marks the request Approved and cancels B's other Pending requests | gRPC `AddMemberIfEligible`, background jobs, message publishing and consuming |
| 6 | Show `XRANGE group-events - +` and the logs of both services with the same correlation id | Message broker, tracing |
| 7 | Lecturer opens the class overview: grouped / ungrouped students, under-filled groups | REST, authorization |
| 8 | Set the class Deadline one or two minutes ahead and wait: DeadlineEnforcer locks the groups and the remaining Pending requests are rejected (GROUP_LOCKED) | Background job, events |

## 7. Team members & responsibilities

| No. | Full name | Student ID | Responsibilities |
|---|---|---|---|
| 1 | _Member 1_ | _SExxxxxx_ | Platform and API Gateway: solution skeleton, shared building blocks, Docker Compose, CI, YARP gateway (JWT, Swagger UI), README and demo script |
| 2 | _Member 2_ | _SExxxxxx_ | Identity Service (sign-in, JWT, users, roles) and Join Request Service REST API |
| 3 | _Member 3_ | _SExxxxxx_ | Group Service REST API: semesters, courses, classes, rosters, groups, lecturer dashboard |
| 4 | _Member 4_ | _SExxxxxx_ | gRPC GroupMembership server and client, Transactional Outbox, Redis Streams consumer, background jobs |
| 5 | _Member 5_ | _SExxxxxx_ | React single-page app for all roles, nginx |
