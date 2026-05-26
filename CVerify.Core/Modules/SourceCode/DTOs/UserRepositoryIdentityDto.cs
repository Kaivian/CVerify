using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record UserRepositoryIdentityDto(
    Guid Id,
    string ProviderType,
    string ExternalRepositoryId,
    string HtmlUrl
);
