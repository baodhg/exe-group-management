workspace "EXE Group Management System" "PRN232 final assignment: microservices for admin-led EXE group formation (design v3.2)." {

    !identifiers hierarchical

    model {
        student = person "Student / Room Leader" "EXE student; may lead a room."
        admin = person "Admin" "Academic staff (Administrator role) who moderates group formation."
        lecturer = person "Lecturer" "Teaches an EXE class; read-only view of its groups."

        exe = softwareSystem "EXE Group Management System" "Admin-led group formation, applications, room suggestions and group chat." {
            spa = container "Single-Page App" "UI for all roles; nginx also proxies /api, /hubs and /swagger to the gateway." "React 19, TypeScript, Vite, nginx" "Web Browser"

            gateway = container "API Gateway" "Single public entry point: JWT check at the edge, path routing, WebSocket pass-through, merged Swagger UI, sign-in rate limit." "ASP.NET Core 10, YARP 2.3"

            identity = container "Identity Service" "Sign-in, JWT access and refresh tokens, users and roles." "ASP.NET Core 10 Web API" {
                authController = component "AuthController" "[Planned] POST /api/v1/auth/login, /refresh-token, /logout; GET/PUT /api/v1/auth/me." "ASP.NET Core MVC" "Planned"
                usersController = component "UsersController" "[Planned] Administrator: users, roles and student import." "ASP.NET Core MVC" "Planned"
                tokenFactory = component "AccessTokenFactory" "Issues HS256 JWTs shared with every service (BuildingBlocks)." "Microsoft.IdentityModel.JsonWebTokens"
                identityDbContext = component "IdentityDbContext" "Users, Roles, UserRoles, RefreshTokens." "EF Core 10"
            }

            group = container "Group Service" "Semesters, subjects, majors, skills, group types, courses, rosters, rooms, memberships, applications and finalize; outbox." "ASP.NET Core 10 Web API" {
                semestersController = component "SemestersController" "Reference CRUD endpoint /api/v1/semesters (golden path)." "ASP.NET Core MVC"
                catalogControllers = component "Master data controllers" "[Planned] /api/v1/subjects, /majors, /skills, /group-types." "ASP.NET Core MVC" "Planned"
                coursesController = component "Courses and rooms controllers" "[Planned] /api/v1/courses and /rooms: rosters, generate, publish, expire, placements, finalize, join, leave, lock." "ASP.NET Core MVC" "Planned"
                joinRequestsController = component "JoinRequestsController" "[Planned] /api/v1/join-requests: apply, approve, reject, withdraw." "ASP.NET Core MVC" "Planned"
                semesterService = component "SemesterService" "Business rules for semesters." "C# service layer"
                roomServices = component "Room services" "[Planned] Rules BR-03 to BR-14: seats, majors, leadership, deadline, finalize." "C# service layer" "Planned"
                recommendationClient = component "RecommendationClient" "[Planned] Typed gRPC client with correlation and a 2 s deadline; falls back to unranked lists." "Grpc.Net.ClientFactory" "Planned"
                semesterRepository = component "SemesterRepository" "Search, sort and paging over Semesters." "EF Core 10"
                groupDbContext = component "GroupDbContext" "Semesters (+ subjects, courses, rooms, memberships, applications, outbox)." "EF Core 10"
                outboxPublisher = component "OutboxPublisher" "[Planned] Every 2 s: XADD unpublished OutboxEvents to group-events." "BackgroundService" "Planned"
                phaseScheduler = component "PhaseScheduler" "[Planned] Every 1 min: publishes courses at PublishAt and expires them at ExpireAt." "BackgroundService" "Planned"
            }

            recommendation = container "Recommendation Service" "Ranks rooms for a student and placements for students without a room from majors and skills; stateless, gRPC only." "ASP.NET Core 10 gRPC" {
                recommendationGrpc = component "RecommendationGrpcService" "[Planned] SuggestRooms and SuggestPlacements on :8081 (HTTP/2)." "Grpc.AspNetCore" "Planned"
                scoring = component "Scoring" "[Planned] Needed majors, skill gaps, rooms below the minimum; greedy placements." "C# service layer" "Planned"
            }

            realtime = container "Realtime Service" "Group chat and notifications; consumes the group events." "ASP.NET Core 10 Web API + SignalR" {
                chatControllers = component "Chat and notification controllers" "[Planned] /api/v1/conversations, /messages, /notifications." "ASP.NET Core MVC" "Planned"
                hub = component "RealtimeHub" "[Planned] /hubs/realtime: chat messages, notifications and room changes." "ASP.NET Core SignalR" "Planned"
                eventsConsumer = component "GroupEventsConsumer" "[Planned] XREADGROUP (group realtime), idempotent apply, XACK after commit, XAUTOCLAIM." "BackgroundService" "Planned"
                chatDbContext = component "ChatDbContext" "[Planned] Conversations, members, messages, notifications, processed events." "EF Core 10" "Planned"
            }

            identityDb = container "IdentityDb" "Users, roles and refresh tokens." "SQL Server 2022" "Database"
            groupDb = container "GroupDb" "Semesters, subjects, majors, skills, courses, rosters, group types, rooms, memberships, applications, outbox." "SQL Server 2022" "Database"
            chatDb = container "ChatDb" "Conversations, messages, notifications and processed event ids." "SQL Server 2022" "Database"
            events = container "Group Events" "Stream group-events: course phases, room members, leaders and applications." "Redis 7 Stream" "Stream"
        }

        student -> exe.spa "Rates skills, joins rooms, applies, chats" "HTTPS"
        admin -> exe.spa "Manages accounts, courses and rooms; finalizes groups" "HTTPS"
        lecturer -> exe.spa "Views class progress and groups" "HTTPS"

        exe.spa -> exe.gateway "Makes API calls and opens the realtime connection" "JSON envelope over HTTPS /api/v1, WSS /hubs"
        exe.gateway -> exe.identity.authController "Routes /api/v1/auth" "HTTP"
        exe.gateway -> exe.identity.usersController "Routes /api/v1/users" "HTTP"
        exe.gateway -> exe.group.semestersController "Routes /api/v1/semesters" "HTTP"
        exe.gateway -> exe.group.catalogControllers "Routes /api/v1/subjects, /majors, /skills, /group-types" "HTTP"
        exe.gateway -> exe.group.coursesController "Routes /api/v1/courses, /rooms" "HTTP"
        exe.gateway -> exe.group.joinRequestsController "Routes /api/v1/join-requests" "HTTP"
        exe.gateway -> exe.realtime.chatControllers "Routes /api/v1/conversations, /messages, /notifications" "HTTP"
        exe.gateway -> exe.realtime.hub "Forwards /hubs/realtime" "WebSocket"

        exe.identity.authController -> exe.identity.tokenFactory "Issues tokens with"
        exe.identity.authController -> exe.identity.identityDbContext "Reads users, stores refresh tokens"
        exe.identity.usersController -> exe.identity.identityDbContext "Reads and writes users"
        exe.identity.identityDbContext -> exe.identityDb "Reads and writes" "SQL"

        exe.group.semestersController -> exe.group.semesterService "Calls"
        exe.group.semesterService -> exe.group.semesterRepository "Uses"
        exe.group.semesterRepository -> exe.group.groupDbContext "Queries"
        exe.group.catalogControllers -> exe.group.groupDbContext "Reads and writes through services and repositories"
        exe.group.coursesController -> exe.group.roomServices "Calls"
        exe.group.joinRequestsController -> exe.group.roomServices "Calls"
        exe.group.roomServices -> exe.group.groupDbContext "Changes rooms, memberships and applications with the outbox in one transaction"
        exe.group.roomServices -> exe.group.recommendationClient "Asks for room and placement suggestions"
        exe.group.recommendationClient -> exe.recommendation.recommendationGrpc "SuggestRooms, SuggestPlacements" "gRPC, HTTP/2 :8081"
        exe.group.outboxPublisher -> exe.group.groupDbContext "Reads unpublished events"
        exe.group.outboxPublisher -> exe.events "Publishes" "XADD"
        exe.group.phaseScheduler -> exe.group.groupDbContext "Publishes and expires courses, writes CoursePhaseChanged"
        exe.group.groupDbContext -> exe.groupDb "Reads and writes" "SQL"

        exe.recommendation.recommendationGrpc -> exe.recommendation.scoring "Scores rooms and placements with"

        exe.realtime.eventsConsumer -> exe.events "Consumes" "XREADGROUP / XACK"
        exe.realtime.eventsConsumer -> exe.realtime.chatDbContext "Stores notifications, syncs chat members"
        exe.realtime.eventsConsumer -> exe.realtime.hub "Pushes notifications and room changes through"
        exe.realtime.chatControllers -> exe.realtime.chatDbContext "Reads and writes messages and notifications"
        exe.realtime.hub -> exe.realtime.chatDbContext "Stores chat messages"
        exe.realtime.chatDbContext -> exe.chatDb "Reads and writes" "SQL"
        exe.realtime.hub -> exe.spa "Pushes messages, notifications and room changes" "WebSocket (SignalR)"

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
                deploymentNode "group-service" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.group
                }
                deploymentNode "recommendation-service" "Internal 8081 (gRPC, HTTP/2 only)" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.recommendation
                }
                deploymentNode "realtime-service" "Internal 8080 (REST and WebSocket)" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.realtime
                }
                deploymentNode "sqlserver" "Internal 1433 (host 14330 in development)" "mcr.microsoft.com/mssql/server:2022-latest" {
                    containerInstance exe.identityDb
                    containerInstance exe.groupDb
                    containerInstance exe.chatDb
                }
                deploymentNode "redis" "Internal 6379, appendonly yes" "redis:7-alpine" {
                    containerInstance exe.events
                }
            }
        }

        demo = deploymentEnvironment "Demo" {
            github = deploymentNode "GitHub" "" "github.com" {
                actions = infrastructureNode "GitHub Actions" "Deploys main after CI is green; holds a key limited to the deploy command" "Hosted runner"
            }
            cloudflare = deploymentNode "Cloudflare" "" "Proxied DNS" {
                edge = infrastructureNode "Cloudflare proxy" "Protects exe.qizhub.com" "Full (strict) TLS"
            }
            server = deploymentNode "Shared server" "No host ports; project exe-group-demo" "Ubuntu 24.04, Docker" {
                proxy = infrastructureNode "Nginx Proxy Manager" "Owns ports 80 and 443; terminates TLS for exe.qizhub.com" "nginx-network"
                webNode = deploymentNode "web" "Alias exe-group-web on nginx-network" "nginx:1.27-alpine" {
                    webInstance = containerInstance exe.spa
                }
                deploymentNode "gateway" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.gateway
                }
                deploymentNode "identity-service" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.identity
                }
                deploymentNode "group-service" "Internal 8080" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.group
                }
                deploymentNode "recommendation-service" "Internal 8081 (gRPC, HTTP/2 only)" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.recommendation
                }
                deploymentNode "realtime-service" "Internal 8080 (REST and WebSocket)" "mcr.microsoft.com/dotnet/aspnet:10.0" {
                    containerInstance exe.realtime
                }
                deploymentNode "sqlserver" "Internal 1433, limited to 2 GB" "mcr.microsoft.com/mssql/server:2022-latest" {
                    containerInstance exe.identityDb
                    containerInstance exe.groupDb
                    containerInstance exe.chatDb
                }
                deploymentNode "redis" "Internal 6379, appendonly yes" "redis:7-alpine" {
                    containerInstance exe.events
                }
            }
        }
        demo.server.proxy -> demo.server.webNode.webInstance "Forwards exe.qizhub.com" "HTTP"
        demo.github.actions -> demo.server.webNode "Runs the deploy command for one commit" "SSH"
        demo.cloudflare.edge -> demo.server.proxy "Forwards exe.qizhub.com" "HTTPS"
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

        component exe.recommendation "RecommendationComponents" "Level 3: Recommendation Service." {
            include *
            autoLayout lr
        }

        component exe.realtime "RealtimeComponents" "Level 3: Realtime Service." {
            include *
            autoLayout lr
        }

        dynamic exe "ApproveApplication" "Approving an application in one transaction (design section 6.4)." {
            exe.spa -> exe.gateway "1. POST /api/v1/join-requests/{id}/approve"
            exe.gateway -> exe.group "2. Forward with JWT and X-Correlation-ID"
            exe.group -> exe.groupDb "3. One transaction: member, room, other applications and OutboxEvents"
            exe.group -> exe.events "4. OutboxPublisher XADD RoomMemberJoined and JoinRequestDecided"
            exe.realtime -> exe.events "5. Consumer reads, stores notifications and chat members, XACK"
            exe.realtime -> exe.spa "6. Pushes the notifications to the applicant and the leader"
            autoLayout lr
        }

        dynamic exe "SuggestRooms" "Room suggestions: the REST API calls the gRPC service (design section 6.4)." {
            exe.spa -> exe.gateway "1. GET /api/v1/courses/{id}/rooms/suggestions"
            exe.gateway -> exe.group "2. Forward with JWT and X-Correlation-ID"
            exe.group -> exe.groupDb "3. Load the student, the rooms, their members and the rules"
            exe.group -> exe.recommendation "4. SuggestRooms with a 2 s deadline"
            autoLayout lr
        }

        deployment exe compose "Deployment" "Docker Compose deployment (8 containers)." {
            include *
            autoLayout lr
        }

        deployment exe demo "DemoDeployment" "Demo on the shared server behind the existing reverse proxy." {
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
