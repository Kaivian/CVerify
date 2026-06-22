using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.System.DTOs;

public record CapabilityCatalogDto(
    string CapabilityId,
    string DisplayName,
    string Category,
    string Description,
    List<string> RecommendedSkills,
    List<string> ExpectedEvidence
);
