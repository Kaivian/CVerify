using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Pipelines.RepositoryIntelligence.Models;

namespace CVerify.API.Pipelines.RepositoryIntelligence.Readers;

public interface IRepositoryArtifactReader
{
    Task<TechStackModel> GetTechStackAsync(Guid jobId, CancellationToken cancellationToken = default);
    Task<ArchitecturePatternsModel> GetArchitectureAsync(Guid jobId, CancellationToken cancellationToken = default);
    Task<OwnershipScoreModel> GetOwnershipMapAsync(Guid jobId, CancellationToken cancellationToken = default);
    Task<TrustSignalsModel> GetTrustSignalsAsync(Guid jobId, CancellationToken cancellationToken = default);
    Task<SkillEvidenceGraphModel> GetSkillGraphAsync(Guid jobId, CancellationToken cancellationToken = default);
}
