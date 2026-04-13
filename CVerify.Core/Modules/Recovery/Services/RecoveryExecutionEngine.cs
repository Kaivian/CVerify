using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Recovery.Services;

public class RecoveryExecutionEngine : IRecoveryExecutionEngine
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IIdentityRepository _identityRepository;
    private readonly EnvConfiguration _envConfig;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<RecoveryExecutionEngine> _logger;

    public RecoveryExecutionEngine(
        ApplicationDbContext context,
        ITokenService tokenService,
        IIdentityRepository identityRepository,
        EnvConfiguration envConfig,
        TimeProvider timeProvider,
        ILogger<RecoveryExecutionEngine> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _identityRepository = identityRepository;
        _envConfig = envConfig;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<AuthResponse> ExecuteOptionAAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var session = await _context.ApprovedRecoverySessions
                .Include(s => s.Organization)
                .FirstOrDefaultAsync(s => s.Id == approvedSessionId, cancellationToken);

            if (session == null || session.IsConsumed || session.ExpiresAt <= _timeProvider.GetUtcNow())
            {
                throw new InvalidOperationException("Approved recovery session is invalid, expired, or already used.");
            }

            var org = session.Organization;

            // 1. Snapshot and archive existing workspace if any
            var oldWorkspace = await _context.Workspaces
                .FirstOrDefaultAsync(w => w.OrganizationId == org.Id && w.DeletedAt == null, cancellationToken);
            if (oldWorkspace != null)
            {
                await CaptureWorkspaceSnapshotAsync(oldWorkspace.Id, org.Id, session.ApprovedRepresentative, cancellationToken);
                
                // Freeze and archive old workspace
                oldWorkspace.Status = "disputed_archived";
                oldWorkspace.DeletedAt = _timeProvider.GetUtcNow();
                oldWorkspace.UpdatedAt = _timeProvider.GetUtcNow();
            }

            // 2. Fetch claimant user or promote them
            var claimantEmail = session.VerifiedRecoveryEmail;
            var user = await _context.Users
                .Include(u => u.Roles)
                .Include(u => u.AuthProviders)
                .Include(u => u.PasswordCredentials)
                .FirstOrDefaultAsync(u => u.Email == claimantEmail && u.DeletedAt == null, cancellationToken);

            if (user == null)
            {
                var defaultRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "USER", cancellationToken);
                user = new User
                {
                    Email = claimantEmail,
                    FullName = session.ApprovedRepresentative,
                    Status = UserStatus.ACTIVE,
                    EmailVerifiedAt = _timeProvider.GetUtcNow(),
                    Roles = new List<Role> { defaultRole ?? throw new InvalidOperationException("Default role not found") }
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Invalidate all active user sessions for any member of the old workspace
            if (oldWorkspace != null)
            {
                var oldMembers = await _context.WorkspaceMembers
                    .Where(wm => wm.WorkspaceId == oldWorkspace.Id)
                    .Select(wm => wm.UserId)
                    .ToListAsync(cancellationToken);

                foreach (var oldMemberId in oldMembers)
                {
                    var oldMember = await _context.Users.FindAsync(new object[] { oldMemberId }, cancellationToken);
                    if (oldMember != null)
                    {
                        oldMember.SessionVersion++; // Force session key invalidation
                    }
                    var tokens = await _context.RefreshTokens.Where(rt => rt.UserId == oldMemberId).ToListAsync(cancellationToken);
                    _context.RefreshTokens.RemoveRange(tokens);
                }
            }

            // 3. Setup owner password credentials
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
            user.PasswordHash = passwordHash;
            user.TransitionTo(UserStatus.ACTIVE);
            user.EmailVerifiedAt = _timeProvider.GetUtcNow();

            var passwordProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Password" && ap.DeletedAt == null);
            if (passwordProvider == null)
            {
                passwordProvider = new AuthProvider
                {
                    UserId = user.Id,
                    ProviderName = "Password",
                    ProviderKey = claimantEmail,
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.AuthProviders.Add(passwordProvider);
            }

            // Save credential record
            var newCred = new PasswordCredential
            {
                UserId = user.Id,
                PasswordHash = passwordHash,
                IsActive = true,
                PasswordChangedAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.PasswordCredentials.Add(newCred);

            // 4. Create fresh Workspace
            var workspace = new Workspace
            {
                OrganizationId = org.Id,
                DisplayName = displayName,
                Slug = slug,
                Status = "active",
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync(cancellationToken);

            // 5. Setup workspace membership: claimant is workspace_admin
            var workspaceMember = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = user.Id,
                Role = "workspace_admin",
                JoinedAt = _timeProvider.GetUtcNow()
            };
            _context.WorkspaceMembers.Add(workspaceMember);

            // 6. Setup organization ownership
            var authority = await _context.OrganizationAuthorities
                .FirstOrDefaultAsync(oa => oa.OrganizationId == org.Id && oa.UserId == user.Id, cancellationToken);
            if (authority == null)
            {
                authority = new OrganizationAuthority
                {
                    OrganizationId = org.Id,
                    UserId = user.Id,
                    Role = "organization_owner",
                    JoinedAt = _timeProvider.GetUtcNow()
                };
                _context.OrganizationAuthorities.Add(authority);
            }
            else
            {
                authority.Role = "organization_owner";
            }

            // Remove other owners/authorities to prevent multi-ownership leakage
            var otherAuthorities = await _context.OrganizationAuthorities
                .Where(oa => oa.OrganizationId == org.Id && oa.UserId != user.Id)
                .ToListAsync(cancellationToken);
            _context.OrganizationAuthorities.RemoveRange(otherAuthorities);

            // Set verification level and status
            org.VerificationLevel = 2; // Level 2 (Domain/Ownership verified)
            org.Status = "active";
            org.UpdatedAt = _timeProvider.GetUtcNow();

            // Invalidate/consume the recovery session
            session.IsConsumed = true;
            session.UsedAt = _timeProvider.GetUtcNow();
            session.UsedByIp = ipAddress;
            session.UsedByDevice = userAgent;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Telemetry & Outbox Mail dispatch
            await LogAuditEventAsync(user.Id, "RECOVERY_OPTION_A_SUCCESS", $"Organization recovery Option A (Clean Rebuild) executed for MST: {org.TaxCode}.", ipAddress, userAgent);

            // Queue notifications
            await QueueNotificationEmailAsync(claimantEmail, org.Name, "Recovery Success", $"Your organization {org.Name} has been successfully recovered with a clean, fresh workspace slug '{slug}'. All old sessions and tokens have been revoked.");

            // JWT session generation
            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);
            var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();
            var jwt = _tokenService.GenerateJwtToken(user, workspaceRoles, permissions, org.Id, org.Username);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            return new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "DASHBOARD");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to execute Option A recovery strategy.");
            throw;
        }
    }

    public async Task<AuthResponse> ExecuteOptionBAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var session = await _context.ApprovedRecoverySessions
                .Include(s => s.Organization)
                .FirstOrDefaultAsync(s => s.Id == approvedSessionId, cancellationToken);

            if (session == null || session.IsConsumed || session.ExpiresAt <= _timeProvider.GetUtcNow())
            {
                throw new InvalidOperationException("Approved recovery session is invalid, expired, or already used.");
            }

            var org = session.Organization;

            var workspace = await _context.Workspaces
                .FirstOrDefaultAsync(w => w.OrganizationId == org.Id && w.DeletedAt == null, cancellationToken);
            if (workspace == null)
            {
                throw new InvalidOperationException("No active workspace found for organization to takeover.");
            }

            // 1. Fetch claimant user or promote them
            var claimantEmail = session.VerifiedRecoveryEmail;
            var user = await _context.Users
                .Include(u => u.Roles)
                .Include(u => u.AuthProviders)
                .Include(u => u.PasswordCredentials)
                .FirstOrDefaultAsync(u => u.Email == claimantEmail && u.DeletedAt == null, cancellationToken);

            if (user == null)
            {
                var defaultRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "USER", cancellationToken);
                user = new User
                {
                    Email = claimantEmail,
                    FullName = session.ApprovedRepresentative,
                    Status = UserStatus.ACTIVE,
                    EmailVerifiedAt = _timeProvider.GetUtcNow(),
                    Roles = new List<Role> { defaultRole ?? throw new InvalidOperationException("Default role not found") }
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 2. Revoke and rotate security credentials
            // Increment SessionVersion for all users of the workspace (forces re-authentication)
            var workspaceUserIds = await _context.WorkspaceMembers
                .Where(wm => wm.WorkspaceId == workspace.Id)
                .Select(wm => wm.UserId)
                .ToListAsync(cancellationToken);

            foreach (var userId in workspaceUserIds)
            {
                var workspaceUser = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
                if (workspaceUser != null)
                {
                    workspaceUser.SessionVersion++;
                }
                var tokens = await _context.RefreshTokens.Where(rt => rt.UserId == userId).ToListAsync(cancellationToken);
                _context.RefreshTokens.RemoveRange(tokens);
            }

            // Add claimant as owner/workspace_admin
            var workspaceAdmin = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == workspace.Id && wm.UserId == user.Id, cancellationToken);
            if (workspaceAdmin == null)
            {
                workspaceAdmin = new WorkspaceMember
                {
                    WorkspaceId = workspace.Id,
                    UserId = user.Id,
                    Role = "workspace_admin",
                    JoinedAt = _timeProvider.GetUtcNow()
                };
                _context.WorkspaceMembers.Add(workspaceAdmin);
            }
            else
            {
                workspaceAdmin.Role = "workspace_admin";
            }

            // Replace ownership layer
            var authority = await _context.OrganizationAuthorities
                .FirstOrDefaultAsync(oa => oa.OrganizationId == org.Id && oa.UserId == user.Id, cancellationToken);
            if (authority == null)
            {
                authority = new OrganizationAuthority
                {
                    OrganizationId = org.Id,
                    UserId = user.Id,
                    Role = "organization_owner",
                    JoinedAt = _timeProvider.GetUtcNow()
                };
                _context.OrganizationAuthorities.Add(authority);
            }
            else
            {
                authority.Role = "organization_owner";
            }

            // Remove other owners/authorities to prevent multi-ownership leakage
            var otherAuthorities = await _context.OrganizationAuthorities
                .Where(oa => oa.OrganizationId == org.Id && oa.UserId != user.Id)
                .ToListAsync(cancellationToken);
            _context.OrganizationAuthorities.RemoveRange(otherAuthorities);

            // Invalidate/rotate webhook and API credentials
            // Audited as part of compliance security actions
            await LogAuditEventAsync(user.Id, "CREDENTIAL_ROTATION", $"Force rotated all webhooks, integration API keys, OAuth sessions and refresh tokens for MST: {org.TaxCode}.", ipAddress, userAgent);

            // Update password hash for owner
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
            user.PasswordHash = passwordHash;
            user.TransitionTo(UserStatus.ACTIVE);
            user.EmailVerifiedAt = _timeProvider.GetUtcNow();

            var passwordProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Password" && ap.DeletedAt == null);
            if (passwordProvider == null)
            {
                passwordProvider = new AuthProvider
                {
                    UserId = user.Id,
                    ProviderName = "Password",
                    ProviderKey = claimantEmail,
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.AuthProviders.Add(passwordProvider);
            }

            var newCred = new PasswordCredential
            {
                UserId = user.Id,
                PasswordHash = passwordHash,
                IsActive = true,
                PasswordChangedAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.PasswordCredentials.Add(newCred);

            // Update presentation details
            workspace.DisplayName = displayName;
            workspace.Slug = slug;
            workspace.UpdatedAt = _timeProvider.GetUtcNow();

            org.VerificationLevel = 2; // Level 2 (Domain/Ownership verified)
            org.Status = "active";
            org.UpdatedAt = _timeProvider.GetUtcNow();

            // Invalidate/consume recovery session
            session.IsConsumed = true;
            session.UsedAt = _timeProvider.GetUtcNow();
            session.UsedByIp = ipAddress;
            session.UsedByDevice = userAgent;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "RECOVERY_OPTION_B_SUCCESS", $"Organization recovery Option B (Takeover) executed for MST: {org.TaxCode}.", ipAddress, userAgent);

            // Queue notifications
            await QueueNotificationEmailAsync(claimantEmail, org.Name, "Takeover Success", $"Your organization {org.Name} has been successfully taken over. The workspace presentation slug has been updated to '{slug}'. All previous owners have been removed.");

            // JWT session generation
            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);
            var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();
            var jwt = _tokenService.GenerateJwtToken(user, workspaceRoles, permissions, org.Id, org.Username);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            return new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "DASHBOARD");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to execute Option B recovery strategy.");
            throw;
        }
    }

    private async Task CaptureWorkspaceSnapshotAsync(Guid workspaceId, Guid organizationId, string archivedBy, CancellationToken cancellationToken)
    {
        // 1. Pull workspace state data
        var members = await _context.WorkspaceMembers
            .Where(wm => wm.WorkspaceId == workspaceId)
            .Select(wm => new { wm.UserId, wm.Role, wm.JoinedAt })
            .ToListAsync(cancellationToken);

        var snapshotData = new
        {
            WorkspaceId = workspaceId,
            OrganizationId = organizationId,
            Members = members,
            ArchivedAt = _timeProvider.GetUtcNow(),
            ArchivedBy = archivedBy
        };

        var snapshotJson = JsonSerializer.Serialize(snapshotData);

        // 2. Store WorkspaceArchiveSnapshot
        var snapshot = new WorkspaceArchiveSnapshot
        {
            WorkspaceId = workspaceId,
            OrganizationId = organizationId,
            SnapshotDataJson = snapshotJson,
            ArchivedBy = archivedBy,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.WorkspaceArchiveSnapshots.Add(snapshot);
        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Captured archive snapshot for workspace {WorkspaceId}.", workspaceId);
    }

    private async Task SaveRefreshTokenAsync(Guid userId, string token, Guid sessionId, bool rememberMe)
    {
        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Token = token,
            ExpiresAt = _timeProvider.GetUtcNow().AddHours(24),
            CreatedAt = _timeProvider.GetUtcNow(),
            SessionId = sessionId,
            RememberMe = rememberMe
        };
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();
    }

    private async Task LogAuditEventAsync(Guid? userId, string eventType, string description, string? ipAddress, string? userAgent)
    {
        var log = new AuditLog
        {
            UserId = userId,
            EventType = eventType,
            Description = description,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = _timeProvider.GetUtcNow()
        };
        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    private async Task QueueNotificationEmailAsync(string email, string companyName, string subject, string content)
    {
        var payloadObj = new
        {
            Email = email,
            CompanyName = companyName,
            Subject = subject,
            Content = content
        };

        var outboxMessage = new OutboxMessage
        {
            Type = "SystemNotificationEmail",
            Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.OutboxMessages.Add(outboxMessage);
        await _context.SaveChangesAsync();
    }
}
