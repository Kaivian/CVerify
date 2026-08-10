using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.Modules.Shared.System.Services;

public class HiringRequirementService : IHiringRequirementService
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityCatalogService _catalogService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHmacSignatureService _hmacService;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<HiringRequirementService> _logger;
    private readonly IAiStreamingSessionService _streamingSessionService;
    private readonly IAiCancellationManager _cancellationManager;
    private readonly ITechnologyNormalizationService _normalizationService;

    public HiringRequirementService(
        ApplicationDbContext context,
        ICapabilityCatalogService catalogService,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        IConnectionMultiplexer redis,
        ILogger<HiringRequirementService> logger,
        IAiStreamingSessionService streamingSessionService,
        IAiCancellationManager cancellationManager,
        ITechnologyNormalizationService normalizationService)
    {
        _context = context;
        _catalogService = catalogService;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _redis = redis;
        _logger = logger;
        _streamingSessionService = streamingSessionService;
        _cancellationManager = cancellationManager;
        _normalizationService = normalizationService;
    }

    public async Task<HiringRequirement> CreateDraftAsync(CreateHiringRequirementRequestDto request, Guid userId, CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == request.OrganizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new KeyNotFoundException("Organization not found.");
        }

        var workspace = await _context.Workspaces
            .FirstOrDefaultAsync(w => w.OrganizationId == org.Id && w.DeletedAt == null, cancellationToken);

        if (workspace == null)
        {
            throw new KeyNotFoundException("Workspace not found for this organization.");
        }

        var requirement = new HiringRequirement
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = org.Id,
            WorkspaceId = workspace.Id,
            Title = request.Title,
            Department = request.Department,
            Seniority = request.Seniority,
            WorkplaceType = request.WorkplaceType,
            City = request.City,
            EmploymentType = request.EmploymentType,
            Headcount = request.Headcount,
            Status = "Draft",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.HiringRequirements.Add(requirement);
        await _context.SaveChangesAsync(cancellationToken);

        return requirement;
    }

    public async Task<HiringRequirement> UpdateDraftAsync(Guid id, UpdateHiringRequirementRequestDto request, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
                .ThenInclude(c => c.EvidenceSignals)
            .Include(r => r.TechnologyRequirements)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        if (req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cannot update a published hiring requirement.");
        }

        // Update scalar fields
        if (request.HiringReason != null) req.HiringReason = request.HiringReason;
        if (request.BusinessProblem != null) req.BusinessProblem = request.BusinessProblem;
        if (request.SalaryMin != null) req.SalaryMin = request.SalaryMin;
        if (request.SalaryMax != null) req.SalaryMax = request.SalaryMax;
        if (request.Currency != null) req.Currency = request.Currency;
        if (request.TimezoneRange != null) req.TimezoneRange = request.TimezoneRange;
        if (request.DegreeRequirement != null) req.DegreeRequirement = request.DegreeRequirement;
        if (request.Benefits != null) req.Benefits = request.Benefits;
        if (request.LanguageRequirements != null) req.LanguageRequirements = request.LanguageRequirements;
        if (request.StartDate != null) req.StartDate = request.StartDate;
        if (request.EndDate != null) req.EndDate = request.EndDate;
        if (request.AutoCloseRule != null) req.AutoCloseRule = request.AutoCloseRule.Value;
        if (request.CandidatesNeededCount != null) req.CandidatesNeededCount = request.CandidatesNeededCount;
        if (request.Headcount != null) req.Headcount = request.Headcount.Value;
        if (request.SalaryPeriod != null) req.SalaryPeriod = request.SalaryPeriod.Value;
        if (request.IsSalaryNegotiable != null) req.IsSalaryNegotiable = request.IsSalaryNegotiable.Value;
        if (request.IsManuallyClosed != null) req.IsManuallyClosed = request.IsManuallyClosed.Value;

        // 1. Update Business Outcomes
        if (request.Outcomes != null)
        {
            _context.BusinessOutcomes.RemoveRange(req.BusinessOutcomes);
            foreach (var outcomeText in request.Outcomes)
            {
                req.BusinessOutcomes.Add(new BusinessOutcome
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = req.Id,
                    Text = outcomeText
                });
            }
        }

        // 2. Update Responsibilities
        if (request.Responsibilities != null)
        {
            _context.Responsibilities.RemoveRange(req.Responsibilities);
            foreach (var resp in request.Responsibilities)
            {
                req.Responsibilities.Add(new Responsibility
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = req.Id,
                    Text = resp.Text,
                    Priority = resp.Priority,
                    OwnershipLevel = resp.OwnershipLevel,
                    IsLeadership = resp.IsLeadership
                });
            }
        }

        // 3. Update Capabilities & Evidence Signals
        if (request.Capabilities != null)
        {
            _context.RequirementCapabilities.RemoveRange(req.Capabilities);
            foreach (var cap in request.Capabilities)
            {
                // Validate capabilityId against catalog
                if (!_catalogService.ValidateCapability(cap.CapabilityId, req.WorkspaceId))
                {
                    throw new ArgumentException($"Capability '{cap.CapabilityId}' is not defined in the catalog.");
                }

                var catalogItem = _catalogService.GetCapability(cap.CapabilityId, req.WorkspaceId)!;

                var newCap = new RequirementCapability
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = req.Id,
                    CapabilityId = cap.CapabilityId,
                    Name = cap.Name,
                    Category = cap.Category,
                    Priority = cap.Priority,
                    OwnershipLevel = cap.OwnershipLevel,
                    ExpectedProficiency = cap.ExpectedProficiency
                };

                // Add default evidence signals based on catalog mapping
                foreach (var signalDesc in catalogItem.ExpectedEvidence)
                {
                    var signalType = signalDesc.Split(' ')[0];
                    newCap.EvidenceSignals.Add(new EvidenceSignal
                    {
                        Id = Guid.CreateVersion7(),
                        RequirementCapabilityId = newCap.Id,
                        SignalType = signalType,
                        ExpectedMetric = signalDesc,
                        Rationale = $"Expected evidence mapping for canonical capability {newCap.Name}."
                    });
                }

                req.Capabilities.Add(newCap);
            }
        }

        // 4. Update Technology / Skills Requirements
        if (request.Skills != null)
        {
            _context.TechnologyRequirements.RemoveRange(req.TechnologyRequirements);
            foreach (var skill in request.Skills)
            {
                var norm = await _normalizationService.NormalizeAsync(skill.Name, cancellationToken);
                req.TechnologyRequirements.Add(new TechnologyRequirement
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = req.Id,
                    Name = norm.NormalizedName, // Save canonical display name
                    Priority = skill.Priority,
                    SfiaLevel = skill.SfiaLevel
                });
            }
        }

        // Sync associated JobVacancy draft if exists
        var vacancy = await _context.JobVacancies.FirstOrDefaultAsync(v => v.HiringRequirementId == req.Id, cancellationToken);
        if (vacancy != null && vacancy.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
        {
            vacancy.Title = req.Title;
            vacancy.Department = req.Department;
            vacancy.WorkplaceType = req.WorkplaceType;
            if (req.City != null) vacancy.City = req.City;
            vacancy.Type = req.EmploymentType;
            vacancy.Headcount = req.Headcount;
            vacancy.Degree = req.DegreeRequirement ?? "No Degree Required";
            vacancy.Salary = req.SalaryMin.HasValue && req.SalaryMax.HasValue ? $"{req.SalaryMin} - {req.SalaryMax} {req.Currency}" : "Negotiable";
            vacancy.SalaryMinMax = $"{req.SalaryMin ?? 0}-{req.SalaryMax ?? 0}";
            vacancy.Benefits = req.Benefits ?? new List<string>();
            vacancy.Skills = req.TechnologyRequirements.Select(t => t.Name).ToList();
            vacancy.UpdatedAt = DateTimeOffset.UtcNow;
        }

        req.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return req;
    }

    public async Task<HiringRequirement> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
                .ThenInclude(c => c.EvidenceSignals)
            .Include(r => r.TechnologyRequirements)
            .Include(r => r.EvaluationRubrics)
            .Include(r => r.InterviewBlueprints)
            .Include(r => r.RequirementArtifacts)
            .Include(r => r.Snapshots)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        return req;
    }

    public async Task<RequirementSnapshot> PublishAsync(Guid id, CancellationToken cancellationToken)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var req = await _context.HiringRequirements
                .Include(r => r.BusinessOutcomes)
                .Include(r => r.Responsibilities)
                .Include(r => r.Capabilities)
                    .ThenInclude(c => c.EvidenceSignals)
                .Include(r => r.TechnologyRequirements)
                .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

            if (req == null)
            {
                throw new KeyNotFoundException("Hiring requirement not found.");
            }

            if (req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Hiring requirement is already published.");
            }

            // Update status
            req.Status = "Published";
            req.UpdatedAt = DateTimeOffset.UtcNow;

            // 1. Dynamic Matching Weight & Vector Calculations
            var weights = CalculateWeights(req);
            var vector = CalculateRequirementVector(req, weights);

            // 2. Build the snapshot
            var snapshot = new RequirementSnapshot
            {
                Id = Guid.CreateVersion7(),
                HiringRequirementId = req.Id,
                Version = req.Version,
                SnapshottedAt = DateTimeOffset.UtcNow,
                Title = req.Title,
                Department = req.Department,
                Seniority = req.Seniority,
                WorkplaceType = req.WorkplaceType,
                City = req.City,
                EmploymentType = req.EmploymentType,
                SalaryMin = req.SalaryMin,
                SalaryMax = req.SalaryMax,
                Currency = req.Currency,
                SalaryPeriod = req.SalaryPeriod,
                IsSalaryNegotiable = req.IsSalaryNegotiable,
                TimezoneRange = req.TimezoneRange,
                DegreeRequirement = req.DegreeRequirement,
                Benefits = req.Benefits,
                LanguageRequirements = req.LanguageRequirements,
                Headcount = req.Headcount,
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                AutoCloseRule = req.AutoCloseRule,
                CandidatesNeededCount = req.CandidatesNeededCount,
                IsManuallyClosed = req.IsManuallyClosed,
                HiringReason = req.HiringReason,
                BusinessProblem = req.BusinessProblem,
                BusinessOutcomesJson = JsonSerializer.Serialize(req.BusinessOutcomes.Select(o => o.Text).ToList()),
                ResponsibilitiesJson = JsonSerializer.Serialize(req.Responsibilities.Select(r => new { r.Text, r.Priority, r.OwnershipLevel, r.IsLeadership }).ToList()),
                CapabilitiesJson = JsonSerializer.Serialize(req.Capabilities.Select(c => new { c.CapabilityId, c.Name, c.Category, c.Priority, c.OwnershipLevel, c.ExpectedProficiency, Signals = c.EvidenceSignals.Select(es => new { es.SignalType, es.ExpectedMetric }).ToList() }).ToList()),
                TechnologyRequirementsJson = JsonSerializer.Serialize(req.TechnologyRequirements.Select(t => new { t.Name, t.Priority, t.SfiaLevel }).ToList())
            };

            // 3. Evaluation Rubric Snapshot projection
            snapshot.EvaluationRubricSnapshot = new EvaluationRubricSnapshot
            {
                RequirementSnapshotId = snapshot.Id,
                CapabilityWeights = JsonSerializer.Serialize(weights),
                ScoringRules = JsonSerializer.Serialize(new
                {
                    minimumMaturityThreshold = req.Seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase) ? "Contributor" : "Practitioner",
                    selfDeclaredMatchCeiling = 0.40
                }),
                EvidenceRequirements = JsonSerializer.Serialize(req.Capabilities.SelectMany(c => c.EvidenceSignals).Select(es => new { es.SignalType, es.ExpectedMetric }).ToList()),
                SnapshottedAt = DateTimeOffset.UtcNow
            };

            // 4. Interview Blueprint Snapshot projection
            var blueprint = req.InterviewBlueprints.FirstOrDefault();
            snapshot.InterviewBlueprintSnapshot = new InterviewBlueprintSnapshot
            {
                RequirementSnapshotId = snapshot.Id,
                CapabilityQuestions = blueprint?.CapabilityQuestions ?? JsonSerializer.Serialize(req.Capabilities.Select(c => new
                {
                    capabilityId = c.CapabilityId,
                    questionText = $"Placeholder behavioral question for canonical capability {c.Name}.",
                    gradingRubric = "Look for standard engineering implementation evidence."
                }).ToList()),
                Dimensions = blueprint?.Dimensions ?? JsonSerializer.Serialize(new List<string> { "Code Hygiene", "Problem Solving", "Architecture Intent" }),
                SnapshottedAt = DateTimeOffset.UtcNow
            };

            // 5. Artifact Snapshots projection (All artifacts, e.g. JobDescription, JobPostMetadata, CandidateDiscoveryProfile)
            foreach (var art in req.RequirementArtifacts)
            {
                snapshot.ArtifactSnapshots.Add(new RequirementArtifactSnapshot
                {
                    Id = Guid.CreateVersion7(),
                    RequirementSnapshotId = snapshot.Id,
                    ArtifactType = art.ArtifactType,
                    MarkdownContent = art.MarkdownContent ?? "",
                    StructuredContentJson = art.StructuredContentJson,
                    SnapshottedAt = DateTimeOffset.UtcNow
                });
            }
            if (!snapshot.ArtifactSnapshots.Any(a => a.ArtifactType == "JobDescription"))
            {
                snapshot.ArtifactSnapshots.Add(new RequirementArtifactSnapshot
                {
                    Id = Guid.CreateVersion7(),
                    RequirementSnapshotId = snapshot.Id,
                    ArtifactType = "JobDescription",
                    MarkdownContent = $"# {req.Title} - {req.Department}\n\n## About the Role\n{req.BusinessProblem}",
                    StructuredContentJson = null,
                    SnapshottedAt = DateTimeOffset.UtcNow
                });
            }

            // 6. Vector Snapshot projection
            snapshot.RequirementVectorSnapshot = new RequirementVectorSnapshot
            {
                RequirementSnapshotId = snapshot.Id,
                Vector = vector,
                Dimension = vector.Length,
                SnapshottedAt = DateTimeOffset.UtcNow
            };

            _context.RequirementSnapshots.Add(snapshot);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return snapshot;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<PaginatedListDto<HiringRequirement>> GetByWorkspaceIdAsync(
        Guid workspaceId,
        string? search,
        string? department,
        string? status,
        string? sortBy,
        string? sortOrder,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Capabilities)
            .Where(r => r.WorkspaceId == workspaceId);

        // 1. Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim().ToLower();
            query = query.Where(r => r.Title.ToLower().Contains(cleanSearch) ||
                                     r.Department.ToLower().Contains(cleanSearch));
        }

        // 2. Department filter
        if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(r => r.Department.ToLower() == department.Trim().ToLower());
        }

        // 3. Status filter
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status.ToLower() == status.Trim().ToLower());
        }

        // 4. Sorting
        var isDesc = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        query = sortBy?.ToLower() switch
        {
            "title" => isDesc ? query.OrderByDescending(r => r.Title) : query.OrderBy(r => r.Title),
            "department" => isDesc ? query.OrderByDescending(r => r.Department) : query.OrderBy(r => r.Department),
            "status" => isDesc ? query.OrderByDescending(r => r.Status) : query.OrderBy(r => r.Status),
            "updatedat" => isDesc ? query.OrderByDescending(r => r.UpdatedAt) : query.OrderBy(r => r.UpdatedAt),
            _ => query.OrderByDescending(r => r.CreatedAt) // Default sort by CreatedAt descending
        };

        // 5. Total Count
        var totalCount = await query.CountAsync(cancellationToken);

        // 6. Pagination
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PaginatedListDto<HiringRequirement>(items, totalCount, page, pageSize);
    }

    public Dictionary<string, float> CalculateWeights(HiringRequirement req)
    {
        var rawWeights = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        float rawSum = 0f;

        foreach (var cap in req.Capabilities)
        {
            // 1. Priority Multiplier
            float priorityMult = cap.Priority switch
            {
                RequirementPriority.MustHave => 1.0f,
                RequirementPriority.ShouldHave => 0.6f,
                RequirementPriority.NiceToHave => 0.2f,
                _ => 1.0f
            };

            // 2. Ownership Multiplier
            float ownershipMult = cap.OwnershipLevel switch
            {
                OwnershipLevel.Leader => 1.4f,
                OwnershipLevel.Owner => 1.2f,
                OwnershipLevel.Contributor => 1.0f,
                OwnershipLevel.Awareness => 0.5f,
                _ => 1.0f
            };

            // 3. Business Outcome Bonus
            float outcomeBonus = 0f;
            if (req.BusinessOutcomes.Any())
            {
                outcomeBonus = 0.25f * req.BusinessOutcomes.Count;
            }

            // 4. Seniority Calibration
            float seniorityMult = 1.0f;
            bool isSeniorOrAbove = req.Seniority.Equals("Senior", StringComparison.OrdinalIgnoreCase) ||
                                   req.Seniority.Equals("Staff", StringComparison.OrdinalIgnoreCase) ||
                                   req.Seniority.Equals("Principal", StringComparison.OrdinalIgnoreCase);

            bool isJunior = req.Seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase);

            if (isSeniorOrAbove && (cap.Category.Equals("Solution Architecture", StringComparison.OrdinalIgnoreCase) ||
                                    cap.Name.Contains("Architecture") || cap.Name.Contains("Design") || cap.Name.Contains("Security")))
            {
                seniorityMult = 1.25f;
            }
            else if (isJunior && (cap.Category.Equals("Software Development", StringComparison.OrdinalIgnoreCase) ||
                                  cap.Name.Contains("Layouts") || cap.Name.Contains("Coding")))
            {
                seniorityMult = 1.25f;
            }

            float rawScore = (priorityMult * ownershipMult + outcomeBonus) * seniorityMult;
            rawWeights[cap.CapabilityId] = rawScore;
            rawSum += rawScore;
        }

        // Normalize
        var normalizedWeights = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in rawWeights)
        {
            normalizedWeights[pair.Key] = rawSum > 0f ? (pair.Value / rawSum) : 0f;
        }

        return normalizedWeights;
    }

    public float[] CalculateRequirementVector(HiringRequirement req, Dictionary<string, float> normalizedWeights)
    {
        var catalog = _catalogService.GetCatalog(req.WorkspaceId).ToList();
        var vector = new float[catalog.Count];

        for (int i = 0; i < catalog.Count; i++)
        {
            var catItem = catalog[i];
            if (normalizedWeights.TryGetValue(catItem.CapabilityId, out float weight))
            {
                var reqCap = req.Capabilities.First(c => c.CapabilityId.Equals(catItem.CapabilityId, StringComparison.OrdinalIgnoreCase));
                vector[i] = weight * reqCap.ExpectedProficiency;
            }
            else
            {
                vector[i] = 0f;
            }
        }

        return vector;
    }

    public async Task GenerateArtifactsAsync(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
                .ThenInclude(c => c.EvidenceSignals)
            .Include(r => r.TechnologyRequirements)
            .Include(r => r.EvaluationRubrics)
            .Include(r => r.InterviewBlueprints)
            .Include(r => r.RequirementArtifacts)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        if (req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cannot regenerate artifacts for a published requirement.");
        }

        req.Status = "Generating";
        await _context.SaveChangesAsync(cancellationToken);

        // Initialize unified streaming session
        await _streamingSessionService.CreateSessionAsync(req.Id, "jd-generation", userId, req.WorkspaceId, "Claude 3.5 Sonnet", "Anthropic", "1.0.0");
        await _streamingSessionService.UpdateSessionStatusAsync(req.Id, "Running");

        // Broadcast starting progress
        await PublishProgressAsync(req.Id, "Running", "Initialize", "Initiating requirement artifacts generation...", 0.0);

        // Prepare the payload for FastAPI
        var payload = new
        {
            requirementData = new
            {
                id = req.Id.ToString(),
                title = req.Title,
                department = req.Department,
                seniority = req.Seniority,
                workplaceType = req.WorkplaceType,
                city = req.City,
                employmentType = req.EmploymentType,
                salaryMin = req.SalaryMin,
                salaryMax = req.SalaryMax,
                currency = req.Currency,
                timezoneRange = req.TimezoneRange,
                degreeRequirement = req.DegreeRequirement,
                benefits = req.Benefits,
                languageRequirements = req.LanguageRequirements,
                headcount = req.Headcount,
                hiringReason = req.HiringReason,
                businessProblem = req.BusinessProblem,
                outcomes = req.BusinessOutcomes.Select(o => o.Text).ToList(),
                responsibilities = req.Responsibilities.Select(r => new { text = r.Text, priority = r.Priority.ToString(), ownershipLevel = r.OwnershipLevel.ToString(), isLeadership = r.IsLeadership }).ToList(),
                capabilities = req.Capabilities.Select(c => new { capabilityId = c.CapabilityId, name = c.Name, category = c.Category, priority = c.Priority.ToString(), ownershipLevel = c.OwnershipLevel.ToString(), expectedProficiency = c.ExpectedProficiency }).ToList(),
                skills = req.TechnologyRequirements.Select(t => new { name = t.Name, priority = t.Priority.ToString(), sfiaLevel = t.SfiaLevel }).ToList()
            }
        };

        var payloadJson = JsonSerializer.Serialize(payload);
        var path = "/api/v1/hiring-requirements/generate/stream";

        var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
        };

        var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", path, payloadJson);
        requestMessage.Headers.Add("X-Client-Id", "cverify-core");
        requestMessage.Headers.Add("X-Timestamp", timestamp);
        requestMessage.Headers.Add("X-Nonce", nonce);
        requestMessage.Headers.Add("X-Correlation-Id", req.Id.ToString());
        requestMessage.Headers.Add("X-Signature", signature);

        try
        {
            using var response = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"AI service returned status code {response.StatusCode}: {errorMsg}");
            }

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new global::System.IO.StreamReader(stream);

            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (line.StartsWith("data: "))
                {
                    var eventData = line.Substring(6).Trim();
                    if (eventData == "[DONE]") continue;

                    using var doc = JsonDocument.Parse(eventData);
                    var root = doc.RootElement;

                    var status = root.GetProperty("status").GetString();
                    var step = root.GetProperty("step").GetString();
                    var message = root.GetProperty("message").GetString() ?? "";
                    var percentage = root.GetProperty("percentage").GetDouble();

                    if (status == "Failed")
                    {
                        throw new Exception($"AI Stream Stage Failed: {message}");
                    }

                    // Forward to client channel and save in DB
                    await _streamingSessionService.UpdateSessionProgressAsync(req.Id, percentage, step);

                    string? detailsJson = root.TryGetProperty("jsonData", out var jsonProp) ? jsonProp.GetString() : null;
                    await _streamingSessionService.UpsertStageAsync(req.Id, step, step, status, percentage, message, detailsJson: detailsJson);

                    var logLevel = status == "Failed" ? "Error" : status == "Completed" ? "Success" : "Info";
                    await _streamingSessionService.AddLogAsync(req.Id, step, logLevel, "FastApiStream", message);

                    // Handle typing chunk if present
                    if (root.TryGetProperty("chunk", out var chunkProp))
                    {
                        var chunk = chunkProp.GetString();
                        if (!string.IsNullOrEmpty(chunk))
                        {
                            await _streamingSessionService.StreamTextChunkAsync(req.Id, step, chunk);
                        }
                    }

                    // Save telemetry metrics if present
                    if (root.TryGetProperty("inputTokens", out var inTokProp) && inTokProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "input_tokens", inTokProp.GetDouble());
                    if (root.TryGetProperty("outputTokens", out var outTokProp) && outTokProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "output_tokens", outTokProp.GetDouble());
                    if (root.TryGetProperty("costUsd", out var costProp) && costProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "cost_usd", costProp.GetDouble());

                    // Save artifact when received
                    if (root.TryGetProperty("artifactType", out var artTypeProp) && root.TryGetProperty("jsonData", out var jsonPayloadProp))
                    {
                        var artifactType = artTypeProp.GetString();
                        var jsonData = jsonPayloadProp.GetString();

                        if (!string.IsNullOrEmpty(artifactType) && !string.IsNullOrEmpty(jsonData))
                        {
                            await SaveArtifactAsync(req.Id, artifactType, jsonData, cancellationToken);
                        }
                    }
                }
            }

            // Publish completed event
            req.Status = "Ready";
            await _context.SaveChangesAsync(cancellationToken);
            await PublishProgressAsync(req.Id, "Completed", "RequirementArtifactsComposer", "All hiring requirement artifacts generated successfully.", 100.0);
            await _streamingSessionService.UpdateSessionStatusAsync(req.Id, "Completed", summaryData: "{}");
        }
        catch (Exception ex)
        {
            try
            {
                req.Status = "Draft";
                await _context.SaveChangesAsync(CancellationToken.None);
            }
            catch { }
            _logger.LogError(ex, "Error generating artifacts for hiring requirement {RequirementId}", req.Id);
            await PublishProgressAsync(req.Id, "Failed", "Failed", ex.Message, 100.0);
            await _streamingSessionService.UpdateSessionStatusAsync(req.Id, "Failed", errorMessage: ex.Message);
            throw;
        }
    }

    public async Task GenerateArtifactAsync(Guid id, string artifactType, Guid userId, CancellationToken cancellationToken)
    {
        var linkedToken = _cancellationManager.Register(id, cancellationToken);

        var existingDbArt = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, linkedToken);
        if (existingDbArt != null && (existingDbArt.Status == "Generating" || existingDbArt.Status == "Regenerating"))
        {
            throw new InvalidOperationException($"An AI generation job is already active in the database (Status: {existingDbArt.Status}) for this artifact.");
        }

        var cts = new { Token = linkedToken };

        try
        {
            var req = await _context.HiringRequirements
                .Include(r => r.BusinessOutcomes)
                .Include(r => r.Responsibilities)
                .Include(r => r.Capabilities)
                    .ThenInclude(c => c.EvidenceSignals)
                .Include(r => r.TechnologyRequirements)
                .Include(r => r.RequirementArtifacts)
                .FirstOrDefaultAsync(r => r.Id == id, cts.Token);

            if (req == null)
            {
                throw new KeyNotFoundException("Hiring requirement not found.");
            }

            var existingArt = req.RequirementArtifacts.FirstOrDefault(ra => ra.ArtifactType == artifactType);
            if (existingArt != null)
            {
                existingArt.Status = "Regenerating";
                existingArt.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                _context.RequirementArtifacts.Add(new RequirementArtifact
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = id,
                    ArtifactType = artifactType,
                    MarkdownContent = "",
                    Status = "Generating",
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
            await _context.SaveChangesAsync(cts.Token);

            // Initialize unified streaming session
            await _streamingSessionService.CreateSessionAsync(req.Id, "jd-generation", userId, req.WorkspaceId, "Claude 3.5 Sonnet", "Anthropic", "1.0.0");
            await _streamingSessionService.UpdateSessionStatusAsync(req.Id, "Running");

            await PublishProgressAsync(req.Id, "Running", "Initialize", $"Initiating requirement artifact ({artifactType}) generation...", 0.0);

            var payload = new
            {
                requirementData = new
                {
                    id = req.Id.ToString(),
                    title = req.Title,
                    department = req.Department,
                    seniority = req.Seniority,
                    workplaceType = req.WorkplaceType,
                    city = req.City,
                    employmentType = req.EmploymentType,
                    salaryMin = req.SalaryMin,
                    salaryMax = req.SalaryMax,
                    currency = req.Currency,
                    timezoneRange = req.TimezoneRange,
                    degreeRequirement = req.DegreeRequirement,
                    benefits = req.Benefits,
                    languageRequirements = req.LanguageRequirements,
                    headcount = req.Headcount,
                    hiringReason = req.HiringReason,
                    businessProblem = req.BusinessProblem,
                    outcomes = req.BusinessOutcomes.Select(o => o.Text).ToList(),
                    responsibilities = req.Responsibilities.Select(r => new { text = r.Text, priority = r.Priority.ToString(), ownershipLevel = r.OwnershipLevel.ToString(), isLeadership = r.IsLeadership }).ToList(),
                    capabilities = req.Capabilities.Select(c => new { capabilityId = c.CapabilityId, name = c.Name, category = c.Category, priority = c.Priority.ToString(), ownershipLevel = c.OwnershipLevel.ToString(), expectedProficiency = c.ExpectedProficiency }).ToList(),
                    skills = req.TechnologyRequirements.Select(t => new { name = t.Name, priority = t.Priority.ToString(), sfiaLevel = t.SfiaLevel }).ToList()
                },
                artifactType = artifactType
            };

            var payloadJson = JsonSerializer.Serialize(payload);
            var path = "/api/v1/hiring-requirements/generate-artifact/stream";

            var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, path)
            {
                Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
            };

            var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", path, payloadJson);
            requestMessage.Headers.Add("X-Client-Id", "cverify-core");
            requestMessage.Headers.Add("X-Timestamp", timestamp);
            requestMessage.Headers.Add("X-Nonce", nonce);
            requestMessage.Headers.Add("X-Correlation-Id", req.Id.ToString());
            requestMessage.Headers.Add("X-Signature", signature);

            using var response = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = await response.Content.ReadAsStringAsync(cts.Token);
                throw new HttpRequestException($"AI service returned status code {response.StatusCode}: {errorMsg}");
            }

            using var stream = await response.Content.ReadAsStreamAsync(cts.Token);
            using var reader = new global::System.IO.StreamReader(stream);

            string? line;
            while ((line = await reader.ReadLineAsync(cts.Token)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (line.StartsWith("data: "))
                {
                    var eventData = line.Substring(6).Trim();
                    if (eventData == "[DONE]") continue;

                    using var doc = JsonDocument.Parse(eventData);
                    var root = doc.RootElement;

                    var status = root.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;
                    var step = root.TryGetProperty("step", out var stepProp) ? stepProp.GetString() : null;
                    var message = root.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "";
                    var percentage = root.TryGetProperty("percentage", out var pctProp) ? pctProp.GetDouble() : 0.0;

                    if (status == "Failed")
                    {
                        throw new Exception($"AI Stream Stage Failed: {message}");
                    }

                    // Forward to client channel and save in DB
                    await _streamingSessionService.UpdateSessionProgressAsync(req.Id, percentage, step);

                    string? detailsJson = root.TryGetProperty("jsonData", out var jsonProp) ? jsonProp.GetString() : null;
                    await _streamingSessionService.UpsertStageAsync(req.Id, step, step, status, percentage, message, detailsJson: detailsJson);

                    var logLevel = status == "Failed" ? "Error" : status == "Completed" ? "Success" : "Info";
                    await _streamingSessionService.AddLogAsync(req.Id, step, logLevel, "FastApiStream", message);

                    // Handle typing chunk if present
                    if (root.TryGetProperty("chunk", out var chunkProp))
                    {
                        var chunk = chunkProp.GetString();
                        if (!string.IsNullOrEmpty(chunk))
                        {
                            await _streamingSessionService.StreamTextChunkAsync(req.Id, step, chunk);
                        }
                    }

                    // Save telemetry metrics if present
                    if (root.TryGetProperty("inputTokens", out var inTokProp) && inTokProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "input_tokens", inTokProp.GetDouble());
                    if (root.TryGetProperty("outputTokens", out var outTokProp) && outTokProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "output_tokens", outTokProp.GetDouble());
                    if (root.TryGetProperty("costUsd", out var costProp) && costProp.ValueKind == JsonValueKind.Number)
                        await _streamingSessionService.AddMetricAsync(req.Id, step, "cost_usd", costProp.GetDouble());

                    if (root.TryGetProperty("artifactType", out var artTypeProp) && root.TryGetProperty("jsonData", out var jsonPayloadProp))
                    {
                        var returnedType = artTypeProp.GetString();
                        var jsonData = jsonPayloadProp.GetString();

                        if (!string.IsNullOrEmpty(returnedType) && !string.IsNullOrEmpty(jsonData))
                        {
                            await SaveArtifactAsync(req.Id, returnedType, jsonData, cts.Token);
                        }
                    }
                }
            }

            await PublishProgressAsync(req.Id, "Completed", "RequirementArtifactsComposer", $"Artifact {artifactType} generated successfully.", 100.0);
            await _streamingSessionService.UpdateSessionStatusAsync(req.Id, "Completed", summaryData: "{}");
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Artifact {ArtifactType} generation cancelled for requirement {RequirementId}", artifactType, id);

            var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, CancellationToken.None);
            if (art != null)
            {
                art.Status = "Cancelled";
                art.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await PublishProgressAsync(id, "Cancelled", "Cancelled", "Generation cancelled by user.", 100.0);
            await _streamingSessionService.UpdateSessionStatusAsync(id, "Cancelled");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating {ArtifactType} for hiring requirement {RequirementId}", artifactType, id);

            var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, CancellationToken.None);
            if (art != null)
            {
                art.Status = "Failed";
                art.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await PublishProgressAsync(id, "Failed", "Failed", ex.Message, 100.0);
            await _streamingSessionService.UpdateSessionStatusAsync(id, "Failed", errorMessage: ex.Message);
            throw;
        }
        finally
        {
            _cancellationManager.Unregister(id);
        }
    }

    public async Task CancelGenerationAsync(Guid id, string artifactType)
    {
        // 1. Set Redis cancellation key for Python AI service
        try
        {
            var db = _redis.GetDatabase();
            await db.StringSetAsync($"ai:cancel:{id}", "true", TimeSpan.FromMinutes(5));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set Redis cancellation key for requirement {RequirementId}", id);
        }

        // 2. Cancel C# token via IAiCancellationManager
        _cancellationManager.Cancel(id);

        // 3. Update unified streaming session status
        await _streamingSessionService.UpdateSessionStatusAsync(id, "Cancelled");

        // 4. Update the artifact record in the DB
        var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType);
        if (art != null && (art.Status == "Generating" || art.Status == "Regenerating"))
        {
            art.Status = "Cancelled";
            art.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }

        await PublishProgressAsync(id, "Cancelled", "Cancelled", "Generation cancelled by user.", 100.0);
    }

    private async Task SaveArtifactAsync(Guid requirementId, string artifactType, string jsonData, CancellationToken cancellationToken)
    {
        if (artifactType.Equals("JobDescription", StringComparison.OrdinalIgnoreCase))
        {
            using var doc = JsonDocument.Parse(jsonData);
            var root = doc.RootElement;
            var markdownContent = root.TryGetProperty("markdownContent", out var mdProp) ? mdProp.GetString() ?? "" : "";

            string? structuredContentJson = null;
            if (root.TryGetProperty("structuredContent", out var scProp))
            {
                structuredContentJson = scProp.ValueKind == JsonValueKind.String ? scProp.GetString() : scProp.GetRawText();
            }

            var modelInfo = root.TryGetProperty("modelInfo", out var modelProp) ? modelProp.GetString() : "claude-3-5-sonnet";
            var promptTemplateId = root.TryGetProperty("promptTemplateId", out var ptIdProp) ? ptIdProp.GetString() : "jd-generator-std";
            var promptVersion = root.TryGetProperty("promptVersion", out var pvProp) ? pvProp.GetString() : "1.2";
            var promptHash = root.TryGetProperty("promptHash", out var phProp) ? phProp.GetString() : "";

            string? generationMetadataJson = null;
            if (root.TryGetProperty("generationMetadata", out var metaProp))
            {
                generationMetadataJson = metaProp.ValueKind == JsonValueKind.String ? metaProp.GetString() : metaProp.GetRawText();
            }

            var existing = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == requirementId && ra.ArtifactType == "JobDescription", cancellationToken);
            if (existing != null)
            {
                var historyEntry = new
                {
                    timestamp = existing.GenerationTimestamp ?? existing.UpdatedAt,
                    markdownContent = existing.MarkdownContent,
                    structuredContent = !string.IsNullOrEmpty(existing.StructuredContentJson) ? JsonSerializer.Deserialize<object>(existing.StructuredContentJson) : null,
                    modelInfo = existing.ModelInfo,
                    promptTemplateId = existing.PromptTemplateId,
                    promptVersion = existing.PromptVersion,
                    promptHash = existing.PromptHash,
                    generationMetadata = !string.IsNullOrEmpty(existing.GenerationMetadataJson) ? JsonSerializer.Deserialize<object>(existing.GenerationMetadataJson) : null
                };

                var history = new List<object>();
                if (!string.IsNullOrEmpty(existing.RegenerationHistoryJson))
                {
                    try
                    {
                        history = JsonSerializer.Deserialize<List<object>>(existing.RegenerationHistoryJson) ?? new();
                    }
                    catch { }
                }
                history.Add(historyEntry);

                existing.MarkdownContent = markdownContent;
                existing.StructuredContentJson = structuredContentJson;
                existing.Status = "Generated";
                existing.ModelInfo = modelInfo;
                existing.PromptTemplateId = promptTemplateId;
                existing.PromptVersion = promptVersion;
                existing.PromptHash = promptHash;
                existing.GenerationMetadataJson = generationMetadataJson;
                existing.RegenerationHistoryJson = JsonSerializer.Serialize(history);
                existing.GenerationTimestamp = DateTimeOffset.UtcNow;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                _context.RequirementArtifacts.Add(new RequirementArtifact
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = requirementId,
                    ArtifactType = "JobDescription",
                    MarkdownContent = markdownContent,
                    StructuredContentJson = structuredContentJson,
                    Status = "Generated",
                    ModelInfo = modelInfo,
                    PromptTemplateId = promptTemplateId,
                    PromptVersion = promptVersion,
                    PromptHash = promptHash,
                    GenerationMetadataJson = generationMetadataJson,
                    GenerationTimestamp = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }

            // Also update associated JobVacancy if it exists and is in Draft status
            var vacancy = await _context.JobVacancies
                .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId, cancellationToken);
            if (vacancy != null && vacancy.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
            {
                vacancy.Description = new List<string> { markdownContent };
                vacancy.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }
        else if (artifactType.Equals("EvaluationRubric", StringComparison.OrdinalIgnoreCase))
        {
            using var doc = JsonDocument.Parse(jsonData);
            var scoringRulesStr = doc.RootElement.GetProperty("scoringRules").GetRawText();
            var evidenceReqsStr = doc.RootElement.GetProperty("evidenceRequirements").GetRawText();

            var existing = await _context.EvaluationRubrics.FirstOrDefaultAsync(er => er.HiringRequirementId == requirementId, cancellationToken);
            if (existing != null)
            {
                existing.ScoringRules = scoringRulesStr;
                existing.EvidenceRequirements = evidenceReqsStr;
            }
            else
            {
                _context.EvaluationRubrics.Add(new EvaluationRubric
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = requirementId,
                    ScoringRules = scoringRulesStr,
                    EvidenceRequirements = evidenceReqsStr,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }
        }
        else if (artifactType.Equals("InterviewBlueprint", StringComparison.OrdinalIgnoreCase))
        {
            using var doc = JsonDocument.Parse(jsonData);
            var questionsStr = doc.RootElement.GetProperty("questions").GetRawText();
            var dimensionsStr = doc.RootElement.GetProperty("dimensions").GetRawText();

            var existing = await _context.InterviewBlueprints.FirstOrDefaultAsync(ib => ib.HiringRequirementId == requirementId, cancellationToken);
            if (existing != null)
            {
                existing.CapabilityQuestions = questionsStr;
                existing.Dimensions = dimensionsStr;
            }
            else
            {
                _context.InterviewBlueprints.Add(new InterviewBlueprint
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = requirementId,
                    CapabilityQuestions = questionsStr,
                    Dimensions = dimensionsStr,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }
        }
        else if (artifactType.Equals("JobPostMetadata", StringComparison.OrdinalIgnoreCase) ||
                 artifactType.Equals("CandidateDiscoveryProfile", StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _context.RequirementArtifacts
                .FirstOrDefaultAsync(ra => ra.HiringRequirementId == requirementId && ra.ArtifactType == artifactType, cancellationToken);
            if (existing != null)
            {
                existing.StructuredContentJson = jsonData;
                existing.MarkdownContent = "";
                existing.Status = "Generated";
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                _context.RequirementArtifacts.Add(new RequirementArtifact
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = requirementId,
                    ArtifactType = artifactType,
                    MarkdownContent = "",
                    StructuredContentJson = jsonData,
                    Status = "Generated",
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }

            if (artifactType.Equals("JobPostMetadata", StringComparison.OrdinalIgnoreCase))
            {
                var vacancy = await _context.JobVacancies
                    .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId, cancellationToken);
                if (vacancy != null && vacancy.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(jsonData);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("experienceRange", out var expProp)) vacancy.Experience = expProp.GetString() ?? vacancy.Experience;
                        if (root.TryGetProperty("degreeRequirement", out var degProp)) vacancy.Degree = degProp.GetString() ?? vacancy.Degree;
                        if (root.TryGetProperty("industryCategory", out var catProp)) vacancy.Category = catProp.GetString() ?? vacancy.Category;
                        if (root.TryGetProperty("coverUrl", out var covProp)) vacancy.CoverUrl = covProp.GetString() ?? vacancy.CoverUrl;
                        if (root.TryGetProperty("tags", out var tagsProp) && tagsProp.ValueKind == JsonValueKind.Array)
                        {
                            vacancy.Tags = tagsProp.EnumerateArray().Select(t => t.GetString() ?? "").Where(t => !string.IsNullOrEmpty(t)).ToList();
                        }
                        vacancy.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                    catch { }
                }
            }
            else if (artifactType.Equals("CandidateDiscoveryProfile", StringComparison.OrdinalIgnoreCase))
            {
                var vacancy = await _context.JobVacancies
                    .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId, cancellationToken);
                if (vacancy != null && vacancy.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
                {
                    vacancy.DiscoveryProfileJson = jsonData;
                    vacancy.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task PublishProgressAsync(Guid reqId, string status, string step, string message, double percentage)
    {
        // 1. Persist using the unified service
        await _streamingSessionService.UpdateSessionProgressAsync(reqId, percentage, step);
        await _streamingSessionService.UpsertStageAsync(reqId, step, step, status, percentage, message);

        var logLevel = status == "Failed" ? "Error" : status == "Completed" ? "Success" : "Info";
        await _streamingSessionService.AddLogAsync(reqId, step, logLevel, "HiringRequirementService", message);

        // 2. Broadcast via legacy Redis channel
        var progress = new
        {
            status = status,
            step = step,
            message = message,
            percentage = percentage
        };
        var json = JsonSerializer.Serialize(progress);
        await PublishRawProgressAsync(reqId, json);
    }

    private async Task PublishRawProgressAsync(Guid reqId, string rawJson)
    {
        var subscriber = _redis.GetSubscriber();
        var channel = $"hiring:requirement:progress:{reqId}";
        await subscriber.PublishAsync(channel, rawJson);
    }

    public async Task<CapabilityCatalogItem> CreateCustomCapabilityAsync(CreateCapabilityCatalogItemDto request, CancellationToken cancellationToken)
    {
        var suffix = request.DisplayName.ToLower()
            .Replace(" ", "-")
            .Replace(".", "")
            .Replace("/", "-");

        var capId = $"custom.{request.WorkspaceId:N}.{suffix}";
        if (capId.Length > 100)
        {
            capId = capId.Substring(0, 100);
        }

        // Check if custom capability already exists
        var existing = await _context.CapabilityCatalogItems
            .FirstOrDefaultAsync(c => c.CapabilityId == capId, cancellationToken);
        if (existing != null)
        {
            throw new InvalidOperationException("A capability with this name already exists in this workspace.");
        }

        var item = new CapabilityCatalogItem
        {
            CapabilityId = capId,
            DisplayName = request.DisplayName,
            Category = request.Category,
            Description = request.Description,
            Skills = request.Skills ?? new List<string>(),
            ExpectedEvidence = request.ExpectedEvidence ?? new List<string>(),
            WorkspaceId = request.WorkspaceId,
            IsCustom = true,
            Status = "Active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.CapabilityCatalogItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

        return item;
    }

    public async Task<CapabilityCatalogItem> UpdateCustomCapabilityAsync(string capabilityId, UpdateCapabilityCatalogItemDto request, CancellationToken cancellationToken)
    {
        var item = await _context.CapabilityCatalogItems
            .FirstOrDefaultAsync(c => c.CapabilityId == capabilityId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException("Capability not found.");
        }

        if (!item.IsCustom)
        {
            throw new InvalidOperationException("Cannot modify global capability catalog items.");
        }

        item.DisplayName = request.DisplayName;
        item.Category = request.Category;
        item.Description = request.Description;
        item.Skills = request.Skills ?? new List<string>();
        item.ExpectedEvidence = request.ExpectedEvidence ?? new List<string>();
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return item;
    }

    public async Task DeleteCustomCapabilityAsync(string capabilityId, CancellationToken cancellationToken)
    {
        var item = await _context.CapabilityCatalogItems
            .FirstOrDefaultAsync(c => c.CapabilityId == capabilityId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException("Capability not found.");
        }

        if (!item.IsCustom)
        {
            throw new InvalidOperationException("Cannot delete global capability catalog items.");
        }

        // Soft delete (archive)
        item.Status = "Archived";
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        // Delete associated JobVacancy
        var vacancies = await _context.JobVacancies
            .Where(v => v.HiringRequirementId == id)
            .ToListAsync(cancellationToken);
        if (vacancies.Any())
        {
            _context.JobVacancies.RemoveRange(vacancies);
        }

        _context.HiringRequirements.Remove(req);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task BulkDeleteAsync(List<Guid> ids, CancellationToken cancellationToken)
    {
        var reqs = await _context.HiringRequirements
            .Where(r => ids.Contains(r.Id))
            .ToListAsync(cancellationToken);

        if (reqs.Count > 0)
        {
            // Delete associated JobVacancies
            var vacancies = await _context.JobVacancies
                .Where(v => v.HiringRequirementId.HasValue && ids.Contains(v.HiringRequirementId.Value))
                .ToListAsync(cancellationToken);
            if (vacancies.Any())
            {
                _context.JobVacancies.RemoveRange(vacancies);
            }

            _context.HiringRequirements.RemoveRange(reqs);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task BulkArchiveAsync(List<Guid> ids, CancellationToken cancellationToken)
    {
        var reqs = await _context.HiringRequirements
            .Where(r => ids.Contains(r.Id))
            .ToListAsync(cancellationToken);

        foreach (var req in reqs)
        {
            req.Status = "Archived";
            req.UpdatedAt = DateTimeOffset.UtcNow;
        }

        if (reqs.Count > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<HiringRequirement> CreateNewVersionAsync(Guid id, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
                .ThenInclude(c => c.EvidenceSignals)
            .Include(r => r.TechnologyRequirements)
            .Include(r => r.EvaluationRubrics)
            .Include(r => r.InterviewBlueprints)
            .Include(r => r.RequirementArtifacts)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        if (!req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Can only create a new version from a published hiring requirement.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Clone the requirement
            var newReq = new HiringRequirement
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = req.OrganizationId,
                WorkspaceId = req.WorkspaceId,
                Title = req.Title,
                Department = req.Department,
                Seniority = req.Seniority,
                WorkplaceType = req.WorkplaceType,
                City = req.City,
                EmploymentType = req.EmploymentType,
                SalaryMin = req.SalaryMin,
                SalaryMax = req.SalaryMax,
                Currency = req.Currency,
                TimezoneRange = req.TimezoneRange,
                DegreeRequirement = req.DegreeRequirement,
                Benefits = req.Benefits.ToList(),
                LanguageRequirements = req.LanguageRequirements.ToList(),
                Headcount = req.Headcount,
                Status = "Draft", // New version starts as Draft
                Version = req.Version + 1, // Version increment
                HiringReason = req.HiringReason,
                BusinessProblem = req.BusinessProblem,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.HiringRequirements.Add(newReq);

            // Clone child entities
            foreach (var bo in req.BusinessOutcomes)
            {
                _context.BusinessOutcomes.Add(new BusinessOutcome
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    Text = bo.Text
                });
            }

            foreach (var resp in req.Responsibilities)
            {
                _context.Responsibilities.Add(new Responsibility
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    Text = resp.Text,
                    Priority = resp.Priority,
                    OwnershipLevel = resp.OwnershipLevel,
                    IsLeadership = resp.IsLeadership
                });
            }

            foreach (var cap in req.Capabilities)
            {
                var newCap = new RequirementCapability
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    CapabilityId = cap.CapabilityId,
                    Name = cap.Name,
                    Category = cap.Category,
                    Priority = cap.Priority,
                    OwnershipLevel = cap.OwnershipLevel,
                    ExpectedProficiency = cap.ExpectedProficiency
                };
                _context.RequirementCapabilities.Add(newCap);

                foreach (var sig in cap.EvidenceSignals)
                {
                    _context.EvidenceSignals.Add(new EvidenceSignal
                    {
                        Id = Guid.CreateVersion7(),
                        RequirementCapabilityId = newCap.Id,
                        SignalType = sig.SignalType,
                        ExpectedMetric = sig.ExpectedMetric,
                        Rationale = sig.Rationale
                    });
                }
            }

            foreach (var tech in req.TechnologyRequirements)
            {
                _context.TechnologyRequirements.Add(new TechnologyRequirement
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    Name = tech.Name,
                    Priority = tech.Priority,
                    SfiaLevel = tech.SfiaLevel
                });
            }

            // Clone rubrics, blueprints and artifacts as draft artifacts
            foreach (var er in req.EvaluationRubrics)
            {
                _context.EvaluationRubrics.Add(new EvaluationRubric
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    ScoringRules = er.ScoringRules,
                    EvidenceRequirements = er.EvidenceRequirements,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            foreach (var ib in req.InterviewBlueprints)
            {
                _context.InterviewBlueprints.Add(new InterviewBlueprint
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    CapabilityQuestions = ib.CapabilityQuestions,
                    Dimensions = ib.Dimensions,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            foreach (var art in req.RequirementArtifacts)
            {
                _context.RequirementArtifacts.Add(new RequirementArtifact
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = newReq.Id,
                    ArtifactType = art.ArtifactType,
                    MarkdownContent = art.MarkdownContent,
                    StructuredContentJson = art.StructuredContentJson,
                    Status = "Generated",
                    ModelInfo = art.ModelInfo,
                    PromptTemplateId = art.PromptTemplateId,
                    PromptVersion = art.PromptVersion,
                    PromptHash = art.PromptHash,
                    GenerationMetadataJson = art.GenerationMetadataJson,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }

            // Clone JobVacancy to Draft
            var existingVacancy = await _context.JobVacancies
                .FirstOrDefaultAsync(v => v.HiringRequirementId == req.Id, cancellationToken);
            if (existingVacancy != null)
            {
                var newVacancy = new JobVacancy
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = existingVacancy.OrganizationId,
                    HiringRequirementId = newReq.Id, // Link to new version
                    Title = existingVacancy.Title,
                    Department = existingVacancy.Department,
                    WorkplaceType = existingVacancy.WorkplaceType,
                    City = existingVacancy.City,
                    Type = existingVacancy.Type,
                    Salary = existingVacancy.Salary,
                    SalaryMinMax = existingVacancy.SalaryMinMax,
                    Headcount = existingVacancy.Headcount,
                    Gender = existingVacancy.Gender,
                    Experience = existingVacancy.Experience,
                    Degree = existingVacancy.Degree,
                    Category = existingVacancy.Category,
                    Description = existingVacancy.Description.ToList(),
                    Requirements = existingVacancy.Requirements.ToList(),
                    Benefits = existingVacancy.Benefits.ToList(),
                    Tags = existingVacancy.Tags.ToList(),
                    Skills = existingVacancy.Skills.ToList(),
                    CoverUrl = existingVacancy.CoverUrl,
                    Images = existingVacancy.Images.ToList(),
                    IsActive = false, // Not active yet
                    Status = "Draft", // New vacancy draft
                    AcquisitionStrategy = existingVacancy.AcquisitionStrategy,
                    DiscoveryProfileJson = existingVacancy.DiscoveryProfileJson,
                    RequirementSnapshotId = null, // Not snapshotted yet
                    Metadata = existingVacancy.Metadata,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                _context.JobVacancies.Add(newVacancy);
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return newReq;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
