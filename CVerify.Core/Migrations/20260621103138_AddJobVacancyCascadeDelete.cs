using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobVacancyCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies");

            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies");

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies",
                column: "hiring_requirement_id",
                principalTable: "hiring_requirements",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies",
                column: "requirement_snapshot_id",
                principalTable: "requirement_snapshots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies");

            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies");

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_hiring_requirements_hiring_requirement_id",
                table: "job_vacancies",
                column: "hiring_requirement_id",
                principalTable: "hiring_requirements",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies",
                column: "requirement_snapshot_id",
                principalTable: "requirement_snapshots",
                principalColumn: "id");
        }
    }
}
