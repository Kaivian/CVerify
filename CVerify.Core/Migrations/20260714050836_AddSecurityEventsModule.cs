using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSecurityEventsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "security_incidents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    assigned_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_security_incidents", x => x.id);
                    table.ForeignKey(
                        name: "fk_security_incidents_users_assigned_to_user_id",
                        column: x => x.assigned_to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "security_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    configuration_json = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_security_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "security_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    risk_score = table.Column<int>(type: "integer", nullable: false),
                    confidence_score = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    country_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    device = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    browser = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    session_id = table.Column<Guid>(type: "uuid", nullable: true),
                    details_json = table.Column<string>(type: "jsonb", nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    incident_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    occurrence_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_security_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_security_events_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_security_events_security_incidents_incident_id",
                        column: x => x.incident_id,
                        principalTable: "security_incidents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_security_events_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_security_events_users_assigned_to_user_id",
                        column: x => x.assigned_to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_security_events_users_target_user_id",
                        column: x => x.target_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "security_event_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    security_event_id = table.Column<Guid>(type: "uuid", nullable: true),
                    security_incident_id = table.Column<Guid>(type: "uuid", nullable: true),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_text = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_security_event_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_security_event_comments_security_events_security_event_id",
                        column: x => x.security_event_id,
                        principalTable: "security_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_security_event_comments_security_incidents_security_inciden",
                        column: x => x.security_incident_id,
                        principalTable: "security_incidents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_security_event_comments_users_author_user_id",
                        column: x => x.author_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_security_event_comments_author_user_id",
                table: "security_event_comments",
                column: "author_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_event_comments_created_at",
                table: "security_event_comments",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_security_event_comments_security_event_id",
                table: "security_event_comments",
                column: "security_event_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_event_comments_security_incident_id",
                table: "security_event_comments",
                column: "security_incident_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_actor_user_id",
                table: "security_events",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_assigned_to_user_id",
                table: "security_events",
                column: "assigned_to_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_correlation_id",
                table: "security_events",
                column: "correlation_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_created_at",
                table: "security_events",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_event_type",
                table: "security_events",
                column: "event_type");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_incident_id",
                table: "security_events",
                column: "incident_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_ip_address",
                table: "security_events",
                column: "ip_address");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_organization_id",
                table: "security_events",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_severity",
                table: "security_events",
                column: "severity");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_status",
                table: "security_events",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_security_events_target_user_id",
                table: "security_events",
                column: "target_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_incidents_assigned_to_user_id",
                table: "security_incidents",
                column: "assigned_to_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_security_incidents_created_at",
                table: "security_incidents",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_security_incidents_status",
                table: "security_incidents",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_security_rules_code",
                table: "security_rules",
                column: "code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "security_event_comments");

            migrationBuilder.DropTable(
                name: "security_rules");

            migrationBuilder.DropTable(
                name: "security_events");

            migrationBuilder.DropTable(
                name: "security_incidents");
        }
    }
}
