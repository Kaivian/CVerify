using Microsoft.AspNetCore.Authorization;
using CVerify.API.Infrastructure.Security.Authorization.Handlers;
using CVerify.API.Infrastructure.Security.Authorization.Providers;

namespace CVerify.API.API.Extensions;

public static class AuthorizationSetup
{
    public static IServiceCollection AddCustomAuthorization(this IServiceCollection services)
    {
        // Register Policy Provider as Singleton as it is stateless
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        
        // Register Handler as Scoped to allow dependency injection (e.g., Database Context) if needed
        services.AddScoped<IAuthorizationHandler, PermissionHandler>();

        return services;
    }
}
