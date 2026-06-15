using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_leadership",
                table: "work_experience_entries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_profile_update_at",
                table: "user_profiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "core_values",
                table: "organizations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "founded",
                table: "organizations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "mission",
                table: "organizations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "vision",
                table: "organizations",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "candidate_assessments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    overall_score = table.Column<double>(type: "double precision", nullable: false),
                    career_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    career_level_label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    primary_tendency = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    primary_working_style = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    summary_headline = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    summary_paragraph = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    pipeline_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    assessment_schema_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    last_profile_update_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_repository_analysis_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_assessment_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failed_stage = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    failure_reason = table.Column<string>(type: "text", nullable: true),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_assessments", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_assessments_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_assessment_artifacts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    json_data = table.Column<string>(type: "text", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_assessment_artifacts", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_assessment_artifacts_candidate_assessments_assess",
                        column: x => x.assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_candidate_assessment_artifacts_assessment_id",
                table: "candidate_assessment_artifacts",
                column: "assessment_id");

            migrationBuilder.CreateIndex(
                name: "ux_candidate_assessment_artifacts_type",
                table: "candidate_assessment_artifacts",
                columns: new[] { "assessment_id", "artifact_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_assessments_user_id",
                table: "candidate_assessments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ux_candidate_assessments_user_version",
                table: "candidate_assessments",
                columns: new[] { "user_id", "version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_assessment_artifacts");

            migrationBuilder.DropTable(
                name: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "is_leadership",
                table: "work_experience_entries");

            migrationBuilder.DropColumn(
                name: "last_profile_update_at",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "core_values",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "founded",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "mission",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "vision",
                table: "organizations");
        }
    }
}
