using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
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

    public WorkspaceProvisioningService(
        ApplicationDbContext context,
        ICacheService cacheService,
        TimeProvider timeProvider,
        IHttpClientFactory httpClientFactory,
        IPasswordPolicyService passwordPolicyService,
        IGoogleTokenValidator googleTokenValidator,
        IAuthService authService,
        EnvConfiguration envConfig,
        ILogger<WorkspaceProvisioningService> logger)
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



    public async Task<VerifyCompanyOnboardingResponse> VerifyCompanyOnboardingAsync(VerifyCompanyOnboardingRequest request, CancellationToken cancellationToken = default)
    {
        var taxCode = request.TaxCode.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(taxCode, @"^\d{10}(-\d{3})?$"))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Tax code format is invalid.");
        }

        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync($"https://api.vietqr.io/v2/business/{taxCode}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
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

        if (!IsFuzzyMatch(officialName, request.CompanyName))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Company name does not match the official tax registry business name.");
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
            return new VerifyCompanyOnboardingResponse(
                SignedToken: null,
                OfficialCompanyName: existingOrg.Name,
                TaxCode: existingOrg.TaxCode,
                OrganizationExists: true,
                OrganizationDisplayName: existingOrg.Name,
                OrganizationSlug: existingOrg.Username,
                RecoveryRequired: true
            );
        }

        var signedToken = OnboardingTokenHelper.GenerateStep1Token(taxCode, officialName, _envConfig.Jwt.Key);

        return new VerifyCompanyOnboardingResponse(signedToken, officialName, taxCode);
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

            var workspace = new Workspace
            {
                OrganizationId = org.Id,
                DisplayName = org.Name,
                Slug = org.Username,
                Status = "active",
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Workspaces.Add(workspace);
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

            var workspace = new Workspace
            {
                OrganizationId = org.Id,
                DisplayName = org.Name,
                Slug = org.Username,
                Status = "active",
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Workspaces.Add(workspace);
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
}
