using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEnterpriseOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "enterprise_workflow_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    priority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    metadata_json = table.Column<string>(type: "text", nullable: false),
                    assigned_reviewer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    claimed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    escalated_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    review_state = table.Column<string>(type: "text", nullable: true),
                    row_version = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enterprise_workflow_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_enterprise_workflow_requests_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_enterprise_workflow_requests_users_assigned_reviewer_id",
                        column: x => x.assigned_reviewer_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_enterprise_workflow_requests_users_escalated_to_user_id",
                        column: x => x.escalated_to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "workflow_attachments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_path = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_attachments", x => x.id);
                    table.ForeignKey(
                        name: "fk_workflow_attachments_enterprise_workflow_requests_workflow_",
                        column: x => x.workflow_request_id,
                        principalTable: "enterprise_workflow_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    is_internal_only = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_workflow_comments_enterprise_workflow_requests_workflow_req",
                        column: x => x.workflow_request_id,
                        principalTable: "enterprise_workflow_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_workflow_comments_users_author_user_id",
                        column: x => x.author_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_enterprise_workflow_requests_assigned_reviewer_id",
                table: "enterprise_workflow_requests",
                column: "assigned_reviewer_id");

            migrationBuilder.CreateIndex(
                name: "ix_enterprise_workflow_requests_escalated_to_user_id",
                table: "enterprise_workflow_requests",
                column: "escalated_to_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_enterprise_workflow_requests_organization_id",
                table: "enterprise_workflow_requests",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_attachments_workflow_request_id",
                table: "workflow_attachments",
                column: "workflow_request_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_comments_author_user_id",
                table: "workflow_comments",
                column: "author_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_comments_workflow_request_id",
                table: "workflow_comments",
                column: "workflow_request_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workflow_attachments");

            migrationBuilder.DropTable(
                name: "workflow_comments");

            migrationBuilder.DropTable(
                name: "enterprise_workflow_requests");
        }
    }
}
