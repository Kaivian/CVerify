using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMetadataToJobVacancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "metadata",
                table: "job_vacancies",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "cv_repository_mappings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_code_repository_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reference_source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    reference_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    indexed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cv_repository_mappings", x => x.id);
                    table.ForeignKey(
                        name: "fk_cv_repository_mappings_source_code_repositories_source_code",
                        column: x => x.source_code_repository_id,
                        principalTable: "source_code_repositories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_cv_repository_mappings_repo_id",
                table: "cv_repository_mappings",
                column: "source_code_repository_id");

            migrationBuilder.CreateIndex(
                name: "idx_cv_repository_mappings_user_id",
                table: "cv_repository_mappings",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cv_repository_mappings");

            migrationBuilder.DropColumn(
                name: "metadata",
                table: "job_vacancies");
        }
    }
}
