using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAiStreamingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_streaming_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pipeline_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    progress = table.Column<double>(type: "double precision", nullable: false),
                    current_step = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    model_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    provider = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    total_cost_usd = table.Column<decimal>(type: "numeric(10,6)", nullable: true),
                    total_input_tokens = table.Column<int>(type: "integer", nullable: true),
                    total_output_tokens = table.Column<int>(type: "integer", nullable: true),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    summary_data = table.Column<string>(type: "jsonb", nullable: true),
                    expected_outputs = table.Column<string>(type: "jsonb", nullable: true),
                    pipeline_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_updated_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_streaming_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_ai_streaming_sessions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_ai_streaming_sessions_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "ai_streaming_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    log_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    component = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    message = table.Column<string>(type: "text", nullable: false),
                    timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_streaming_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_ai_streaming_logs_ai_streaming_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "ai_streaming_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ai_streaming_metrics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    metric_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    metric_value = table.Column<double>(type: "double precision", nullable: false),
                    timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_streaming_metrics", x => x.id);
                    table.ForeignKey(
                        name: "fk_ai_streaming_metrics_ai_streaming_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "ai_streaming_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ai_streaming_stages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    stage_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    progress = table.Column<double>(type: "double precision", nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_streaming_stages", x => x.id);
                    table.ForeignKey(
                        name: "fk_ai_streaming_stages_ai_streaming_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "ai_streaming_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_streaming_logs_session_id",
                table: "ai_streaming_logs",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_ai_streaming_metrics_session_id",
                table: "ai_streaming_metrics",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_ai_streaming_sessions_user_id",
                table: "ai_streaming_sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_ai_streaming_sessions_workspace_id",
                table: "ai_streaming_sessions",
                column: "workspace_id");

            migrationBuilder.CreateIndex(
                name: "ix_ai_streaming_stages_session_id",
                table: "ai_streaming_stages",
                column: "session_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_streaming_logs");

            migrationBuilder.DropTable(
                name: "ai_streaming_metrics");

            migrationBuilder.DropTable(
                name: "ai_streaming_stages");

            migrationBuilder.DropTable(
                name: "ai_streaming_sessions");
        }
    }
}
