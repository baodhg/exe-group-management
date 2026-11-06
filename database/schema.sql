IF DB_ID(N'IdentityDb') IS NULL CREATE DATABASE [IdentityDb];
GO
USE [IdentityDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

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

CREATE TABLE dbo.[Roles] (
    [RoleId] uniqueidentifier NOT NULL,
    [Name] varchar(50) NOT NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([RoleId])
);
CREATE UNIQUE INDEX [UX_Roles_Name] ON dbo.[Roles] ([Name]);
GO

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

INSERT INTO dbo.[Roles] ([RoleId], [Name]) VALUES
    ('6B1F2A40-0001-4C1A-9F00-000000000001', 'Student'),
    ('6B1F2A40-0002-4C1A-9F00-000000000002', 'Lecturer'),
    ('6B1F2A40-0003-4C1A-9F00-000000000003', 'Administrator');
GO

IF DB_ID(N'GroupDb') IS NULL CREATE DATABASE [GroupDb];
GO
USE [GroupDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

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

CREATE TABLE dbo.[Subjects] (
    [SubjectId] uniqueidentifier NOT NULL,
    [Code] varchar(20) NOT NULL,
    [Name] nvarchar(150) NOT NULL,
    CONSTRAINT [PK_Subjects] PRIMARY KEY CLUSTERED ([SubjectId])
);
CREATE UNIQUE INDEX [UX_Subjects_Code] ON dbo.[Subjects] ([Code]);
GO

CREATE TABLE dbo.[Majors] (
    [MajorId] uniqueidentifier NOT NULL,
    [Code] varchar(10) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    CONSTRAINT [PK_Majors] PRIMARY KEY CLUSTERED ([MajorId])
);
CREATE UNIQUE INDEX [UX_Majors_Code] ON dbo.[Majors] ([Code]);
GO

CREATE TABLE dbo.[Skills] (
    [SkillId] uniqueidentifier NOT NULL,
    [Code] varchar(20) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    CONSTRAINT [PK_Skills] PRIMARY KEY CLUSTERED ([SkillId])
);
CREATE UNIQUE INDEX [UX_Skills_Code] ON dbo.[Skills] ([Code]);
GO

CREATE TABLE dbo.[SemesterStudents] (
    [SemesterId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [StudentCode] varchar(20) NOT NULL,
    [FullName] nvarchar(150) NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [MajorId] uniqueidentifier NOT NULL,
    [AddedAt] datetime2 NOT NULL CONSTRAINT [DF_SemesterStudents_AddedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_SemesterStudents] PRIMARY KEY CLUSTERED ([SemesterId], [StudentId])
);
CREATE INDEX [IX_SemesterStudents_MajorId] ON dbo.[SemesterStudents] ([MajorId]);
GO

CREATE TABLE dbo.[StudentSkills] (
    [SemesterId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [SkillId] uniqueidentifier NOT NULL,
    [Level] tinyint NOT NULL,
    [UpdatedAt] datetime2 NOT NULL CONSTRAINT [DF_StudentSkills_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_StudentSkills] PRIMARY KEY CLUSTERED ([SemesterId], [StudentId], [SkillId]),
    CONSTRAINT [CK_StudentSkills_Level] CHECK ([Level] BETWEEN 1 AND 5)
);
CREATE INDEX [IX_StudentSkills_SkillId] ON dbo.[StudentSkills] ([SkillId]);
GO

CREATE TABLE dbo.[Courses] (
    [CourseId] uniqueidentifier NOT NULL,
    [SemesterId] uniqueidentifier NOT NULL,
    [SubjectId] uniqueidentifier NOT NULL,
    [ClassCode] varchar(30) NOT NULL,
    [LecturerId] uniqueidentifier NULL,
    [LecturerName] nvarchar(150) NULL,
    [MinGroupSize] int NOT NULL CONSTRAINT [DF_Courses_MinGroupSize] DEFAULT (4),
    [MaxGroupSize] int NOT NULL CONSTRAINT [DF_Courses_MaxGroupSize] DEFAULT (6),
    [RoomFactor] decimal(3,2) NOT NULL CONSTRAINT [DF_Courses_RoomFactor] DEFAULT (1.20),
    [Phase] varchar(20) NOT NULL CONSTRAINT [DF_Courses_Phase] DEFAULT ('Setup'),
    [PublishAt] datetime2 NULL,
    [ExpireAt] datetime2 NULL,
    [FinalizedAt] datetime2 NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_Courses] PRIMARY KEY CLUSTERED ([CourseId]),
    CONSTRAINT [AK_Courses_CourseId_SemesterId] UNIQUE ([CourseId], [SemesterId]),
    CONSTRAINT [CK_Courses_GroupSize] CHECK ([MinGroupSize] >= 1 AND [MaxGroupSize] >= [MinGroupSize]),
    CONSTRAINT [CK_Courses_RoomFactor] CHECK ([RoomFactor] >= 1.00),
    CONSTRAINT [CK_Courses_Phase] CHECK ([Phase] IN ('Setup', 'Published', 'Expired', 'Finalized')),
    CONSTRAINT [CK_Courses_Schedule] CHECK ([PublishAt] IS NULL OR [ExpireAt] IS NULL OR [ExpireAt] > [PublishAt])
);
CREATE UNIQUE INDEX [UX_Courses_Semester_Subject_Class] ON dbo.[Courses] ([SemesterId], [SubjectId], [ClassCode]);
CREATE INDEX [IX_Courses_SubjectId] ON dbo.[Courses] ([SubjectId]);
CREATE INDEX [IX_Courses_LecturerId] ON dbo.[Courses] ([LecturerId]) WHERE [LecturerId] IS NOT NULL;
CREATE INDEX [IX_Courses_Phase] ON dbo.[Courses] ([Phase]);
GO

CREATE TABLE dbo.[CourseEnrollments] (
    [CourseId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [SemesterId] uniqueidentifier NOT NULL,
    [EnrolledAt] datetime2 NOT NULL CONSTRAINT [DF_CourseEnrollments_EnrolledAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_CourseEnrollments] PRIMARY KEY CLUSTERED ([CourseId], [StudentId])
);
CREATE INDEX [IX_CourseEnrollments_Semester_Student] ON dbo.[CourseEnrollments] ([SemesterId], [StudentId]);
GO

CREATE TABLE dbo.[GroupTypes] (
    [GroupTypeId] uniqueidentifier NOT NULL,
    [Code] varchar(20) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    [MinDistinctMajors] int NOT NULL CONSTRAINT [DF_GroupTypes_MinDistinctMajors] DEFAULT (2),
    CONSTRAINT [PK_GroupTypes] PRIMARY KEY CLUSTERED ([GroupTypeId]),
    CONSTRAINT [CK_GroupTypes_MinDistinctMajors] CHECK ([MinDistinctMajors] >= 1)
);
CREATE UNIQUE INDEX [UX_GroupTypes_Code] ON dbo.[GroupTypes] ([Code]);
GO

CREATE TABLE dbo.[GroupTypeMajors] (
    [GroupTypeId] uniqueidentifier NOT NULL,
    [MajorId] uniqueidentifier NOT NULL,
    [MinMembers] int NOT NULL,
    CONSTRAINT [PK_GroupTypeMajors] PRIMARY KEY CLUSTERED ([GroupTypeId], [MajorId]),
    CONSTRAINT [CK_GroupTypeMajors_MinMembers] CHECK ([MinMembers] >= 1)
);
CREATE INDEX [IX_GroupTypeMajors_MajorId] ON dbo.[GroupTypeMajors] ([MajorId]);
GO

CREATE TABLE dbo.[SemesterGroupTypes] (
    [SemesterId] uniqueidentifier NOT NULL,
    [GroupTypeId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_SemesterGroupTypes] PRIMARY KEY CLUSTERED ([SemesterId], [GroupTypeId])
);
CREATE INDEX [IX_SemesterGroupTypes_GroupTypeId] ON dbo.[SemesterGroupTypes] ([GroupTypeId]);
GO

CREATE TABLE dbo.[Rooms] (
    [RoomId] uniqueidentifier NOT NULL,
    [CourseId] uniqueidentifier NOT NULL,
    [SemesterId] uniqueidentifier NOT NULL,
    [GroupTypeId] uniqueidentifier NOT NULL,
    [Name] nvarchar(50) NOT NULL,
    [Topic] nvarchar(200) NULL,
    [Capacity] int NOT NULL,
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_Rooms_Status] DEFAULT ('Open'),
    [LeaderId] uniqueidentifier NULL,
    [MemberCount] int NOT NULL CONSTRAINT [DF_Rooms_MemberCount] DEFAULT (0),
    [GroupNo] int NULL,
    [LockedAt] datetime2 NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_Rooms] PRIMARY KEY CLUSTERED ([RoomId]),
    CONSTRAINT [AK_Rooms_RoomId_CourseId] UNIQUE ([RoomId], [CourseId]),
    CONSTRAINT [CK_Rooms_Status] CHECK ([Status] IN ('Open', 'Locked', 'Finalized')),
    CONSTRAINT [CK_Rooms_MemberCount] CHECK ([MemberCount] >= 0 AND [MemberCount] <= [Capacity]),
    CONSTRAINT [CK_Rooms_Leader] CHECK (([MemberCount] = 0 AND [LeaderId] IS NULL) OR ([MemberCount] > 0 AND [LeaderId] IS NOT NULL))
);
CREATE UNIQUE INDEX [UX_Rooms_Course_Name] ON dbo.[Rooms] ([CourseId], [Name]);
CREATE UNIQUE INDEX [UX_Rooms_Course_GroupNo] ON dbo.[Rooms] ([CourseId], [GroupNo]) WHERE [GroupNo] IS NOT NULL;
CREATE INDEX [IX_Rooms_Semester_GroupType] ON dbo.[Rooms] ([SemesterId], [GroupTypeId]);
GO

CREATE TABLE dbo.[RoomMembers] (
    [MembershipId] uniqueidentifier NOT NULL,
    [RoomId] uniqueidentifier NOT NULL,
    [CourseId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [JoinedVia] varchar(20) NOT NULL,
    [JoinedAt] datetime2 NOT NULL CONSTRAINT [DF_RoomMembers_JoinedAt] DEFAULT (SYSUTCDATETIME()),
    [EndedAt] datetime2 NULL,
    [EndReason] varchar(20) NULL,
    [EndedBy] uniqueidentifier NULL,
    [EndNote] nvarchar(300) NULL,
    CONSTRAINT [PK_RoomMembers] PRIMARY KEY CLUSTERED ([MembershipId]),
    CONSTRAINT [CK_RoomMembers_JoinedVia] CHECK ([JoinedVia] IN ('Open', 'Application', 'Admin')),
    CONSTRAINT [CK_RoomMembers_End] CHECK (([EndedAt] IS NULL AND [EndReason] IS NULL) OR ([EndedAt] IS NOT NULL AND [EndReason] IN ('Left', 'Removed', 'Moved'))),
    CONSTRAINT [CK_RoomMembers_RemovedNote] CHECK ([EndReason] IS NULL OR [EndReason] <> 'Removed' OR [EndNote] IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_RoomMembers_Course_Student] ON dbo.[RoomMembers] ([CourseId], [StudentId]) WHERE [EndedAt] IS NULL;
CREATE INDEX [IX_RoomMembers_Room_Student] ON dbo.[RoomMembers] ([RoomId], [StudentId]);
GO

CREATE TABLE dbo.[JoinRequests] (
    [RequestId] uniqueidentifier NOT NULL,
    [RoomId] uniqueidentifier NOT NULL,
    [CourseId] uniqueidentifier NOT NULL,
    [StudentId] uniqueidentifier NOT NULL,
    [Message] nvarchar(500) NULL,
    [Status] varchar(20) NOT NULL CONSTRAINT [DF_JoinRequests_Status] DEFAULT ('Pending'),
    [DecidedBy] uniqueidentifier NULL,
    [DecidedAt] datetime2 NULL,
    [ReasonCode] varchar(40) NULL,
    [ReasonText] nvarchar(500) NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_JoinRequests_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_JoinRequests] PRIMARY KEY CLUSTERED ([RequestId]),
    CONSTRAINT [CK_JoinRequests_Status] CHECK ([Status] IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    CONSTRAINT [CK_JoinRequests_ReasonCode] CHECK ([ReasonCode] IS NULL OR [ReasonCode] IN ('REJECTED_BY_LEADER', 'WITHDRAWN', 'ROOM_FULL', 'ROOM_REOPENED', 'COMPOSITION_RULE', 'JOINED_ANOTHER_ROOM', 'GROUPING_EXPIRED'))
);
CREATE UNIQUE INDEX [UX_JoinRequests_Pending] ON dbo.[JoinRequests] ([RoomId], [StudentId]) WHERE [Status] = 'Pending';
CREATE INDEX [IX_JoinRequests_Course_Student_Status] ON dbo.[JoinRequests] ([CourseId], [StudentId], [Status]);
CREATE INDEX [IX_JoinRequests_Room_Status] ON dbo.[JoinRequests] ([RoomId], [Status]);
GO

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

ALTER TABLE dbo.[SemesterStudents] ADD CONSTRAINT [FK_SemesterStudents_Semesters] FOREIGN KEY ([SemesterId]) REFERENCES dbo.[Semesters] ([SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[SemesterStudents] ADD CONSTRAINT [FK_SemesterStudents_Majors] FOREIGN KEY ([MajorId]) REFERENCES dbo.[Majors] ([MajorId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[StudentSkills] ADD CONSTRAINT [FK_StudentSkills_SemesterStudents] FOREIGN KEY ([SemesterId], [StudentId]) REFERENCES dbo.[SemesterStudents] ([SemesterId], [StudentId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[StudentSkills] ADD CONSTRAINT [FK_StudentSkills_Skills] FOREIGN KEY ([SkillId]) REFERENCES dbo.[Skills] ([SkillId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Courses] ADD CONSTRAINT [FK_Courses_Semesters] FOREIGN KEY ([SemesterId]) REFERENCES dbo.[Semesters] ([SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Courses] ADD CONSTRAINT [FK_Courses_Subjects] FOREIGN KEY ([SubjectId]) REFERENCES dbo.[Subjects] ([SubjectId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[CourseEnrollments] ADD CONSTRAINT [FK_CourseEnrollments_Courses] FOREIGN KEY ([CourseId], [SemesterId]) REFERENCES dbo.[Courses] ([CourseId], [SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[CourseEnrollments] ADD CONSTRAINT [FK_CourseEnrollments_SemesterStudents] FOREIGN KEY ([SemesterId], [StudentId]) REFERENCES dbo.[SemesterStudents] ([SemesterId], [StudentId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[GroupTypeMajors] ADD CONSTRAINT [FK_GroupTypeMajors_GroupTypes] FOREIGN KEY ([GroupTypeId]) REFERENCES dbo.[GroupTypes] ([GroupTypeId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[GroupTypeMajors] ADD CONSTRAINT [FK_GroupTypeMajors_Majors] FOREIGN KEY ([MajorId]) REFERENCES dbo.[Majors] ([MajorId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[SemesterGroupTypes] ADD CONSTRAINT [FK_SemesterGroupTypes_Semesters] FOREIGN KEY ([SemesterId]) REFERENCES dbo.[Semesters] ([SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[SemesterGroupTypes] ADD CONSTRAINT [FK_SemesterGroupTypes_GroupTypes] FOREIGN KEY ([GroupTypeId]) REFERENCES dbo.[GroupTypes] ([GroupTypeId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Rooms] ADD CONSTRAINT [FK_Rooms_Courses] FOREIGN KEY ([CourseId], [SemesterId]) REFERENCES dbo.[Courses] ([CourseId], [SemesterId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Rooms] ADD CONSTRAINT [FK_Rooms_SemesterGroupTypes] FOREIGN KEY ([SemesterId], [GroupTypeId]) REFERENCES dbo.[SemesterGroupTypes] ([SemesterId], [GroupTypeId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[RoomMembers] ADD CONSTRAINT [FK_RoomMembers_Rooms] FOREIGN KEY ([RoomId], [CourseId]) REFERENCES dbo.[Rooms] ([RoomId], [CourseId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[RoomMembers] ADD CONSTRAINT [FK_RoomMembers_CourseEnrollments] FOREIGN KEY ([CourseId], [StudentId]) REFERENCES dbo.[CourseEnrollments] ([CourseId], [StudentId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[JoinRequests] ADD CONSTRAINT [FK_JoinRequests_Rooms] FOREIGN KEY ([RoomId], [CourseId]) REFERENCES dbo.[Rooms] ([RoomId], [CourseId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[JoinRequests] ADD CONSTRAINT [FK_JoinRequests_CourseEnrollments] FOREIGN KEY ([CourseId], [StudentId]) REFERENCES dbo.[CourseEnrollments] ([CourseId], [StudentId]) ON DELETE NO ACTION;
GO

IF DB_ID(N'ChatDb') IS NULL CREATE DATABASE [ChatDb];
GO
USE [ChatDb];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE dbo.[Conversations] (
    [ConversationId] uniqueidentifier NOT NULL,
    [CourseId] uniqueidentifier NOT NULL,
    [Title] nvarchar(50) NOT NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Conversations_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_Conversations] PRIMARY KEY CLUSTERED ([ConversationId])
);
CREATE INDEX [IX_Conversations_CourseId] ON dbo.[Conversations] ([CourseId]);
GO

CREATE TABLE dbo.[ConversationMembers] (
    [ConversationId] uniqueidentifier NOT NULL,
    [UserId] uniqueidentifier NOT NULL,
    [JoinedAt] datetime2 NOT NULL,
    [LeftAt] datetime2 NULL,
    CONSTRAINT [PK_ConversationMembers] PRIMARY KEY CLUSTERED ([ConversationId], [UserId])
);
CREATE INDEX [IX_ConversationMembers_UserId] ON dbo.[ConversationMembers] ([UserId]);
GO

CREATE TABLE dbo.[Messages] (
    [MessageId] uniqueidentifier NOT NULL,
    [ConversationId] uniqueidentifier NOT NULL,
    [SenderId] uniqueidentifier NOT NULL,
    [SenderName] nvarchar(150) NOT NULL,
    [Content] nvarchar(2000) NOT NULL,
    [SentAt] datetime2 NOT NULL CONSTRAINT [DF_Messages_SentAt] DEFAULT (SYSUTCDATETIME()),
    [DeletedAt] datetime2 NULL,
    CONSTRAINT [PK_Messages] PRIMARY KEY CLUSTERED ([MessageId])
);
CREATE INDEX [IX_Messages_Conversation_SentAt] ON dbo.[Messages] ([ConversationId], [SentAt]);
GO

CREATE TABLE dbo.[Notifications] (
    [NotificationId] uniqueidentifier NOT NULL,
    [UserId] uniqueidentifier NOT NULL,
    [Type] varchar(50) NOT NULL,
    [Title] nvarchar(200) NOT NULL,
    [Body] nvarchar(500) NOT NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [ReadAt] datetime2 NULL,
    [CourseId] uniqueidentifier NULL,
    [RoomId] uniqueidentifier NULL,
    CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId])
);
CREATE INDEX [IX_Notifications_Unread] ON dbo.[Notifications] ([UserId], [CreatedAt]) WHERE [ReadAt] IS NULL;
CREATE INDEX [IX_Notifications_User_CreatedAt] ON dbo.[Notifications] ([UserId], [CreatedAt]);
GO

CREATE TABLE dbo.[ProcessedEvents] (
    [EventId] uniqueidentifier NOT NULL,
    [EventType] varchar(100) NOT NULL,
    [ProcessedAtUtc] datetime2 NOT NULL CONSTRAINT [DF_ProcessedEvents_ProcessedAtUtc] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_ProcessedEvents] PRIMARY KEY CLUSTERED ([EventId])
);
CREATE INDEX [IX_ProcessedEvents_ProcessedAtUtc] ON dbo.[ProcessedEvents] ([ProcessedAtUtc]);
GO

ALTER TABLE dbo.[ConversationMembers] ADD CONSTRAINT [FK_ConversationMembers_Conversations] FOREIGN KEY ([ConversationId]) REFERENCES dbo.[Conversations] ([ConversationId]) ON DELETE NO ACTION;
ALTER TABLE dbo.[Messages] ADD CONSTRAINT [FK_Messages_Conversations] FOREIGN KEY ([ConversationId]) REFERENCES dbo.[Conversations] ([ConversationId]) ON DELETE NO ACTION;
GO
