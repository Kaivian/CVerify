using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalOrganizations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "external_organization_id",
                table: "source_code_repositories",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "external_organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    auth_provider_id = table.Column<Guid>(type: "uuid", nullable: false),
                    external_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    login = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    avatar_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    html_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    last_synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_external_organizations", x => x.id);
                    table.ForeignKey(
                        name: "fk_external_organizations_auth_providers_auth_provider_id",
                        column: x => x.auth_provider_id,
                        principalTable: "auth_providers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_source_code_repositories_external_organization_id",
                table: "source_code_repositories",
                column: "external_organization_id");

            migrationBuilder.CreateIndex(
                name: "idx_external_organizations_provider_external_active",
                table: "external_organizations",
                columns: new[] { "auth_provider_id", "external_id" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_source_code_repositories_external_organizations_external_or",
                table: "source_code_repositories",
                column: "external_organization_id",
                principalTable: "external_organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_source_code_repositories_external_organizations_external_or",
                table: "source_code_repositories");

            migrationBuilder.DropTable(
                name: "external_organizations");

            migrationBuilder.DropIndex(
                name: "ix_source_code_repositories_external_organization_id",
                table: "source_code_repositories");

            migrationBuilder.DropColumn(
                name: "external_organization_id",
                table: "source_code_repositories");
        }
    }
}
