using System;
using System.Text.Json;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public interface ISkillTreeValidationService
{
    /// <summary>
    /// Parses, validates, and normalizes the raw JSON skill tree.
    /// Generates stable database GUIDs for the nodes and verifies constraints (no cycles, max depth, duplicates).
    /// </summary>
    Task<System.Collections.Generic.List<CandidateSkillTreeNode>> ValidateAndNormalizeTreeAsync(
        Guid candidateId,
        Guid assessmentId,
        JsonElement rootElement);
}
