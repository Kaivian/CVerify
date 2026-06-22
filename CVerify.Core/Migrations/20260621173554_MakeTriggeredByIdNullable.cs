using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class MakeTriggeredByIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_candidate_discovery_runs_users_triggered_by_id",
                table: "candidate_discovery_runs");

            migrationBuilder.AlterColumn<Guid>(
                name: "triggered_by_id",
                table: "candidate_discovery_runs",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "fk_candidate_discovery_runs_users_triggered_by_id",
                table: "candidate_discovery_runs",
                column: "triggered_by_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_candidate_discovery_runs_users_triggered_by_id",
                table: "candidate_discovery_runs");

            migrationBuilder.AlterColumn<Guid>(
                name: "triggered_by_id",
                table: "candidate_discovery_runs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "fk_candidate_discovery_runs_users_triggered_by_id",
                table: "candidate_discovery_runs",
                column: "triggered_by_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
