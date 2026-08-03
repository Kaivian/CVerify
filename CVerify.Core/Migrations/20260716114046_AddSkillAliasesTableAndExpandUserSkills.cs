using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSkillAliasesTableAndExpandUserSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "normalized_name",
                table: "user_skills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "skill_id",
                table: "user_skills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "canonical_skill_aliases",
                columns: table => new
                {
                    alias_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    skill_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    taxonomy_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_canonical_skill_aliases", x => x.alias_name);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "canonical_skill_aliases");

            migrationBuilder.DropColumn(
                name: "normalized_name",
                table: "user_skills");

            migrationBuilder.DropColumn(
                name: "skill_id",
                table: "user_skills");
        }
    }
}
