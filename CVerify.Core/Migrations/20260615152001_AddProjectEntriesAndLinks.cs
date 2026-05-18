using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectEntriesAndLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "project_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    role = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    start_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    end_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    is_currently_working = table.Column<bool>(type: "boolean", nullable: false),
                    verification_level = table.Column<int>(type: "integer", nullable: false),
                    verification_status = table.Column<int>(type: "integer", nullable: false),
                    verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    verification_metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_contributions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_contributions", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_contributions_project_entries_project_entry_id",
                        column: x => x.project_entry_id,
                        principalTable: "project_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_repository_links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_code_repository_id = table.Column<Guid>(type: "uuid", nullable: false),
                    linked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_repository_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_repository_links_project_entries_project_entry_id",
                        column: x => x.project_entry_id,
                        principalTable: "project_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_project_repository_links_source_code_repositories_source_co",
                        column: x => x.source_code_repository_id,
                        principalTable: "source_code_repositories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_technologies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_technologies", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_technologies_project_entries_project_entry_id",
                        column: x => x.project_entry_id,
                        principalTable: "project_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_project_contributions_project_id",
                table: "project_contributions",
                column: "project_entry_id");

            migrationBuilder.CreateIndex(
                name: "idx_project_entries_user_id",
                table: "project_entries",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_project_repo_links_unique",
                table: "project_repository_links",
                columns: new[] { "project_entry_id", "source_code_repository_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_project_repository_links_source_code_repository_id",
                table: "project_repository_links",
                column: "source_code_repository_id");

            migrationBuilder.CreateIndex(
                name: "idx_project_technologies_project_id",
                table: "project_technologies",
                column: "project_entry_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_contributions");

            migrationBuilder.DropTable(
                name: "project_repository_links");

            migrationBuilder.DropTable(
                name: "project_technologies");

            migrationBuilder.DropTable(
                name: "project_entries");
        }
    }
}
