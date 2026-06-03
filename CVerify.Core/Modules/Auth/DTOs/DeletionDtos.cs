using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using CVerify.API.Modules.AiChat.Entities;

namespace CVerify.API.Modules.Auth.DTOs;

public record DeletionRequirementsDto(
    bool RequiresPassword,
    bool RequiresOAuthReauth,
    string? LinkedOAuthProvider
);

public record InitiateDeletionRequest(
    string? Password,
    string? DeletionAuthorizeToken,
    string? FallbackOtpCode,
    Guid? FallbackOtpChallengeId,
    [Required]
    string ConfirmationPhrase
);

public record DeletionInitiationResponse(
    bool Success,
    string? ErrorCode,
    string? Message,
    List<BlockingOrganizationDto>? BlockingOrganizations = null
);

public record BlockingOrganizationDto(
    Guid Id,
    string Name,
    string Username,
    int MemberCount
);

public record ReactivateRequest(
    [Required]
    string ReactivationToken
);

public record FallbackOtpRequest(
    [Required]
    string Email
);
