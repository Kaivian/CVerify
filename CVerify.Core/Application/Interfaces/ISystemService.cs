using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface ISystemService
{
    Task<DatabaseStatusResponse> CheckDatabaseStatusAsync();
    Task<SystemHealthResponse> CheckSystemHealthAsync();
}
