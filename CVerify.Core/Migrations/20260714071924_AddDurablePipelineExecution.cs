using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDurablePipelineExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pipeline_executions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pipeline_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    reference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    progress = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false),
                    max_budget_usd = table.Column<decimal>(type: "numeric(10,6)", nullable: false),
                    cumulative_cost_usd = table.Column<decimal>(type: "numeric(10,6)", nullable: false),
                    total_input_tokens = table.Column<int>(type: "integer", nullable: true),
                    total_output_tokens = table.Column<int>(type: "integer", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: true),
                    model_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    provider = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    pipeline_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pipeline_executions", x => x.id);
                    table.ForeignKey(
                        name: "fk_pipeline_executions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_pipeline_executions_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "pipeline_events_durable",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    execution_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    log_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    component = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    message = table.Column<string>(type: "text", nullable: false),
                    timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pipeline_events_durable", x => x.id);
                    table.ForeignKey(
                        name: "fk_pipeline_events_durable_pipeline_executions_execution_id",
                        column: x => x.execution_id,
                        principalTable: "pipeline_executions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pipeline_stages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    execution_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    stage_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_stage_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    progress = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    details_json = table.Column<string>(type: "jsonb", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pipeline_stages", x => x.id);
                    table.ForeignKey(
                        name: "fk_pipeline_stages_pipeline_executions_execution_id",
                        column: x => x.execution_id,
                        principalTable: "pipeline_executions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pipeline_tasks_durable",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    execution_id = table.Column<Guid>(type: "uuid", nullable: false),
                    task_identifier = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    task_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    progress = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    prompt_tokens = table.Column<int>(type: "integer", nullable: true),
                    completion_tokens = table.Column<int>(type: "integer", nullable: true),
                    cache_read_tokens = table.Column<int>(type: "integer", nullable: true),
                    cache_write_tokens = table.Column<int>(type: "integer", nullable: true),
                    estimated_cost_usd = table.Column<decimal>(type: "numeric(10,6)", nullable: true),
                    model_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pipeline_tasks_durable", x => x.id);
                    table.ForeignKey(
                        name: "fk_pipeline_tasks_durable_pipeline_executions_execution_id",
                        column: x => x.execution_id,
                        principalTable: "pipeline_executions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_pipeline_events_durable_execution_id",
                table: "pipeline_events_durable",
                column: "execution_id");

            migrationBuilder.CreateIndex(
                name: "ix_pipeline_executions_user_id",
                table: "pipeline_executions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_pipeline_executions_workspace_id",
                table: "pipeline_executions",
                column: "workspace_id");

            migrationBuilder.CreateIndex(
                name: "ix_pipeline_stages_execution_id",
                table: "pipeline_stages",
                column: "execution_id");

            migrationBuilder.CreateIndex(
                name: "ix_pipeline_tasks_durable_execution_id",
                table: "pipeline_tasks_durable",
                column: "execution_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pipeline_events_durable");

            migrationBuilder.DropTable(
                name: "pipeline_stages");

            migrationBuilder.DropTable(
                name: "pipeline_tasks_durable");

            migrationBuilder.DropTable(
                name: "pipeline_executions");
        }
    }
}
