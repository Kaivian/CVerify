using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Domain.Models;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.UnitTests.Services;

public class GraphBuilderTests
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICapabilityProjectionBuilder> _capabilityProjectionBuilderMock;

    public GraphBuilderTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(dbOptions);
        _capabilityProjectionBuilderMock = new Mock<ICapabilityProjectionBuilder>();

        // Default setup for resolver
        _capabilityProjectionBuilderMock
            .Setup(x => x.ResolveCanonicalIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string s, CancellationToken ct) => s);

        _capabilityProjectionBuilderMock
            .Setup(x => x.GetCapabilityRegistryAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string s, CancellationToken ct) => new CapabilityRegistry
            {
                CapabilityId = s,
                DisplayName = s + " Display",
                Category = "Engineering",
                Description = s + " Description"
            });
    }

    [Fact]
    public async Task RequirementGraphBuilder_BuildGraphAsync_ShouldBuildGraphCorrectly()
    {
        // Arrange
        var builder = new RequirementGraphBuilder(_capabilityProjectionBuilderMock.Object);

        var req = new HiringRequirement
        {
            Id = Guid.CreateVersion7(),
            Title = "Staff Backend Engineer",
            Department = "Core Engine",
            Seniority = "Staff",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            BusinessOutcomes = new List<BusinessOutcome>
            {
                new BusinessOutcome { Id = Guid.CreateVersion7(), Text = "Reduce db latency by 40% using db.query-tuning" }
            },
            Responsibilities = new List<Responsibility>
            {
                new Responsibility
                {
                    Id = Guid.CreateVersion7(),
                    Text = "Design and optimize Postgres queries",
                    Priority = RequirementPriority.MustHave,
                    OwnershipLevel = OwnershipLevel.Leader,
                    IsLeadership = true
                }
            },
            Capabilities = new List<RequirementCapability>
            {
                new RequirementCapability
                {
                    Id = Guid.CreateVersion7(),
                    CapabilityId = "db.query-tuning",
                    Name = "Database Query Tuning",
                    Category = "Backend Engineering",
                    Priority = RequirementPriority.MustHave,
                    OwnershipLevel = OwnershipLevel.Leader,
                    ExpectedProficiency = 4
                }
            },
            TechnologyRequirements = new List<TechnologyRequirement>
            {
                new TechnologyRequirement
                {
                    Id = Guid.CreateVersion7(),
                    Name = "PostgreSQL",
                    Priority = RequirementPriority.MustHave,
                    SfiaLevel = 4
                }
            }
        };

        // Act
        var graph = await builder.BuildGraphAsync(req, CancellationToken.None);

        // Assert
        graph.Nodes.Should().ContainKey("capability:db.query-tuning");
        graph.Nodes.Should().ContainKey("technology:postgresql");
        graph.Nodes.Should().ContainKey("domain:backend-engineering");
        graph.Nodes.Should().ContainKey($"outcome:{req.BusinessOutcomes.First().Id}");
        graph.Nodes.Should().ContainKey($"responsibility:{req.Responsibilities.First().Id}");

        var capNode = graph.Nodes["capability:db.query-tuning"];
        capNode.NodeType.Should().Be(LogicalNodeType.Capability);
        capNode.Attributes["ExpectedProficiency"].Should().Be("4");

        var edges = graph.AdjacencyList[$"outcome:{req.BusinessOutcomes.First().Id}"];
        edges.Should().ContainSingle(e => e.TargetId == "capability:db.query-tuning" && e.RelationType == LogicalRelationType.REQUIRES);
    }

    [Fact]
    public async Task RequirementGraphBuilder_BuildGraphFromSnapshotAsync_ShouldBuildGraphCorrectly()
    {
        // Arrange
        var builder = new RequirementGraphBuilder(_capabilityProjectionBuilderMock.Object);

        var snapshot = new RequirementSnapshot
        {
            Id = Guid.CreateVersion7(),
            HiringRequirementId = Guid.CreateVersion7(),
            Version = 1,
            Title = "Staff Backend Engineer",
            Department = "Core Engine",
            Seniority = "Staff",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            BusinessOutcomesJson = JsonSerializer.Serialize(new List<string> { "Reduce db latency by 40% using db.query-tuning" }),
            ResponsibilitiesJson = JsonSerializer.Serialize(new List<ResponsibilityDto>
            {
                new ResponsibilityDto("Design and optimize Postgres queries", RequirementPriority.MustHave, OwnershipLevel.Leader, true)
            }),
            CapabilitiesJson = JsonSerializer.Serialize(new List<RequirementCapabilityDto>
            {
                new RequirementCapabilityDto("db.query-tuning", "Database Query Tuning", "Backend Engineering", RequirementPriority.MustHave, OwnershipLevel.Leader, 4)
            }),
            TechnologyRequirementsJson = JsonSerializer.Serialize(new List<TechnologyRequirementDto>
            {
                new TechnologyRequirementDto("PostgreSQL", RequirementPriority.MustHave, 4)
            })
        };

        // Act
        var graph = await builder.BuildGraphFromSnapshotAsync(snapshot, CancellationToken.None);

        // Assert
        graph.Nodes.Should().ContainKey("capability:db.query-tuning");
        graph.Nodes.Should().ContainKey("technology:postgresql");
        graph.Nodes.Should().ContainKey("domain:backend-engineering");
        graph.Nodes.Should().ContainKey("outcome:snapshot_0");
        graph.Nodes.Should().ContainKey("responsibility:snapshot_0");

        var outcomeEdges = graph.AdjacencyList["outcome:snapshot_0"];
        outcomeEdges.Should().ContainSingle(e => e.TargetId == "capability:db.query-tuning" && e.RelationType == LogicalRelationType.REQUIRES);
    }

    [Fact]
    public async Task TalentGraphBuilder_BuildGraphAsync_ShouldBuildGraphCorrectly()
    {
        // Arrange
        var candidateAssessmentId = Guid.CreateVersion7();
        var userId = Guid.CreateVersion7();

        var user = new User
        {
            Id = userId,
            Email = "jane@cverify.ai",
            FullName = "Jane Doe",
            Username = "janedoe",
            Status = UserStatus.ACTIVE
        };

        var assessment = new CandidateAssessment
        {
            Id = candidateAssessmentId,
            UserId = userId,
            Status = "Completed",
            OverallScore = 85.0
        };

        var proj = new ProjectEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Name = "Query Profiler Tool",
            Description = "An open source query optimizer",
            Role = "Creator",
            VerificationLevel = ProjectVerificationLevel.RepositoryLinked,
            VerificationStatus = ProjectVerificationStatus.Verified
        };

        var repoAssessmentId = Guid.CreateVersion7();
        var repoId = Guid.CreateVersion7();

        var repo = new SourceCodeRepository
        {
            Id = repoId,
            AuthProviderId = Guid.CreateVersion7(),
            ExternalRepositoryId = "12345",
            IsEnabled = true,
            Name = "QueryOptimizer",
            Owner = "janedoe",
            OwnerLogin = "janedoe",
            OwnerType = "User"
        };

        var job = new AnalysisJob
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            RepositoryId = repoId,
            Status = "Completed"
        };

        var repoAssessment = new RepositoryAssessment
        {
            Id = repoAssessmentId,
            RepositoryId = repoId,
            AnalysisJobId = job.Id,
            Status = "Completed",
            CommitSha = "sha123",
            OverallScore = 90.0
        };

        var cap = new RepositoryCapability
        {
            Id = Guid.CreateVersion7(),
            RepositoryAssessmentId = repoAssessmentId,
            Name = "db.query-tuning",
            Category = "Backend Engineering",
            Confidence = 0.95,
            Maturity = "Advanced",
            DifficultyScore = 0.8,
            Score = 80.0,
            EvidenceJson = JsonSerializer.Serialize(new
            {
                file_path = "src/优化.sql",
                description = "Optimized complex query execution paths"
            })
        };

        var aggregatedCap = new RepositoryCapability
        {
            Id = Guid.CreateVersion7(),
            RepositoryAssessmentId = candidateAssessmentId, // Candidate assessment convention
            Name = "db.query-tuning",
            Category = "Backend Engineering",
            Confidence = 0.95,
            Maturity = "Advanced",
            DifficultyScore = 0.8,
            Score = 80.0
        };

        var domain = new CandidateDomainProfile
        {
            Id = Guid.CreateVersion7(),
            CandidateAssessmentId = candidateAssessmentId,
            DomainName = "Backend Engineering",
            Score = 85.0,
            Confidence = 0.9,
            Seniority = "Senior"
        };

        proj.RepositoryLinks.Add(new ProjectRepositoryLink
        {
            Id = Guid.CreateVersion7(),
            ProjectEntryId = proj.Id,
            SourceCodeRepositoryId = repoId
        });

        _context.Users.Add(user);
        _context.CandidateAssessments.Add(assessment);
        _context.ProjectEntries.Add(proj);
        _context.SourceCodeRepositories.Add(repo);
        _context.AnalysisJobs.Add(job);
        _context.RepositoryAssessments.Add(repoAssessment);
        _context.RepositoryCapabilities.Add(cap);
        _context.RepositoryCapabilities.Add(aggregatedCap);
        _context.CandidateDomainProfiles.Add(domain);
        await _context.SaveChangesAsync();

        var builder = new TalentGraphBuilder(_context, _capabilityProjectionBuilderMock.Object);

        // Act
        var graph = await builder.BuildGraphAsync(candidateAssessmentId, CancellationToken.None);

        // Assert
        graph.Nodes.Should().ContainKey($"project:{proj.Id}");
        graph.Nodes.Should().ContainKey($"repository:{repoAssessmentId}");
        graph.Nodes.Should().ContainKey("capability:db.query-tuning");
        graph.Nodes.Should().ContainKey($"citation:{repoAssessmentId}:{"src/优化.sql".GetHashCode()}");

        var citationNode = graph.Nodes[$"citation:{repoAssessmentId}:{"src/优化.sql".GetHashCode()}"];
        citationNode.NodeType.Should().Be(LogicalNodeType.CommitFileCitation);
        citationNode.Attributes["FilePath"].Should().Be("src/优化.sql");

        var repoEdges = graph.AdjacencyList[$"repository:{repoAssessmentId}"];
        repoEdges.Should().ContainSingle(e => e.TargetId == citationNode.Id && e.RelationType == LogicalRelationType.CONTAINS);

        var citationEdges = graph.AdjacencyList[citationNode.Id];
        citationEdges.Should().ContainSingle(e => e.TargetId == "capability:db.query-tuning" && e.RelationType == LogicalRelationType.PROVES);
    }
}
