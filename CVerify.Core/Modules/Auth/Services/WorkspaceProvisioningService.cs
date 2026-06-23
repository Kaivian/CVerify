using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Polly;
using Polly.Retry;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Google.Apis.Auth;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services.PasswordPolicies;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

public class WorkspaceProvisioningService : IWorkspaceProvisioningService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly TimeProvider _timeProvider;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IPasswordPolicyService _passwordPolicyService;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly IAuthService _authService;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<WorkspaceProvisioningService> _logger;
    private readonly IWorkspaceMembershipService _workspaceMembershipService;
    private readonly IOrganizationBootstrapService _bootstrapService;

    public WorkspaceProvisioningService(
        ApplicationDbContext context,
        ICacheService cacheService,
        TimeProvider timeProvider,
        IHttpClientFactory httpClientFactory,
        IPasswordPolicyService passwordPolicyService,
        IGoogleTokenValidator googleTokenValidator,
        IAuthService authService,
        EnvConfiguration envConfig,
        ILogger<WorkspaceProvisioningService> logger,
        IWorkspaceMembershipService workspaceMembershipService,
        IOrganizationBootstrapService bootstrapService)
    {
        _context = context;
        _cacheService = cacheService;
        _timeProvider = timeProvider;
        _httpClientFactory = httpClientFactory;
        _passwordPolicyService = passwordPolicyService;
        _googleTokenValidator = googleTokenValidator;
        _authService = authService;
        _envConfig = envConfig;
        _logger = logger;
        _workspaceMembershipService = workspaceMembershipService;
        _bootstrapService = bootstrapService;
    }

    private string NormalizeEmailPolicy(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private bool IsFuzzyMatch(string officialName, string inputName)
    {
        if (string.IsNullOrWhiteSpace(officialName) || string.IsNullOrWhiteSpace(inputName))
            return false;

        var cleanOfficial = NormalizeCompanyNameForMatching(officialName);
        var cleanInput = NormalizeCompanyNameForMatching(inputName);

        if (cleanOfficial == cleanInput) return true;
        if (cleanOfficial.Contains(cleanInput) || cleanInput.Contains(cleanOfficial)) return true;

        int distance = LevenshteinDistance(cleanOfficial, cleanInput);
        int maxLength = Math.Max(cleanOfficial.Length, cleanInput.Length);
        double similarity = 1.0 - ((double)distance / maxLength);

        return similarity >= 0.75;
    }

    private string NormalizeCompanyNameForMatching(string name)
    {
        var clean = name.ToLowerInvariant();
        clean = clean.Replace("công ty", "")
                     .Replace("tnhh", "")
                     .Replace("cổ phần", "")
                     .Replace("cp", "")
                     .Replace("thành viên", "")
                     .Replace("một thành viên", "")
                     .Replace("1 thành viên", "")
                     .Replace("doanh nghiệp", "")
                     .Replace("tập đoàn", "")
                     .Replace("phát triển", "")
                     .Replace("dịch vụ", "")
                     .Replace("thương mại", "")
                     .Replace("sản xuất", "")
                     .Replace("đầu tư", "")
                     .Replace("quốc tế", "")
                     .Replace("việt nam", "")
                     .Replace("vietnam", "");
                     
        var charArray = clean.Where(c => char.IsLetterOrDigit(c)).ToArray();
        return new string(charArray);
    }

    private int LevenshteinDistance(string s, string t)
    {
        if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t)) return s.Length;

        int n = s.Length;
        int m = t.Length;
        int[,] d = new int[n + 1, m + 1];

        for (int i = 0; i <= n; d[i, 0] = i++) ;
        for (int j = 0; j <= m; d[0, j] = j++) ;

        for (int i = 1; i <= n; i++)
        {
            for (int j = 1; j <= m; j++)
            {
                int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }
        return d[n, m];
    }

    private bool IsImpersonatingBrand(string organizationUsername)
    {
        var blocklist = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "google", "facebook", "microsoft", "github", "linkedin", "apple", "twitter", "stripe", "amazon", "netflix"
        };
        return blocklist.Contains(organizationUsername);
    }

    private bool ConstantTimeEquals(string a, string b)
    {
        if (a == null || b == null) return false;
        if (a.Length != b.Length) return false;
        int result = 0;
        for (int i = 0; i < a.Length; i++)
        {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }

    private async Task<bool> ValidateEmailDomainMxAsync(string email)
    {
        try
        {
            var parts = email.Split('@');
            if (parts.Length != 2) return false;
            var domain = parts[1];
            var addresses = await System.Net.Dns.GetHostAddressesAsync(domain);
            return addresses != null && addresses.Length > 0;
        }
        catch (Exception)
        {
            return false;
        }
    }



    private async Task<HttpResponseMessage> SendVietQrRequestWithRetryAsync(string taxCode, CancellationToken cancellationToken)
    {
        var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
            .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                MaxRetryAttempts = 1,
                Delay = TimeSpan.FromSeconds(1),
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .HandleResult(r => (int)r.StatusCode >= 500 || r.StatusCode == HttpStatusCode.RequestTimeout)
                    .Handle<HttpRequestException>()
                    .Handle<TaskCanceledException>(ex => !cancellationToken.IsCancellationRequested),
                OnRetry = args =>
                {
                    _logger.LogWarning(
                        "VietQR lookup transient failure (attempt {Attempt}). Retrying in {Delay}s for tax code {TaxCode}.",
                        args.AttemptNumber + 1, args.RetryDelay.TotalSeconds, taxCode);
                    return ValueTask.CompletedTask;
                }
            })
            .Build();

        return await pipeline.ExecuteAsync(async ct =>
        {
            var client = _httpClientFactory.CreateClient("VietQR");
            return await client.GetAsync($"v2/business/{taxCode}", ct);
        }, cancellationToken);
    }

    public async Task<VerifyOrganizationOnboardingResponse> VerifyOrganizationOnboardingAsync(VerifyOrganizationOnboardingRequest request, CancellationToken cancellationToken = default)
    {
        var taxCode = request.TaxCode.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(taxCode, @"^\d{10}(-\d{3})?$"))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Tax code format is invalid.");
        }

        var response = await SendVietQrRequestWithRetryAsync(taxCode, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var statusCode = (int)response.StatusCode;
            _logger.LogWarning("VietQR business registry lookup returned HTTP {StatusCode} for tax code {TaxCode}.", statusCode, taxCode);

            if (statusCode >= 500 || response.StatusCode == HttpStatusCode.RequestTimeout)
            {
                throw new AuthException(AuthErrorCodes.ServiceUnavailable, "The business registry service is temporarily unavailable. Please try again.");
            }

            throw new AuthException(AuthErrorCodes.InvalidCredentials, "The business tax registry lookup failed.");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        
        if (!root.TryGetProperty("code", out var codeProp) || codeProp.GetString() != "00")
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Invalid business tax code.");
        }

        if (!root.TryGetProperty("data", out var dataElement) || dataElement.ValueKind == System.Text.Json.JsonValueKind.Null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "No business record found matching this tax code.");
        }

        var officialName = dataElement.GetProperty("name").GetString() ?? string.Empty;
        var status = dataElement.GetProperty("status").GetString() ?? string.Empty;

        if (!status.Contains("đang hoạt động", StringComparison.OrdinalIgnoreCase))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"This company is inactive/suspended: {status}.");
        }

        if (!IsFuzzyMatch(officialName, request.OrganizationName))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Organization name does not match the official tax registry business name.");
        }

        var existingOrg = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == taxCode && o.DeletedAt == null, cancellationToken);

        if (existingOrg == null)
        {
            var normalizedOfficial = NormalizeCompanyNameForMatching(officialName);
            var allActiveOrgs = await _context.Organizations
                .Where(o => o.DeletedAt == null)
                .ToListAsync(cancellationToken);

            existingOrg = allActiveOrgs.FirstOrDefault(o => NormalizeCompanyNameForMatching(o.Name) == normalizedOfficial);
        }

        if (existingOrg != null)
        {
            return new VerifyOrganizationOnboardingResponse(
                SignedToken: null,
                OfficialOrganizationName: existingOrg.Name,
                TaxCode: existingOrg.TaxCode,
                OrganizationExists: true,
                OrganizationDisplayName: existingOrg.Name,
                OrganizationSlug: existingOrg.Username,
                RecoveryRequired: true
            );
        }

        var signedToken = OnboardingTokenHelper.GenerateStep1Token(taxCode, officialName, _envConfig.Jwt.Key);

        return new VerifyOrganizationOnboardingResponse(signedToken, officialName, taxCode);
    }

    public async Task<VerifyOtpResponse> VerifyOnboardingOtpAsync(VerifyOtpRequest request, string step1Token, CancellationToken cancellationToken = default)
    {
        var step1Payload = OnboardingTokenHelper.VerifyToken(step1Token, _envConfig.Jwt.Key);
        if (step1Payload == null || step1Payload["step"] != "1")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Company verification context is invalid or expired.");
        }

        var taxCode = step1Payload["taxCode"];
        var companyName = step1Payload["companyName"];

        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        if (!await ValidateEmailDomainMxAsync(normalizedEmail))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Email domain does not resolve to active mail hosts.");
        }

        await _authService.VerifyOtpAsync(request, cancellationToken);

        var signedStep2Token = OnboardingTokenHelper.GenerateStep2Token(taxCode, companyName, normalizedEmail, false, _envConfig.Jwt.Key);

        return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, signedStep2Token);
    }

    public async Task<VerifyOtpResponse> VerifyOnboardingGoogleAsync(GoogleOnboardingLinkRequest request, CancellationToken cancellationToken = default)
    {
        var step1Payload = OnboardingTokenHelper.VerifyToken(request.Step1Token, _envConfig.Jwt.Key);
        if (step1Payload == null || step1Payload["step"] != "1")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Company verification context is invalid or expired.");
        }

        var taxCode = step1Payload["taxCode"];
        var companyName = step1Payload["companyName"];

        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _envConfig.Auth.GoogleClientId },
            IssuedAtClockTolerance = TimeSpan.FromMinutes(5),
            ExpirationTimeClockTolerance = TimeSpan.FromMinutes(5)
        };

        var payload = await _googleTokenValidator.ValidateAsync(request.IdToken, settings);
        if (payload == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Google ID token validation failed.");
        }

        var googleEmail = NormalizeEmailPolicy(payload.Email);

        var signedStep2Token = OnboardingTokenHelper.GenerateStep2Token(taxCode, companyName, googleEmail, true, _envConfig.Jwt.Key);

        return new VerifyOtpResponse(Guid.Empty, googleEmail, signedStep2Token);
    }

    public async Task<SetupWorkspaceResponse> CompleteOnboardingAsync(CompleteOnboardingRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Default");

        var step2Payload = OnboardingTokenHelper.VerifyToken(request.Step2Token, _envConfig.Jwt.Key);
        if (step2Payload == null || step2Payload["step"] != "2")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Onboarding session is invalid or expired.");
        }

        var taxCode = step2Payload["taxCode"];
        var companyName = step2Payload["companyName"];
        var email = step2Payload["email"];

        var normalizedSlug = request.OrganizationUsername.Trim().ToLowerInvariant();
        if (!System.Text.RegularExpressions.Regex.IsMatch(normalizedSlug, @"^[a-z0-9-]{4,32}$"))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Slug must be 4-32 alphanumeric or dash characters.");
        }

        var reservedList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "admin", "root", "support", "system", "api", "cverify", "auth", "login", "workspace", "billing"
        };
        if (reservedList.Contains(normalizedSlug))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"The handle '{request.OrganizationUsername}' is a reserved keyword.");
        }

        if (IsImpersonatingBrand(normalizedSlug))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Impersonation of protected brands is prohibited.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingOrg = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Username == normalizedSlug && o.DeletedAt == null, cancellationToken);
            if (existingOrg != null)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization handle is already taken.");
            }

            var org = new Organization
            {
                Name = companyName,
                TaxCode = taxCode,
                Email = email,
                Username = normalizedSlug,
                IsVerified = true,
                VerificationLevel = 1,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Organizations.Add(org);
            await _context.SaveChangesAsync(cancellationToken);



            var credential = new OrganizationCredential
            {
                OrganizationId = org.Id,
                Username = org.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FailedLoginAttempts = 0,
                LockoutEnd = null,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.OrganizationCredentials.Add(credential);
            await _context.SaveChangesAsync(cancellationToken);

            var verification = new OrganizationVerification
            {
                OrganizationId = org.Id,
                VerificationType = "Legal",
                IsVerified = true,
                VerifiedValue = taxCode,
                VerifiedAt = _timeProvider.GetUtcNow(),
                VerifiedBy = "System_VietQR_Lookups",
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    OfficialCompanyName = companyName,
                    TaxCode = taxCode,
                    VerifiedAt = DateTimeOffset.UtcNow,
                    ClientIp = ipAddress,
                    ClientAgent = userAgent
                })
            };
            _context.OrganizationVerifications.Add(verification);
            await _context.SaveChangesAsync(cancellationToken);

            // Seed default roles for the tenant (idempotent, does not require a User to exist)
            await _bootstrapService.SeedDefaultRolesForTenantAsync(org.Id, cancellationToken);

            // Link existing active user immediately or create pending organization ownership
            var normalizedEmail = NormalizeEmailPolicy(org.Email);
            var repUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);
            if (repUser != null && repUser.Status == Shared.Domain.Enums.UserStatus.ACTIVE)
            {
                await _workspaceMembershipService.BootstrapInitialAdminAsync(org.Email, false, cancellationToken);
            }
            else
            {
                var pendingOwnership = new PendingOrganizationOwnership
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    OwnerEmail = normalizedEmail,
                    CreatedAt = _timeProvider.GetUtcNow(),
                    ExpiresAt = _timeProvider.GetUtcNow().AddDays(30)
                };
                _context.PendingOrganizationOwnerships.Add(pendingOwnership);

                // Also write a pending OrganizationInvitation for the representative
                var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
                var tokenHash = ComputeSha256(rawToken);
                var invitation = new OrganizationInvitation
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    InviteeEmail = normalizedEmail,
                    TokenHash = tokenHash,
                    InvitedByUserId = null,
                    Status = "Pending",
                    CreatedAt = _timeProvider.GetUtcNow(),
                    ExpiresAt = _timeProvider.GetUtcNow().AddDays(30)
                };
                _context.OrganizationInvitations.Add(invitation);

                // Pre-assign the "owner" role to the invitation
                var ownerRole = await _context.Roles.FirstOrDefaultAsync(r => r.TenantId == org.Id && r.Name == "owner" && r.Domain == "TENANT", cancellationToken);
                if (ownerRole != null)
                {
                    var invitationRole = new OrganizationInvitationRole
                    {
                        Id = Guid.CreateVersion7(),
                        InvitationId = invitation.Id,
                        RoleId = ownerRole.Id,
                        ScopeType = "ORGANIZATION",
                        ScopeId = org.Id
                    };
                    _context.OrganizationInvitationRoles.Add(invitationRole);
                }

                await _context.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            return new SetupWorkspaceResponse(true, org.Email, org.Username);
        }
        catch (DbUpdateException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Concurrency or duplicate database constraint triggered during workspace provisioning.");
            var exString = ex.ToString();
            if (exString.Contains("tax_code") || ex.InnerException?.Message.Contains("tax_code") == true)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This company has already been onboarded.", ex);
            }
            if (exString.Contains("username") || exString.Contains("organizations") || ex.InnerException?.Message.Contains("username") == true)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization handle is already taken.", ex);
            }
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Workspace provisioning conflict.", ex);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed during complete onboarding workspace provision.");
            throw;
        }
    }

    public async Task<SetupWorkspaceResponse> SetupWorkspaceAsync(SetupWorkspaceRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmailPolicy(request.CompanyEmail);
        var cachedToken = await _cacheService.GetAsync<string>($"workspace:token:{normalizedEmail}");

        if (cachedToken == null || !ConstantTimeEquals(cachedToken, request.VerificationToken))
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The workspace setup session has expired or is invalid.");
        }

        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Default");

        var reservedUsernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "admin", "support", "api", "auth", "login", "billing", "security", "careers", "jobs", "cverify", "system", "root", "portal"
        };
        var normalizedUsername = request.OrganizationUsername.Trim().ToLowerInvariant();
        if (reservedUsernames.Contains(normalizedUsername))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"The workspace username '{request.OrganizationUsername}' is reserved.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingOrg = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Username == normalizedUsername && o.DeletedAt == null, cancellationToken);
            if (existingOrg != null)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization workspace username is already taken.");
            }

            var link = await _context.VerificationLinks
                .Where(vl => vl.Email == normalizedEmail && vl.Purpose == "CompanyVerification" && vl.DeletedAt == null)
                .OrderByDescending(vl => vl.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (link == null)
            {
                throw new AuthException(AuthErrorCodes.InvalidToken, "Company ownership details not found.");
            }

            var org = new Organization
            {
                Name = link.CompanyName ?? "Default Organization",
                TaxCode = link.TaxCode ?? string.Empty,
                Email = normalizedEmail,
                Username = normalizedUsername,
                IsVerified = true,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Organizations.Add(org);
            await _context.SaveChangesAsync(cancellationToken);



            var credential = new OrganizationCredential
            {
                OrganizationId = org.Id,
                Username = org.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FailedLoginAttempts = 0,
                LockoutEnd = null,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.OrganizationCredentials.Add(credential);
            await _context.SaveChangesAsync(cancellationToken);

            link.UserId = null;
            link.OrganizationId = org.Id;
            await _context.SaveChangesAsync(cancellationToken);

            // Seed default roles for the tenant (idempotent, does not require a User to exist)
            await _bootstrapService.SeedDefaultRolesForTenantAsync(org.Id, cancellationToken);

            // Link existing active user immediately or create pending organization ownership
            var repEmail = NormalizeEmailPolicy(org.Email);
            var repUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == repEmail && u.DeletedAt == null, cancellationToken);
            if (repUser != null && repUser.Status == Shared.Domain.Enums.UserStatus.ACTIVE)
            {
                await _workspaceMembershipService.BootstrapInitialAdminAsync(org.Email, false, cancellationToken);
            }
            else
            {
                var pendingOwnership = new PendingOrganizationOwnership
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    OwnerEmail = repEmail,
                    CreatedAt = _timeProvider.GetUtcNow(),
                    ExpiresAt = _timeProvider.GetUtcNow().AddDays(30)
                };
                _context.PendingOrganizationOwnerships.Add(pendingOwnership);

                // Also write a pending OrganizationInvitation for the representative
                var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
                var tokenHash = ComputeSha256(rawToken);
                var invitation = new OrganizationInvitation
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    InviteeEmail = repEmail,
                    TokenHash = tokenHash,
                    InvitedByUserId = null,
                    Status = "Pending",
                    CreatedAt = _timeProvider.GetUtcNow(),
                    ExpiresAt = _timeProvider.GetUtcNow().AddDays(30)
                };
                _context.OrganizationInvitations.Add(invitation);

                // Pre-assign the "owner" role to the invitation
                var ownerRole = await _context.Roles.FirstOrDefaultAsync(r => r.TenantId == org.Id && r.Name == "owner" && r.Domain == "TENANT", cancellationToken);
                if (ownerRole != null)
                {
                    var invitationRole = new OrganizationInvitationRole
                    {
                        Id = Guid.CreateVersion7(),
                        InvitationId = invitation.Id,
                        RoleId = ownerRole.Id,
                        ScopeType = "ORGANIZATION",
                        ScopeId = org.Id
                    };
                    _context.OrganizationInvitationRoles.Add(invitationRole);
                }

                await _context.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            await _cacheService.RemoveAsync($"workspace:token:{normalizedEmail}");

            return new SetupWorkspaceResponse(true, org.Email, org.Username);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Workspace setup flow failed.");
            throw;
        }
    }

    private string ComputeSha256(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
