using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExeGroup.Realtime.Repositories.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationTarget : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CourseId",
                table: "Notifications",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RoomId",
                table: "Notifications",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CourseId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "RoomId",
                table: "Notifications");
        }
    }
}
