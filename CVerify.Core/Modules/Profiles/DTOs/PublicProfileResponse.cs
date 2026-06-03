using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Profiles.DTOs;

public record PublicProfileResponse(
    Guid UserId,
    string Username,
    string FullName,
    string? AvatarUrl,
    string? Bio,
    string? Headline,
    string? Company,
    string? Location,
    List<string> SocialLinks
);
