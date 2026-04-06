using System.Data;
using Dapper;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.Application.Services;

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
