using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicJobsAndInteractions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "job_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_vacancy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    gaps_snapshot_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_applications", x => x.id);
                    table.ForeignKey(
                        name: "fk_job_applications_job_vacancies_job_vacancy_id",
                        column: x => x.job_vacancy_id,
                        principalTable: "job_vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_job_applications_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "job_interactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_vacancy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    interaction_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    interaction_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_interactions", x => x.id);
                    table.ForeignKey(
                        name: "fk_job_interactions_job_vacancies_job_vacancy_id",
                        column: x => x.job_vacancy_id,
                        principalTable: "job_vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_job_interactions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_job_vacancies_published_active",
                table: "job_vacancies",
                columns: new[] { "status", "is_active" },
                filter: "status = 'Published' AND is_active = TRUE");

            migrationBuilder.CreateIndex(
                name: "ix_job_applications_candidate_id",
                table: "job_applications",
                column: "candidate_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_applications_job_vacancy_id_candidate_id",
                table: "job_applications",
                columns: new[] { "job_vacancy_id", "candidate_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_job_interactions_job_vacancy_id",
                table: "job_interactions",
                column: "job_vacancy_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_interactions_user_id_interaction_type",
                table: "job_interactions",
                columns: new[] { "user_id", "interaction_type" });

            migrationBuilder.CreateIndex(
                name: "ix_job_interactions_user_id_job_vacancy_id_interaction_type",
                table: "job_interactions",
                columns: new[] { "user_id", "job_vacancy_id", "interaction_type" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_applications");

            migrationBuilder.DropTable(
                name: "job_interactions");

            migrationBuilder.DropIndex(
                name: "idx_job_vacancies_published_active",
                table: "job_vacancies");
        }
    }
}
