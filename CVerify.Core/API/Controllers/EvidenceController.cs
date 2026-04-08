using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;

namespace CVerify.API.API.Controllers;

[ApiController]
[Route("api/v1/users/evidence")]
[Authorize]
public class EvidenceController : ControllerBase
{
    private readonly IAttachmentService _attachmentService;

    public EvidenceController(IAttachmentService attachmentService)
    {
        _attachmentService = attachmentService;
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

    [HttpPost("upload")]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(AttachmentResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UploadEvidence(
        [FromForm] IFormFile file,
        [FromForm] string entityType,
        [FromForm] Guid? entityId,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File payload is empty or missing.");
        }

        if (string.IsNullOrWhiteSpace(entityType))
        {
            return BadRequest("EntityType is required.");
        }

        using var fileStream = file.OpenReadStream();
        var response = await _attachmentService.UploadAttachmentAsync(
            CurrentUserId, 
            entityType, 
            entityId, 
            fileStream, 
            file.FileName, 
            file.ContentType, 
            cancellationToken);

        return CreatedAtAction(nameof(GetEvidenceDownload), new { id = response.Id }, response);
    }

    [HttpGet("{id}/download")]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetEvidenceDownload(Guid id, CancellationToken cancellationToken)
    {
        var signedUrl = await _attachmentService.GetAttachmentSignedUrlAsync(CurrentUserId, id, cancellationToken);
        return Redirect(signedUrl);
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteEvidence(Guid id, CancellationToken cancellationToken)
    {
        await _attachmentService.DeleteAttachmentAsync(CurrentUserId, id, cancellationToken);
        return NoContent();
    }
}
