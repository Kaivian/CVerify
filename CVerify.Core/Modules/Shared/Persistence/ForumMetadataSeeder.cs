using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Forum.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class ForumMetadataSeeder : IValidatableSeeder
{
    public string ModuleId => "ForumMetadataSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => Array.Empty<string>();

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        // Seed Forum Categories
        var defaultCategories = new List<(string Name, string Slug, string Description, string IconName, int DisplayOrder, string? RequiredRole)>
        {
            ("General Discussion", "general-discussion", "Discuss anything tech, life, or CVerify related.", "MessageSquare", 1, null),
            ("Programming", "programming", "Share code snippets, software design patterns, and programming advice.", "Code", 2, null),
            ("Frontend Development", "frontend", "Discuss HTML, CSS, React, Next.js, Tailwind and UI/UX.", "Layout", 3, null),
            ("Backend Development", "backend", "Discuss C#, .NET, Go, Python, databases, API design, and system architecture.", "Server", 4, null),
            ("DevOps & Cloud", "devops-cloud", "Discuss CI/CD, Docker, Kubernetes, AWS, Cloudflare, and automation.", "Cloud", 5, null),
            ("Security", "security", "Discuss penetration testing, cryptography, auth safety, and cybersecurity guidelines.", "Shield", 6, null),
            ("Career Discussion", "career", "Career development advice, resume reviews, salary negotiations, and advice.", "TrendingUp", 7, null),
            ("Hiring & Open Positions", "hiring", "Official hiring posts, job openings, and employer branding updates.", "Briefcase", 8, "BUSINESS"),
            ("Projects & Showcase", "projects-showcase", "Showcase your side projects, open source contributions, and web products.", "Folder", 9, null),
            ("Announcements", "announcements", "Platform news, official updates, and maintenance announcements from CVerify.", "Megaphone", 10, "ADMIN")
        };

        int affected = 0;
        foreach (var dc in defaultCategories)
        {
            var exists = await context.ForumCategories.AnyAsync(c => c.Slug == dc.Slug && c.OrganizationId == null);
            if (!exists)
            {
                context.ForumCategories.Add(new ForumCategory
                {
                    Id = Guid.CreateVersion7(),
                    Name = dc.Name,
                    Slug = dc.Slug,
                    Description = dc.Description,
                    IconName = dc.IconName,
                    DisplayOrder = dc.DisplayOrder,
                    RequiredRole = dc.RequiredRole,
                    IsPrivate = false,
                    IsArchived = false,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
                affected++;
            }
        }

        // Seed Forum Badges
        var defaultBadges = new List<(string Name, string Description, string IconName, string CriteriaCode)>
        {
            ("First Post", "Awarded for posting your first discussion topic or reply.", "Award", "first_post"),
            ("Top Contributor", "Awarded for reaching 1000 reputation points.", "Trophy", "top_contributor"),
            ("AI Expert", "Awarded for contributions to AI discussions and insights.", "Sparkles", "ai_expert"),
            ("Open Source Contributor", "Awarded for sharing open source projects in showcase.", "GitFork", "open_source_contributor"),
            ("Hiring Expert", "Awarded to verified businesses with helpful hiring discussions.", "Briefcase", "hiring_expert"),
            ("Community Helper", "Awarded for having 5 accepted solutions.", "Heart", "community_helper")
        };

        foreach (var db in defaultBadges)
        {
            var exists = await context.ForumBadges.AnyAsync(b => b.CriteriaCode == db.CriteriaCode);
            if (!exists)
            {
                context.ForumBadges.Add(new ForumBadge
                {
                    Id = Guid.CreateVersion7(),
                    Name = db.Name,
                    Description = db.Description,
                    IconName = db.IconName,
                    CriteriaCode = db.CriteriaCode,
                    CreatedAt = DateTimeOffset.UtcNow
                });
                affected++;
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, "Forum metadata seeded successfully.", affected);
    }

    public async Task<ValidationResult> ValidateAsync(ApplicationDbContext context)
    {
        var categoryCount = await context.ForumCategories.CountAsync(c => c.OrganizationId == null);
        var badgeCount = await context.ForumBadges.CountAsync();
        if (categoryCount == 0 || badgeCount == 0)
        {
            return new ValidationResult(false, $"Forum validation failed: {categoryCount} categories, {badgeCount} badges seeded.");
        }
        return new ValidationResult(true);
    }
}
