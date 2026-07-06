using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.DTOs;
namespace CVerify.API.UnitTests.Services
{
    public class CandidateAssessmentServiceReprocessTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
        private readonly Mock<ILogger<CandidateAssessmentService>> _loggerMock;
        private readonly Mock<ICandidateAssessmentQueue> _queueMock;
        private readonly Mock<IHmacSignatureService> _hmacServiceMock;
        private readonly Mock<IConnectionMultiplexer> _redisMock;
        private readonly Mock<ICandidateRepositoryProvider> _repositoryProviderMock;
        private readonly Mock<ICandidateEvaluationService> _evaluationServiceMock;
        private readonly Mock<ISkillTreeValidationService> _validationServiceMock;
        private readonly Mock<IAiStreamingSessionService> _streamingSessionServiceMock;
        private readonly Mock<IAiCancellationManager> _cancellationManagerMock;
        private readonly Mock<ICandidateRankingProjectionService> _rankingProjectionServiceMock;

        public CandidateAssessmentServiceReprocessTests()
        {
            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(dbOptions);
            _httpClientFactoryMock = new Mock<IHttpClientFactory>();
            _loggerMock = new Mock<ILogger<CandidateAssessmentService>>();
            _queueMock = new Mock<ICandidateAssessmentQueue>();
            _hmacServiceMock = new Mock<IHmacSignatureService>();
            _redisMock = new Mock<IConnectionMultiplexer>();
            _repositoryProviderMock = new Mock<ICandidateRepositoryProvider>();
            _evaluationServiceMock = new Mock<ICandidateEvaluationService>();
            _validationServiceMock = new Mock<ISkillTreeValidationService>();
            _streamingSessionServiceMock = new Mock<IAiStreamingSessionService>();
            _cancellationManagerMock = new Mock<IAiCancellationManager>();
            _rankingProjectionServiceMock = new Mock<ICandidateRankingProjectionService>();

            // Mock HMAC sign to return empty header values for test
            _hmacServiceMock.Setup(h => h.CreateSignatureHeaders(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(("mock-sig", "1234567890", "nonce-val"));
        }

        private CandidateAssessmentService CreateService()
        {
            return new CandidateAssessmentService(
                _context,
                _queueMock.Object,
                _httpClientFactoryMock.Object,
                _hmacServiceMock.Object,
                _redisMock.Object,
                _repositoryProviderMock.Object,
                _loggerMock.Object,
                _evaluationServiceMock.Object,
                _validationServiceMock.Object,
                _streamingSessionServiceMock.Object,
                _cancellationManagerMock.Object,
                _rankingProjectionServiceMock.Object
            );
        }

        private async Task SeedUserProfileAsync(Guid userId)
        {
            var user = new User
            {
                Id = userId,
                FullName = "Test Candidate",
                Email = "test@cverify.com",
                Username = "testcandidate",
                Status = CVerify.API.Modules.Shared.Domain.Enums.UserStatus.ACTIVE
            };

            var userProfile = new UserProfile
            {
                UserId = userId,
                ProfileVisibility = "public",
                Username = "testcandidate",
                Headline = "Software Engineer",
                Bio = "A passionate software engineer."
            };

            _context.Users.Add(user);
            _context.UserProfiles.Add(userProfile);
            await _context.SaveChangesAsync();
        }

        [Fact]
        public async Task ReprocessAssessmentAsync_WithValidSchemaV2_UpdatesAllDatabaseColumns()
        {
            // Arrange
            var assessmentId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            await SeedUserProfileAsync(userId);
            
            var assessment = new CandidateAssessment
            {
                Id = assessmentId,
                UserId = userId,
                Status = "Completed",
                OverallScore = 50.0,
                TrustLevel = 10.0,
                CareerLevel = "L1"
            };
            _context.CandidateAssessments.Add(assessment);
            await _context.SaveChangesAsync();

            var validJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""candidateScore"": 85.0,
                ""careerLevel"": ""L3"",
                ""careerLevelLabel"": ""Senior"",
                ""primaryTendency"": ""Backend"",
                ""primaryWorkingStyle"": ""System Designer"",
                ""recruiterHeadline"": ""Experienced backend dev"",
                ""fullSummary"": ""A detailed summary of candidate experience."",
                ""professionalBio"": ""A professional bio suggestion."",
                ""technicalDepth"": 80.0,
                ""technicalBreadth"": 70.0,
                ""leadershipPotential"": 75.0,
                ""executionStrength"": 90.0,
                ""trustLevel"": 95.0,
                ""trustScoreMetrics"": {
                    ""verifiedSkillRatio"": 0.9,
                    ""verifiedRepositoryRatio"": 1.0,
                    ""verifiedEvidenceRatio"": 0.85,
                    ""candidateTrustScore"": 95.0
                }
            }";

            SetupMockHttpClient(validJson, HttpStatusCode.OK);
            var service = CreateService();

            // Act
            await service.ReprocessAssessmentAsync(assessmentId, CancellationToken.None);

            // Assert
            var updated = await _context.CandidateAssessments.FindAsync(assessmentId);
            updated.Should().NotBeNull();
            updated.OverallScore.Should().Be(85.0);
            updated.CareerLevel.Should().Be("L3");
            updated.CareerLevelLabel.Should().Be("Senior");
            updated.PrimaryTendency.Should().Be("Backend");
            updated.PrimaryWorkingStyle.Should().Be("System Designer");
            updated.SummaryHeadline.Should().Be("Experienced backend dev");
            updated.SummaryParagraph.Should().Be("A detailed summary of candidate experience.");
            updated.ProfessionalBio.Should().Be("A professional bio suggestion.");
            updated.TechnicalDepth.Should().Be(80.0);
            updated.TechnicalBreadth.Should().Be(70.0);
            updated.LeadershipPotential.Should().Be(75.0);
            updated.ExecutionStrength.Should().Be(90.0);
            updated.TrustLevel.Should().Be(95.0);
        }

        [Fact]
        public async Task ReprocessAssessmentAsync_WithInvalidSchemaV2_FailsFastWithoutDatabaseUpdates()
        {
            // Arrange
            var assessmentId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            await SeedUserProfileAsync(userId);
            
            var assessment = new CandidateAssessment
            {
                Id = assessmentId,
                UserId = userId,
                Status = "Completed",
                OverallScore = 50.0,
                TrustLevel = 10.0
            };
            _context.CandidateAssessments.Add(assessment);
            await _context.SaveChangesAsync();

            // Missing trustScoreMetrics entirely
            var invalidJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""candidateScore"": 85.0,
                ""careerLevel"": ""L3""
            }";

            SetupMockHttpClient(invalidJson, HttpStatusCode.OK);
            var service = CreateService();

            // Act
            Func<Task> act = async () => await service.ReprocessAssessmentAsync(assessmentId, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<InvalidDataException>()
                .WithMessage("*Reprocess requires 'trustScoreMetrics'*");

            // Verify db columns were NOT modified
            var untouched = await _context.CandidateAssessments.FindAsync(assessmentId);
            untouched.OverallScore.Should().Be(50.0);
            untouched.TrustLevel.Should().Be(10.0);
        }

        [Fact]
        public async Task ReprocessAssessmentAsync_WithWrongSchemaVersion_FailsFastWithoutDatabaseUpdates()
        {
            // Arrange
            var assessmentId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            await SeedUserProfileAsync(userId);
            
            var assessment = new CandidateAssessment
            {
                Id = assessmentId,
                UserId = userId,
                Status = "Completed",
                OverallScore = 50.0,
                TrustLevel = 10.0
            };
            _context.CandidateAssessments.Add(assessment);
            await _context.SaveChangesAsync();

            // Wrong schema version
            var invalidJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v1"",
                ""candidateScore"": 85.0,
                ""careerLevel"": ""L3"",
                ""trustScoreMetrics"": {
                    ""verifiedSkillRatio"": 0.9,
                    ""verifiedRepositoryRatio"": 1.0,
                    ""verifiedEvidenceRatio"": 0.85,
                    ""candidateTrustScore"": 95.0
                }
            }";

            SetupMockHttpClient(invalidJson, HttpStatusCode.OK);
            var service = CreateService();

            // Act
            Func<Task> act = async () => await service.ReprocessAssessmentAsync(assessmentId, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<InvalidDataException>()
                .WithMessage("*Reprocess requires 'candidate-profile-v2'*");

            // Verify db columns were NOT modified
            var untouched = await _context.CandidateAssessments.FindAsync(assessmentId);
            untouched.OverallScore.Should().Be(50.0);
            untouched.TrustLevel.Should().Be(10.0);
        }

        [Fact]
        public async Task ReprocessAssessmentAsync_WithPriorNarratives_PreservesQualitativeFields()
        {
            // Arrange
            var assessmentId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            await SeedUserProfileAsync(userId);

            var assessment = new CandidateAssessment
            {
                Id = assessmentId,
                UserId = userId,
                Status = "Completed",
                OverallScore = 50.0,
                TrustLevel = 10.0
            };
            _context.CandidateAssessments.Add(assessment);

            var originalJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""recruiterHeadline"": ""Original AI Headline"",
                ""fullSummary"": ""Original AI Narrative Summary"",
                ""professionalBio"": ""Original AI Professional Bio"",
                ""keyStrengths"": [""Original Strength 1"", ""Original Strength 2""],
                ""watchPoints"": [""Original Warning 1""],
                ""evidenceGovernance"": [
                    { ""repositoryId"": ""repo-123"", ""repositoryName"": ""test-repo"" }
                ]
            }";

            var priorArtifact = new CandidateAssessmentArtifact
            {
                Id = Guid.NewGuid(),
                AssessmentId = assessmentId,
                ArtifactType = "CandidateProfile",
                JsonData = originalJson,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.CandidateAssessmentArtifacts.Add(priorArtifact);
            await _context.SaveChangesAsync();

            // The reprocessed scoring response only returns metrics (no narratives)
            var scoringResponseJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""candidateScore"": 92.0,
                ""careerLevel"": ""L4"",
                ""careerLevelLabel"": ""Architect"",
                ""trustLevel"": 98.0,
                ""trustScoreMetrics"": {
                    ""verifiedSkillRatio"": 1.0,
                    ""verifiedRepositoryRatio"": 1.0,
                    ""verifiedEvidenceRatio"": 0.95,
                    ""candidateTrustScore"": 98.0
                }
            }";

            SetupMockHttpClient(scoringResponseJson, HttpStatusCode.OK);
            var service = CreateService();

            // Act
            await service.ReprocessAssessmentAsync(assessmentId, CancellationToken.None);

            // Assert
            var updatedArtifact = await _context.CandidateAssessmentArtifacts
                .FirstOrDefaultAsync(a => a.AssessmentId == assessmentId && a.ArtifactType == "CandidateProfile");

            updatedArtifact.Should().NotBeNull();
            
            var parsed = JsonDocument.Parse(updatedArtifact.JsonData);
            var root = parsed.RootElement;

            // Metrics are updated
            root.GetProperty("candidateScore").GetDouble().Should().Be(92.0);
            root.GetProperty("trustLevel").GetDouble().Should().Be(98.0);

            // Qualitative fields are preserved
            root.GetProperty("recruiterHeadline").GetString().Should().Be("Original AI Headline");
            root.GetProperty("fullSummary").GetString().Should().Be("Original AI Narrative Summary");
            root.GetProperty("professionalBio").GetString().Should().Be("Original AI Professional Bio");
            
            var strengths = root.GetProperty("keyStrengths");
            strengths.GetArrayLength().Should().Be(2);
            strengths[0].GetString().Should().Be("Original Strength 1");
            strengths[1].GetString().Should().Be("Original Strength 2");

            var watchPoints = root.GetProperty("watchPoints");
            watchPoints.GetArrayLength().Should().Be(1);
            watchPoints[0].GetString().Should().Be("Original Warning 1");

            var evidence = root.GetProperty("evidenceGovernance");
            evidence.GetArrayLength().Should().Be(1);
            evidence[0].GetProperty("repositoryName").GetString().Should().Be("test-repo");
        }

        [Fact]
        public async Task ReprocessAssessmentAsync_SavesSchemaAndVersioningMetadata()
        {
            // Arrange
            var assessmentId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            await SeedUserProfileAsync(userId);

            var ca = new CandidateAssessment
            {
                Id = assessmentId,
                UserId = userId,
                Status = "Completed",
                OverallScore = 50.0,
                TrustLevel = 10.0
            };
            _context.CandidateAssessments.Add(ca);

            var originalJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""recruiterHeadline"": ""Headline"",
                ""fullSummary"": ""Summary"",
                ""professionalBio"": ""Bio""
            }";

            var priorArtifact = new CandidateAssessmentArtifact
            {
                Id = Guid.NewGuid(),
                AssessmentId = assessmentId,
                ArtifactType = "CandidateProfile",
                JsonData = originalJson,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.CandidateAssessmentArtifacts.Add(priorArtifact);
            await _context.SaveChangesAsync();

            var scoringResponseJson = @"
            {
                ""schemaVersion"": ""candidate-profile-v2"",
                ""candidateScore"": 85.0,
                ""careerLevel"": ""L3"",
                ""careerLevelLabel"": ""Senior"",
                ""trustLevel"": 75.0,
                ""evidenceCompleteness"": ""FULL"",
                ""cloneRiskClassification"": ""low_risk"",
                ""trustScoreMetrics"": {
                    ""verifiedSkillRatio"": 0.8,
                    ""verifiedRepositoryRatio"": 0.9,
                    ""verifiedEvidenceRatio"": 0.75,
                    ""candidateTrustScore"": 75.0
                }
            }";

            SetupMockHttpClient(scoringResponseJson, HttpStatusCode.OK);
            var service = CreateService();

            // Act
            await service.ReprocessAssessmentAsync(assessmentId, CancellationToken.None);

            // Assert
            var updated = await _context.CandidateAssessments.FindAsync(assessmentId);
            updated.Should().NotBeNull();
            updated.CalculationMode.Should().Be("Deterministic_Scoring");
            updated.EvidenceCompleteness.Should().Be("FULL");
            updated.CloneRiskClassification.Should().Be("low_risk");
            updated.InputFeatureSetHash.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public void MapToResponse_ShouldGenerateFallbackBio_WhenProfessionalBioIsNull()
        {
            // Arrange
            var assessment = new CandidateAssessment
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                CareerLevelLabel = "Senior",
                PrimaryTendency = "Frontend",
                PrimaryWorkingStyle = "UI Architect",
                SummaryHeadline = "Headline",
                SummaryParagraph = "Paragraph",
                ProfessionalBio = null
            };

            // Act
            var method = typeof(CandidateAssessmentService).GetMethod("MapToResponse", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            method.Should().NotBeNull();
            var response = (CandidateAssessmentResponse)method.Invoke(null, new object[] { assessment })!;

            // Assert
            response.Should().NotBeNull();
            response.ProfessionalBio.Should().Be("Senior Frontend Engineer specializing in robust system development, operating primarily as a UI Architect. Proven capability in designing, building, and deploying clean, maintainable software architectures.");
        }

        private void SetupMockHttpClient(string responseContent, HttpStatusCode statusCode)
        {
            var handler = new MockHttpMessageHandler(responseContent, statusCode);
            var client = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost:8000")
            };
            _httpClientFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(client);
        }

        private class MockHttpMessageHandler : HttpMessageHandler
        {
            private readonly string _response;
            private readonly HttpStatusCode _statusCode;

            public MockHttpMessageHandler(string response, HttpStatusCode statusCode)
            {
                _response = response;
                _statusCode = statusCode;
            }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                return Task.FromResult(new HttpResponseMessage
                {
                    StatusCode = _statusCode,
                    Content = new StringContent(_response, System.Text.Encoding.UTF8, "application/json")
                });
            }
        }
    }
}
