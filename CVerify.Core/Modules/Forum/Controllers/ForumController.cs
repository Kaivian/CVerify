using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Forum.DTOs;
using CVerify.API.Modules.Forum.Services;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;

namespace CVerify.API.Modules.Forum.Controllers;

[ApiController]
[Route("api/v1/forum")]
[Authorize]
public class ForumController : ControllerBase
{
    private readonly IForumService _forumService;

    public ForumController(IForumService forumService)
    {
        _forumService = forumService ?? throw new ArgumentNullException(nameof(forumService));
    }

    private Guid? OptionalCurrentUserId
    {
        get
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                return null;
            }
            return userId;
        }
    }

    private Guid CurrentUserId
    {
        get
        {
            var userId = OptionalCurrentUserId;
            if (!userId.HasValue)
            {
                throw new UnauthorizedAccessException("User is not authenticated.");
            }
            return userId.Value;
        }
    }

    private string? UserRole => User.FindFirst(ClaimTypes.Role)?.Value;

    #region Category Endpoints

    [HttpGet("categories")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories([FromQuery] Guid? organizationId, CancellationToken cancellationToken)
    {
        var categories = await _forumService.GetCategoriesAsync(organizationId, UserRole, cancellationToken);
        return Ok(categories);
    }

    [HttpGet("categories/{id}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCategory(Guid id, CancellationToken cancellationToken)
    {
        var category = await _forumService.GetCategoryByIdAsync(id, cancellationToken);
        return Ok(category);
    }

    [HttpPost("admin/categories")]
    [HasPermission("forum:category:manage")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request, [FromQuery] Guid? organizationId, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var category = await _forumService.CreateCategoryAsync(request, organizationId, cancellationToken);
        return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
    }

    [HttpPut("admin/categories/{id}")]
    [HasPermission("forum:category:manage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var category = await _forumService.UpdateCategoryAsync(id, request, cancellationToken);
        return Ok(category);
    }

    [HttpDelete("admin/categories/{id}")]
    [HasPermission("forum:category:manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken cancellationToken)
    {
        await _forumService.DeleteCategoryAsync(id, cancellationToken);
        return NoContent();
    }

    #endregion

    #region Tag Endpoints

    [HttpGet("tags")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTags(CancellationToken cancellationToken)
    {
        var tags = await _forumService.GetTagsAsync(cancellationToken);
        return Ok(tags);
    }

    [HttpGet("tags/trending")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTrendingTags(CancellationToken cancellationToken)
    {
        var tags = await _forumService.GetTrendingTagsAsync(cancellationToken);
        return Ok(tags);
    }

    [HttpPost("admin/tags/merge")]
    [HasPermission("forum:tag:manage")]
    public async Task<IActionResult> MergeTags([FromQuery] string source, [FromQuery] string target, CancellationToken cancellationToken)
    {
        await _forumService.MergeTagsAsync(source, target, cancellationToken);
        return NoContent();
    }

    #endregion

    #region Topic Endpoints

    [HttpGet("topics")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTopics([FromQuery] ForumTopicSearchQuery query, CancellationToken cancellationToken)
    {
        var pagedTopics = await _forumService.GetTopicsAsync(query, OptionalCurrentUserId, UserRole, cancellationToken);
        return Ok(pagedTopics);
    }

    [HttpGet("topics/{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTopicBySlug(string slug, CancellationToken cancellationToken)
    {
        var topic = await _forumService.GetTopicBySlugAsync(slug, OptionalCurrentUserId, cancellationToken);
        return Ok(topic);
    }

    [HttpPost("topics")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTopic([FromBody] CreateTopicRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var topic = await _forumService.CreateTopicAsync(request, CurrentUserId, cancellationToken);
        return CreatedAtAction(nameof(GetTopicBySlug), new { slug = topic.Slug }, topic);
    }

    [HttpPut("topics/{id}")]
    public async Task<IActionResult> UpdateTopic(Guid id, [FromBody] UpdateTopicRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var topic = await _forumService.UpdateTopicAsync(id, request, CurrentUserId, cancellationToken);
        return Ok(topic);
    }

    [HttpDelete("topics/{id}")]
    public async Task<IActionResult> DeleteTopic(Guid id, CancellationToken cancellationToken)
    {
        await _forumService.DeleteTopicAsync(id, CurrentUserId, UserRole, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{id}/vote")]
    public async Task<IActionResult> VoteOnTopic(Guid id, [FromBody] VoteRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.VoteOnTopicAsync(id, request, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{id}/react")]
    public async Task<IActionResult> ReactToTopic(Guid id, [FromBody] ReactionRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.ReactToTopicAsync(id, request, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{id}/bookmark")]
    public async Task<IActionResult> ToggleBookmark(Guid id, CancellationToken cancellationToken)
    {
        await _forumService.ToggleBookmarkTopicAsync(id, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{id}/follow")]
    public async Task<IActionResult> ToggleFollow(Guid id, CancellationToken cancellationToken)
    {
        await _forumService.ToggleFollowTopicAsync(id, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{id}/moderation")]
    [HasPermission("forum:topic:moderate")]
    public async Task<IActionResult> ModerateTopic(Guid id, [FromBody] ModerationActionRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var topic = await _forumService.PerformModeratorActionOnTopicAsync(id, request.Action, request.Reason, CurrentUserId, cancellationToken);
        return Ok(topic);
    }

    #endregion

    #region Reply Endpoints

    [HttpGet("topics/{topicId}/replies")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReplies(Guid topicId, CancellationToken cancellationToken)
    {
        var replies = await _forumService.GetTopicRepliesAsync(topicId, OptionalCurrentUserId, cancellationToken);
        return Ok(replies);
    }

    [HttpPost("topics/{topicId}/replies")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateReply(Guid topicId, [FromBody] CreateReplyRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var reply = await _forumService.CreateReplyAsync(topicId, request, CurrentUserId, cancellationToken);
        return Created(string.Empty, reply);
    }

    [HttpPut("replies/{id}")]
    public async Task<IActionResult> UpdateReply(Guid id, [FromBody] UpdateReplyRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var reply = await _forumService.UpdateReplyAsync(id, request, CurrentUserId, cancellationToken);
        return Ok(reply);
    }

    [HttpDelete("replies/{id}")]
    public async Task<IActionResult> DeleteReply(Guid id, CancellationToken cancellationToken)
    {
        await _forumService.DeleteReplyAsync(id, CurrentUserId, UserRole, cancellationToken);
        return NoContent();
    }

    [HttpPost("replies/{id}/accept")]
    public async Task<IActionResult> ToggleAcceptSolution(Guid id, CancellationToken cancellationToken)
    {
        var reply = await _forumService.AcceptSolutionAsync(id, CurrentUserId, cancellationToken);
        return Ok(reply);
    }

    [HttpPost("replies/{id}/vote")]
    public async Task<IActionResult> VoteOnReply(Guid id, [FromBody] VoteRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.VoteOnReplyAsync(id, request, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("replies/{id}/react")]
    public async Task<IActionResult> ReactToReply(Guid id, [FromBody] ReactionRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.ReactToReplyAsync(id, request, CurrentUserId, cancellationToken);
        return NoContent();
    }

    #endregion

    #region Moderation & Report Endpoints

    [HttpPost("reports")]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.ReportContentAsync(request, CurrentUserId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created);
    }

    [HttpGet("moderation/queue")]
    [HasPermission("forum:moderation:queue")]
    public async Task<IActionResult> GetReports([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var reports = await _forumService.GetReportsAsync(page, pageSize, cancellationToken);
        return Ok(reports);
    }

    [HttpPost("moderation/resolve/{id}")]
    [HasPermission("forum:moderation:queue")]
    public async Task<IActionResult> ResolveReport(Guid id, [FromBody] ResolveReportRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _forumService.ResolveReportAsync(id, request, CurrentUserId, cancellationToken);
        return NoContent();
    }

    [HttpGet("user/me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentUserForumProfile(CancellationToken cancellationToken)
    {
        var profile = await _forumService.GetUserMiniProfileAsync(CurrentUserId, cancellationToken);
        return Ok(profile);
    }

    #endregion
}
