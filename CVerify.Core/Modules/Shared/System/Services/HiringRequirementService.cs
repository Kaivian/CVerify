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

namespace CVerify.API.Modules.Shared.System.Services;

public class HiringRequirementService : IHiringRequirementService
{
    private static readonly global::System.Collections.Concurrent.ConcurrentDictionary<(Guid requirementId, string artifactType), CancellationTokenSource> _activeGenerations = new();

    private readonly ApplicationDbContext _context;
    private readonly ICapabilityCatalogService _catalogService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHmacSignatureService _hmacService;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<HiringRequirementService> _logger;

    public HiringRequirementService(
        ApplicationDbContext context,
        ICapabilityCatalogService catalogService,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        IConnectionMultiplexer redis,
        ILogger<HiringRequirementService> logger)
    {
        _context = context;
        _catalogService = catalogService;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _redis = redis;
        _logger = logger;
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

        if (!req.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
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
                req.TechnologyRequirements.Add(new TechnologyRequirement
                {
                    Id = Guid.CreateVersion7(),
                    HiringRequirementId = req.Id,
                    Name = skill.Name,
                    Priority = skill.Priority,
                    SfiaLevel = skill.SfiaLevel
                });
            }
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

            if (!req.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
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
                TimezoneRange = req.TimezoneRange,
                DegreeRequirement = req.DegreeRequirement,
                Benefits = req.Benefits,
                LanguageRequirements = req.LanguageRequirements,
                Headcount = req.Headcount,
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

            // 4. Interview Blueprint Snapshot projection (Stub - to be generated/updated via AI pipeline)
            snapshot.InterviewBlueprintSnapshot = new InterviewBlueprintSnapshot
            {
                RequirementSnapshotId = snapshot.Id,
                CapabilityQuestions = JsonSerializer.Serialize(req.Capabilities.Select(c => new
                {
                    capabilityId = c.CapabilityId,
                    questionText = $"Placeholder behavioral question for canonical capability {c.Name}.",
                    gradingRubric = "Look for standard engineering implementation evidence."
                }).ToList()),
                Dimensions = JsonSerializer.Serialize(new List<string> { "Code Hygiene", "Problem Solving", "Architecture Intent" }),
                SnapshottedAt = DateTimeOffset.UtcNow
            };

            // 5. Job Description Snapshot projection (Stub - will be updated by downstream generator)
            var jd = req.RequirementArtifacts.FirstOrDefault(a => a.ArtifactType == "JobDescription");
            snapshot.ArtifactSnapshots.Add(new RequirementArtifactSnapshot
            {
                Id = Guid.CreateVersion7(),
                RequirementSnapshotId = snapshot.Id,
                ArtifactType = "JobDescription",
                MarkdownContent = jd?.MarkdownContent ?? $"# {req.Title} - {req.Department}\n\n## About the Role\n{req.BusinessProblem}",
                StructuredContentJson = jd?.StructuredContentJson,
                SnapshottedAt = DateTimeOffset.UtcNow
            });

            // 6. Vector Snapshot projection
            snapshot.RequirementVectorSnapshot = new RequirementVectorSnapshot
            {
                RequirementSnapshotId = snapshot.Id,
                Vector = vector,
                Dimension = vector.Length,
                SnapshottedAt = DateTimeOffset.UtcNow
            };

            _context.RequirementSnapshots.Add(snapshot);

            // 7. Publish to JobVacancy board (Create new linked posting)
            var jobVacancy = new JobVacancy
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = req.OrganizationId,
                HiringRequirementId = req.Id,
                Title = req.Title,
                Department = req.Department,
                WorkplaceType = req.WorkplaceType,
                City = req.City ?? "Ho Chi Minh City",
                Type = req.EmploymentType,
                Salary = req.SalaryMin.HasValue && req.SalaryMax.HasValue ? $"{req.SalaryMin} - {req.SalaryMax} {req.Currency}" : "Negotiable",
                SalaryMinMax = $"{req.SalaryMin ?? 0}-{req.SalaryMax ?? 0}",
                Headcount = req.Headcount,
                Gender = "KhÃ´ng yÃªu cáº§u",
                Experience = req.Seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase) ? "1-2 years" : req.Seniority.Equals("Middle", StringComparison.OrdinalIgnoreCase) ? "3-4 years" : "5+ years",
                Degree = req.DegreeRequirement ?? "No Degree Required",
                Category = "Software Engineering",
                Description = new List<string> { req.BusinessProblem ?? string.Empty },
                Requirements = req.Capabilities.Select(c => $"{c.Name} ({c.OwnershipLevel})").ToList(),
                Benefits = req.Benefits,
                Tags = new List<string> { req.Department, req.WorkplaceType, req.Seniority },
                Skills = req.TechnologyRequirements.Select(t => t.Name).ToList(),
                CoverUrl = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.JobVacancies.Add(jobVacancy);

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

    public async Task GenerateArtifactsAsync(Guid id, CancellationToken cancellationToken)
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

                    // Forward to client channel
                    await PublishRawProgressAsync(req.Id, eventData);

                    // Save artifact when received
                    if (root.TryGetProperty("artifactType", out var artTypeProp) && root.TryGetProperty("jsonData", out var jsonProp))
                    {
                        var artifactType = artTypeProp.GetString();
                        var jsonData = jsonProp.GetString();

                        if (!string.IsNullOrEmpty(artifactType) && !string.IsNullOrEmpty(jsonData))
                        {
                            await SaveArtifactAsync(req.Id, artifactType, jsonData, cancellationToken);
                        }
                    }
                }
            }

            // Publish completed event
            await PublishProgressAsync(req.Id, "Completed", "RequirementArtifactsComposer", "All hiring requirement artifacts generated successfully.", 100.0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating artifacts for hiring requirement {RequirementId}", req.Id);
            await PublishProgressAsync(req.Id, "Failed", "Failed", ex.Message, 100.0);
            throw;
        }
    }

    public async Task GenerateArtifactAsync(Guid id, string artifactType, CancellationToken cancellationToken)
    {
        if (_activeGenerations.ContainsKey((id, artifactType)))
        {
            throw new InvalidOperationException($"An AI generation job is already active for the {artifactType} artifact of this requirement.");
        }

        var existingDbArt = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, cancellationToken);
        if (existingDbArt != null && (existingDbArt.Status == "Generating" || existingDbArt.Status == "Regenerating"))
        {
            throw new InvalidOperationException($"An AI generation job is already active in the database (Status: {existingDbArt.Status}) for this artifact.");
        }

        var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        if (!_activeGenerations.TryAdd((id, artifactType), cts))
        {
            throw new InvalidOperationException($"An AI generation job is already active for the {artifactType} artifact of this requirement.");
        }

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

                    var status = root.GetProperty("status").GetString();
                    var step = root.GetProperty("step").GetString();
                    var message = root.GetProperty("message").GetString() ?? "";
                    var percentage = root.GetProperty("percentage").GetDouble();

                    if (status == "Failed")
                    {
                        throw new Exception($"AI Stream Stage Failed: {message}");
                    }

                    await PublishRawProgressAsync(req.Id, eventData);

                    if (root.TryGetProperty("artifactType", out var artTypeProp) && root.TryGetProperty("jsonData", out var jsonProp))
                    {
                        var returnedType = artTypeProp.GetString();
                        var jsonData = jsonProp.GetString();

                        if (!string.IsNullOrEmpty(returnedType) && !string.IsNullOrEmpty(jsonData))
                        {
                            await SaveArtifactAsync(req.Id, returnedType, jsonData, cts.Token);
                        }
                    }
                }
            }

            _activeGenerations.TryRemove((id, artifactType), out _);
            await PublishProgressAsync(req.Id, "Completed", "RequirementArtifactsComposer", $"Artifact {artifactType} generated successfully.", 100.0);
        }
        catch (OperationCanceledException)
        {
            _activeGenerations.TryRemove((id, artifactType), out _);
            _logger.LogInformation("Artifact {ArtifactType} generation cancelled for requirement {RequirementId}", artifactType, id);

            var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, CancellationToken.None);
            if (art != null)
            {
                art.Status = "Cancelled";
                art.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await PublishProgressAsync(id, "Cancelled", "Cancelled", "Generation cancelled by user.", 100.0);
        }
        catch (Exception ex)
        {
            _activeGenerations.TryRemove((id, artifactType), out _);
            _logger.LogError(ex, "Error generating {ArtifactType} for hiring requirement {RequirementId}", artifactType, id);

            var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType, CancellationToken.None);
            if (art != null)
            {
                art.Status = "Failed";
                art.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await PublishProgressAsync(id, "Failed", "Failed", ex.Message, 100.0);
            throw;
        }
    }

    public async Task CancelGenerationAsync(Guid id, string artifactType)
    {
        if (_activeGenerations.TryRemove((id, artifactType), out var cts))
        {
            try
            {
                cts.Cancel();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to request cancellation for active generation of requirement {RequirementId}", id);
            }
        }
        else
        {
            var art = await _context.RequirementArtifacts.FirstOrDefaultAsync(ra => ra.HiringRequirementId == id && ra.ArtifactType == artifactType);
            if (art != null && (art.Status == "Generating" || art.Status == "Regenerating"))
            {
                art.Status = "Cancelled";
                art.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync();
                await PublishProgressAsync(id, "Cancelled", "Cancelled", "Generation cancelled.", 100.0);
            }
        }
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

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task PublishProgressAsync(Guid reqId, string status, string step, string message, double percentage)
    {
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
}
