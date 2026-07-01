using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddForumModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "forum_badges",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    icon_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    criteria_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_badges", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "forum_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    icon_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    is_private = table.Column<bool>(type: "boolean", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false),
                    required_role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_categories", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_categories_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "forum_moderation_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    moderator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_moderation_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_moderation_logs_users_moderator_id",
                        column: x => x.moderator_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_reputations",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    points = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_reputations", x => x.user_id);
                    table.ForeignKey(
                        name: "fk_forum_reputations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    slug = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "forum_user_badges",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    badge_id = table.Column<Guid>(type: "uuid", nullable: false),
                    awarded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_user_badges", x => new { x.user_id, x.badge_id });
                    table.ForeignKey(
                        name: "fk_forum_user_badges_forum_badges_badge_id",
                        column: x => x.badge_id,
                        principalTable: "forum_badges",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_user_badges_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_category_moderators",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_category_moderators", x => new { x.category_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_forum_category_moderators_forum_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "forum_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_category_moderators_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_topics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    slug = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    ai_excerpt = table.Column<string>(type: "text", nullable: true),
                    view_count = table.Column<int>(type: "integer", nullable: false),
                    reply_count = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false),
                    is_locked = table.Column<bool>(type: "boolean", nullable: false),
                    is_solved = table.Column<bool>(type: "boolean", nullable: false),
                    is_featured = table.Column<bool>(type: "boolean", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false),
                    is_pending_review = table.Column<bool>(type: "boolean", nullable: false),
                    last_activity_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_topics", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_topics_forum_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "forum_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_topics_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_forum_topics_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_bookmarks",
                columns: table => new
                {
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_bookmarks", x => new { x.topic_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_forum_bookmarks_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_bookmarks_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_follows",
                columns: table => new
                {
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_follows", x => new { x.topic_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_forum_follows_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_follows_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_replies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_reply_id = table.Column<Guid>(type: "uuid", nullable: true),
                    content = table.Column<string>(type: "text", nullable: false),
                    quote_text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    is_accepted_solution = table.Column<bool>(type: "boolean", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_replies", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_replies_forum_replies_parent_reply_id",
                        column: x => x.parent_reply_id,
                        principalTable: "forum_replies",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_forum_replies_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_replies_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_topic_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    edited_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_topic_histories", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_topic_histories_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_topic_histories_users_edited_by_id",
                        column: x => x.edited_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_topic_tags",
                columns: table => new
                {
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_topic_tags", x => new { x.topic_id, x.tag_id });
                    table.ForeignKey(
                        name: "fk_forum_topic_tags_forum_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "forum_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_topic_tags_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_reactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reply_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reaction_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_reactions", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_reactions_forum_replies_reply_id",
                        column: x => x.reply_id,
                        principalTable: "forum_replies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_reactions_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_reactions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_reply_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reply_id = table.Column<Guid>(type: "uuid", nullable: false),
                    edited_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_reply_histories", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_reply_histories_forum_replies_reply_id",
                        column: x => x.reply_id,
                        principalTable: "forum_replies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_reply_histories_users_edited_by_id",
                        column: x => x.edited_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reply_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reported_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reporter_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    resolution_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    resolved_by_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_reports", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_reports_forum_replies_reply_id",
                        column: x => x.reply_id,
                        principalTable: "forum_replies",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_forum_reports_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_forum_reports_users_reported_user_id",
                        column: x => x.reported_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_forum_reports_users_reporter_user_id",
                        column: x => x.reporter_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_reports_users_resolved_by_id",
                        column: x => x.resolved_by_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "forum_votes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reply_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vote_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_votes", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_votes_forum_replies_reply_id",
                        column: x => x.reply_id,
                        principalTable: "forum_replies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_votes_forum_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "forum_topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_votes_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_forum_bookmarks_user_id",
                table: "forum_bookmarks",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_categories_organization_id",
                table: "forum_categories",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_category_moderators_user_id",
                table: "forum_category_moderators",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_follows_user_id",
                table: "forum_follows",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_moderation_logs_moderator_id",
                table: "forum_moderation_logs",
                column: "moderator_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reactions_reply_id",
                table: "forum_reactions",
                column: "reply_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reactions_topic_id",
                table: "forum_reactions",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reactions_user_id",
                table: "forum_reactions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_replies_author_id",
                table: "forum_replies",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_replies_parent_reply_id",
                table: "forum_replies",
                column: "parent_reply_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_replies_topic_id_parent_reply_id_created_at",
                table: "forum_replies",
                columns: new[] { "topic_id", "parent_reply_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_reply_histories_edited_by_id",
                table: "forum_reply_histories",
                column: "edited_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reply_histories_reply_id",
                table: "forum_reply_histories",
                column: "reply_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reports_reply_id",
                table: "forum_reports",
                column: "reply_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reports_reported_user_id",
                table: "forum_reports",
                column: "reported_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reports_reporter_user_id",
                table: "forum_reports",
                column: "reporter_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reports_resolved_by_id",
                table: "forum_reports",
                column: "resolved_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_reports_topic_id",
                table: "forum_reports",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_tags_name",
                table: "forum_tags",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_tags_slug",
                table: "forum_tags",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_topic_histories_edited_by_id",
                table: "forum_topic_histories",
                column: "edited_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_topic_histories_topic_id",
                table: "forum_topic_histories",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_topic_tags_tag_id",
                table: "forum_topic_tags",
                column: "tag_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_topics_author_id",
                table: "forum_topics",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_topics_category_id_is_pinned_created_at",
                table: "forum_topics",
                columns: new[] { "category_id", "is_pinned", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_topics_organization_id_created_at",
                table: "forum_topics",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_topics_slug",
                table: "forum_topics",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_user_badges_badge_id",
                table: "forum_user_badges",
                column: "badge_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_votes_reply_id",
                table: "forum_votes",
                column: "reply_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_votes_topic_id",
                table: "forum_votes",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_votes_user_id",
                table: "forum_votes",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "forum_bookmarks");

            migrationBuilder.DropTable(
                name: "forum_category_moderators");

            migrationBuilder.DropTable(
                name: "forum_follows");

            migrationBuilder.DropTable(
                name: "forum_moderation_logs");

            migrationBuilder.DropTable(
                name: "forum_reactions");

            migrationBuilder.DropTable(
                name: "forum_reply_histories");

            migrationBuilder.DropTable(
                name: "forum_reports");

            migrationBuilder.DropTable(
                name: "forum_reputations");

            migrationBuilder.DropTable(
                name: "forum_topic_histories");

            migrationBuilder.DropTable(
                name: "forum_topic_tags");

            migrationBuilder.DropTable(
                name: "forum_user_badges");

            migrationBuilder.DropTable(
                name: "forum_votes");

            migrationBuilder.DropTable(
                name: "forum_tags");

            migrationBuilder.DropTable(
                name: "forum_badges");

            migrationBuilder.DropTable(
                name: "forum_replies");

            migrationBuilder.DropTable(
                name: "forum_topics");

            migrationBuilder.DropTable(
                name: "forum_categories");
        }
    }
}
