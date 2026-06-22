using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCapabilityRegistryAndGraphSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "capability_registries",
                columns: table => new
                {
                    capability_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    taxonomy_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capability_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    deprecated_by_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    effective_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    migration_mappings = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_capability_registries", x => x.capability_id);
                    table.ForeignKey(
                        name: "fk_capability_registries_capability_registries_deprecated_by_id",
                        column: x => x.deprecated_by_id,
                        principalTable: "capability_registries",
                        principalColumn: "capability_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "capability_aliases",
                columns: table => new
                {
                    alias_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    canonical_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_capability_aliases", x => x.alias_name);
                    table.ForeignKey(
                        name: "fk_capability_aliases_capability_registries_canonical_id",
                        column: x => x.canonical_id,
                        principalTable: "capability_registries",
                        principalColumn: "capability_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "capability_hierarchies",
                columns: table => new
                {
                    parent_id = table.Column<string>(type: "character varying(100)", nullable: false),
                    child_id = table.Column<string>(type: "character varying(100)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_capability_hierarchies", x => new { x.parent_id, x.child_id });
                    table.ForeignKey(
                        name: "fk_capability_hierarchies_capability_registries_child_id",
                        column: x => x.child_id,
                        principalTable: "capability_registries",
                        principalColumn: "capability_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_capability_hierarchies_capability_registries_parent_id",
                        column: x => x.parent_id,
                        principalTable: "capability_registries",
                        principalColumn: "capability_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_capability_aliases_canonical_id",
                table: "capability_aliases",
                column: "canonical_id");

            migrationBuilder.CreateIndex(
                name: "ix_capability_hierarchies_child_id",
                table: "capability_hierarchies",
                column: "child_id");

            migrationBuilder.CreateIndex(
                name: "ix_capability_registries_deprecated_by_id",
                table: "capability_registries",
                column: "deprecated_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_capability_registries_status",
                table: "capability_registries",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_capability_registries_taxonomy_version",
                table: "capability_registries",
                column: "taxonomy_version");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "capability_aliases");

            migrationBuilder.DropTable(
                name: "capability_hierarchies");

            migrationBuilder.DropTable(
                name: "capability_registries");
        }
    }
}
