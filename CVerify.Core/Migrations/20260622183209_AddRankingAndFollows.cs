using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRankingAndFollows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "candidate_ranking_projections",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    username = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    bio = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    headline = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    avatar_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    composite_score = table.Column<double>(type: "double precision", nullable: false),
                    ai_score = table.Column<double>(type: "double precision", nullable: false),
                    trust_score = table.Column<double>(type: "double precision", nullable: false),
                    profile_completeness = table.Column<double>(type: "double precision", nullable: false),
                    evidence_trust_score = table.Column<double>(type: "double precision", nullable: false),
                    verified_repo_count = table.Column<int>(type: "integer", nullable: false),
                    total_stars_count = table.Column<int>(type: "integer", nullable: false),
                    total_forks_count = table.Column<int>(type: "integer", nullable: false),
                    verified_contribution_count = table.Column<int>(type: "integer", nullable: false),
                    top_capabilities_json = table.Column<string>(type: "jsonb", nullable: true),
                    primary_domain = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    career_level_label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    followers_count = table.Column<int>(type: "integer", nullable: false),
                    following_count = table.Column<int>(type: "integer", nullable: false),
                    available_for_hire = table.Column<bool>(type: "boolean", nullable: false),
                    open_to_work_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    global_rank_position = table.Column<int>(type: "integer", nullable: false),
                    previous_global_rank_position = table.Column<int>(type: "integer", nullable: false),
                    last_updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_ranking_projections", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_ranking_projections_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_followers",
                columns: table => new
                {
                    follower_id = table.Column<Guid>(type: "uuid", nullable: false),
                    followee_id = table.Column<Guid>(type: "uuid", nullable: false),
                    followed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_followers", x => new { x.follower_id, x.followee_id });
                    table.ForeignKey(
                        name: "fk_user_followers_users_followee_id",
                        column: x => x.followee_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_user_followers_users_follower_id",
                        column: x => x.follower_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_followers_followee_id",
                table: "user_followers",
                column: "followee_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_ranking_projections");

            migrationBuilder.DropTable(
                name: "user_followers");
        }
    }
}
