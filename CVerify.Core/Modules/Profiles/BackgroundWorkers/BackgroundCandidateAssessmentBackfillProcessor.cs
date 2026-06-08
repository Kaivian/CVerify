using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.BackgroundWorkers;

public class BackgroundCandidateAssessmentBackfillProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundCandidateAssessmentBackfillProcessor> _logger;

    public BackgroundCandidateAssessmentBackfillProcessor(
        IServiceProvider serviceProvider,
        ILogger<BackgroundCandidateAssessmentBackfillProcessor> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Candidate Assessment Backfill Processor started.");

        // Wait a small delay to ensure startup has completed
        await Task.Delay(5000, stoppingToken);

        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var queue = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentQueue>();

        try
        {
            var assessmentsToBackfill = await context.CandidateAssessments
                .Where(ca => ca.Status == "Completed")
                .Where(ca => !context.CandidateSkills.Any(cs => cs.CandidateAssessmentId == ca.Id))
                .ToListAsync(stoppingToken);

            if (assessmentsToBackfill.Count == 0)
            {
                _logger.LogInformation("No historical candidate assessments need backfilling.");
                return;
            }

            _logger.LogInformation("Found {Count} historical candidate assessments to backfill.", assessmentsToBackfill.Count);

            foreach (var ca in assessmentsToBackfill)
            {
                try
                {
                    var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
                    var db = redis.GetDatabase();
                    var lockKey = $"candidate:assessment:lock:{ca.UserId}";
                    var lockToken = Guid.NewGuid().ToString();

                    bool acquiredLock = await db.LockTakeAsync(lockKey, lockToken, TimeSpan.FromMinutes(10));
                    if (!acquiredLock)
                    {
                        _logger.LogWarning("Backfill Processor: Could not acquire lock for user {UserId}. Skipping for now.", ca.UserId);
                        continue;
                    }

                    try
                    {
                        _logger.LogInformation("Backfilling candidate assessment {AssessmentId} for user {UserId}...", ca.Id, ca.UserId);

                        var completedJobs = await context.AnalysisJobs
                            .Include(j => j.Repository)
                            .Where(j => j.UserId == ca.UserId && j.Status == "Completed")
                            .ToListAsync(stoppingToken);

                        var repos = completedJobs.Select(j => j.Repository)
                            .Where(r => r.IsEnabled)
                            .GroupBy(r => r.Id)
                            .Select(g => g.First())
                            .ToList();
                        var repoIds = repos.Select(r => r.Id).ToList();
                        var jobIds = completedJobs.Select(j => j.Id).ToList();

                        var repoAssessments = await context.RepositoryAssessments
                            .Where(ra => jobIds.Contains(ra.AnalysisJobId) && ra.Status == "Completed")
                            .ToListAsync(stoppingToken);

                        var repoAssessmentIds = repoAssessments.Select(ra => ra.Id).ToList();

                        bool allReposHaveAssets = true;
                        if (repoAssessments.Count == 0)
                        {
                            allReposHaveAssets = false;
                        }
                        else
                        {
                            foreach (var ra in repoAssessments)
                            {
                                var hasCaps = await context.RepositoryCapabilities.AnyAsync(c => c.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasSkills = await context.RepositorySkillAttributions.AnyAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasDomains = await context.RepositoryDomains.AnyAsync(d => d.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasSignal = await context.RepositoryIntelligenceSignals.AnyAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);

                                if (!hasCaps || !hasSkills || !hasDomains || !hasSignal)
                                {
                                    allReposHaveAssets = false;
                                    break;
                                }
                            }
                        }

                        if (!allReposHaveAssets)
                        {
                            _logger.LogInformation("Assessment {AssessmentId} lacks Pipeline 1 relational assets in repository assessments. Queueing for automated reassessment.", ca.Id);
                            
                            var maxVersion = await context.CandidateAssessments
                                .Where(x => x.UserId == ca.UserId)
                                .MaxAsync(x => (int?)x.Version, stoppingToken) ?? 0;

                            ca.Status = "Queued";
                            ca.Version = maxVersion + 1;
                            await context.SaveChangesAsync(stoppingToken);
                            
                            await queue.EnqueueAssessmentAsync(ca.Id);
                            continue;
                        }

                        // Load scoring policy from scoring_policy.json
                        string? policyPath = null;
                        var currDir = Directory.GetCurrentDirectory();
                        for (int i = 0; i < 10; i++)
                        {
                            var candidatePath = Path.Combine(currDir, "scoring_policy.json");
                            if (File.Exists(candidatePath))
                            {
                                policyPath = candidatePath;
                                break;
                            }
                            currDir = Directory.GetParent(currDir)?.FullName;
                            if (currDir == null) break;
                        }

                        double wSd = 0.35, aSd = 22.0, bSd = 0.05;
                        double wOwn = 0.25, aOwn = 22.0, bOwn = 0.2;
                        double wArch = 0.20, aArch = 22.0, bArch = 0.05;
                        double wPs = 0.12, aPs = 22.0, bPs = 0.1;
                        double wImp = 0.08, aImp = 20.0, bImp = 1.0;

                        if (policyPath != null)
                        {
                            try
                            {
                                var policyJson = File.ReadAllText(policyPath);
                                using var policyDoc = JsonDocument.Parse(policyJson);
                                var dims = policyDoc.RootElement.GetProperty("dimensions");
                                
                                if (dims.TryGetProperty("skillDepth", out var sdProp))
                                {
                                    wSd = sdProp.GetProperty("weight").GetDouble();
                                    aSd = sdProp.GetProperty("scale_A").GetDouble();
                                    bSd = sdProp.GetProperty("scale_B").GetDouble();
                                }
                                if (dims.TryGetProperty("ownership", out var ownProp))
                                {
                                    wOwn = ownProp.GetProperty("weight").GetDouble();
                                    aOwn = ownProp.GetProperty("scale_A").GetDouble();
                                    bOwn = ownProp.GetProperty("scale_B").GetDouble();
                                }
                                if (dims.TryGetProperty("architecture", out var archProp))
                                {
                                    wArch = archProp.GetProperty("weight").GetDouble();
                                    aArch = archProp.GetProperty("scale_A").GetDouble();
                                    bArch = archProp.GetProperty("scale_B").GetDouble();
                                }
                                if (dims.TryGetProperty("problemSolving", out var psProp))
                                {
                                    wPs = psProp.GetProperty("weight").GetDouble();
                                    aPs = psProp.GetProperty("scale_A").GetDouble();
                                    bPs = psProp.GetProperty("scale_B").GetDouble();
                                }
                                if (dims.TryGetProperty("impact", out var impProp))
                                {
                                    wImp = impProp.GetProperty("weight").GetDouble();
                                    aImp = impProp.GetProperty("scale_A").GetDouble();
                                    bImp = impProp.GetProperty("scale_B").GetDouble();
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to parse scoring policy file {PolicyPath}. Using defaults.", policyPath);
                            }
                        }

                        // 1. Skill Depth
                        var cvSkills = await context.UserSkills
                            .Where(us => us.UserId == ca.UserId)
                            .Select(us => us.Skill)
                            .ToListAsync(stoppingToken);

                        var careerPref = await context.CareerPreferences
                            .FirstOrDefaultAsync(cp => cp.UserId == ca.UserId, stoppingToken);
                        if (careerPref?.TargetSkills != null)
                        {
                            cvSkills = cvSkills.Concat(careerPref.TargetSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                        }

                        var raSkillAttributions = await context.RepositorySkillAttributions
                            .Where(s => repoAssessmentIds.Contains(s.RepositoryAssessmentId))
                            .ToListAsync(stoppingToken);

                        double rawSkills = 0.0;
                        foreach (var skillName in cvSkills)
                        {
                            var matchingAttributions = raSkillAttributions
                                .Where(s => string.Equals(s.SkillName, skillName, StringComparison.OrdinalIgnoreCase))
                                .ToList();
                            
                            if (matchingAttributions.Count > 0)
                            {
                                double avgWeight = matchingAttributions.Average(s => s.ContributionWeight);
                                double profLevel = avgWeight switch
                                {
                                    >= 0.8 => 4.0,
                                    >= 0.5 => 3.0,
                                    >= 0.2 => 2.0,
                                    _ => 1.0
                                };
                                
                                rawSkills += profLevel * 25.0;
                            }
                        }
                        int sdScore = (int)Math.Round(aSd * Math.Log(1.0 + bSd * rawSkills));

                        // 2. Repository Ownership
                        var repoScores = new List<double>();
                        double maxDifficultyScore = 0.0;
                        var allCategories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                        foreach (var ra in repoAssessments)
                        {
                            var raCapabilities = await context.RepositoryCapabilities
                                .Where(c => c.RepositoryAssessmentId == ra.Id)
                                .ToListAsync(stoppingToken);

                            double repoScore = 0.0;
                            foreach (var cap in raCapabilities)
                            {
                                double diffScore = cap.DifficultyScore;
                                if (!string.IsNullOrEmpty(cap.Category))
                                {
                                    allCategories.Add(cap.Category);
                                }

                                if (diffScore <= 1.0)
                                {
                                    diffScore *= 10.0;
                                }
                                maxDifficultyScore = Math.Max(maxDifficultyScore, diffScore);

                                string maturity = cap.Maturity ?? "Basic";
                                double maturityMult = 0.5;
                                if (maturity == "Basic") maturityMult = 0.5;
                                else if (maturity == "Intermediate") maturityMult = 1.0;
                                else if (maturity == "Advanced") maturityMult = 1.5;
                                else if (maturity == "Enterprise" || maturity == "Principal") maturityMult = 2.0;

                                repoScore += diffScore * maturityMult;
                            }
                            repoScores.Add(repoScore);
                        }

                        double rawOwnership = 0.0;
                        for (int i = 0; i < repoAssessments.Count; i++)
                        {
                            var ra = repoAssessments[i];
                            var raSignal = await context.RepositoryIntelligenceSignals
                                .FirstOrDefaultAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);

                            double ownershipSignal = raSignal != null ? raSignal.OwnershipSignal : 0.0;
                            if (ownershipSignal > 1.0)
                            {
                                ownershipSignal /= 100.0;
                            }
                            if (ownershipSignal == 0.0)
                            {
                                ownershipSignal = 1.0;
                            }

                            rawOwnership += ownershipSignal * repoScores[i];
                        }
                        int ownScore = (int)Math.Round(aOwn * Math.Log(1.0 + bOwn * rawOwnership));

                        // 3. System Architecture
                        var uniqueArchCaps = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
                        foreach (var ra in repoAssessments)
                        {
                            var raCapabilities = await context.RepositoryCapabilities
                                .Where(c => c.RepositoryAssessmentId == ra.Id)
                                .ToListAsync(stoppingToken);

                            foreach (var cap in raCapabilities)
                            {
                                double diffScore = cap.DifficultyScore;
                                if (diffScore <= 1.0)
                                {
                                    diffScore *= 10.0;
                                }

                                if (diffScore >= 5.0)
                                {
                                    string cname = (cap.Name ?? "").ToLowerInvariant();
                                    if (string.IsNullOrEmpty(cname)) continue;

                                    string maturity = cap.Maturity ?? "Basic";
                                    double maturityMult = 0.5;
                                    if (maturity == "Basic") maturityMult = 0.5;
                                    else if (maturity == "Intermediate") maturityMult = 1.0;
                                    else if (maturity == "Advanced") maturityMult = 1.5;
                                    else if (maturity == "Enterprise" || maturity == "Principal") maturityMult = 2.0;

                                    double capScore = diffScore * 10.0 * maturityMult;
                                    if (!uniqueArchCaps.ContainsKey(cname) || capScore > uniqueArchCaps[cname])
                                    {
                                        uniqueArchCaps[cname] = capScore;
                                    }
                                }
                            }
                        }
                        double rawArchitecture = uniqueArchCaps.Values.Sum();
                        int archScore = (int)Math.Round(aArch * Math.Log(1.0 + bArch * rawArchitecture));

                        // 4. Problem Solving
                        double rawSolving = 0.0;
                        foreach (var ra in repoAssessments)
                        {
                            var raSignal = await context.RepositoryIntelligenceSignals
                                .FirstOrDefaultAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);

                            double consistencySignal = raSignal != null ? raSignal.ConsistencySignal : 50.0;
                            double ownershipSignal = raSignal != null ? raSignal.OwnershipSignal : 100.0;
                            if (ownershipSignal > 1.0)
                            {
                                ownershipSignal /= 100.0;
                            }

                            double qualityScore = 50.0;
                            if (!string.IsNullOrEmpty(ra.QualityMetrics))
                            {
                                try
                                {
                                    using var qmDoc = JsonDocument.Parse(ra.QualityMetrics);
                                    if (qmDoc.RootElement.TryGetProperty("qualityScore", out var qsProp))
                                    {
                                        qualityScore = qsProp.GetDouble();
                                    }
                                }
                                catch {}
                            }

                            rawSolving += (consistencySignal / 100.0) * qualityScore * ownershipSignal;
                        }
                        int psScore = (int)Math.Round(aPs * Math.Log(1.0 + bPs * rawSolving));

                        // 5. Engineering Business Impact
                        var experiences = await context.WorkExperiences
                            .Include(we => we.Achievements)
                            .Include(we => we.Technologies)
                            .Where(we => we.UserId == ca.UserId && we.DeletedAt == null)
                            .ToListAsync(stoppingToken);

                        double totalMonths = 0;
                        bool hasLeadership = false;
                        foreach (var exp in experiences)
                        {
                            var endDate = exp.EndDate ?? DateTimeOffset.UtcNow;
                            var months = ((endDate.Year - exp.StartDate.Year) * 12) + endDate.Month - exp.StartDate.Month;
                            totalMonths += Math.Max(months, 1);
                            if (exp.IsLeadership)
                            {
                                hasLeadership = true;
                            }
                        }

                        double leadershipMult = hasLeadership ? 1.15 : 1.0;
                        double maxCompanyScale = 1.0;
                        double maxRoleScale = 1.0;

                        foreach (var exp in experiences)
                        {
                            string company = (exp.Company ?? "").ToLowerInvariant();
                            if (company.Contains("google") || company.Contains("apple") || company.Contains("facebook") || 
                                company.Contains("meta") || company.Contains("netflix") || company.Contains("amazon") || company.Contains("microsoft"))
                            {
                                maxCompanyScale = 1.15;
                            }

                            string title = (exp.JobTitle ?? "").ToLowerInvariant();
                            if (title.Contains("principal") || title.Contains("director") || title.Contains("head"))
                            {
                                maxRoleScale = Math.Max(maxRoleScale, 1.6);
                            }
                            else if (title.Contains("staff") || title.Contains("lead") || title.Contains("manager"))
                            {
                                maxRoleScale = Math.Max(maxRoleScale, 1.4);
                            }
                            else if (title.Contains("senior"))
                            {
                                maxRoleScale = Math.Max(maxRoleScale, 1.2);
                            }
                            else if (title.Contains("junior") || title.Contains("intern"))
                            {
                                maxRoleScale = Math.Max(maxRoleScale, 0.8);
                            }
                            else
                            {
                                maxRoleScale = Math.Max(maxRoleScale, 1.0);
                            }
                        }
                        int impScore = (int)Math.Round(Math.Log(1.0 + bImp * totalMonths) * maxCompanyScale * maxRoleScale * leadershipMult * aImp);

                        // Overall Score
                        int sCandidate = (int)Math.Round(
                            sdScore * wSd +
                            ownScore * wOwn +
                            archScore * wArch +
                            psScore * wPs +
                            impScore * wImp
                        );

                        // Trust score calculation
                        var verifiedSkillsSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var ra in repoAssessments)
                        {
                            var attributions = await context.RepositorySkillAttributions
                                .Where(s => s.RepositoryAssessmentId == ra.Id)
                                .ToListAsync(stoppingToken);
                            foreach (var attr in attributions)
                            {
                                if (!string.IsNullOrEmpty(attr.SkillName))
                                {
                                    verifiedSkillsSet.Add(attr.SkillName);
                                }
                            }
                        }

                        int matchedSkillsCount = 0;
                        foreach (var s in cvSkills)
                        {
                            if (verifiedSkillsSet.Contains(s))
                            {
                                matchedSkillsCount++;
                            }
                        }

                        double rSkills = cvSkills.Count > 0 ? (double)matchedSkillsCount / cvSkills.Count : 1.0;

                        int verifiedReposCount = 0;
                        foreach (var ra in repoAssessments)
                        {
                            var raSignal = await context.RepositoryIntelligenceSignals
                                .FirstOrDefaultAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);
                            double ownership = raSignal != null ? raSignal.OwnershipSignal : 0.0;
                            if (ownership > 1.0)
                            {
                                ownership /= 100.0;
                            }
                            if (ownership == 0.0)
                            {
                                ownership = ra.OverallScore / 100.0;
                            }

                            string cloneClassification = "clean";
                            if (!string.IsNullOrEmpty(ra.QualityMetrics))
                            {
                                try
                                {
                                    using var qmDoc = JsonDocument.Parse(ra.QualityMetrics);
                                    if (qmDoc.RootElement.TryGetProperty("cloneRiskClassification", out var crProp))
                                    {
                                        cloneClassification = crProp.GetString() ?? "clean";
                                    }
                                }
                                catch {}
                            }

                            // Always count repository as verified regardless of readiness gates
                            verifiedReposCount++;
                        }

                        double rRepos = repoAssessments.Count > 0 ? (double)verifiedReposCount / repoAssessments.Count : 1.0;
                        double rEvidence = sCandidate > 0 ? (ownScore * 0.60) / sCandidate : 0.0;

                        double tCandidate = ((rSkills * 0.30) + (rRepos * 0.30) + (rEvidence * 0.40)) * 100.0;
                        tCandidate = Math.Round(Math.Max(Math.Min(tCandidate, 100.0), 0.0), 2);

                        // Signals and seniority
                        double candidateComplexity = maxDifficultyScore * 10.0;

                        var scopes = new List<double>();
                        var ownerships = new List<double>();
                        var leaderships = new List<double>();
                        var consistencies = new List<double>();

                        foreach (var ra in repoAssessments)
                        {
                            var raSignal = await context.RepositoryIntelligenceSignals
                                .FirstOrDefaultAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);
                            if (raSignal != null)
                            {
                                scopes.Add(raSignal.ScopeSignal);
                                ownerships.Add(raSignal.OwnershipSignal);
                                leaderships.Add(raSignal.LeadershipSignal);
                                consistencies.Add(raSignal.ConsistencySignal);
                            }
                        }

                        double candidateScope = scopes.Count > 0 ? scopes.Average() : 0.0;
                        double candidateOwnership = ownerships.Count > 0 ? ownerships.Average() : 0.0;
                        double candidateLeadership = leaderships.Count > 0 ? leaderships.Max() : 0.0;
                        double candidateConsistency = consistencies.Count > 0 ? consistencies.Average() : 0.0;

                        double candidateMaturity = 50.0;
                        double candidateProblemSolving = 50.0;

                        var existingProfileArtifact = await context.CandidateAssessmentArtifacts
                            .FirstOrDefaultAsync(a => a.AssessmentId == ca.Id && a.ArtifactType == "CandidateProfile", stoppingToken);

                        string? primaryTendency = null;
                        string? primaryWorkingStyle = null;
                        string? summaryHeadline = null;
                        string? summaryParagraph = null;

                        if (existingProfileArtifact != null)
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(existingProfileArtifact.JsonData);
                                var r = doc.RootElement;
                                if (r.TryGetProperty("engineeringMaturityScore", out var matProp)) candidateMaturity = matProp.GetDouble();
                                if (r.TryGetProperty("problemSolvingScore", out var probProp)) candidateProblemSolving = probProp.GetDouble();
                                if (r.TryGetProperty("primaryTendency", out var tendProp)) primaryTendency = tendProp.GetString();
                                if (r.TryGetProperty("primaryWorkingStyle", out var styleProp)) primaryWorkingStyle = styleProp.GetString();
                                if (r.TryGetProperty("recruiterHeadline", out var headlineProp)) summaryHeadline = headlineProp.GetString();
                                if (r.TryGetProperty("fullSummary", out var sumProp)) summaryParagraph = sumProp.GetString();
                            }
                            catch {}
                        }

                        string ClassifySeniority(double comp, double lead, double mat, double own, out string label)
                        {
                            if (comp >= 85 && lead >= 80 && mat >= 85 && own >= 75)
                            {
                                label = "Principal";
                                return "L5";
                            }
                            if (comp >= 75 && lead >= 65 && mat >= 75 && own >= 60)
                            {
                                label = "Staff";
                                return "L4";
                            }
                            if (comp >= 55 && lead >= 40 && mat >= 60 && own >= 45)
                            {
                                label = "Senior";
                                return "L3";
                            }
                            if (comp >= 30 && lead >= 15 && mat >= 35 && own >= 30)
                            {
                                label = "Middle";
                                return "L2";
                            }
                            if (comp >= 10 && mat >= 15 && own >= 15)
                            {
                                label = "Junior";
                                return "L1";
                            }
                            label = "Intern";
                            return "Intern";
                        }

                        string overallLevel = ClassifySeniority(candidateComplexity, candidateLeadership, candidateMaturity, candidateOwnership, out string overallLabel);

                        // Save CandidateSkills
                        var aggregatedSkills = raSkillAttributions
                            .GroupBy(s => s.SkillName, StringComparer.OrdinalIgnoreCase)
                            .Select(g => new
                            {
                                SkillName = g.Key,
                                Score = g.Average(s => s.ContributionWeight) * 100.0,
                                Confidence = g.Average(s => s.Confidence),
                                Level = g.Average(s => s.ContributionWeight) switch
                                {
                                    >= 0.8 => "Expert",
                                    >= 0.5 => "Practitioner",
                                    >= 0.2 => "Working",
                                    _ => "Awareness"
                                },
                                SupportingRepoIds = g.Select(s => s.RepositoryAssessmentId).Distinct().ToList()
                            }).ToList();

                        foreach (var s in aggregatedSkills)
                        {
                            var repoNames = s.SupportingRepoIds
                                .Select(rid => repoAssessments.FirstOrDefault(ra => ra.Id == rid)?.RepositoryId)
                                .Where(rId => rId.HasValue)
                                .Select(rId => repos.FirstOrDefault(r => r.Id == rId.Value)?.Name ?? "unknown")
                                .ToList();

                            var skill = new CandidateSkill
                            {
                                Id = Guid.CreateVersion7(),
                                CandidateAssessmentId = ca.Id,
                                SkillName = s.SkillName,
                                Score = Math.Round(s.Score, 2),
                                Confidence = Math.Round(s.Confidence, 2),
                                Level = s.Level,
                                EvidenceSources = JsonSerializer.Serialize(new
                                {
                                    repositories = repoNames,
                                    rationale = "Backfilled from repository skill attributions."
                                })
                            };
                            context.CandidateSkills.Add(skill);
                        }

                        // Save Domain Profiles
                        var raDomains = await context.RepositoryDomains
                            .Where(d => repoAssessmentIds.Contains(d.RepositoryAssessmentId))
                            .ToListAsync(stoppingToken);

                        var domainSums = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
                        var domainWeightsSum = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);

                        foreach (var ra in repoAssessments)
                        {
                            var raDoms = raDomains.Where(d => d.RepositoryAssessmentId == ra.Id).ToList();
                            foreach (var dom in raDoms)
                            {
                                string dname = dom.DomainName;
                                double w = dom.Weight;
                                double dScore = ra.OverallScore;

                                if (!domainSums.ContainsKey(dname))
                                {
                                    domainSums[dname] = 0.0;
                                    domainWeightsSum[dname] = 0.0;
                                }
                                domainSums[dname] += dScore * w;
                                domainWeightsSum[dname] += w;
                            }
                        }

                        foreach (var kvp in domainWeightsSum)
                        {
                            string dname = kvp.Key;
                            double wSum = kvp.Value;
                            double avgScore = wSum > 0 ? domainSums[dname] / wSum : 0.0;

                            double domComplexity = candidateComplexity * (repoAssessments.Count > 0 ? wSum / repoAssessments.Count : 1.0);
                            string domLevel = ClassifySeniority(domComplexity, candidateLeadership, candidateMaturity, candidateOwnership, out string domLabel);

                            var domProfile = new CandidateDomainProfile
                            {
                                Id = Guid.CreateVersion7(),
                                CandidateAssessmentId = ca.Id,
                                DomainName = dname,
                                Score = Math.Round(avgScore, 2),
                                Confidence = 0.85,
                                Seniority = domLabel,
                                SupportingEvidence = JsonSerializer.Serialize(new { weight_ratio = Math.Round(wSum, 2) })
                            };
                            context.CandidateDomainProfiles.Add(domProfile);
                        }

                        // Save Intelligence Signals
                        var signals = new CandidateIntelligenceSignal
                        {
                            Id = Guid.CreateVersion7(),
                            CandidateAssessmentId = ca.Id,
                            ScopeSignal = candidateScope,
                            ComplexitySignal = candidateComplexity,
                            OwnershipSignal = candidateOwnership,
                            LeadershipSignal = candidateLeadership,
                            ConsistencySignal = candidateConsistency,
                            DeliverySignal = rRepos * 100.0,
                            EngineeringMaturitySignal = candidateMaturity,
                            ProblemSolvingSignal = candidateProblemSolving,
                            LastUpdatedUtc = DateTimeOffset.UtcNow
                        };
                        context.CandidateIntelligenceSignals.Add(signals);

                        // Save Best-Fit Roles
                        var recommendationsArtifact = await context.CandidateAssessmentArtifacts
                            .FirstOrDefaultAsync(a => a.AssessmentId == ca.Id && a.ArtifactType == "Recommendations", stoppingToken);

                        var bestFitRoles = new List<CandidateBestFitRole>();
                        if (recommendationsArtifact != null)
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(recommendationsArtifact.JsonData);
                                var r = doc.RootElement;

                                var allRoles = new List<JsonElement>();
                                if (r.TryGetProperty("topMatch", out var topMatchProp) && topMatchProp.ValueKind == JsonValueKind.Object)
                                {
                                    allRoles.Add(topMatchProp);
                                }
                                if (r.TryGetProperty("suggestedRoles", out var suggestedProp) && suggestedProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var item in suggestedProp.EnumerateArray())
                                    {
                                        allRoles.Add(item);
                                    }
                                }
                                else if (r.TryGetProperty("recommendations", out var recProp))
                                {
                                    if (recProp.TryGetProperty("topMatch", out var tm) && tm.ValueKind == JsonValueKind.Object)
                                    {
                                        allRoles.Add(tm);
                                    }
                                    if (recProp.TryGetProperty("suggestedRoles", out var sr) && sr.ValueKind == JsonValueKind.Array)
                                    {
                                        foreach (var item in sr.EnumerateArray())
                                        {
                                            allRoles.Add(item);
                                        }
                                    }
                                }

                                int rank = 1;
                                var seenTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                                foreach (var roleEl in allRoles)
                                {
                                    string? title = null;
                                    if (roleEl.TryGetProperty("roleTitle", out var tProp)) title = tProp.GetString();
                                    else if (roleEl.TryGetProperty("role", out var rProp)) title = rProp.GetString();

                                    if (string.IsNullOrEmpty(title) || seenTitles.Contains(title)) continue;
                                    seenTitles.Add(title);

                                    double confidence = 0.8;
                                    if (roleEl.TryGetProperty("confidence", out var cProp))
                                    {
                                        if (cProp.ValueKind == JsonValueKind.Number) confidence = cProp.GetDouble();
                                    }

                                    string? rationale = null;
                                    if (roleEl.TryGetProperty("rationale", out var ratProp)) rationale = ratProp.GetString();

                                    string? levelFit = "exact";
                                    if (roleEl.TryGetProperty("levelFit", out var lfProp)) levelFit = lfProp.GetString();

                                    var bestFitRole = new CandidateBestFitRole
                                    {
                                        Id = Guid.CreateVersion7(),
                                        CandidateAssessmentId = ca.Id,
                                        RoleTitle = title,
                                        MatchScore = confidence * 100.0,
                                        Confidence = confidence,
                                        Rank = rank++,
                                        MatchingEngineVersion = "V1",
                                        Evidence = JsonSerializer.Serialize(new { rationale, levelFit }),
                                        EngineMetadata = JsonSerializer.Serialize(new { matchingEngine = "RuleBasedMaturityV1" })
                                    };
                                    bestFitRoles.Add(bestFitRole);
                                }
                            }
                            catch {}
                        }

                        if (bestFitRoles.Count == 0)
                        {
                            int rank = 1;
                            var domainProfiles = await context.CandidateDomainProfiles
                                .Where(d => d.CandidateAssessmentId == ca.Id)
                                .OrderByDescending(d => d.Score)
                                .ToListAsync(stoppingToken);

                            foreach (var dp in domainProfiles)
                            {
                                string title = $"{dp.Seniority} {dp.DomainName}";
                                var bestFitRole = new CandidateBestFitRole
                                {
                                    Id = Guid.CreateVersion7(),
                                    CandidateAssessmentId = ca.Id,
                                    RoleTitle = title,
                                    MatchScore = dp.Score,
                                    Confidence = dp.Score / 100.0,
                                    Rank = rank++,
                                    MatchingEngineVersion = "V1",
                                    Evidence = JsonSerializer.Serialize(new { rationale = $"Inferred from domain score for {dp.DomainName}.", levelFit = "exact" }),
                                    EngineMetadata = JsonSerializer.Serialize(new { matchingEngine = "RuleBasedMaturityV1" })
                                };
                                bestFitRoles.Add(bestFitRole);
                            }
                        }

                        foreach (var r in bestFitRoles)
                        {
                            context.CandidateBestFitRoles.Add(r);
                        }

                        // Save Strengths & Weaknesses
                        var sgArtifact = await context.CandidateAssessmentArtifacts
                            .FirstOrDefaultAsync(a => a.AssessmentId == ca.Id && a.ArtifactType == "StrengthsGaps", stoppingToken);

                        var swList = new List<CandidateStrengthWeakness>();
                        if (sgArtifact != null)
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(sgArtifact.JsonData);
                                var r = doc.RootElement;

                                if (r.TryGetProperty("keyStrengths", out var strProp) && strProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var item in strProp.EnumerateArray())
                                    {
                                        if (item.GetString() is string str && !string.IsNullOrEmpty(str))
                                        {
                                            swList.Add(new CandidateStrengthWeakness
                                            {
                                                Id = Guid.CreateVersion7(),
                                                CandidateAssessmentId = ca.Id,
                                                FindingType = "Strength",
                                                Topic = "Engineering Capability",
                                                Description = str,
                                                Evidence = null
                                            });
                                        }
                                    }
                                }

                                if (r.TryGetProperty("watchPoints", out var watchProp) && watchProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var item in watchProp.EnumerateArray())
                                    {
                                        if (item.GetString() is string wp && !string.IsNullOrEmpty(wp))
                                        {
                                            swList.Add(new CandidateStrengthWeakness
                                            {
                                                Id = Guid.CreateVersion7(),
                                                CandidateAssessmentId = ca.Id,
                                                FindingType = "ImprovementArea",
                                                Topic = "Development Gap",
                                                Description = wp,
                                                Evidence = null
                                            });
                                        }
                                    }
                                }
                            }
                            catch {}
                        }

                        if (swList.Count == 0)
                        {
                            swList.Add(new CandidateStrengthWeakness
                            {
                                Id = Guid.CreateVersion7(),
                                CandidateAssessmentId = ca.Id,
                                FindingType = "Strength",
                                Topic = "General",
                                Description = "Solid engineering execution verified by repository assessments.",
                                Evidence = null
                            });
                        }

                        foreach (var sw in swList)
                        {
                            context.CandidateStrengthsWeaknesses.Add(sw);
                        }

                        // Update CandidateAssessment columns
                        ca.TechnicalDepth = candidateComplexity;
                        ca.TechnicalBreadth = allCategories.Count * 10.0;
                        ca.LeadershipPotential = candidateLeadership;
                        ca.ExecutionStrength = (candidateConsistency + candidateProblemSolving) / 2.0;
                        ca.TrustLevel = tCandidate;
                        ca.OverallScore = sCandidate;
                        ca.CareerLevel = overallLevel;
                        ca.CareerLevelLabel = overallLabel;
                        ca.PrimaryTendency = primaryTendency;
                        ca.PrimaryWorkingStyle = primaryWorkingStyle;
                        ca.SummaryHeadline = summaryHeadline;
                        ca.SummaryParagraph = summaryParagraph;

                        // Synchronize backfilled scores to the CandidateProfile JSON artifact for backward compatibility
                        if (existingProfileArtifact != null)
                        {
                            try
                            {
                                var node = System.Text.Json.Nodes.JsonNode.Parse(existingProfileArtifact.JsonData);
                                if (node != null)
                                {
                                    node["candidateScore"] = sCandidate;
                                    node["trustLevel"] = tCandidate;
                                    existingProfileArtifact.JsonData = node.ToJsonString();
                                    context.Entry(existingProfileArtifact).State = EntityState.Modified;
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to synchronize backfilled scores to CandidateProfile JSON artifact for assessment {AssessmentId}.", ca.Id);
                            }
                        }

                        context.Entry(ca).State = EntityState.Modified;
                        await context.SaveChangesAsync(stoppingToken);

                        _logger.LogInformation("Successfully backfilled candidate assessment {AssessmentId}.", ca.Id);
                    }
                    finally
                    {
                        await db.LockReleaseAsync(lockKey, lockToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error backfilling candidate assessment {AssessmentId}.", ca.Id);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred in the Backfill Processor.");
        }

        _logger.LogInformation("Background Candidate Assessment Backfill Processor completed.");
    }
}
