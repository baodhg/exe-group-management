using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExeGroup.Group.Repositories.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicProposalsAndProjectMilestones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectMilestones",
                columns: table => new
                {
                    MilestoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Weight = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProjectMilestones_Weight"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ProjectMilestones_CreatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectMilestones", x => x.MilestoneId);
                    table.CheckConstraint("CK_ProjectMilestones_Sequence", "[Sequence] >= 1");
                    table.CheckConstraint("CK_ProjectMilestones_Weight", "[Weight] >= 1");
                    table.ForeignKey(
                        name: "FK_ProjectMilestones_Courses",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "CourseId");
                });

            migrationBuilder.CreateTable(
                name: "TopicProposals",
                columns: table => new
                {
                    ProposalId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Round = table.Column<int>(type: "int", nullable: false),
                    ProposedTopic = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ProposedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Pending")
                        .Annotation("Relational:DefaultConstraintName", "DF_TopicProposals_Status"),
                    ReviewedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_TopicProposals_CreatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicProposals", x => x.ProposalId);
                    table.CheckConstraint("CK_TopicProposals_Round", "[Round] >= 1");
                    table.CheckConstraint("CK_TopicProposals_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'NeedsRevision')");
                    table.ForeignKey(
                        name: "FK_TopicProposals_Rooms",
                        columns: x => new { x.RoomId, x.CourseId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "RoomId", "CourseId" });
                });

            migrationBuilder.CreateTable(
                name: "ProjectDeliverables",
                columns: table => new
                {
                    DeliverableId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MilestoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "NotStarted")
                        .Annotation("Relational:DefaultConstraintName", "DF_ProjectDeliverables_Status"),
                    SubmittedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Score = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    ReviewNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ProjectDeliverables_CreatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectDeliverables", x => x.DeliverableId);
                    table.CheckConstraint("CK_ProjectDeliverables_Score", "[Score] IS NULL OR ([Score] >= 0 AND [Score] <= 10)");
                    table.CheckConstraint("CK_ProjectDeliverables_Status", "[Status] IN ('NotStarted', 'InProgress', 'Submitted', 'Approved', 'ChangesRequested')");
                    table.ForeignKey(
                        name: "FK_ProjectDeliverables_Milestones",
                        column: x => x.MilestoneId,
                        principalTable: "ProjectMilestones",
                        principalColumn: "MilestoneId");
                    table.ForeignKey(
                        name: "FK_ProjectDeliverables_Rooms",
                        columns: x => new { x.RoomId, x.CourseId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "RoomId", "CourseId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectDeliverables_Course_Room",
                table: "ProjectDeliverables",
                columns: new[] { "CourseId", "RoomId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectDeliverables_Milestone_Status",
                table: "ProjectDeliverables",
                columns: new[] { "MilestoneId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_ProjectDeliverables_Milestone_Room",
                table: "ProjectDeliverables",
                columns: new[] { "MilestoneId", "RoomId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ProjectMilestones_Course_Name",
                table: "ProjectMilestones",
                columns: new[] { "CourseId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ProjectMilestones_Course_Sequence",
                table: "ProjectMilestones",
                columns: new[] { "CourseId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TopicProposals_Course_Status",
                table: "TopicProposals",
                columns: new[] { "CourseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicProposals_Room_Status",
                table: "TopicProposals",
                columns: new[] { "RoomId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_TopicProposals_Room_Round",
                table: "TopicProposals",
                columns: new[] { "RoomId", "Round" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectDeliverables");

            migrationBuilder.DropTable(
                name: "TopicProposals");

            migrationBuilder.DropTable(
                name: "ProjectMilestones");
        }
    }
}
