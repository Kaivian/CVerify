using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRequirementArtifacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_description_snapshots");

            migrationBuilder.DropTable(
                name: "job_descriptions");

            migrationBuilder.CreateTable(
                name: "requirement_artifact_snapshots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    requirement_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    markdown_content = table.Column<string>(type: "text", nullable: false),
                    structured_content_json = table.Column<string>(type: "jsonb", nullable: true),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_requirement_artifact_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "fk_requirement_artifact_snapshots_requirement_snapshots_requir",
                        column: x => x.requirement_snapshot_id,
                        principalTable: "requirement_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "requirement_artifacts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    markdown_content = table.Column<string>(type: "text", nullable: false),
                    structured_content_json = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    model_info = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    prompt_template_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    prompt_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    generation_metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    regeneration_history_json = table.Column<string>(type: "jsonb", nullable: true),
                    generation_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_requirement_artifacts", x => x.id);
                    table.ForeignKey(
                        name: "fk_requirement_artifacts_hiring_requirements_hiring_requiremen",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_requirement_artifact_snapshots_requirement_snapshot_id",
                table: "requirement_artifact_snapshots",
                column: "requirement_snapshot_id");

            migrationBuilder.CreateIndex(
                name: "ix_requirement_artifacts_hiring_requirement_id",
                table: "requirement_artifacts",
                column: "hiring_requirement_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "requirement_artifact_snapshots");

            migrationBuilder.DropTable(
                name: "requirement_artifacts");

            migrationBuilder.CreateTable(
                name: "job_description_snapshots",
                columns: table => new
                {
                    requirement_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    markdown_content = table.Column<string>(type: "text", nullable: false),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_description_snapshots", x => x.requirement_snapshot_id);
                    table.ForeignKey(
                        name: "fk_job_description_snapshots_requirement_snapshots_requirement",
                        column: x => x.requirement_snapshot_id,
                        principalTable: "requirement_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "job_descriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    markdown_content = table.Column<string>(type: "text", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_descriptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_job_descriptions_hiring_requirements_hiring_requirement_id",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_job_descriptions_hiring_requirement_id",
                table: "job_descriptions",
                column: "hiring_requirement_id");
        }
    }
}
