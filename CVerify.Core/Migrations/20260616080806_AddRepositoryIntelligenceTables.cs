using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRepositoryIntelligenceTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "repository_capabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    repository_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    maturity = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    difficulty_score = table.Column<double>(type: "double precision", nullable: false),
                    score = table.Column<double>(type: "double precision", nullable: false),
                    evidence_json = table.Column<string>(type: "jsonb", nullable: true),
                    assessment_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    analysis_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    model_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_repository_capabilities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "repository_domains",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    repository_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    domain_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    weight = table.Column<double>(type: "double precision", nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    evidence_count = table.Column<int>(type: "integer", nullable: false),
                    supporting_signals = table.Column<string>(type: "jsonb", nullable: true),
                    assessment_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    analysis_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    model_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_repository_domains", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "repository_intelligence_signals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    repository_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope_signal = table.Column<double>(type: "double precision", nullable: false),
                    complexity_signal = table.Column<double>(type: "double precision", nullable: false),
                    ownership_signal = table.Column<double>(type: "double precision", nullable: false),
                    leadership_signal = table.Column<double>(type: "double precision", nullable: false),
                    consistency_signal = table.Column<double>(type: "double precision", nullable: false),
                    last_updated_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    assessment_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    analysis_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    model_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_repository_intelligence_signals", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "repository_skill_attributions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    repository_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    skill_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    contribution_weight = table.Column<double>(type: "double precision", nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    verification_level = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    assessment_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    analysis_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    model_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    prompt_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_repository_skill_attributions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_repository_capabilities_assessment_id",
                table: "repository_capabilities",
                column: "repository_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ux_repository_capabilities_assessment_id_name",
                table: "repository_capabilities",
                columns: new[] { "repository_assessment_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_repository_domains_assessment_id",
                table: "repository_domains",
                column: "repository_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ux_repository_domains_assessment_id_domain",
                table: "repository_domains",
                columns: new[] { "repository_assessment_id", "domain_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_repository_intelligence_signals_assessment_id",
                table: "repository_intelligence_signals",
                column: "repository_assessment_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_repository_skill_attributions_assessment_id",
                table: "repository_skill_attributions",
                column: "repository_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ux_repository_skill_attributions_assessment_id_skill",
                table: "repository_skill_attributions",
                columns: new[] { "repository_assessment_id", "skill_name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "repository_capabilities");

            migrationBuilder.DropTable(
                name: "repository_domains");

            migrationBuilder.DropTable(
                name: "repository_intelligence_signals");

            migrationBuilder.DropTable(
                name: "repository_skill_attributions");
        }
    }
}
