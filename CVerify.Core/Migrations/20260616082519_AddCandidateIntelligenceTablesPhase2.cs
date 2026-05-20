using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateIntelligenceTablesPhase2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "execution_strength",
                table: "candidate_assessments",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "leadership_potential",
                table: "candidate_assessments",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "technical_breadth",
                table: "candidate_assessments",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "technical_depth",
                table: "candidate_assessments",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "trust_level",
                table: "candidate_assessments",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateTable(
                name: "candidate_best_fit_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    match_score = table.Column<double>(type: "double precision", nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    rank = table.Column<int>(type: "integer", nullable: false),
                    matching_engine_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    evidence = table.Column<string>(type: "jsonb", nullable: true),
                    engine_metadata = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_best_fit_roles", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_best_fit_roles_candidate_assessments_candidate_as",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_domain_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    domain_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    score = table.Column<double>(type: "double precision", nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    seniority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    supporting_evidence = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_domain_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_domain_profiles_candidate_assessments_candidate_a",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_intelligence_signals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope_signal = table.Column<double>(type: "double precision", nullable: false),
                    complexity_signal = table.Column<double>(type: "double precision", nullable: false),
                    ownership_signal = table.Column<double>(type: "double precision", nullable: false),
                    leadership_signal = table.Column<double>(type: "double precision", nullable: false),
                    consistency_signal = table.Column<double>(type: "double precision", nullable: false),
                    delivery_signal = table.Column<double>(type: "double precision", nullable: false),
                    engineering_maturity_signal = table.Column<double>(type: "double precision", nullable: false),
                    problem_solving_signal = table.Column<double>(type: "double precision", nullable: false),
                    last_updated_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_intelligence_signals", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_intelligence_signals_candidate_assessments_candid",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_skills",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    skill_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    score = table.Column<double>(type: "double precision", nullable: false),
                    confidence = table.Column<double>(type: "double precision", nullable: false),
                    level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    evidence_sources = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_skills", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_skills_candidate_assessments_candidate_assessment",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_strengths_weaknesses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    finding_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    topic = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    evidence = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_strengths_weaknesses", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_strengths_weaknesses_candidate_assessments_candid",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_candidate_best_fit_roles_candidate_assessment_id",
                table: "candidate_best_fit_roles",
                column: "candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_domain_profiles_candidate_assessment_id",
                table: "candidate_domain_profiles",
                column: "candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_intelligence_signals_candidate_assessment_id",
                table: "candidate_intelligence_signals",
                column: "candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_skills_candidate_assessment_id",
                table: "candidate_skills",
                column: "candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_strengths_weaknesses_candidate_assessment_id",
                table: "candidate_strengths_weaknesses",
                column: "candidate_assessment_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_best_fit_roles");

            migrationBuilder.DropTable(
                name: "candidate_domain_profiles");

            migrationBuilder.DropTable(
                name: "candidate_intelligence_signals");

            migrationBuilder.DropTable(
                name: "candidate_skills");

            migrationBuilder.DropTable(
                name: "candidate_strengths_weaknesses");

            migrationBuilder.DropColumn(
                name: "execution_strength",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "leadership_potential",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "technical_breadth",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "technical_depth",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "trust_level",
                table: "candidate_assessments");
        }
    }
}
