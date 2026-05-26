using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddHiringRequirementSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "hiring_requirement_id",
                table: "job_vacancies",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "hiring_requirements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    seniority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    workplace_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    employment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    salary_min = table.Column<decimal>(type: "numeric", nullable: true),
                    salary_max = table.Column<decimal>(type: "numeric", nullable: true),
                    currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    timezone_range = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    degree_requirement = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    benefits = table.Column<List<string>>(type: "text[]", nullable: false),
                    language_requirements = table.Column<List<string>>(type: "text[]", nullable: false),
                    headcount = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    hiring_reason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    business_problem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hiring_requirements", x => x.id);
                    table.ForeignKey(
                        name: "fk_hiring_requirements_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_hiring_requirements_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "business_outcomes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_business_outcomes", x => x.id);
                    table.ForeignKey(
                        name: "fk_business_outcomes_hiring_requirements_hiring_requirement_id",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_rubrics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_weights = table.Column<string>(type: "jsonb", nullable: true),
                    scoring_rules = table.Column<string>(type: "jsonb", nullable: true),
                    evidence_requirements = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evaluation_rubrics", x => x.id);
                    table.ForeignKey(
                        name: "fk_evaluation_rubrics_hiring_requirements_hiring_requirement_id",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "interview_blueprints",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_questions = table.Column<string>(type: "jsonb", nullable: true),
                    dimensions = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_interview_blueprints", x => x.id);
                    table.ForeignKey(
                        name: "fk_interview_blueprints_hiring_requirements_hiring_requirement",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "requirement_capabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    ownership_level = table.Column<string>(type: "text", nullable: false),
                    expected_proficiency = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_requirement_capabilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_requirement_capabilities_hiring_requirements_hiring_require",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "requirement_snapshots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    seniority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    workplace_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    employment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    salary_min = table.Column<decimal>(type: "numeric", nullable: true),
                    salary_max = table.Column<decimal>(type: "numeric", nullable: true),
                    currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    timezone_range = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    degree_requirement = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    benefits = table.Column<List<string>>(type: "text[]", nullable: false),
                    language_requirements = table.Column<List<string>>(type: "text[]", nullable: false),
                    headcount = table.Column<int>(type: "integer", nullable: false),
                    hiring_reason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    business_problem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    business_outcomes_json = table.Column<string>(type: "jsonb", nullable: true),
                    responsibilities_json = table.Column<string>(type: "jsonb", nullable: true),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: true),
                    technology_requirements_json = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_requirement_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "fk_requirement_snapshots_hiring_requirements_hiring_requiremen",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "responsibilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    ownership_level = table.Column<string>(type: "text", nullable: false),
                    is_leadership = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_responsibilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_responsibilities_hiring_requirements_hiring_requirement_id",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "technology_requirements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hiring_requirement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    sfia_level = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_technology_requirements", x => x.id);
                    table.ForeignKey(
                        name: "fk_technology_requirements_hiring_requirements_hiring_requirem",
                        column: x => x.hiring_requirement_id,
                        principalTable: "hiring_requirements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evidence_signals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    requirement_capability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    signal_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    expected_metric = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    rationale = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    metadata = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evidence_signals", x => x.id);
                    table.ForeignKey(
                        name: "fk_evidence_signals_requirement_capabilities_requirement_capab",
                        column: x => x.requirement_capability_id,
                        principalTable: "requirement_capabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_rubric_snapshots",
                columns: table => new
                {
                    requirement_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_weights = table.Column<string>(type: "jsonb", nullable: true),
                    scoring_rules = table.Column<string>(type: "jsonb", nullable: true),
                    evidence_requirements = table.Column<string>(type: "jsonb", nullable: true),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evaluation_rubric_snapshots", x => x.requirement_snapshot_id);
                    table.ForeignKey(
                        name: "fk_evaluation_rubric_snapshots_requirement_snapshots_requireme",
                        column: x => x.requirement_snapshot_id,
                        principalTable: "requirement_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "interview_blueprint_snapshots",
                columns: table => new
                {
                    requirement_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_questions = table.Column<string>(type: "jsonb", nullable: true),
                    dimensions = table.Column<string>(type: "jsonb", nullable: true),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_interview_blueprint_snapshots", x => x.requirement_snapshot_id);
                    table.ForeignKey(
                        name: "fk_interview_blueprint_snapshots_requirement_snapshots_require",
                        column: x => x.requirement_snapshot_id,
                        principalTable: "requirement_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                name: "requirement_vector_snapshots",
                columns: table => new
                {
                    requirement_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vector = table.Column<float[]>(type: "real[]", nullable: false),
                    dimension = table.Column<int>(type: "integer", nullable: false),
                    snapshotted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_requirement_vector_snapshots", x => x.requirement_snapshot_id);
                    table.ForeignKey(
                        name: "fk_requirement_vector_snapshots_requirement_snapshots_requirem",
                        column: x => x.requirement_snapshot_id,
                        principalTable: "requirement_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_job_vacancies_hiring_requirement_id",
                table: "job_vacancies",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_business_outcomes_hr_id",
                table: "business_outcomes",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_evaluation_rubrics_hr_id",
                table: "evaluation_rubrics",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_evidence_signals_cap_id",
                table: "evidence_signals",
                column: "requirement_capability_id");

            migrationBuilder.CreateIndex(
                name: "idx_hiring_requirements_org_id",
                table: "hiring_requirements",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "idx_hiring_requirements_workspace_id",
                table: "hiring_requirements",
                column: "workspace_id");

            migrationBuilder.CreateIndex(
                name: "idx_interview_blueprints_hr_id",
                table: "interview_blueprints",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_requirement_capabilities_hr_id",
                table: "requirement_capabilities",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_requirement_snapshots_hr_id",
                table: "requirement_snapshots",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_responsibilities_hr_id",
                table: "responsibilities",
                column: "hiring_requirement_id");

            migrationBuilder.CreateIndex(
                name: "idx_technology_requirements_hr_id",
                table: "technology_requirements",
                column: "hiring_requirement_id");

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies",
                column: "hiring_requirement_id",
                principalTable: "hiring_requirements",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies");

            migrationBuilder.DropTable(
                name: "business_outcomes");

            migrationBuilder.DropTable(
                name: "evaluation_rubric_snapshots");

            migrationBuilder.DropTable(
                name: "evaluation_rubrics");

            migrationBuilder.DropTable(
                name: "evidence_signals");

            migrationBuilder.DropTable(
                name: "interview_blueprint_snapshots");

            migrationBuilder.DropTable(
                name: "interview_blueprints");

            migrationBuilder.DropTable(
                name: "job_description_snapshots");

            migrationBuilder.DropTable(
                name: "requirement_vector_snapshots");

            migrationBuilder.DropTable(
                name: "responsibilities");

            migrationBuilder.DropTable(
                name: "technology_requirements");

            migrationBuilder.DropTable(
                name: "requirement_capabilities");

            migrationBuilder.DropTable(
                name: "requirement_snapshots");

            migrationBuilder.DropTable(
                name: "hiring_requirements");

            migrationBuilder.DropIndex(
                name: "ix_job_vacancies_hiring_requirement_id",
                table: "job_vacancies");

            migrationBuilder.DropColumn(
                name: "hiring_requirement_id",
                table: "job_vacancies");
        }
    }
}
