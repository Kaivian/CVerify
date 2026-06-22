using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddHiringLifecycleAndDiscoveryRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "auto_close_rule",
                table: "requirement_snapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "candidates_needed_count",
                table: "requirement_snapshots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "end_date",
                table: "requirement_snapshots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_manually_closed",
                table: "requirement_snapshots",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_salary_negotiable",
                table: "requirement_snapshots",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "salary_period",
                table: "requirement_snapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "start_date",
                table: "requirement_snapshots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "auto_close_rule",
                table: "hiring_requirements",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "candidates_needed_count",
                table: "hiring_requirements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "end_date",
                table: "hiring_requirements",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_manually_closed",
                table: "hiring_requirements",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_salary_negotiable",
                table: "hiring_requirements",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "salary_period",
                table: "hiring_requirements",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "start_date",
                table: "hiring_requirements",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "candidate_discovery_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    triggered_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    candidates_found_count = table.Column<int>(type: "integer", nullable: false),
                    match_quality_summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    error_message = table.Column<string>(type: "text", nullable: true),
                    raw_results_json = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_discovery_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_discovery_runs_hiring_requirements_hiring_require",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_candidate_discovery_runs_users_triggered_by_id",
                        column: x => x.triggered_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_candidate_discovery_runs_requirement_id",
                table: "candidate_discovery_runs",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_candidate_discovery_runs_triggered_by_id",
                table: "candidate_discovery_runs",
                column: "triggered_by_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_discovery_runs");

            migrationBuilder.DropColumn(
                name: "auto_close_rule",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "candidates_needed_count",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "end_date",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "is_manually_closed",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "is_salary_negotiable",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "salary_period",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "start_date",
                table: "requirement_snapshots");

            migrationBuilder.DropColumn(
                name: "auto_close_rule",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "candidates_needed_count",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "end_date",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "is_manually_closed",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "is_salary_negotiable",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "salary_period",
                table: "hiring_requirements");

            migrationBuilder.DropColumn(
                name: "start_date",
                table: "hiring_requirements");
        }
    }
}
