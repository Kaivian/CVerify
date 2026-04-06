using System.Data;
using Dapper;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Application.Interfaces;

namespace CVerify.API.Infrastructure.Persistence;

public class IdentityRepository : IIdentityRepository
{
    private readonly IDbConnection _dbConnection;

    public IdentityRepository(ApplicationDbContext context)
    {
        _dbConnection = context.Database.GetDbConnection();
    }

    public async Task<IEnumerable<string>> GetUserRolesAsync(Guid userId)
    {
        const string sql = @"
            SELECT r.name 
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = @UserId";
        
        return await _dbConnection.QueryAsync<string>(sql, new { UserId = userId });
    }

    public async Task<IEnumerable<string>> GetUserPermissionsAsync(Guid userId)
    {
        const string sql = @"
            SELECT DISTINCT p.name 
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = @UserId";
        
        return await _dbConnection.QueryAsync<string>(sql, new { UserId = userId });
    }
}
