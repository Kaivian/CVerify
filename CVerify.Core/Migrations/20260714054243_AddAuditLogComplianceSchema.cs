using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogComplianceSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "browser",
                table: "audit_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "category",
                table: "audit_logs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "client_app",
                table: "audit_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "correlation_id",
                table: "audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "device",
                table: "audit_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "http_method",
                table: "audit_logs",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "http_path",
                table: "audit_logs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_legacy_security_event",
                table: "audit_logs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "request_id",
                table: "audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "resource_display_name",
                table: "audit_logs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "resource_id",
                table: "audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "resource_type",
                table: "audit_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "browser",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "category",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "client_app",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "correlation_id",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "device",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "http_method",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "http_path",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "is_legacy_security_event",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "request_id",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "resource_display_name",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "resource_id",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "resource_type",
                table: "audit_logs");
        }
    }
}
