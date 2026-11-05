/*
  EXE Group Management System - reference DDL (SQL Server 2019+/2022)
  Generated from the design specification v2.0 (November 1, 2026).
  The EF Core Code-First migrations of each service are the source of truth at runtime;
  this script mirrors the same physical model for review and manual setup.
  Run with sqlcmd (e.g. sqlcmd -S localhost -E -I -i schema.sql) or in SSMS.
*/

-- ==========================================================================
-- IdentityDb (owned by Identity Service)
-- ==========================================================================
IF DB_ID(N'IdentityDb') IS NULL CREATE DATABASE [IdentityDb];
GO
USE [IdentityDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;  -- required for filtered indexes
GO

-- Users: User accounts for all roles.
CREATE TABLE dbo.[Users] (
    [UserId] uniqueidentifier NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [UserCode] varchar(20) NULL,
    [PasswordHash] nvarchar(500) NOT NULL,
    [FullName] nvarchar(150) NOT NULL,
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_Users_Status] DEFAULT ('Active'),
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Users_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserId]),
    CONSTRAINT [CK_Users_Status] CHECK ([Status] IN ('Active', 'Locked'))
);
CREATE UNIQUE INDEX [UX_Users_Email] ON dbo.[Users] ([Email]);
CREATE UNIQUE INDEX [UX_Users_UserCode] ON dbo.[Users] ([UserCode]) WHERE [UserCode] IS NOT NULL;
GO

-- Roles: Global roles (seeded): Student, Lecturer, Administrator.
CREATE TABLE dbo.[Roles] (
    [RoleId] uniqueidentifier NOT NULL,
    [Name] varchar(50) NOT NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([RoleId])
);
CREATE UNIQUE INDEX [UX_Roles_Name] ON dbo.[Roles] ([Name]);
GO

-- UserRoles: Many-to-many assignment of roles to users.
CREATE TABLE dbo.[UserRoles] (
    [UserId] uniqueidentifier NOT NULL,
    [RoleId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_UserRoles] PRIMARY KEY CLUSTERED ([UserId], [RoleId])
);
CREATE INDEX [IX_UserRoles_RoleId] ON dbo.[UserRoles] ([RoleId]);
GO

CREATE TABLE dbo.[RefreshTokens] (
    [RefreshTokenId] uniqueidentifier NOT NULL,
    [UserId] uniqueidentifier NOT NULL,
    [TokenHash] char(64) NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_RefreshTokens_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [RevokedAt] datetime2 NULL,
    [ReplacedByTokenId] uniqueidentifier NULL,
    CONSTRAINT [PK_RefreshTokens] PRIMARY KEY CLUSTERED ([RefreshTokenId])
);
CREATE UNIQUE INDEX [UX_RefreshTokens_TokenHash] ON dbo.[RefreshTokens] ([TokenHash]);
CREATE INDEX [IX_RefreshTokens_UserId] ON dbo.[RefreshTokens] ([UserId]);
GO

ALTER TABLE dbo.[UserRoles] ADD CONSTRAINT [FK_UserRoles_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.[Users] ([UserId]) ON DELETE CASCADE;
ALTER TABLE dbo.[UserRoles] ADD CONSTRAINT [FK_UserRoles_Roles] FOREIGN KEY ([RoleId]) REFERENCES dbo.[Roles] ([RoleId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[RefreshTokens] ADD CONSTRAINT [FK_RefreshTokens_Users] FOREIGN KEY ([UserId]) REFERENCES dbo.[Users] ([UserId]) ON DELETE CASCADE;
GO

-- Seed data: global roles
INSERT INTO dbo.[Roles] ([RoleId], [Name]) VALUES
    ('6B1F2A40-0001-4C1A-9F00-000000000001', 'Student'),
    ('6B1F2A40-0002-4C1A-9F00-000000000002', 'Lecturer'),
    ('6B1F2A40-0003-4C1A-9F00-000000000003', 'Administrator');
GO

-- ==========================================================================
-- GroupDb (owned by Group Service)
-- ==========================================================================
IF DB_ID(N'GroupDb') IS NULL CREATE DATABASE [GroupDb];
GO
USE [GroupDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;  -- required for filtered indexes
GO

-- Semesters: Academic semesters.
CREATE TABLE dbo.[Semesters] (
    [SemesterId] uniqueidentifier NOT NULL,
    [Code] varchar(20) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    [StartDate] date NOT NULL,
    [EndDate] date NOT NULL,
    CONSTRAINT [PK_Semesters] PRIMARY KEY CLUSTERED ([SemesterId]),
    CONSTRAINT [CK_Semesters_Dates] CHECK ([EndDate] > [StartDate])
);
CREATE UNIQUE INDEX [UX_Semesters_Code] ON dbo.[Semesters] ([Code]);
GO

-- Courses: EXE courses.
CREATE TABLE dbo.[Courses] (
    [CourseId] uniqueidentifier NOT NULL,
    [Code] varchar(20) NOT NULL,
    [Name] nvarchar(150) NOT NULL,
    CONSTRAINT [PK_Courses] PRIMARY KEY CLUSTERED ([CourseId])
);
CREATE UNIQUE INDEX [UX_Courses_Code] ON dbo.[Courses] ([Code]);
GO

-- ExeClasses: Class sections of an EXE course in a semester, with grouping rules.
CREATE TABLE dbo.[ExeClasses] (
    [ClassId] uniqueidentifier NOT NULL,
    [SemesterId] uniqueidentifier NOT NULL,
    [CourseId] uniqueidentifier NOT NULL,
    [ClassCode] varchar(30) NOT NULL,
    [LecturerId] uniqueidentifier NOT NULL,
    [MinMembers] int NOT NULL,
    [MaxMembers] int NOT NULL,
    [Deadline] datetime2 NOT NULL,
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_ExeClasses_Status] DEFAULT ('Open'),
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_ExeClasses_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_ExeClasses] PRIMARY KEY CLUSTERED ([ClassId]),
    CONSTRAINT [CK_ExeClasses_Members] CHECK ([MinMembers] >= 1 AND [MaxMembers] >= [MinMembers]),
    CONSTRAINT [CK_ExeClasses_Status] CHECK ([Status] IN ('Open', 'Closed'))
);
CREATE UNIQUE INDEX [UX_ExeClasses_Semester_Course_Code] ON dbo.[ExeClasses] ([SemesterId], [CourseId], [ClassCode]);
CREATE INDEX [IX_ExeClasses_CourseId] ON dbo.[ExeClasses] ([CourseId]);
CREATE INDEX [IX_ExeClasses_LecturerId] ON dbo.[ExeClasses] ([LecturerId]);
GO

-- ClassEnrollments: Class roster: which students belong to which class.
CREATE TABLE dbo.[ClassEnrollments] (
    [ClassId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [StudentCode] varchar(20) NOT NULL,
    [FullName] nvarchar(150) NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [EnrolledAt] datetime2 NOT NULL CONSTRAINT [DF_ClassEnrollments_EnrolledAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_ClassEnrollments] PRIMARY KEY CLUSTERED ([ClassId], [StudentId])
);
CREATE INDEX [IX_ClassEnrollments_StudentId] ON dbo.[ClassEnrollments] ([StudentId]);
GO

-- Groups: Project groups formed inside a class.
CREATE TABLE dbo.[Groups] (
    [GroupId] uniqueidentifier NOT NULL,
    [ClassId] uniqueidentifier NOT NULL,
    [LeaderId] uniqueidentifier NOT NULL,
    [Title] nvarchar(200) NOT NULL,
    [Description] nvarchar(1000) NULL,
    [CurrentMemberCount] int NOT NULL CONSTRAINT [DF_Groups_CurrentMemberCount] DEFAULT (1),
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_Groups_Status] DEFAULT ('Recruiting'),
    [RowVersion] rowversion NOT NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Groups_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Groups] PRIMARY KEY CLUSTERED ([GroupId]),
    CONSTRAINT [AK_Groups_GroupId_ClassId] UNIQUE ([GroupId], [ClassId]),
    CONSTRAINT [CK_Groups_Status] CHECK ([Status] IN ('Recruiting', 'Full', 'Locked', 'Dissolved')),
    CONSTRAINT [CK_Groups_MemberCount] CHECK (([Status] = 'Dissolved' AND [CurrentMemberCount] = 0) OR ([Status] <> 'Dissolved' AND [CurrentMemberCount] >= 1))
);
CREATE UNIQUE INDEX [UX_Groups_Class_Title] ON dbo.[Groups] ([ClassId], [Title]) WHERE [Status] <> 'Dissolved';
CREATE INDEX [IX_Groups_Class_Status] ON dbo.[Groups] ([ClassId], [Status]);
CREATE INDEX [IX_Groups_LeaderId] ON dbo.[Groups] ([LeaderId]);
GO

-- GroupMembers: Membership of enrolled students in groups.
CREATE TABLE dbo.[GroupMembers] (
    [MembershipId] uniqueidentifier NOT NULL,
    [GroupId] uniqueidentifier NOT NULL,
    [ClassId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [JoinedAt] datetime2 NOT NULL CONSTRAINT [DF_GroupMembers_JoinedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_GroupMembers] PRIMARY KEY CLUSTERED ([MembershipId])
);
CREATE UNIQUE INDEX [UX_GroupMembers_Class_Student] ON dbo.[GroupMembers] ([ClassId], [StudentId]);
CREATE INDEX [IX_GroupMembers_Group_Class] ON dbo.[GroupMembers] ([GroupId], [ClassId]);
GO

-- AddMemberRequests: Idempotency records of successful AddMemberIfEligible calls (one per join request).
CREATE TABLE dbo.[AddMemberRequests] (
    [RequestId] uniqueidentifier NOT NULL,
    [GroupId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [MembershipId] uniqueidentifier NOT NULL,
    [ProcessedAtUtc] datetime2 NOT NULL CONSTRAINT [DF_AddMemberRequests_ProcessedAtUtc] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_AddMemberRequests] PRIMARY KEY CLUSTERED ([RequestId])
);
CREATE INDEX [IX_AddMemberRequests_GroupId] ON dbo.[AddMemberRequests] ([GroupId]);
CREATE INDEX [IX_AddMemberRequests_ProcessedAtUtc] ON dbo.[AddMemberRequests] ([ProcessedAtUtc]);
GO

-- OutboxEvents: Transactional outbox: events written in the same transaction as the business change.
CREATE TABLE dbo.[OutboxEvents] (
    [EventId] uniqueidentifier NOT NULL,
    [EventType] varchar(100) NOT NULL,
    [AggregateId] uniqueidentifier NOT NULL,
    [Payload] nvarchar(max) NOT NULL,
    [CorrelationId] varchar(64) NULL,
    [OccurredAtUtc] datetime2 NOT NULL CONSTRAINT [DF_OutboxEvents_OccurredAtUtc] DEFAULT (SYSUTCDATETIME()),
    [PublishedAtUtc] datetime2 NULL,
    [RetryCount] int NOT NULL CONSTRAINT [DF_OutboxEvents_RetryCount] DEFAULT (0),
    [LastError] nvarchar(1000) NULL,
    CONSTRAINT [PK_OutboxEvents] PRIMARY KEY CLUSTERED ([EventId]),
    CONSTRAINT [CK_OutboxEvents_Payload] CHECK (ISJSON([Payload]) = 1)
);
CREATE INDEX [IX_OutboxEvents_Unpublished] ON dbo.[OutboxEvents] ([OccurredAtUtc]) WHERE [PublishedAtUtc] IS NULL;
CREATE INDEX [IX_OutboxEvents_PublishedAtUtc] ON dbo.[OutboxEvents] ([PublishedAtUtc]) WHERE [PublishedAtUtc] IS NOT NULL;
GO

-- Foreign keys (NO ACTION except UserRoles -> Users, to avoid multiple cascade paths)
ALTER TABLE dbo.[ExeClasses] ADD CONSTRAINT [FK_ExeClasses_Semesters] FOREIGN KEY ([SemesterId]) REFERENCES dbo.[Semesters] ([SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[ExeClasses] ADD CONSTRAINT [FK_ExeClasses_Courses] FOREIGN KEY ([CourseId]) REFERENCES dbo.[Courses] ([CourseId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[ClassEnrollments] ADD CONSTRAINT [FK_ClassEnrollments_ExeClasses] FOREIGN KEY ([ClassId]) REFERENCES dbo.[ExeClasses] ([ClassId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Groups] ADD CONSTRAINT [FK_Groups_ExeClasses] FOREIGN KEY ([ClassId]) REFERENCES dbo.[ExeClasses] ([ClassId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[GroupMembers] ADD CONSTRAINT [FK_GroupMembers_Groups] FOREIGN KEY ([GroupId], [ClassId]) REFERENCES dbo.[Groups] ([GroupId], [ClassId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[GroupMembers] ADD CONSTRAINT [FK_GroupMembers_ClassEnrollments] FOREIGN KEY ([ClassId], [StudentId]) REFERENCES dbo.[ClassEnrollments] ([ClassId], [StudentId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[AddMemberRequests] ADD CONSTRAINT [FK_AddMemberRequests_Groups] FOREIGN KEY ([GroupId]) REFERENCES dbo.[Groups] ([GroupId]) ON DELETE NO ACTION;
GO

-- ==========================================================================
-- RequestDb (owned by Join Request Service)
-- ==========================================================================
IF DB_ID(N'RequestDb') IS NULL CREATE DATABASE [RequestDb];
GO
USE [RequestDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;  -- required for filtered indexes
GO

-- JoinRequests: Requests from students to join a group, with their lifecycle state.
CREATE TABLE dbo.[JoinRequests] (
    [RequestId] uniqueidentifier NOT NULL,
    [GroupId] uniqueidentifier NOT NULL,
    [ClassId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [StudentCode] varchar(20) NOT NULL,
    [StudentName] nvarchar(150) NOT NULL,
    [GroupTitle] nvarchar(200) NOT NULL,
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_JoinRequests_Status] DEFAULT ('Pending'),
    [Message] nvarchar(500) NULL,
    [DecidedBy] uniqueidentifier NULL,
    [DecidedAt] datetime2 NULL,
    [ReasonCode] varchar(40) NULL,
    [ReasonText] nvarchar(500) NULL,
    [RowVersion] rowversion NOT NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_JoinRequests_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_JoinRequests] PRIMARY KEY CLUSTERED ([RequestId]),
    CONSTRAINT [CK_JoinRequests_Status] CHECK ([Status] IN ('Pending', 'Processing', 'Approved', 'Rejected', 'Cancelled')),
    CONSTRAINT [CK_JoinRequests_ReasonCode] CHECK ([ReasonCode] IS NULL OR [ReasonCode] IN ('GROUP_FULL', 'GROUP_LOCKED', 'GROUP_DISSOLVED', 'DEADLINE_PASSED', 'ALREADY_IN_OTHER_GROUP', 'NOT_ENROLLED', 'GROUP_NOT_FOUND', 'JOINED_ANOTHER_GROUP', 'REJECTED_BY_LEADER'))
);
CREATE UNIQUE INDEX [UX_JoinRequests_ActiveRequest] ON dbo.[JoinRequests] ([GroupId], [StudentId]) WHERE [Status] IN ('Pending', 'Processing');
CREATE INDEX [IX_JoinRequests_Student_Class_Status] ON dbo.[JoinRequests] ([StudentId], [ClassId], [Status]);
CREATE INDEX [IX_JoinRequests_Group_Status] ON dbo.[JoinRequests] ([GroupId], [Status]);
CREATE INDEX [IX_JoinRequests_Processing] ON dbo.[JoinRequests] ([DecidedAt]) WHERE [Status] = 'Processing';
GO

-- ProcessedEvents: Inbox of consumed event ids (idempotent consumer).
CREATE TABLE dbo.[ProcessedEvents] (
    [EventId] uniqueidentifier NOT NULL,
    [EventType] varchar(100) NOT NULL,
    [ProcessedAtUtc] datetime2 NOT NULL CONSTRAINT [DF_ProcessedEvents_ProcessedAtUtc] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_ProcessedEvents] PRIMARY KEY CLUSTERED ([EventId])
);
CREATE INDEX [IX_ProcessedEvents_ProcessedAtUtc] ON dbo.[ProcessedEvents] ([ProcessedAtUtc]);
GO
