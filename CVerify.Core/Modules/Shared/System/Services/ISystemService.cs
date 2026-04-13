
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ISystemService
{
    Task<DatabaseStatusResponse> CheckDatabaseStatusAsync();
    Task<SystemHealthResponse> CheckSystemHealthAsync();
}
