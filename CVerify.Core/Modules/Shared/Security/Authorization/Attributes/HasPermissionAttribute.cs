using Microsoft.AspNetCore.Authorization;

namespace CVerify.API.Modules.Shared.Security.Authorization.Attributes;

public class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string permission) : base(policy: permission)
    {
    }
}
