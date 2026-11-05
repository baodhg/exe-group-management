using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExeGroup.Group.Repositories.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GroupTypes",
                columns: table => new
                {
                    GroupTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MinDistinctMajors = table.Column<int>(type: "int", nullable: false, defaultValue: 2)
                        .Annotation("Relational:DefaultConstraintName", "DF_GroupTypes_MinDistinctMajors")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTypes", x => x.GroupTypeId);
                    table.CheckConstraint("CK_GroupTypes_MinDistinctMajors", "[MinDistinctMajors] >= 1");
                });

            migrationBuilder.CreateTable(
                name: "Majors",
                columns: table => new
                {
                    MajorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Majors", x => x.MajorId);
                });

            migrationBuilder.CreateTable(
                name: "OutboxEvents",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventType = table.Column<string>(type: "varchar(100)", unicode: false, maxLength: 100, nullable: false),
                    AggregateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CorrelationId = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: true),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_OutboxEvents_OccurredAtUtc"),
                    PublishedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                        .Annotation("Relational:DefaultConstraintName", "DF_OutboxEvents_RetryCount"),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboxEvents", x => x.EventId);
                    table.CheckConstraint("CK_OutboxEvents_Payload", "ISJSON([Payload]) = 1");
                });

            migrationBuilder.CreateTable(
                name: "Skills",
                columns: table => new
                {
                    SkillId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Skills", x => x.SkillId);
                });

            migrationBuilder.CreateTable(
                name: "Subjects",
                columns: table => new
                {
                    SubjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subjects", x => x.SubjectId);
                });

            migrationBuilder.CreateTable(
                name: "SemesterGroupTypes",
                columns: table => new
                {
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SemesterGroupTypes", x => new { x.SemesterId, x.GroupTypeId });
                    table.ForeignKey(
                        name: "FK_SemesterGroupTypes_GroupTypes",
                        column: x => x.GroupTypeId,
                        principalTable: "GroupTypes",
                        principalColumn: "GroupTypeId");
                    table.ForeignKey(
                        name: "FK_SemesterGroupTypes_Semesters",
                        column: x => x.SemesterId,
                        principalTable: "Semesters",
                        principalColumn: "SemesterId");
                });

            migrationBuilder.CreateTable(
                name: "GroupTypeMajors",
                columns: table => new
                {
                    GroupTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MajorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MinMembers = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupTypeMajors", x => new { x.GroupTypeId, x.MajorId });
                    table.CheckConstraint("CK_GroupTypeMajors_MinMembers", "[MinMembers] >= 1");
                    table.ForeignKey(
                        name: "FK_GroupTypeMajors_GroupTypes",
                        column: x => x.GroupTypeId,
                        principalTable: "GroupTypes",
                        principalColumn: "GroupTypeId");
                    table.ForeignKey(
                        name: "FK_GroupTypeMajors_Majors",
                        column: x => x.MajorId,
                        principalTable: "Majors",
                        principalColumn: "MajorId");
                });

            migrationBuilder.CreateTable(
                name: "SemesterStudents",
                columns: table => new
                {
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentCode = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    MajorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_SemesterStudents_AddedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SemesterStudents", x => new { x.SemesterId, x.StudentId });
                    table.ForeignKey(
                        name: "FK_SemesterStudents_Majors",
                        column: x => x.MajorId,
                        principalTable: "Majors",
                        principalColumn: "MajorId");
                    table.ForeignKey(
                        name: "FK_SemesterStudents_Semesters",
                        column: x => x.SemesterId,
                        principalTable: "Semesters",
                        principalColumn: "SemesterId");
                });

            migrationBuilder.CreateTable(
                name: "Courses",
                columns: table => new
                {
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClassCode = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    LecturerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LecturerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    MinGroupSize = table.Column<int>(type: "int", nullable: false, defaultValue: 4)
                        .Annotation("Relational:DefaultConstraintName", "DF_Courses_MinGroupSize"),
                    MaxGroupSize = table.Column<int>(type: "int", nullable: false, defaultValue: 6)
                        .Annotation("Relational:DefaultConstraintName", "DF_Courses_MaxGroupSize"),
                    RoomFactor = table.Column<decimal>(type: "decimal(3,2)", precision: 3, scale: 2, nullable: false, defaultValue: 1.20m)
                        .Annotation("Relational:DefaultConstraintName", "DF_Courses_RoomFactor"),
                    Phase = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Setup")
                        .Annotation("Relational:DefaultConstraintName", "DF_Courses_Phase"),
                    PublishAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExpireAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courses", x => x.CourseId);
                    table.UniqueConstraint("AK_Courses_CourseId_SemesterId", x => new { x.CourseId, x.SemesterId });
                    table.CheckConstraint("CK_Courses_GroupSize", "[MinGroupSize] >= 1 AND [MaxGroupSize] >= [MinGroupSize]");
                    table.CheckConstraint("CK_Courses_Phase", "[Phase] IN ('Setup', 'Published', 'Expired', 'Finalized')");
                    table.CheckConstraint("CK_Courses_RoomFactor", "[RoomFactor] >= 1.00");
                    table.CheckConstraint("CK_Courses_Schedule", "[PublishAt] IS NULL OR [ExpireAt] IS NULL OR [ExpireAt] > [PublishAt]");
                    table.ForeignKey(
                        name: "FK_Courses_Semesters",
                        column: x => x.SemesterId,
                        principalTable: "Semesters",
                        principalColumn: "SemesterId");
                    table.ForeignKey(
                        name: "FK_Courses_Subjects",
                        column: x => x.SubjectId,
                        principalTable: "Subjects",
                        principalColumn: "SubjectId");
                });

            migrationBuilder.CreateTable(
                name: "StudentSkills",
                columns: table => new
                {
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SkillId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Level = table.Column<byte>(type: "tinyint", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_StudentSkills_UpdatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentSkills", x => new { x.SemesterId, x.StudentId, x.SkillId });
                    table.CheckConstraint("CK_StudentSkills_Level", "[Level] BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_StudentSkills_SemesterStudents",
                        columns: x => new { x.SemesterId, x.StudentId },
                        principalTable: "SemesterStudents",
                        principalColumns: new[] { "SemesterId", "StudentId" });
                    table.ForeignKey(
                        name: "FK_StudentSkills_Skills",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "SkillId");
                });

            migrationBuilder.CreateTable(
                name: "CourseEnrollments",
                columns: table => new
                {
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrolledAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_CourseEnrollments_EnrolledAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseEnrollments", x => new { x.CourseId, x.StudentId });
                    table.ForeignKey(
                        name: "FK_CourseEnrollments_Courses",
                        columns: x => new { x.CourseId, x.SemesterId },
                        principalTable: "Courses",
                        principalColumns: new[] { "CourseId", "SemesterId" });
                    table.ForeignKey(
                        name: "FK_CourseEnrollments_SemesterStudents",
                        columns: x => new { x.SemesterId, x.StudentId },
                        principalTable: "SemesterStudents",
                        principalColumns: new[] { "SemesterId", "StudentId" });
                });

            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SemesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Topic = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Open")
                        .Annotation("Relational:DefaultConstraintName", "DF_Rooms_Status"),
                    LeaderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MemberCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                        .Annotation("Relational:DefaultConstraintName", "DF_Rooms_MemberCount"),
                    GroupNo = table.Column<int>(type: "int", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.RoomId);
                    table.UniqueConstraint("AK_Rooms_RoomId_CourseId", x => new { x.RoomId, x.CourseId });
                    table.CheckConstraint("CK_Rooms_Leader", "([MemberCount] = 0 AND [LeaderId] IS NULL) OR ([MemberCount] > 0 AND [LeaderId] IS NOT NULL)");
                    table.CheckConstraint("CK_Rooms_MemberCount", "[MemberCount] >= 0 AND [MemberCount] <= [Capacity]");
                    table.CheckConstraint("CK_Rooms_Status", "[Status] IN ('Open', 'Locked', 'Finalized')");
                    table.ForeignKey(
                        name: "FK_Rooms_Courses",
                        columns: x => new { x.CourseId, x.SemesterId },
                        principalTable: "Courses",
                        principalColumns: new[] { "CourseId", "SemesterId" });
                    table.ForeignKey(
                        name: "FK_Rooms_SemesterGroupTypes",
                        columns: x => new { x.SemesterId, x.GroupTypeId },
                        principalTable: "SemesterGroupTypes",
                        principalColumns: new[] { "SemesterId", "GroupTypeId" });
                });

            migrationBuilder.CreateTable(
                name: "JoinRequests",
                columns: table => new
                {
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Pending")
                        .Annotation("Relational:DefaultConstraintName", "DF_JoinRequests_Status"),
                    DecidedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReasonCode = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: true),
                    ReasonText = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_JoinRequests_CreatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JoinRequests", x => x.RequestId);
                    table.CheckConstraint("CK_JoinRequests_ReasonCode", "[ReasonCode] IS NULL OR [ReasonCode] IN ('REJECTED_BY_LEADER', 'WITHDRAWN', 'ROOM_FULL', 'ROOM_REOPENED', 'COMPOSITION_RULE', 'JOINED_ANOTHER_ROOM', 'GROUPING_EXPIRED')");
                    table.CheckConstraint("CK_JoinRequests_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'Cancelled')");
                    table.ForeignKey(
                        name: "FK_JoinRequests_CourseEnrollments",
                        columns: x => new { x.CourseId, x.StudentId },
                        principalTable: "CourseEnrollments",
                        principalColumns: new[] { "CourseId", "StudentId" });
                    table.ForeignKey(
                        name: "FK_JoinRequests_Rooms",
                        columns: x => new { x.RoomId, x.CourseId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "RoomId", "CourseId" });
                });

            migrationBuilder.CreateTable(
                name: "RoomMembers",
                columns: table => new
                {
                    MembershipId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    JoinedVia = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_RoomMembers_JoinedAt"),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndReason = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true),
                    EndedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    EndNote = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomMembers", x => x.MembershipId);
                    table.CheckConstraint("CK_RoomMembers_End", "([EndedAt] IS NULL AND [EndReason] IS NULL) OR ([EndedAt] IS NOT NULL AND [EndReason] IN ('Left', 'Removed', 'Moved'))");
                    table.CheckConstraint("CK_RoomMembers_JoinedVia", "[JoinedVia] IN ('Open', 'Application', 'Admin')");
                    table.CheckConstraint("CK_RoomMembers_RemovedNote", "[EndReason] IS NULL OR [EndReason] <> 'Removed' OR [EndNote] IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_RoomMembers_CourseEnrollments",
                        columns: x => new { x.CourseId, x.StudentId },
                        principalTable: "CourseEnrollments",
                        principalColumns: new[] { "CourseId", "StudentId" });
                    table.ForeignKey(
                        name: "FK_RoomMembers_Rooms",
                        columns: x => new { x.RoomId, x.CourseId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "RoomId", "CourseId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseEnrollments_Semester_Student",
                table: "CourseEnrollments",
                columns: new[] { "SemesterId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_LecturerId",
                table: "Courses",
                column: "LecturerId",
                filter: "[LecturerId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_Phase",
                table: "Courses",
                column: "Phase");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_SubjectId",
                table: "Courses",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "UX_Courses_Semester_Subject_Class",
                table: "Courses",
                columns: new[] { "SemesterId", "SubjectId", "ClassCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupTypeMajors_MajorId",
                table: "GroupTypeMajors",
                column: "MajorId");

            migrationBuilder.CreateIndex(
                name: "UX_GroupTypes_Code",
                table: "GroupTypes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_JoinRequests_Course_Student_Status",
                table: "JoinRequests",
                columns: new[] { "CourseId", "StudentId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_JoinRequests_Room_Status",
                table: "JoinRequests",
                columns: new[] { "RoomId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_JoinRequests_Pending",
                table: "JoinRequests",
                columns: new[] { "RoomId", "StudentId" },
                unique: true,
                filter: "[Status] = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "UX_Majors_Code",
                table: "Majors",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutboxEvents_PublishedAtUtc",
                table: "OutboxEvents",
                column: "PublishedAtUtc",
                filter: "[PublishedAtUtc] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxEvents_Unpublished",
                table: "OutboxEvents",
                column: "OccurredAtUtc",
                filter: "[PublishedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RoomMembers_Room_Student",
                table: "RoomMembers",
                columns: new[] { "RoomId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "UX_RoomMembers_Course_Student",
                table: "RoomMembers",
                columns: new[] { "CourseId", "StudentId" },
                unique: true,
                filter: "[EndedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_Semester_GroupType",
                table: "Rooms",
                columns: new[] { "SemesterId", "GroupTypeId" });

            migrationBuilder.CreateIndex(
                name: "UX_Rooms_Course_GroupNo",
                table: "Rooms",
                columns: new[] { "CourseId", "GroupNo" },
                unique: true,
                filter: "[GroupNo] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Rooms_Course_Name",
                table: "Rooms",
                columns: new[] { "CourseId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SemesterGroupTypes_GroupTypeId",
                table: "SemesterGroupTypes",
                column: "GroupTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SemesterStudents_MajorId",
                table: "SemesterStudents",
                column: "MajorId");

            migrationBuilder.CreateIndex(
                name: "UX_Skills_Code",
                table: "Skills",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentSkills_SkillId",
                table: "StudentSkills",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "UX_Subjects_Code",
                table: "Subjects",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupTypeMajors");

            migrationBuilder.DropTable(
                name: "JoinRequests");

            migrationBuilder.DropTable(
                name: "OutboxEvents");

            migrationBuilder.DropTable(
                name: "RoomMembers");

            migrationBuilder.DropTable(
                name: "StudentSkills");

            migrationBuilder.DropTable(
                name: "CourseEnrollments");

            migrationBuilder.DropTable(
                name: "Rooms");

            migrationBuilder.DropTable(
                name: "Skills");

            migrationBuilder.DropTable(
                name: "SemesterStudents");

            migrationBuilder.DropTable(
                name: "Courses");

            migrationBuilder.DropTable(
                name: "SemesterGroupTypes");

            migrationBuilder.DropTable(
                name: "Majors");

            migrationBuilder.DropTable(
                name: "Subjects");

            migrationBuilder.DropTable(
                name: "GroupTypes");
        }
    }
}
