"""Text content of the design document, version 3.2 (rendered by build_docx.py together with spec.py).

Everything a reader needs besides the data model lives here: context, problems, solutions, actors, features,
business rules, statuses, architecture notes, flows, events, jobs, the gRPC contract, the REST API list and the
mapping to the assignment requirements.
"""
import spec

VERSIONS = [
    ("2.2", "November 5, 2026", "Versioned routes (/api/v1), refresh tokens and sign-out (Identity Service)."),
    ("3.2", "November 5, 2026",
     "Lecturer feedback: FAP terms (Subject, Course = subject + class + semester), admin-led rooms instead of "
     "student-created groups, group types with major minimums, skills, deadline and finalize, group chat. "
     "Join requests move into the Group Service; new Recommendation Service (gRPC) and Realtime Service (SignalR)."),
]

CONTEXT = [
    "At FPT University the EXE subjects (EXE101 Experiential Entrepreneurship 1 and EXE201) are taught to classes "
    "such as SE1919 every semester. In every class the students work in project groups of four to six members from "
    "at least two different majors, so that each start-up team covers technology, design and business. Forming the "
    "groups is the first task of the semester and blocks everything that follows: topic registration, checkpoints "
    "and grading.",
    "Today the groups form informally through chat groups and spreadsheets, and the academic staff only see the "
    "result. The PRN232 lecturer's feedback describes the process the school wants instead: the staff prepare the "
    "semester, the subjects and the courses, add the students with their major, create rooms for each course from a "
    "simple formula and publish them. Students rate their own strengths and join rooms; the first student in a room "
    "leads it, may lock it and then reviews applications. When the deadline passes the staff arrange the remaining "
    "students and finalize the official groups, which everyone can then see.",
    "The EXE Group Management System implements this process as a distributed .NET application. It is also the "
    "PRN232 Final Assignment, so it demonstrates REST APIs, background jobs, a message broker, a gRPC service and a "
    "containerized deployment.",
]

PROBLEMS = [
    ("P1", "Groups form informally", "Chat groups and spreadsheets: the staff have no live view and find the "
                                     "students without a group too late."),
    ("P2", "Major-mix rules are hard to keep by hand", "Groups miss a required major (for example no marketing "
                                                       "student) and have to be rebuilt."),
    ("P3", "Nobody knows who is good at what", "Students pick friends instead of complementary strengths."),
    ("P4", "Deadline and final list are handled by hand", "Late changes and disputes about who is in which group."),
    ("P5", "Group communication is scattered", "Leaders cannot reach applicants and members in one place."),
    ("P6", "Lecturers cannot see their class's groups", "They mentor groups they have no list of."),
]

SOLUTIONS = [
    ("S1", "Admin-led rooms", "The admin generates the rooms of a course (rooms = ceil(students / MaxGroupSize "
                              "x k), k = 1.2) and publishes them; students join rooms instead of creating groups.",
     "P1"),
    ("S2", "Rules in the backend", "One room per student per course, seats reserved for the majors a group type "
                                   "still needs, eligibility (minimum size and majors), deadline lock.", "P2, P4"),
    ("S3", "Skills and suggestions", "Students rate their strengths 1-5; a gRPC Recommendation Service ranks rooms "
                                     "for a student and placements for the admin.", "P3"),
    ("S4", "Deadline and finalize", "The course expires at ExpireAt (background job); the admin places the remaining "
                                    "students and finalizes numbered, read-only official groups.", "P4"),
    ("S5", "Built-in chat and notifications", "One chat per room and real-time notifications (Realtime Service, "
                                              "SignalR).", "P5"),
    ("S6", "Lecturer view", "Lecturer accounts with a read-only view of the courses they teach.", "P6"),
    ("S7", "Distributed .NET platform", "Microservices behind an API gateway, a database per service, transactional "
                                        "outbox and Redis Streams, Docker Compose, CI and a demo deployment.",
     "Assignment"),
]

ACTORS = [
    ("Admin", "Administrator", "Academic staff who runs group formation: the moderator of the lecturer's feedback.",
     "Accounts and roles; semesters, subjects, majors, skills, group types; courses and rosters; generate, publish "
     "and expire rooms; move and place students; finalize."),
    ("Lecturer", "Lecturer", "Teaches one or more EXE classes.",
     "Read-only: progress, rooms and members, students without a room and the official groups of their courses."),
    ("Student", "Student", "EXE student enrolled in courses of a semester.",
     "Rate skills; browse rooms and get suggestions; join, leave and apply; chat with the room; see the official "
     "groups."),
    ("Room Leader", "Student (leader of a room)", "First student to join a room, or the member the leader hands "
                                                  "over to.",
     "Set the topic; lock and unlock; approve and reject applications; remove a member with a reason; hand over "
     "leadership."),
    ("Scheduler", "-", "Background jobs of the services.",
     "Publish and expire courses on time; publish and consume events; clean up."),
]

FEATURES = [
    ("F01", "Sign in, refresh the token, sign out, edit own profile", "All", "Identity"),
    ("F02", "Manage accounts and roles: create, import students, lock and unlock", "Admin", "Identity"),
    ("F03", "Manage semesters, subjects, majors and skills", "Admin (read: all)", "Group"),
    ("F04", "Manage group types (minimum students per major, minimum different majors) and allow them per semester",
     "Admin", "Group"),
    ("F05", "Add students to a semester with their major; enroll them in courses", "Admin", "Group"),
    ("F06", "Create courses (subject + class + semester): lecturer, group sizes, k, PublishAt, ExpireAt", "Admin",
     "Group"),
    ("F07", "Generate the rooms of a course with their group type", "Admin", "Group"),
    ("F08", "Publish and expire a course, manually or on time; move the deadline later", "Admin, Scheduler",
     "Group"),
    ("F09", "Rate own skills 1-5", "Student", "Group"),
    ("F10", "Browse rooms with search, filters, sorting and paging; see members, majors, skills and topic",
     "Student, Lecturer, Admin", "Group"),
    ("F11", "Get room suggestions", "Student", "Group + Recommendation (gRPC)"),
    ("F12", "Join an open room; leave a room", "Student", "Group"),
    ("F13", "Apply to a locked room; withdraw the application", "Student", "Group"),
    ("F14", "Set the topic, lock and unlock, approve and reject, remove a member, hand over leadership",
     "Room Leader", "Group"),
    ("F15", "Course overview: students without a room, rooms that are not eligible", "Admin, Lecturer", "Group"),
    ("F16", "Move and place students after the deadline, with placement suggestions", "Admin",
     "Group + Recommendation (gRPC)"),
    ("F17", "Finalize the course into numbered, read-only official groups", "Admin", "Group"),
    ("F18", "Chat with the members of the room", "Student", "Realtime"),
    ("F19", "Receive notifications: applications, decisions, removals, phase changes", "All", "Realtime"),
    ("F20", "Scheduled work: publish and expire on time, publish events, clean up", "Scheduler", "Group, Realtime"),
]

RULES = [
    ("BR-01", "A course is one subject taught to one class in one semester; the class code is unique per subject "
              "and semester."),
    ("BR-02", "A student takes part in a semester with exactly one major (imported by the admin) and can be "
              "enrolled only in courses of that semester."),
    ("BR-03", "Rooms of a course = ceil(enrolled students / MaxGroupSize x k), k = RoomFactor (default 1.2). Every "
              "room has Capacity = MaxGroupSize and a group type allowed in the semester."),
    ("BR-04", "Rooms are generated, renamed or deleted only while the course is in Setup."),
    ("BR-05", "Students join, leave and apply only while the course is Published."),
    ("BR-06", "A student is in at most one room per course. Joining a room cancels their pending applications in "
              "that course (JOINED_ANOTHER_ROOM)."),
    ("BR-07", "The first student to join an empty room becomes its leader. When the leader leaves, the earliest "
              "remaining member takes over; the leader may also hand over leadership."),
    ("BR-08", "Open room: enrolled students join directly. Locked room: students apply and the leader decides. "
              "Unlocking, or the room becoming empty, cancels its pending applications (ROOM_REOPENED)."),
    ("BR-09", "Every join or approval must keep enough free seats for the majors the group type still needs: the "
              "minimum per major and the minimum number of different majors (COMPOSITION_RULE)."),
    ("BR-10", "A full room accepts no one. When a room becomes full its pending applications are rejected "
              "(ROOM_FULL)."),
    ("BR-11", "Until the course expires the leader may remove a member and must give a reason; the removed "
              "student cannot join or apply to that room again (REMOVED_FROM_ROOM). Memberships are kept as "
              "history: Left, Removed, Moved."),
    ("BR-12", "At ExpireAt, or when the admin expires the course, pending applications are rejected "
              "(GROUPING_EXPIRED) and students can no longer change rooms; only the admin moves or places "
              "students (JoinedVia = Admin, EndReason = Moved). While the course is Published the admin may move "
              "ExpireAt later."),
    ("BR-13", "A room is eligible when it has at least MinGroupSize members and the majors its group type "
              "requires."),
    ("BR-14", "Finalize needs every enrolled student in a room and every non-empty room eligible; the admin may "
              "confirm an exception (for example a class too small for the rules). Empty rooms are deleted; the "
              "others get GroupNo 1..n and become read-only official groups."),
    ("BR-15", "Skills are self-rated 1-5 per semester. They are shown to students and leaders and used for "
              "suggestions; they never block an action."),
    ("BR-16", "A lecturer sees only the courses they teach. Only the members of a room can read its chat."),
]

STATUSES = [
    ("Course phase (Courses.Phase)", [
        ("Setup", "The admin imports students, generates rooms and sets group types; students rate skills."),
        ("Published", "Students join, leave and apply; leaders lock, review applications and remove members."),
        ("Expired", "Students are frozen; the admin moves and places students."),
        ("Finalized", "Rooms are numbered official groups; the list is read-only."),
    ]),
    ("Room status (Rooms.Status)", [
        ("Open", "Enrolled students join directly."),
        ("Locked", "Students apply; the leader approves or rejects."),
        ("Finalized", "Official group (GroupNo set); read-only."),
    ]),
    ("Membership (RoomMembers.JoinedVia / EndReason)", [
        ("Open / Application / Admin", "How the student entered: direct join, approved application, admin placement."),
        ("Left / Removed / Moved", "How the membership ended: the student left, the leader removed them, the admin "
                                   "moved them."),
    ]),
    ("Application (JoinRequests.Status)", [
        ("Pending", "Waiting for the leader."),
        ("Approved", "The student became a member."),
        ("Rejected", "By the leader or automatically (see ReasonCode)."),
        ("Cancelled", "Withdrawn by the student or cancelled automatically (see ReasonCode)."),
    ]),
]

CONTAINERS = [
    ("Single-Page App", "React 19, TypeScript, Vite, nginx",
     "UI for all roles; nginx serves the app and proxies /api, /hubs and /swagger to the gateway.", "web: 3000 -> 80"),
    ("API Gateway", "ASP.NET Core 10, YARP 2.3",
     "Single entry point: JWT check at the edge, routing by path prefix, WebSocket pass-through, sign-in rate "
     "limit, merged Swagger UI.", "8080"),
    ("Identity Service", "ASP.NET Core 10 Web API", "Sign-in, JWT access and refresh tokens, users and roles.",
     "IdentityDb"),
    ("Group Service", "ASP.NET Core 10 Web API",
     "Semesters, subjects, majors, skills, group types, courses and rosters, rooms, memberships, applications and "
     "finalize; calls the Recommendation Service; writes the outbox; schedules publish and expiry.", "GroupDb"),
    ("Recommendation Service", "ASP.NET Core 10 gRPC",
     "Ranks rooms for a student and placements for students without a room from majors and skills. Stateless, "
     "no database, not routed by the gateway.", "8081 (HTTP/2)"),
    ("Realtime Service", "ASP.NET Core 10 Web API + SignalR",
     "Group chat and notifications; consumes the group events and pushes them to browsers.", "ChatDb, /hubs"),
    ("IdentityDb, GroupDb, ChatDb", "SQL Server 2022", "One database per service; no cross-database foreign keys.",
     "1433"),
    ("Event Streams", "Redis 7 Streams", "Stream group-events; consumer group realtime.", "6379"),
]

COMMUNICATION = [
    ("REST (synchronous)", "Browser -> Gateway -> services", "HTTPS, JSON envelope, /api/v1, JWT",
     "Every user action."),
    ("gRPC (synchronous)", "Group Service -> Recommendation Service", "Protobuf over HTTP/2 (:8081), 2 s deadline",
     "Room suggestions and placement suggestions; the Group Service falls back to unranked lists."),
    ("Events (asynchronous)", "Group Service -> Redis Streams -> Realtime Service",
     "XADD from the outbox; XREADGROUP and XACK", "Notifications, chat membership, live room board."),
    ("WebSocket", "Browser <-> Realtime Service (through the gateway)", "SignalR hub /hubs/realtime",
     "Chat messages, notifications and room changes pushed to the browser."),
]

COMMUNICATION_RULE = ("Rule of thumb: the browser calls REST; a service that needs an answer now calls gRPC; a "
                      "service that only announces that something happened publishes an event.")

FLOWS = [
    ("Apply to a locked room and approval (single transaction)", [
        "The student calls POST /api/v1/join-requests {roomId, message}. The Group Service checks BR-05, BR-06, "
        "BR-08 and BR-11, stores the application as Pending and writes JoinRequestSubmitted to the outbox.",
        "The OutboxPublisher adds the event to group-events; the Realtime Service notifies the leader.",
        "The leader calls POST /api/v1/join-requests/{id}/approve. In one transaction the Group Service checks the "
        "seat and the majors again (BR-09, BR-10), inserts the membership (JoinedVia = Application), updates "
        "Rooms.MemberCount (RowVersion), cancels the student's other pending applications, rejects the room's "
        "pending applications if it is now full and writes the events.",
        "The Realtime Service notifies the applicant, adds them to the room chat and refreshes the room board.",
    ]),
    ("Room suggestions (REST -> gRPC)", [
        "The student calls GET /api/v1/courses/{id}/rooms/suggestions?top=3.",
        "The Group Service loads the student's major and skills, the rooms with a free seat, their members' majors "
        "and skills and the group type minimums.",
        "It calls Recommendation.SuggestRooms with a 2 s deadline.",
        "The Recommendation Service drops the rooms the student cannot join, scores the others and returns them "
        "ranked, with reasons.",
        "If the call fails the Group Service returns the rooms without ranking.",
    ]),
    ("Deadline (background job)", [
        "Every minute the PhaseScheduler finds Published courses whose ExpireAt has passed.",
        "In one transaction it sets Phase = Expired, rejects the pending applications (GROUPING_EXPIRED) and writes "
        "CoursePhaseChanged.",
        "The Realtime Service notifies the students of the course and the admin.",
    ]),
    ("Finalize", [
        "The admin opens GET /api/v1/courses/{id}/overview: students without a room and rooms that are not eligible.",
        "The admin places students with POST /api/v1/courses/{id}/placements, helped by "
        "GET /api/v1/courses/{id}/placement-suggestions (gRPC).",
        "POST /api/v1/courses/{id}/finalize {acceptExceptions} checks BR-14, deletes empty rooms, numbers the others, "
        "sets them Finalized and writes CoursePhaseChanged.",
        "Students and the lecturer are notified and see the official list.",
    ]),
]

EVENTS = [
    ("CoursePhaseChanged", "Publish, expire, finalize", "courseId, phase",
     "Notify the enrolled students (and the lecturer when finalized)."),
    ("RoomMemberJoined", "Join, approval, admin placement", "courseId, roomId, studentId, joinedVia",
     "Add the student to the room chat (create it for the first member); notify the leader; refresh the board."),
    ("RoomMemberLeft", "Leave, removal, admin move", "courseId, roomId, studentId, endReason, endNote",
     "Remove the student from the chat; notify a removed or moved student; refresh the board."),
    ("RoomLeaderChanged", "First join, leader left, hand-over", "roomId, leaderId", "Notify the new leader."),
    ("RoomStatusChanged", "Lock, unlock, finalize", "roomId, status", "Refresh the board."),
    ("JoinRequestSubmitted", "Application stored", "requestId, roomId, studentId, leaderId", "Notify the leader."),
    ("JoinRequestDecided", "Approve, reject, automatic rejection or cancellation",
     "requestId, roomId, studentId, status, reasonCode", "Notify the applicant."),
]

JOBS = [
    ("OutboxPublisher", "Group", "Every 2 s",
     "XADD unpublished OutboxEvents to group-events and set PublishedAtUtc; RetryCount and LastError on failure."),
    ("PhaseScheduler", "Group", "Every 1 min", "Publish courses at PublishAt; expire courses at ExpireAt (BR-12)."),
    ("OutboxCleanup", "Group", "Daily", "Delete published events older than 7 days."),
    ("GroupEventsConsumer", "Realtime", "Continuous",
     "XREADGROUP (group realtime); skip ids found in ProcessedEvents; apply; XACK after commit; XAUTOCLAIM stale "
     "entries."),
    ("ProcessedEventsCleanup", "Realtime", "Daily", "Delete processed event ids older than 7 days."),
]

PROTO = """syntax = "proto3";

option csharp_namespace = "ExeGroup.Contracts.Recommendation";

package exegroup.recommendation.v1;

service Recommendation {
  rpc SuggestRooms (SuggestRoomsRequest) returns (SuggestRoomsReply);
  rpc SuggestPlacements (SuggestPlacementsRequest) returns (SuggestPlacementsReply);
}

message Student {
  string student_id = 1;
  string major_code = 2;
  map<string, int32> skills = 3;
}

message Room {
  string room_id = 1;
  string name = 2;
  int32 capacity = 3;
  repeated Student members = 4;
  map<string, int32> min_per_major = 5;
  int32 min_distinct_majors = 6;
  int32 min_group_size = 7;
}

message Reason {
  string code = 1;
  string detail = 2;
}

message SuggestRoomsRequest {
  Student student = 1;
  repeated Room rooms = 2;
  int32 top = 3;
}

message RoomSuggestion {
  string room_id = 1;
  double score = 2;
  repeated Reason reasons = 3;
}

message SuggestRoomsReply {
  repeated RoomSuggestion suggestions = 1;
}

message SuggestPlacementsRequest {
  repeated Student unassigned = 1;
  repeated Room rooms = 2;
}

message Placement {
  string student_id = 1;
  string room_id = 2;
  repeated Reason reasons = 3;
}

message SuggestPlacementsReply {
  repeated Placement placements = 1;
  repeated string unplaced_student_ids = 2;
}"""

SCORING = [
    "Rooms the student cannot join are dropped: full rooms and rooms where the join would break BR-09.",
    "MAJOR_NEEDED: the room still needs the student's major (minimum per major or a new distinct major).",
    "SKILL_GAP: for every skill, the student's level above the best level in the room (detail = skill code).",
    "BELOW_MINIMUM: the room has fewer than MinGroupSize members.",
    "Placements: students with the scarcest majors are placed first, each into the best-scoring room that keeps "
    "BR-09; students that fit nowhere are returned as unplaced.",
]

CONVENTIONS = [
    "Three projects per service: API -> Services -> Repositories. Architecture tests fail the build when the API "
    "uses EF Core, when Services or Repositories use ASP.NET Core, or when a service references another one.",
    "Four model types: Entity (Repositories), business model (Services), Request and Response (API).",
    "Every response is an envelope {success, message, data, errors, traceId, pagination}; failures are coded "
    "exceptions mapped to 400, 401, 403, 404 and 409 with a business code (the codes of section 5.3).",
    "Versioned routes /api/v{version}/<plural-resource>; authentication is required unless an endpoint is marked "
    "anonymous; roles through [Authorize(Roles = ...)], room leadership and lecturer ownership checked in the "
    "Services layer.",
    "List endpoints accept search, sort (several fields, '-' for descending), page, pageSize (default 20, at most "
    "100), fields and expand, plus their own filters.",
    "Serilog with a correlation id (X-Correlation-ID) carried across REST, gRPC and events; health checks per "
    "service; one OpenAPI document per service, merged at the gateway.",
]

TECH = [
    ("Runtime", ".NET 10 (SDK pinned in global.json), C# latest, nullable enabled, warnings as errors"),
    ("Backend", "ASP.NET Core 10; three projects per service (API -> Services -> Repositories)"),
    ("Data", "Entity Framework Core 10, SQL Server 2022, code-first migrations matching database/schema.sql"),
    ("Gateway", "YARP 2.3"),
    ("Synchronous service calls", "gRPC: Grpc.AspNetCore / Grpc.Net.ClientFactory 2.85, Protobuf over HTTP/2"),
    ("Messaging", "Redis 7 Streams (StackExchange.Redis 3.x), transactional outbox, idempotent consumer"),
    ("Real time", "ASP.NET Core SignalR (chat, notifications, live room board)"),
    ("Background jobs", "BackgroundService + PeriodicTimer through a shared PeriodicBackgroundService base"),
    ("Security", "JWT Bearer HS256, rotating refresh tokens, ASP.NET Core PasswordHasher"),
    ("API surface", "URL versioning (Asp.Versioning 10), JSON and XML, DataAnnotations + FluentValidation"),
    ("API documentation", "Swashbuckle 10 (OpenAPI), one document per service, merged Swagger UI at the gateway"),
    ("Logging", "Serilog with correlation id; request-logging and exception middleware"),
    ("Frontend", "React 19, TypeScript, Vite, React Router 7, TanStack Query 5, nginx"),
    ("Tests", "xUnit v3, Testcontainers (real SQL Server), NetArchTest"),
    ("Deployment", "Docker, Docker Compose (8 containers), GitHub Actions CI and demo deployment"),
]

ENTITIES = [
    ("USER, ROLE", "Accounts and their global roles.", "IdentityDb"),
    ("SEMESTER", "Academic term, e.g. FA26.", "GroupDb"),
    ("SUBJECT", "Subject such as EXE101.", "GroupDb"),
    ("COURSE", "A subject taught to one class in one semester, with grouping settings, phase and lecturer.",
     "GroupDb"),
    ("STUDENT", "A user taking part in a semester, with one major.", "GroupDb"),
    ("MAJOR, SKILL", "Study majors; strengths students rate (rates 1-5).", "GroupDb"),
    ("ENROLLMENT", "A student on the roster of a course.", "GroupDb"),
    ("GROUP_TYPE", "Major mix rules (requires >= n of a major); allowed per semester.", "GroupDb"),
    ("ROOM", "A slot of a course; becomes an official group at finalize.", "GroupDb"),
    ("ROOM_MEMBER", "A membership of an enrolled student in a room, current or ended; the room is led by one.",
     "GroupDb"),
    ("JOIN_REQUEST", "An application of an enrolled student to a locked room.", "GroupDb"),
    ("CHAT_MESSAGE", "A message in the room's chat.", "ChatDb"),
]

API = [
    ("Identity Service", [
        ("POST", "/auth/login", "Anonymous", "Sign in; returns an access token and a refresh token."),
        ("POST", "/auth/refresh-token", "Anonymous", "Rotate the refresh token and get a new access token."),
        ("POST", "/auth/logout", "Signed in", "Revoke the refresh token."),
        ("GET, PUT", "/auth/me", "Signed in", "Read or update own name and password."),
        ("GET", "/users", "Administrator", "List users: search name, e-mail or code; filter role, status; sort; page."),
        ("GET, PUT", "/users/{id}", "Administrator", "Read or update a user: name, roles, status (lock revokes tokens)."),
        ("POST", "/users", "Administrator", "Create an account with its roles, e.g. a lecturer."),
        ("POST", "/users/import", "Administrator", "Create or update student accounts in bulk (by e-mail); returns their ids."),
    ]),
    ("Group Service: master data", [
        ("GET, POST", "/semesters", "Read: all; write: Administrator", "List (search, sort, page) and create."),
        ("GET, PUT, DELETE", "/semesters/{id}", "Read: all; write: Administrator", "Read, update, delete."),
        ("GET, POST, PUT, DELETE", "/subjects, /majors, /skills (+ /{id})", "Read: all; write: Administrator",
         "Same CRUD and list conventions."),
        ("GET, POST, PUT, DELETE", "/group-types (+ /{id})", "Read: all; write: Administrator",
         "Group types; PUT /group-types/{id}/majors sets the minimum per major."),
        ("GET, PUT", "/semesters/{id}/group-types", "Read: all; write: Administrator",
         "Group types allowed in the semester."),
    ]),
    ("Group Service: students and courses", [
        ("GET, POST", "/semesters/{id}/students", "Administrator",
         "List (search, filter majorId, sort, page); add or update students with their major (bulk)."),
        ("DELETE", "/semesters/{id}/students/{studentId}", "Administrator", "Remove a student not enrolled anywhere."),
        ("GET", "/semesters/{id}/students/me", "Student", "Own major and skills."),
        ("PUT", "/semesters/{id}/students/me/skills", "Student", "Rate own skills 1-5."),
        ("GET, POST", "/courses", "Read: all (mine=true); write: Administrator",
         "List (filter semesterId, subjectId, phase, mine; search class code; sort; page) and create."),
        ("GET, PUT, DELETE", "/courses/{id}", "Read: course members, lecturer, Administrator; write: Administrator",
         "Read; update settings, lecturer, PublishAt and ExpireAt; delete in Setup."),
        ("GET, POST", "/courses/{id}/students", "Read: Administrator, lecturer; write: Administrator",
         "Roster (filter majorId, hasRoom; search; sort; page); enroll semester students."),
        ("DELETE", "/courses/{id}/students/{studentId}", "Administrator", "Remove a student without a room."),
        ("POST", "/courses/{id}/rooms/generate", "Administrator", "Setup: create the rooms (BR-03)."),
        ("POST", "/courses/{id}/publish, /courses/{id}/expire", "Administrator", "Change the phase now."),
        ("GET", "/courses/{id}/overview", "Administrator, lecturer",
         "Counts, students without a room, rooms that are not eligible."),
        ("GET", "/courses/{id}/placement-suggestions", "Administrator", "Expired: suggestions (gRPC)."),
        ("POST", "/courses/{id}/placements", "Administrator", "Expired: move or place students."),
        ("POST", "/courses/{id}/finalize", "Administrator", "Finalize (BR-14) with acceptExceptions."),
    ]),
    ("Group Service: rooms and applications", [
        ("GET", "/courses/{id}/rooms", "Course members, lecturer, Administrator",
         "Filter status, hasSeat, groupTypeId; search name or topic; sort name or memberCount; page."),
        ("GET", "/courses/{id}/rooms/suggestions", "Student", "Top rooms with reasons (gRPC)."),
        ("GET, PUT", "/rooms/{id}", "Read: course members, lecturer, Administrator; write: leader (topic), "
                                    "Administrator (Setup)", "Room with members, majors, skills and leader."),
        ("DELETE", "/rooms/{id}", "Administrator", "Delete an empty room in Setup."),
        ("POST", "/rooms/{id}/join, /rooms/{id}/leave", "Student", "Join an open room; leave a room."),
        ("POST", "/rooms/{id}/lock, /rooms/{id}/unlock", "Room leader", "Switch between Open and Locked."),
        ("POST", "/rooms/{id}/leader", "Room leader", "Hand over leadership to a member."),
        ("POST", "/rooms/{id}/members/{studentId}/remove", "Room leader", "Remove a member with a reason (BR-11)."),
        ("GET, POST", "/join-requests", "Read: own, leader of the room, Administrator; write: Student",
         "List (filter roomId, courseId, status; sort; page); apply to a locked room."),
        ("GET", "/join-requests/{id}", "Applicant, leader, Administrator", "One application."),
        ("POST", "/join-requests/{id}/approve, /reject, /withdraw", "Leader (approve, reject); applicant (withdraw)",
         "Decide or withdraw."),
    ]),
    ("Realtime Service", [
        ("GET", "/conversations", "Signed in", "Own room chats with the last message."),
        ("GET, POST", "/conversations/{id}/messages", "Room members",
         "Messages, newest first (before, pageSize); send a message."),
        ("DELETE", "/messages/{id}", "Sender", "Delete own message."),
        ("GET", "/notifications", "Signed in", "Own notifications (filter unread; page)."),
        ("POST", "/notifications/{id}/read, /notifications/read-all", "Signed in", "Mark as read."),
        ("WebSocket", "/hubs/realtime", "Signed in",
         "Server to client: notificationReceived, messageReceived, roomChanged."),
    ]),
]

REQUIREMENTS = [
    ("2.1 REST API service", "Identity, Group and Realtime services (Appendix A); CRUD for semesters, subjects, "
                             "majors, skills, group types, courses, rooms and users; layered architecture and JWT "
                             "(section 6.8); search, filters, sorting and paging on every list."),
    ("2.2 Background job", "PhaseScheduler, OutboxPublisher, clean-ups and the GroupEventsConsumer (section 6.6)."),
    ("2.3 Message broker", "Redis Streams: the Group Service produces, the Realtime Service consumes (section 6.5)."),
    ("2.4 gRPC service", "Recommendation Service: independent, gRPC only, called by the Group Service REST API "
                         "(sections 6.4 and 6.7)."),
    ("3 Deployment", "Docker Compose with all containers; demo server deployed by GitHub Actions."),
    ("4 Technical requirements", ".NET 10, EF Core 10, SQL Server 2022, dependency injection, configuration, "
                                 "Serilog and exception middleware, JWT, REST, gRPC, Redis, BackgroundService, Docker "
                                 "(section 7)."),
    ("5 Deliverables", "Source code, EF Core migrations and database/schema.sql, Dockerfiles, docker-compose.yml, "
                       "Swagger at the gateway, README.md."),
    ("6 Demonstration", "README demo script: setup, publish, join, apply and approve, suggestions, expiry by the job, "
                        "placement, finalize, chat."),
]

FIGURES = {
    "fig1": ("fig1_c4_l1_context.png", "Figure 1. System Context diagram (C4 Level 1)"),
    "fig2": ("fig2_c4_l2_container.png", "Figure 2. Container diagram (C4 Level 2)"),
    "fig3": ("fig3_conceptual_erd.png", "Figure 3. Conceptual ERD"),
    "fig4": ("fig4_physical_identitydb.png", "Figure 4. Physical database: IdentityDb"),
    "fig5a": ("fig5a_physical_groupdb_academic.png", "Figure 5a. Physical database: GroupDb (1/2), semesters, courses "
                                                     "and students"),
    "fig5b": ("fig5b_physical_groupdb_rooms.png", "Figure 5b. Physical database: GroupDb (2/2), group types, rooms "
                                                  "and applications"),
    "fig6": ("fig6_physical_chatdb.png", "Figure 6. Physical database: ChatDb"),
    "figA": ("figA_grouping_workflow.png", "Figure A. Grouping workflow: course phases, room statuses and rules"),
}

REASON_CODES = spec.REASON_CODES
APPLY_ERRORS = spec.APPLY_ERRORS
