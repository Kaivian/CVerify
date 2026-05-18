using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record ExternalOrganizationResponseDto(
    Guid Id,
    Guid AuthProviderId,
    string ExternalId,
    string Name,
    string Login,
    string Type,
    string? AvatarUrl,
    string? HtmlUrl,
    string? Description,
    bool IsActive
);
