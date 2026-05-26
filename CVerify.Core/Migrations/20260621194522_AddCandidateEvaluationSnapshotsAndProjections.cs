using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateEvaluationSnapshotsAndProjections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "eligibility_snapshot_json",
                table: "job_applications",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "candidate_capability_projections",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: false),
                    projected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_capability_projections", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_capability_projections_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_evaluation_snapshots",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_completeness = table.Column<double>(type: "double precision", nullable: false),
                    identity_trust_score = table.Column<double>(type: "double precision", nullable: false),
                    evidence_trust_score = table.Column<double>(type: "double precision", nullable: false),
                    verification_state = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    evaluated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_evaluation_snapshots", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_evaluation_snapshots_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_capability_projections");

            migrationBuilder.DropTable(
                name: "candidate_evaluation_snapshots");

            migrationBuilder.DropColumn(
                name: "eligibility_snapshot_json",
                table: "job_applications");
        }
    }
}
