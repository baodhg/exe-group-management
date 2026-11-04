workspace "EXE Group Management System" "PRN232 final assignment: microservices for forming EXE project groups." {

    !identifiers hierarchical

    model {
        student = person "Student / Team Leader" "EXE student; may lead a group in a class."
        lecturer = person "Lecturer" "Teaches EXE classes and monitors grouping."
        admin = person "Administrator" "Manages users, semesters, courses, classes and rosters."

        exe = softwareSystem "EXE Group Management System" "Centralises group formation, join requests and class monitoring." {
            spa = container "Single-Page App" "UI for all roles; nginx also proxies /api and /swagger to the gateway." "React 19, TypeScript, Vite, nginx" "Web Browser"

            gateway = container "API Gateway" "Single public entry point: JWT check at the edge, path routing, merged Swagger UI, sign-in rate limit." "ASP.NET Core 10, YARP 2.3"

            identity = container "Identity Service" "Sign-in, JWT access and refresh tokens, users and roles." "ASP.NET Core 10 Web API" {
                authController = component "AuthController" "[Planned] POST /api/v1/auth/login, /refresh-token; GET/PUT /api/v1/auth/me." "ASP.NET Core MVC" "Planned"
                usersController = component "UsersController" "[Planned] Administrator user and role management." "ASP.NET Core MVC" "Planned"
                tokenFactory = component "AccessTokenFactory" "Issues HS256 JWTs shared with every service (BuildingBlocks)." "Microsoft.IdentityModel.JsonWebTokens"
                identityDbContext = component "IdentityDbContext" "Users, Roles, UserRoles, RefreshTokens." "EF Core 10"
            }

            group = container "Group Service" "Semesters, courses, classes, rosters, groups; gRPC GroupMembership; outbox." "ASP.NET Core 10 Web API + gRPC server" {
                semestersController = component "SemestersController" "Reference CRUD endpoint /api/v1/semesters (golden path)." "ASP.NET Core MVC"
                classesController = component "Classes and groups controllers" "[Planned] /api/v1/courses, /classes, /groups." "ASP.NET Core MVC" "Planned"
                membershipGrpc = component "GroupMembershipGrpcService" "GetGroupContext, AddMemberIfEligible on :8081 (HTTP/2)." "Grpc.AspNetCore"
                semesterService = component "SemesterService" "Business rules for semesters." "C# service layer"
                semesterRepository = component "SemesterRepository" "Search, sort and paging over Semesters." "EF Core 10"
                groupDbContext = component "GroupDbContext" "Semesters (+ classes, enrollments, groups, outbox)." "EF Core 10"
                outboxPublisher = component "OutboxPublisher" "[Planned] Every 2 s: XADD unpublished OutboxEvents to group-events." "BackgroundService" "Planned"
                deadlineEnforcer = component "DeadlineEnforcer" "[Planned] Every 1 min: closes classes past their deadline, locks groups." "BackgroundService" "Planned"
            }

            joinRequest = container "Join Request Service" "Join-request lifecycle T1-T11; event consumer and reconciler." "ASP.NET Core 10 Web API + gRPC client" {
                joinRequestsController = component "JoinRequestsController" "[Planned] Submit, cancel, approve (202), reject." "ASP.NET Core MVC" "Planned"
                membershipClient = component "GroupMembershipClient" "Typed gRPC client with correlation and 5 s deadline interceptors." "Grpc.Net.ClientFactory"
                eventsConsumer = component "GroupEventsConsumer" "[Planned] XREADGROUP, idempotent apply, XACK after commit, XAUTOCLAIM." "BackgroundService" "Planned"
                reconciler = component "ProcessingReconciler" "[Planned] Every 1 min: retries AddMemberIfEligible for stuck Processing requests." "BackgroundService" "Planned"
                joinRequestDbContext = component "JoinRequestDbContext" "JoinRequests, ProcessedEvents." "EF Core 10"
            }

            identityDb = container "IdentityDb" "Users, roles and refresh tokens." "SQL Server 2022" "Database"
            groupDb = container "GroupDb" "Semesters, courses, classes, rosters, groups, memberships, outbox." "SQL Server 2022" "Database"
            requestDb = container "RequestDb" "Join requests and processed event ids." "SQL Server 2022" "Database"
            events = container "Group Events" "Stream group-events: GroupMemberAdded, GroupClosed." "Redis 7 Stream" "Stream"
        }

        student -> exe.spa "Forms and joins groups, reviews join requests" "HTTPS"
        lecturer -> exe.spa "Monitors grouping progress" "HTTPS"
        admin -> exe.spa "Manages users, classes and deadlines" "HTTPS"

        exe.spa -> exe.gateway "Makes API calls" "JSON envelope over HTTPS, /api/v1"
        exe.gateway -> exe.identity.authController "Routes /api/v1/auth, /api/v1/users" "HTTP"
        exe.gateway -> exe.group.semestersController "Routes /api/v1/semesters" "HTTP"
        exe.gateway -> exe.group.classesController "Routes /api/v1/courses, /classes, /groups" "HTTP"
        exe.gateway -> exe.joinRequest.joinRequestsController "Routes /api/v1/join-requests" "HTTP"

        exe.identity.authController -> exe.identity.tokenFactory "Issues tokens with"
        exe.identity.authController -> exe.identity.identityDbContext "Reads users"
        exe.identity.usersController -> exe.identity.identityDbContext "Reads and writes users"
        exe.identity.identityDbContext -> exe.identityDb "Reads and writes" "SQL"

        exe.group.semestersController -> exe.group.semesterService "Calls"
        exe.group.semesterService -> exe.group.semesterRepository "Uses"
        exe.group.semesterRepository -> exe.group.groupDbContext "Queries"
        exe.group.classesController -> exe.group.groupDbContext "Reads and writes via services"
        exe.group.membershipGrpc -> exe.group.groupDbContext "Adds members, writes outbox in one transaction"
        exe.group.outboxPublisher -> exe.group.groupDbContext "Reads unpublished events"
        exe.group.outboxPublisher -> exe.events "Publishes" "XADD"
        exe.group.deadlineEnforcer -> exe.group.groupDbContext "Locks groups, writes GroupClosed"
        exe.group.groupDbContext -> exe.groupDb "Reads and writes" "SQL"

        exe.joinRequest.joinRequestsController -> exe.joinRequest.membershipClient "Checks eligibility, adds member"
        exe.joinRequest.joinRequestsController -> exe.joinRequest.joinRequestDbContext "Reads and writes requests"
        exe.joinRequest.membershipClient -> exe.group.membershipGrpc "GetGroupContext, AddMemberIfEligible" "gRPC, HTTP/2 :8081"
        exe.joinRequest.reconciler -> exe.joinRequest.membershipClient "Retries AddMemberIfEligible"
        exe.joinRequest.eventsConsumer -> exe.events "Consumes" "XREADGROUP / XACK"
        exe.joinRequest.eventsConsumer -> exe.joinRequest.joinRequestDbContext "Approves, cancels, rejects requests"
        exe.joinRequest.joinRequestDbContext -> exe.requestDb "Reads and writes" "SQL"

        compose = deploymentEnvironment "Docker Compose" {
            deploymentNode "Developer machine" "" "Docker Desktop" {
                deploymentNode "web" "Published 3000 -> 80" "nginx:1.27-alpine" {
                    containerInstance exe.spa
                }
                deploymentNode "gateway" "Published 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.gateway
                }
                deploymentNode "identity-service" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.identity
                }
                deploymentNode "group-service" "Internal 8080 (REST) and 8081 (gRPC, HTTP/2 only)" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.group
                }
                deploymentNode "join-request-service" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.joinRequest
                }
                deploymentNode "sqlserver" "Internal 1433 (host 14330 in development)" "mcr.microsoft.com/mssql/server:2022-latest" {
                    containerInstance exe.identityDb
                    containerInstance exe.groupDb
                    containerInstance exe.requestDb
                }
                deploymentNode "redis" "Internal 6379, appendonly yes" "redis:7-alpine" {
                    containerInstance exe.events
                }
            }
        }
    }

    views {
        systemContext exe "SystemContext" "Level 1: who uses the system." {
            include *
            autoLayout lr
        }

        container exe "Containers" "Level 2: deployable containers and how they talk." {
            include *
            autoLayout lr
        }

        component exe.identity "IdentityComponents" "Level 3: Identity Service." {
            include *
            autoLayout lr
        }

        component exe.group "GroupComponents" "Level 3: Group Service." {
            include *
            autoLayout lr
        }

        component exe.joinRequest "JoinRequestComponents" "Level 3: Join Request Service." {
            include *
            autoLayout lr
        }

        dynamic exe "ApproveJoinRequest" "Approving a join request (design section 6.4)." {
            exe.spa -> exe.gateway "1. POST /api/v1/join-requests/{id}/approve"
            exe.gateway -> exe.joinRequest "2. Forward with JWT and X-Correlation-ID"
            exe.joinRequest -> exe.group "3. GetGroupContext: is the caller the leader?"
            exe.joinRequest -> exe.requestDb "4. Pending -> Processing (conditional update)"
            exe.joinRequest -> exe.group "5. AddMemberIfEligible(requestId) with 5 s deadline"
            exe.group -> exe.groupDb "6. Insert member + AddMemberRequests + OutboxEvents in one transaction"
            exe.group -> exe.events "7. OutboxPublisher XADD GroupMemberAdded"
            exe.joinRequest -> exe.events "8. Consumer reads, marks Approved, cancels other requests, XACK"
            exe.spa -> exe.gateway "9. Polls GET /api/v1/join-requests/{id} until Approved"
            autoLayout lr
        }

        deployment exe compose "Deployment" "Docker Compose deployment (7 containers)." {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #08427B
                color #ffffff
            }
            element "Software System" {
                background #1168BD
                color #ffffff
            }
            element "Container" {
                background #438DD5
                color #ffffff
            }
            element "Component" {
                background #85BBF0
                color #000000
            }
            element "Database" {
                shape Cylinder
            }
            element "Stream" {
                shape Pipe
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Planned" {
                border dashed
                opacity 70
            }
        }
    }
}
