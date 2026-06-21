using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CVerify.API.Modules.Shared.System.Controllers;

[ApiController]
[Route("api/v1/hiring-requirements")]
[Authorize]
public class HiringRequirementController : ControllerBase
{
    private readonly IHiringRequirementService _hiringRequirementService;
    private readonly ICandidateMatchService _candidateMatchService;
    private readonly IConnectionMultiplexer _redis;
    private readonly ICapabilityCatalogService _catalogService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HiringRequirementController> _logger;

    public HiringRequirementController(
        IHiringRequirementService hiringRequirementService,
        ICandidateMatchService candidateMatchService,
        IConnectionMultiplexer redis,
        ICapabilityCatalogService catalogService,
        IServiceScopeFactory scopeFactory,
        ILogger<HiringRequirementController> logger)
    {
        _hiringRequirementService = hiringRequirementService;
        _candidateMatchService = candidateMatchService;
        _redis = redis;
        _catalogService = catalogService;
        _scopeFactory = scopeFactory;
        _logger = logger;
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

    [HttpGet("catalog")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetCatalog([FromQuery] Guid? workspaceId = null)
    {
        var catalog = _catalogService.GetCatalog(workspaceId);
        return Ok(catalog);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateDraft([FromBody] CreateHiringRequirementRequestDto request, CancellationToken cancellationToken)
    {
        try
        {
            var draft = await _hiringRequirementService.CreateDraftAsync(request, CurrentUserId, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = draft.Id }, new
            {
                id = draft.Id,
                status = draft.Status,
                version = draft.Version,
                createdAt = draft.CreatedAt
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDraft(Guid id, [FromBody] UpdateHiringRequirementRequestDto request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _hiringRequirementService.UpdateDraftAsync(id, request, cancellationToken);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var req = await _hiringRequirementService.GetByIdAsync(id, cancellationToken);
            return Ok(req);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpGet("workspace/{workspaceId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetByWorkspaceId(
        Guid workspaceId,
        [FromQuery] string? search,
        [FromQuery] string? department,
        [FromQuery] string? status,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortOrder,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _hiringRequirementService.GetByWorkspaceIdAsync(
            workspaceId,
            search,
            department,
            status,
            sortBy,
            sortOrder,
            page,
            pageSize,
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id}/generate-artifacts")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateArtifacts(Guid id)
    {
        try
        {
            // Verify requirement exists
            var req = await _hiringRequirementService.GetByIdAsync(id, CancellationToken.None);
            if (req == null)
            {
                return NotFound(new { message = "Hiring requirement not found." });
            }

            // Trigger asynchronously
            var scopeFactory = _scopeFactory;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var scopedService = scope.ServiceProvider.GetRequiredService<IHiringRequirementService>();
                    await scopedService.GenerateArtifactsAsync(id, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to asynchronously generate artifacts for hiring requirement {Id}", id);
                }
            });

            return Accepted(new { jobId = id.ToString(), status = "Generating" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpGet("{id}/artifacts")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetArtifacts(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var req = await _hiringRequirementService.GetByIdAsync(id, cancellationToken);
            var jd = req.RequirementArtifacts.FirstOrDefault(ra => ra.ArtifactType == "JobDescription");
            var rubric = req.EvaluationRubrics.FirstOrDefault();
            var blueprint = req.InterviewBlueprints.FirstOrDefault();

            if (jd == null && rubric == null && blueprint == null)
            {
                return NotFound(new { Message = "No artifacts generated yet for this requirement." });
            }

            object capabilityWeightsJson = null;
            object scoringRulesJson = null;
            object evidenceRequirementsJson = null;

            if (rubric != null)
            {
                if (!string.IsNullOrEmpty(rubric.CapabilityWeights))
                    capabilityWeightsJson = JsonSerializer.Deserialize<object>(rubric.CapabilityWeights);
                if (!string.IsNullOrEmpty(rubric.ScoringRules))
                    scoringRulesJson = JsonSerializer.Deserialize<object>(rubric.ScoringRules);
                if (!string.IsNullOrEmpty(rubric.EvidenceRequirements))
                    evidenceRequirementsJson = JsonSerializer.Deserialize<object>(rubric.EvidenceRequirements);
            }

            object capabilityQuestionsJson = null;
            object dimensionsJson = null;

            if (blueprint != null)
            {
                if (!string.IsNullOrEmpty(blueprint.CapabilityQuestions))
                    capabilityQuestionsJson = JsonSerializer.Deserialize<object>(blueprint.CapabilityQuestions);
                if (!string.IsNullOrEmpty(blueprint.Dimensions))
                    dimensionsJson = JsonSerializer.Deserialize<object>(blueprint.Dimensions);
            }

            object generatedJdJson = null;
            if (jd != null)
            {
                generatedJdJson = new {
                    Id = jd.Id,
                    ArtifactType = jd.ArtifactType,
                    MarkdownContent = jd.MarkdownContent,
                    StructuredContent = !string.IsNullOrEmpty(jd.StructuredContentJson) ? JsonSerializer.Deserialize<object>(jd.StructuredContentJson) : null,
                    Status = jd.Status,
                    ModelInfo = jd.ModelInfo,
                    PromptTemplateId = jd.PromptTemplateId,
                    PromptVersion = jd.PromptVersion,
                    PromptHash = jd.PromptHash,
                    GenerationTimestamp = jd.GenerationTimestamp,
                    GenerationMetadata = !string.IsNullOrEmpty(jd.GenerationMetadataJson) ? JsonSerializer.Deserialize<object>(jd.GenerationMetadataJson) : null,
                    RegenerationHistory = !string.IsNullOrEmpty(jd.RegenerationHistoryJson) ? JsonSerializer.Deserialize<object>(jd.RegenerationHistoryJson) : null,
                    UpdatedAt = jd.UpdatedAt
                };
            }

            return Ok(new
            {
                RequirementId = req.Id,
                GeneratedJd = generatedJdJson,
                Artifacts = req.RequirementArtifacts.Select(a => new {
                    Id = a.Id,
                    ArtifactType = a.ArtifactType,
                    MarkdownContent = a.MarkdownContent,
                    StructuredContent = !string.IsNullOrEmpty(a.StructuredContentJson) ? JsonSerializer.Deserialize<object>(a.StructuredContentJson) : null,
                    Status = a.Status,
                    ModelInfo = a.ModelInfo,
                    PromptTemplateId = a.PromptTemplateId,
                    PromptVersion = a.PromptVersion,
                    PromptHash = a.PromptHash,
                    GenerationTimestamp = a.GenerationTimestamp,
                    GenerationMetadata = !string.IsNullOrEmpty(a.GenerationMetadataJson) ? JsonSerializer.Deserialize<object>(a.GenerationMetadataJson) : null,
                    RegenerationHistory = !string.IsNullOrEmpty(a.RegenerationHistoryJson) ? JsonSerializer.Deserialize<object>(a.RegenerationHistoryJson) : null,
                    UpdatedAt = a.UpdatedAt
                }).ToList(),
                Rubric = rubric != null ? new
                {
                    CapabilityWeights = capabilityWeightsJson,
                    ScoringRules = scoringRulesJson,
                    EvidenceRequirements = evidenceRequirementsJson
                } : null,
                InterviewBlueprint = blueprint != null ? new
                {
                    Questions = capabilityQuestionsJson,
                    Dimensions = dimensionsJson
                } : null
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpPost("{id}/artifacts/generate")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateArtifact(Guid id, [FromBody] GenerateArtifactRequestDto request)
    {
        try
        {
            var req = await _hiringRequirementService.GetByIdAsync(id, CancellationToken.None);
            if (req == null)
            {
                return NotFound(new { message = "Hiring requirement not found." });
            }

            var scopeFactory = _scopeFactory;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var scopedService = scope.ServiceProvider.GetRequiredService<IHiringRequirementService>();
                    await scopedService.GenerateArtifactAsync(id, request.ArtifactType, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to asynchronously generate artifact {ArtifactType} for hiring requirement {Id}", request.ArtifactType, id);
                }
            });

            return Accepted(new { jobId = id.ToString(), status = "Generating" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/artifacts/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelArtifactGeneration(Guid id, [FromBody] CancelArtifactRequestDto request)
    {
        try
        {
            var req = await _hiringRequirementService.GetByIdAsync(id, CancellationToken.None);
            if (req == null)
            {
                return NotFound(new { message = "Hiring requirement not found." });
            }

            await _hiringRequirementService.CancelGenerationAsync(id, request.ArtifactType);
            return Ok(new { status = "Cancelled" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpGet("{id}/candidate-matches")]
    [ProducesResponseType(typeof(List<CandidateMatchDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCandidateMatches(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var matches = await _candidateMatchService.GetCandidateMatchesAsync(id, cancellationToken);
            return Ok(matches);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpPost("{id}/publish")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Publish(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var snapshot = await _hiringRequirementService.PublishAsync(id, cancellationToken);
            return Ok(new
            {
                snapshotId = snapshot.Id,
                version = snapshot.Version,
                publishedAt = snapshot.SnapshottedAt
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id}/progress-stream")]
    [Produces("text/event-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task GetProgressStream(Guid id)
    {
        try
        {
            var req = await _hiringRequirementService.GetByIdAsync(id, HttpContext.RequestAborted);
            if (req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
            {
                Response.StatusCode = StatusCodes.Status200OK;
                Response.ContentType = "text/event-stream";
                await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
                await Response.Body.FlushAsync(HttpContext.RequestAborted);
                return;
            }

            Response.ContentType = "text/event-stream";
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            var sub = _redis.GetSubscriber();
            var channel = $"hiring:requirement:progress:{id}";
            var channelQueue = global::System.Threading.Channels.Channel.CreateUnbounded<string>();

            void RedisMessageHandler(RedisChannel rc, RedisValue value)
            {
                channelQueue.Writer.TryWrite(value.ToString());
            }

            await sub.SubscribeAsync(channel, RedisMessageHandler);

            try
            {
                while (!HttpContext.RequestAborted.IsCancellationRequested)
                {
                    var message = await channelQueue.Reader.ReadAsync(HttpContext.RequestAborted);

                    await Response.WriteAsync($"data: {message}\n\n", HttpContext.RequestAborted);
                    await Response.Body.FlushAsync(HttpContext.RequestAborted);

                    using var doc = JsonDocument.Parse(message);
                    var statusPropExists = doc.RootElement.TryGetProperty("status", out var statusProp) || doc.RootElement.TryGetProperty("Status", out statusProp);
                    if (statusPropExists)
                    {
                        var status = statusProp.GetString();
                        if (status != null && (status.Equals("Completed", StringComparison.OrdinalIgnoreCase) || status.Equals("Failed", StringComparison.OrdinalIgnoreCase)))
                        {
                            await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
                            await Response.Body.FlushAsync(HttpContext.RequestAborted);
                            break;
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Graceful exit when client disconnects
            }
            finally
            {
                await sub.UnsubscribeAsync(channel, RedisMessageHandler);
            }
        }
        catch (KeyNotFoundException)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            await Response.WriteAsJsonAsync(new { message = "Hiring requirement not found." });
        }
    }

    [HttpPost("catalog")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateCustomCapability([FromBody] CreateCapabilityCatalogItemDto request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await _hiringRequirementService.CreateCustomCapabilityAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetCatalog), new { workspaceId = request.WorkspaceId }, item);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("catalog/{capabilityId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCustomCapability(string capabilityId, [FromBody] UpdateCapabilityCatalogItemDto request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await _hiringRequirementService.UpdateCustomCapabilityAsync(capabilityId, request, cancellationToken);
            return Ok(item);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("catalog/{capabilityId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCustomCapability(string capabilityId, CancellationToken cancellationToken)
    {
        try
        {
            await _hiringRequirementService.DeleteCustomCapabilityAsync(capabilityId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await _hiringRequirementService.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }
    }

    [HttpPost("bulk-delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> BulkDelete([FromBody] BulkHiringRequirementOperationDto request, CancellationToken cancellationToken)
    {
        await _hiringRequirementService.BulkDeleteAsync(request.Ids, cancellationToken);
        return NoContent();
    }

    [HttpPost("bulk-archive")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> BulkArchive([FromBody] BulkHiringRequirementOperationDto request, CancellationToken cancellationToken)
    {
        await _hiringRequirementService.BulkArchiveAsync(request.Ids, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id}/new-version")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateNewVersion(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var newReq = await _hiringRequirementService.CreateNewVersionAsync(id, cancellationToken);
            return Ok(new
            {
                id = newReq.Id,
                status = newReq.Status,
                version = newReq.Version,
                createdAt = newReq.CreatedAt
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
