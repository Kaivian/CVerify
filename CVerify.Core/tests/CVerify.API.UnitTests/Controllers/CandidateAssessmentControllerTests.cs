using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Profiles.Controllers;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Profiles.DTOs;
using StackExchange.Redis;

namespace CVerify.API.UnitTests.Controllers;

public class CandidateAssessmentControllerTests
{
    private readonly Mock<ICandidateAssessmentService> _mockService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSession;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly ClaimsPrincipal _userPrincipal;
    private readonly CandidateAssessmentController _controller;

    public CandidateAssessmentControllerTests()
    {
        _mockService = new Mock<ICandidateAssessmentService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockStreamingSession = new Mock<IAiStreamingSessionService>();

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, _userId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuthType");
        _userPrincipal = new ClaimsPrincipal(identity);

        _controller = new CandidateAssessmentController(
            _mockService.Object,
            _mockRedis.Object,
            _mockStreamingSession.Object
        )
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = _userPrincipal }
            }
        };
    }

    private CandidateAssessmentResponse CreateAssessmentResponse(Guid id, string status)
    {
        return new CandidateAssessmentResponse(
            Id: id,
            UserId: _userId,
            Status: status,
            OverallScore: 85.0,
            TrustLevel: 90.0,
            CareerLevel: "L2",
            CareerLevelLabel: "Mid Level",
            PrimaryTendency: "Backend",
            PrimaryWorkingStyle: "Individual",
            SummaryHeadline: "Headline",
            SummaryParagraph: "Paragraph",
            ProfessionalBio: "Bio",
            PipelineVersion: "2.2.0",
            AssessmentSchemaVersion: "1.2.0",
            CvId: _userId,
            PromptVersion: "v2.2.0",
            ModelVersion: "claude-haiku-4-5-20251001",
            LastProfileUpdateAt: DateTimeOffset.UtcNow,
            LastRepositoryAnalysisAt: DateTimeOffset.UtcNow,
            LastAssessmentAt: DateTimeOffset.UtcNow,
            FailedStage: null,
            FailureReason: null,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            CompletedAtUtc: DateTimeOffset.UtcNow,
            CalculationMode: "standard",
            InputFeatureSetHash: "hash",
            EvidenceCompleteness: "high",
            CloneRiskClassification: "low"
        );
    }

    [Fact]
    public async Task GetReadinessStatus_Should_Return_Ok_With_ReadinessDto()
    {
        // Arrange
        var readinessDto = new CandidateReadinessDto(
            IsReady: true,
            MissingFields: new List<MissingFieldDto>(),
            CompletenessScore: 100.0,
            RequiresReassessment: false,
            LastAssessmentAt: DateTimeOffset.UtcNow,
            LastProfileUpdateAt: DateTimeOffset.UtcNow,
            LastRepositoryAnalysisAt: DateTimeOffset.UtcNow
        );
        _mockService.Setup(s => s.GetReadinessStatusAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(readinessDto);

        // Act
        var result = await _controller.GetReadinessStatus(CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(readinessDto);
    }

    [Fact]
    public void GetStages_Should_Return_Ok_With_StagesList()
    {
        // Act
        var result = _controller.GetStages();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var list = okResult.Value as System.Collections.IEnumerable;
        list.Should().NotBeNull();
        
        int count = 0;
        foreach (var item in list!) count++;
        count.Should().Be(19);
    }

    [Fact]
    public async Task TriggerAssessment_Should_Return_Accepted_With_Response()
    {
        // Arrange
        var response = CreateAssessmentResponse(Guid.NewGuid(), "Queued");
        _mockService.Setup(s => s.TriggerAssessmentAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

        // Act
        var result = await _controller.TriggerAssessment(CancellationToken.None);

        // Assert
        var acceptedResult = result.Should().BeOfType<AcceptedResult>().Subject;
        acceptedResult.Value.Should().BeEquivalentTo(response);
    }

    [Fact]
    public async Task CancelAssessment_Should_Return_Ok_When_Successful()
    {
        // Arrange
        var assessmentId = Guid.NewGuid();
        _mockService.Setup(s => s.CancelAssessmentAsync(_userId, assessmentId))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.CancelAssessment(assessmentId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task CancelAssessment_Should_Return_BadRequest_When_Failed()
    {
        // Arrange
        var assessmentId = Guid.NewGuid();
        _mockService.Setup(s => s.CancelAssessmentAsync(_userId, assessmentId))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.CancelAssessment(assessmentId);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task DevTriggerAssessment_Should_Return_Ok_When_Successful()
    {
        // Arrange
        var targetUserId = Guid.Parse("019ecc1b-44e6-7600-803f-11249088ae92");
        var response = new CandidateAssessmentResponse(
            Id: Guid.NewGuid(),
            UserId: targetUserId,
            Status: "Queued",
            OverallScore: 0.0,
            TrustLevel: 0.0,
            CareerLevel: null,
            CareerLevelLabel: null,
            PrimaryTendency: null,
            PrimaryWorkingStyle: null,
            SummaryHeadline: null,
            SummaryParagraph: null,
            ProfessionalBio: null,
            PipelineVersion: "2.2.0",
            AssessmentSchemaVersion: "1.2.0",
            CvId: targetUserId,
            PromptVersion: "v2.2.0",
            ModelVersion: "claude-haiku-4-5-20251001",
            LastProfileUpdateAt: DateTimeOffset.UtcNow,
            LastRepositoryAnalysisAt: DateTimeOffset.UtcNow,
            LastAssessmentAt: null,
            FailedStage: null,
            FailureReason: null,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            CompletedAtUtc: null,
            CalculationMode: null,
            InputFeatureSetHash: null,
            EvidenceCompleteness: null,
            CloneRiskClassification: null
        );
        _mockService.Setup(s => s.TriggerAssessmentAsync(targetUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

        // Act
        var result = await _controller.DevTriggerAssessment(CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetLatestAssessment_Should_Return_Ok_With_Response()
    {
        // Arrange
        var response = CreateAssessmentResponse(Guid.NewGuid(), "Completed");
        _mockService.Setup(s => s.GetLatestAssessmentAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

        // Act
        var result = await _controller.GetLatestAssessment(CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(response);
    }

    [Fact]
    public async Task GetLatestAssessment_Should_Return_NoContent_When_NoneExists()
    {
        // Arrange
        _mockService.Setup(s => s.GetLatestAssessmentAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateAssessmentResponse?)null);

        // Act
        var result = await _controller.GetLatestAssessment(CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task GetAssessmentHistory_Should_Return_Ok_With_List()
    {
        // Arrange
        var list = new List<CandidateAssessmentResponse>
        {
            CreateAssessmentResponse(Guid.NewGuid(), "Completed")
        };
        _mockService.Setup(s => s.GetAssessmentHistoryAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(list);

        // Act
        var result = await _controller.GetAssessmentHistory(CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(list);
    }

    [Fact]
    public async Task GetAssessmentDetails_Should_Return_Ok_With_Details()
    {
        // Arrange
        var assessmentId = Guid.NewGuid();
        var assessmentResponse = CreateAssessmentResponse(assessmentId, "Completed");
        var details = new CandidateAssessmentDetailResponse(
            Assessment: assessmentResponse,
            Artifacts: new List<CandidateAssessmentArtifactDto>()
        );
        _mockService.Setup(s => s.GetAssessmentDetailsAsync(_userId, assessmentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(details);

        // Act
        var result = await _controller.GetAssessmentDetails(assessmentId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(details);
    }
}
