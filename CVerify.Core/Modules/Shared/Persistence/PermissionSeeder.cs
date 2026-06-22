using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public static class PermissionSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, SeedingPolicy policy)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (policy == null) throw new ArgumentNullException(nameof(policy));

        if (!policy.SeedInfrastructure)
        {
            return;
        }

        var permissions = new List<(string Name, string DisplayName, string Description, string Module)>
        {
            ("organization:profile:edit", "Edit Profile", "Modify organization public profile, logo, and banner", "Organization"),
            ("organization:settings:edit", "Edit Settings", "Modify organization settings and metadata", "Organization"),
            ("organization:workspace:view", "View Workspace", "Read-only access to assigned workspaces and pipelines", "Workspace"),
            ("organization:roles:manage", "Manage Roles", "Create, edit, and delete custom business roles", "Business Roles"),
            ("organization:roles:view", "View Roles", "Read business roles and permission mapping matrices", "Business Roles"),
            ("organization:members:manage", "Manage Members", "Invite, suspend, and remove organization team members", "People"),
            ("organization:members:view", "View Members", "List and search organization members", "People"),
            ("identity:verification:initiate", "Initiate Verification", "Trigger identity KYC check for a candidate", "Identity"),
            ("identity:verification:approve", "Approve Identity", "Confirm candidate identity verification claims", "Identity"),
            ("identity:verification:reject", "Reject Identity", "Flag candidate identity claims as invalid or fraud", "Identity"),
            ("evidence:graph:validate", "Validate Evidence", "Endorse candidate developer evidence graph contribution blocks", "Evidence Graph"),
            ("evidence:graph:comment", "Comment on Evidence", "Leave peer evaluation comments on candidate contribution nodes", "Evidence Graph"),
            ("analysis:repository:sync", "Sync Repository", "Connect or refresh git source repositories", "Repo Analysis"),
            ("analysis:repository:run", "Run Analysis", "Trigger git code analysis and authorship scans", "Repo Analysis"),
            ("analysis:repository:configure", "Configure Analysis", "Configure analysis rules and repository ignore filters", "Repo Analysis"),
            ("trust:metric:view", "View Trust Metrics", "Read AI authorship ratios, risk scores, and code authenticity reports", "Trust Intel"),
            ("trust:flag:manage", "Manage Trust Flags", "Manually mark anomalies or override warning logs", "Trust Intel"),
            ("ai:interview:configure", "Configure AI Interviews", "Edit automated AI interview templates and parameters", "AI Interviews"),
            ("ai:interview:conduct", "Conduct AI Interviews", "Send AI technical interview session invites to candidates", "AI Interviews"),
            ("ai:interview:evaluate", "Evaluate AI Interviews", "Assess AI generated candidate interview transcripts", "AI Interviews"),
            ("candidate:trust:score", "View Trust Score", "Access aggregate candidate talent trust scorecards", "Trust Scorecard"),
            ("candidate:trust:override", "Override Trust Score", "Manually adjust candidate trust scorecards or clear fraud flags", "Trust Scorecard"),
            ("billing:invoice:view", "View Invoices", "Access invoices, billing summary, and billing cycles", "Billing"),
            ("billing:subscription:manage", "Manage Subscription", "Upgrade or modify organization subscription tiers", "Billing"),
            ("organization:audit:view", "View Audit Logs", "Read organization roles and membership audit log streams", "Audit Logs")
        };

        foreach (var perm in permissions)
        {
            var existing = await context.Permissions.FirstOrDefaultAsync(p => p.Name == perm.Name);
            if (existing == null)
            {
                context.Permissions.Add(new Permission
                {
                    Id = Guid.CreateVersion7(),
                    Name = perm.Name,
                    DisplayName = perm.DisplayName,
                    Description = perm.Description,
                    Module = perm.Module,
                    IsSystem = false,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                existing.DisplayName = perm.DisplayName;
                existing.Description = perm.Description;
                existing.Module = perm.Module;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }
        await context.SaveChangesAsync();
    }
}
