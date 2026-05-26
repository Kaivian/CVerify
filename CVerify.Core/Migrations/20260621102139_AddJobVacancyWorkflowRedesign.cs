using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobVacancyWorkflowRedesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "acquisition_strategy",
                table: "job_vacancies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "discovery_profile_json",
                table: "job_vacancies",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "requirement_snapshot_id",
                table: "job_vacancies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "job_vacancies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_job_vacancies_requirement_snapshot_id",
                table: "job_vacancies",
                column: "requirement_snapshot_id");

            migrationBuilder.AddForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies",
                column: "requirement_snapshot_id",
                principalTable: "requirement_snapshots",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_job_vacancies_requirement_snapshots_requirement_snapshot_id",
                table: "job_vacancies");

            migrationBuilder.DropIndex(
                name: "ix_job_vacancies_requirement_snapshot_id",
                table: "job_vacancies");

            migrationBuilder.DropColumn(
                name: "acquisition_strategy",
                table: "job_vacancies");

            migrationBuilder.DropColumn(
                name: "discovery_profile_json",
                table: "job_vacancies");

            migrationBuilder.DropColumn(
                name: "requirement_snapshot_id",
                table: "job_vacancies");

            migrationBuilder.DropColumn(
                name: "status",
                table: "job_vacancies");
        }
    }
}
