using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class CapabilityCatalogSeeder : IValidatableSeeder
{
    public string ModuleId => "CapabilityCatalogSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => Array.Empty<string>();

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        var capabilities = new List<CapabilityCatalogItem>
        {
            new()
            {
                CapabilityId = "api.rest-design",
                DisplayName = "REST API Architecture",
                Category = "Backend Engineering",
                Description = "Design high-performance RESTful interfaces with consistent routing, payload schemas, and HTTP semantics.",
                Skills = new List<string> { "C#", "ASP.NET Core", "REST APIs", "Web API" },
                ExpectedEvidence = new List<string> { "AstSignature (controller/route definition)", "BlameAuthorship (API controllers)", "CommitDiffActivity (route refactoring)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "db.query-tuning",
                DisplayName = "Database Performance Tuning",
                Category = "Backend Engineering",
                Description = "Identify and optimize slow SQL queries, design index strategies, and refactor schemas to support high throughput.",
                Skills = new List<string> { "PostgreSQL", "SQL Server", "SQL Tuning", "Entity Framework" },
                ExpectedEvidence = new List<string> { "AstSignature (query/indexing/Entity Framework config)", "BlameAuthorship (database migrations/SQL files)", "CommitDiffActivity (queries tuning)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "cache.distributed",
                DisplayName = "Distributed Caching Implementation",
                Category = "Backend Engineering",
                Description = "Design multi-tier caching architectures using Redis to improve endpoint response latencies and scale reads.",
                Skills = new List<string> { "Redis", "Distributed Caching", "Cache Invalidation" },
                ExpectedEvidence = new List<string> { "AstSignature (caching config/Redis client usage)", "BlameAuthorship (cache helper modules)", "CommitDiffActivity (cache layers setup)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "sec.oauth2-integration",
                DisplayName = "Secure Authentication & OAuth2",
                Category = "Backend Engineering",
                Description = "Configure secure authentication pipelines, JWT token rotation, role permissions, and identity federation.",
                Skills = new List<string> { "OAuth2", "JWT", "ASP.NET Identity", "Security Headers" },
                ExpectedEvidence = new List<string> { "AstSignature (authentication configuration/middleware setup)", "BlameAuthorship (auth controller/token validation)", "CommitDiffActivity (auth modules commits)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "fe.perf-optimize",
                DisplayName = "Web Performance & Bundle Tuning",
                Category = "Frontend Engineering",
                Description = "Optimize bundle sizes, implement code splitting, configure image optimization, and improve Lighthouse scores.",
                Skills = new List<string> { "React", "Next.js", "Webpack", "Lighthouse" },
                ExpectedEvidence = new List<string> { "AstSignature (Next.js configurations/lazy load routes)", "BlameAuthorship (bundle config/layout tuning files)", "CommitDiffActivity (performance optimization PRs)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "fe.state-mgmt",
                DisplayName = "Advanced State Management",
                Category = "Frontend Engineering",
                Description = "Build decoupled and predictable client-side application states using global stores and context models.",
                Skills = new List<string> { "React", "Zustand", "Redux Toolkit", "Context API" },
                ExpectedEvidence = new List<string> { "AstSignature (Zustand stores/React Context definitions)", "BlameAuthorship (store files)", "CommitDiffActivity (state management refactors)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "fe.responsive-layouts",
                DisplayName = "Semantic Responsive Layouts",
                Category = "Frontend Engineering",
                Description = "Code responsive grid layouts matching strict designs, ensuring typography fluidness and browser compatibility.",
                Skills = new List<string> { "HTML", "CSS", "TailwindCSS", "Flexbox" },
                ExpectedEvidence = new List<string> { "AstSignature (CSS classes/flexbox/grid layouts)", "BlameAuthorship (UI/responsive components)", "CommitDiffActivity (responsive page layouts)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "infra.docker-deploy",
                DisplayName = "Microservice Containerization",
                Category = "DevOps & Security",
                Description = "Configure lightweight Docker files, optimize multi-stage builds, and deploy container clusters.",
                Skills = new List<string> { "Docker", "Docker Compose", "Containerization" },
                ExpectedEvidence = new List<string> { "AstSignature (Dockerfile/Docker Compose configuration)", "BlameAuthorship (docker workspace files)", "CommitDiffActivity (infrastructure setup)" },
                IsCustom = false,
                Status = "Active"
            },
            new()
            {
                CapabilityId = "cicd.pipeline-tuning",
                DisplayName = "CI/CD Pipeline Automation",
                Category = "DevOps & Security",
                Description = "Write continuous integration workflows that automate linting, unit testing coverage, and deployment.",
                Skills = new List<string> { "GitHub Actions", "GitLab CI", "CI/CD Pipelines", "Automated Testing" },
                ExpectedEvidence = new List<string> { "AstSignature (GitHub Actions YAML/GitLab pipeline files)", "BlameAuthorship (.github/workflows folder files)", "CommitDiffActivity (workflow file changes)" },
                IsCustom = false,
                Status = "Active"
            }
        };

        int affected = 0;
        foreach (var cap in capabilities)
        {
            var existing = await context.CapabilityCatalogItems.FirstOrDefaultAsync(c => c.CapabilityId == cap.CapabilityId);
            if (existing == null)
            {
                cap.CreatedAt = DateTimeOffset.UtcNow;
                cap.UpdatedAt = DateTimeOffset.UtcNow;
                context.CapabilityCatalogItems.Add(cap);
                affected++;
            }
            else if (existing.DisplayName != cap.DisplayName || 
                     existing.Category != cap.Category || 
                     existing.Description != cap.Description ||
                     !EqualLists(existing.Skills, cap.Skills) ||
                     !EqualLists(existing.ExpectedEvidence, cap.ExpectedEvidence))
            {
                existing.DisplayName = cap.DisplayName;
                existing.Category = cap.Category;
                existing.Description = cap.Description;
                existing.Skills = cap.Skills;
                existing.ExpectedEvidence = cap.ExpectedEvidence;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
                context.CapabilityCatalogItems.Update(existing);
                affected++;
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, "Capability catalog items seeded successfully.", affected);
    }

    private static bool EqualLists(List<string>? list1, List<string>? list2)
    {
        if (list1 == null && list2 == null) return true;
        if (list1 == null || list2 == null) return false;
        if (list1.Count != list2.Count) return false;
        for (int i = 0; i < list1.Count; i++)
        {
            if (list1[i] != list2[i]) return false;
        }
        return true;
    }

    public async Task<ValidationResult> ValidateAsync(ApplicationDbContext context)
    {
        var count = await context.CapabilityCatalogItems.CountAsync();
        if (count == 0)
        {
            return new ValidationResult(false, "No capability catalog items were seeded.");
        }
        return new ValidationResult(true);
    }
}
