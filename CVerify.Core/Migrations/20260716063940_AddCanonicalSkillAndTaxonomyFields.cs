using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCanonicalSkillAndTaxonomyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_repository_skill_attributions_assessment_id_skill",
                table: "repository_skill_attributions");

            migrationBuilder.RenameIndex(
                name: "ix_candidate_skills_candidate_assessment_id",
                table: "candidate_skills",
                newName: "idx_candidate_skills_assessment_id");

            migrationBuilder.AddColumn<string>(
                name: "normalization_source",
                table: "repository_skill_attributions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_name",
                table: "repository_skill_attributions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pipeline_trace_id",
                table: "repository_skill_attributions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "skill_id",
                table: "repository_skill_attributions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "taxonomy_version",
                table: "repository_skill_attributions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "normalization_source",
                table: "candidate_skills",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_name",
                table: "candidate_skills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pipeline_trace_id",
                table: "candidate_skills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "skill_id",
                table: "candidate_skills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "taxonomy_version",
                table: "candidate_skills",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "canonical_skills",
                columns: table => new
                {
                    skill_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    taxonomy_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sfia_category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    onet_code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_canonical_skills", x => new { x.skill_id, x.taxonomy_version });
                });

            migrationBuilder.CreateTable(
                name: "seeding_history",
                columns: table => new
                {
                    module_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    environment_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    applied_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    records_affected = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seeding_history", x => x.module_id);
                });

            migrationBuilder.CreateIndex(
                name: "ux_repository_skill_attributions_assessment_id_skill",
                table: "repository_skill_attributions",
                columns: new[] { "repository_assessment_id", "skill_id", "taxonomy_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_candidate_skills_assessment_id_skill",
                table: "candidate_skills",
                columns: new[] { "candidate_assessment_id", "skill_id", "taxonomy_version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "canonical_skills");

            migrationBuilder.DropTable(
                name: "seeding_history");

            migrationBuilder.DropIndex(
                name: "ux_repository_skill_attributions_assessment_id_skill",
                table: "repository_skill_attributions");

            migrationBuilder.DropIndex(
                name: "ux_candidate_skills_assessment_id_skill",
                table: "candidate_skills");

            migrationBuilder.DropColumn(
                name: "normalization_source",
                table: "repository_skill_attributions");

            migrationBuilder.DropColumn(
                name: "original_name",
                table: "repository_skill_attributions");

            migrationBuilder.DropColumn(
                name: "pipeline_trace_id",
                table: "repository_skill_attributions");

            migrationBuilder.DropColumn(
                name: "skill_id",
                table: "repository_skill_attributions");

            migrationBuilder.DropColumn(
                name: "taxonomy_version",
                table: "repository_skill_attributions");

            migrationBuilder.DropColumn(
                name: "normalization_source",
                table: "candidate_skills");

            migrationBuilder.DropColumn(
                name: "original_name",
                table: "candidate_skills");

            migrationBuilder.DropColumn(
                name: "pipeline_trace_id",
                table: "candidate_skills");

            migrationBuilder.DropColumn(
                name: "skill_id",
                table: "candidate_skills");

            migrationBuilder.DropColumn(
                name: "taxonomy_version",
                table: "candidate_skills");

            migrationBuilder.RenameIndex(
                name: "idx_candidate_skills_assessment_id",
                table: "candidate_skills",
                newName: "ix_candidate_skills_candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ux_repository_skill_attributions_assessment_id_skill",
                table: "repository_skill_attributions",
                columns: new[] { "repository_assessment_id", "skill_name" },
                unique: true);
        }
    }
}
