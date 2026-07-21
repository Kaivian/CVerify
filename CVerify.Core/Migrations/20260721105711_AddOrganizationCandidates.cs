using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationCandidates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "organization_candidates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    saved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    saved_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    hiring_stage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    recruiter_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organization_candidates", x => x.id);
                    table.ForeignKey(
                        name: "fk_organization_candidates_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_organization_candidates_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_organization_candidates_users_recruiter_id",
                        column: x => x.recruiter_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_organization_candidates_users_saved_by_id",
                        column: x => x.saved_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_organization_candidates_composite",
                table: "organization_candidates",
                columns: new[] { "organization_id", "candidate_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_organization_candidates_candidate_id",
                table: "organization_candidates",
                column: "candidate_id");

            migrationBuilder.CreateIndex(
                name: "ix_organization_candidates_recruiter_id",
                table: "organization_candidates",
                column: "recruiter_id");

            migrationBuilder.CreateIndex(
                name: "ix_organization_candidates_saved_by_id",
                table: "organization_candidates",
                column: "saved_by_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "organization_candidates");
        }
    }
}
