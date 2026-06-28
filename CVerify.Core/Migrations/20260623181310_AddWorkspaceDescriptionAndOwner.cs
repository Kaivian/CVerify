using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkspaceDescriptionAndOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "workspaces",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "owner_id",
                table: "workspaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE workspaces w 
                SET owner_id = COALESCE(
                    (SELECT user_id FROM organization_memberships om WHERE om.organization_id = w.organization_id AND om.role = 'OWNER' AND om.status = 'active' LIMIT 1),
                    (SELECT user_id FROM organization_memberships om WHERE om.organization_id = w.organization_id AND om.status = 'active' LIMIT 1)
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE workspaces
                SET owner_id = (SELECT id FROM users LIMIT 1)
                WHERE owner_id IS NULL;
            ");

            migrationBuilder.AlterColumn<Guid>(
                name: "owner_id",
                table: "workspaces",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_workspaces_owner_id",
                table: "workspaces",
                column: "owner_id");

            migrationBuilder.AddForeignKey(
                name: "fk_workspaces_users_owner_id",
                table: "workspaces",
                column: "owner_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_workspaces_users_owner_id",
                table: "workspaces");

            migrationBuilder.DropIndex(
                name: "ix_workspaces_owner_id",
                table: "workspaces");

            migrationBuilder.DropColumn(
                name: "description",
                table: "workspaces");

            migrationBuilder.DropColumn(
                name: "owner_id",
                table: "workspaces");
        }
    }
}
