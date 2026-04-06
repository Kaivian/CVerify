using Microsoft.AspNetCore.Authorization;

namespace CVerify.API.Infrastructure.Security.Authorization.Attributes;

public class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string permission) : base(policy: permission)
    {
    }
}
