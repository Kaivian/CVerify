
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;

using CVerify.API.Modules.Shared.Security.Authorization.Attributes;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/permissions")]
public class PermissionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PermissionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [HasPermission("admin:roles:view")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPermissions()
    {
        var permissions = await _context.Permissions
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.DisplayName,
                p.Description,
                p.Module,
                p.IsSystem
            })
            .ToListAsync();

        return Ok(permissions);
    }
}
