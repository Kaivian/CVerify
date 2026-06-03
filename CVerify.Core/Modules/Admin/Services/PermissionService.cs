
using System.Data;
using Microsoft.EntityFrameworkCore;
using Dapper;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Admin.Services;

public class PermissionService : IPermissionService
{
    private readonly IDbConnection _db;

    public PermissionService(ApplicationDbContext context)
    {
        _db = context.Database.GetDbConnection();
    }

    public async Task<List<string>> GetPermissionsByRoleIdAsync(Guid roleId)
    {
        const string sql = @"
            SELECT p.name 
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = @RoleId";

        var permissions = await _db.QueryAsync<string>(sql, new { RoleId = roleId });
        return permissions.ToList();
    }
}
