using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobVacanciesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "job_vacancies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    workplace_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    salary = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    salary_min_max = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    headcount = table.Column<int>(type: "integer", nullable: false),
                    gender = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    experience = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    degree = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<List<string>>(type: "text[]", nullable: false),
                    requirements = table.Column<List<string>>(type: "text[]", nullable: false),
                    benefits = table.Column<List<string>>(type: "text[]", nullable: false),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    skills = table.Column<List<string>>(type: "text[]", nullable: false),
                    cover_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    images = table.Column<List<string>>(type: "text[]", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_vacancies", x => x.id);
                    table.ForeignKey(
                        name: "fk_job_vacancies_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_job_vacancies_organization_id",
                table: "job_vacancies",
                column: "organization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_vacancies");
        }
    }
}
