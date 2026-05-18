using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Modules.SourceCode.DTOs;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.SourceCode.Controllers;

[ApiController]
[Route("api/source-code-providers")]
[Authorize]
public class SourceCodeProvidersController : ControllerBase
{
    private readonly ISourceCodeProviderService _sourceCodeProviderService;

    public SourceCodeProvidersController(ISourceCodeProviderService sourceCodeProviderService)
    {
        _sourceCodeProviderService = sourceCodeProviderService;
    }

    private Guid CurrentUserId
    {
        get
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                throw new UnauthorizedAccessException("User is not authenticated or user ID is invalid.");
            }
            return userId;
        }
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(System.Collections.Generic.IEnumerable<SourceCodeProviderDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProviders(CancellationToken cancellationToken)
    {
        var providers = await _sourceCodeProviderService.GetProvidersAsync(CurrentUserId);
        return Ok(providers);
    }

    [HttpGet("repositories")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<RepositoryDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetRepositories(
        [FromQuery] Guid? providerId,
        [FromQuery] string? search,
        [FromQuery] string? visibility,
        [FromQuery] string? language,
        [FromQuery] string? sort,
        [FromQuery] string? category,
        [FromQuery] string? ownerType,
        [FromQuery] Guid? organizationId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var result = await _sourceCodeProviderService.GetRepositoriesAsync(
            CurrentUserId,
            providerId,
            search,
            visibility,
            language,
            sort,
            category,
            ownerType,
            organizationId,
            page,
            pageSize);

        return Ok(result);
    }

    [HttpGet("organizations")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(System.Collections.Generic.IEnumerable<ExternalOrganizationResponseDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetOrganizations(CancellationToken cancellationToken)
    {
        var result = await _sourceCodeProviderService.GetOrganizationsAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpGet("repositories/categories")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(System.Collections.Generic.IEnumerable<string>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetRepositoryCategories(CancellationToken cancellationToken)
    {
        var categories = await _sourceCodeProviderService.GetDistinctCategoriesAsync(CurrentUserId);
        return Ok(categories);
    }

    [HttpPost("{providerId}/sync")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SyncProvider(Guid providerId, CancellationToken cancellationToken)
    {
        var jobId = await _sourceCodeProviderService.EnqueueSyncJobAsync(CurrentUserId, providerId);
        return Accepted(new { JobId = jobId, Status = "Queued" });
    }

    [HttpPost("sync-all")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SyncAll(CancellationToken cancellationToken)
    {
        var jobId = await _sourceCodeProviderService.EnqueueSyncJobAsync(CurrentUserId, null);
        return Accepted(new { JobId = jobId, Status = "Queued" });
    }

    [HttpGet("sync/status/{jobId}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RepositorySyncJobStatus))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSyncStatus(Guid jobId, CancellationToken cancellationToken)
    {
        var status = await _sourceCodeProviderService.GetSyncStatusAsync(CurrentUserId, jobId);
        if (status == null)
        {
            return NotFound(new { Message = "Sync job not found or access denied." });
        }
        return Ok(status);
    }
}
