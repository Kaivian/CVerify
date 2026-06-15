using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRepositoryAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "cv_id",
                table: "candidate_assessments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "model_version",
                table: "candidate_assessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "prompt_version",
                table: "candidate_assessments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "repository_assessments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    repository_id = table.Column<Guid>(type: "uuid", nullable: false),
                    analysis_job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    commit_sha = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    overall_score = table.Column<double>(type: "double precision", nullable: false),
                    tech_stack = table.Column<string>(type: "jsonb", nullable: true),
                    patterns = table.Column<string>(type: "jsonb", nullable: true),
                    quality_metrics = table.Column<string>(type: "jsonb", nullable: true),
                    json_data = table.Column<string>(type: "jsonb", nullable: true),
                    model_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    assessment_schema_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    pipeline_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_repository_assessments", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_repository_assessments_job_id",
                table: "repository_assessments",
                column: "analysis_job_id");

            migrationBuilder.CreateIndex(
                name: "idx_repository_assessments_repo_id",
                table: "repository_assessments",
                column: "repository_id");

            migrationBuilder.CreateIndex(
                name: "ux_repository_assessments_repo_sha",
                table: "repository_assessments",
                columns: new[] { "repository_id", "commit_sha" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "repository_assessments");

            migrationBuilder.DropColumn(
                name: "cv_id",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "model_version",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "prompt_version",
                table: "candidate_assessments");
        }
    }
}
