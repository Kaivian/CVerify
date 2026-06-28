using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateSkillTreeNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "candidate_skill_tree_nodes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    proficiency_level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    confidence_score = table.Column<double>(type: "double precision", nullable: false),
                    estimated_experience_months = table.Column<double>(type: "double precision", nullable: false),
                    supporting_evidence = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_skill_tree_nodes", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_skill_tree_nodes_candidate_assessments_candidate_",
                        column: x => x.candidate_assessment_id,
                        principalTable: "candidate_assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_candidate_skill_tree_nodes_candidate_skill_tree_nodes_paren",
                        column: x => x.parent_id,
                        principalTable: "candidate_skill_tree_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_candidate_skill_tree_nodes_candidate_assessment_id",
                table: "candidate_skill_tree_nodes",
                column: "candidate_assessment_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_skill_tree_nodes_parent_id",
                table: "candidate_skill_tree_nodes",
                column: "parent_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_skill_tree_nodes");
        }
    }
}
