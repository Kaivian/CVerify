using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using FluentAssertions;
using Xunit;
using Moq;
using Google.Apis.Auth;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.Controllers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.Storage.Constants;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Shared.Storage.DTOs;

namespace CVerify.API.IntegrationTests.Auth;

[Collection("Shared Containers Collection")]
public class UserRequestedProfileFlowsTests : BaseIntegrationTest
{
    private readonly WebApplicationFactory<Program> _customFactory;
    private readonly HttpClient _client;
    private readonly Mock<IStorageService> _mockStorage;
    private readonly Mock<IGoogleTokenValidator> _mockGoogleValidator;
    private readonly MockProfileHttpMessageHandler _mockProfileHttpMessageHandler;

    public UserRequestedProfileFlowsTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
        _mockProfileHttpMessageHandler = new MockProfileHttpMessageHandler();
        _mockStorage = new Mock<IStorageService>();
        _mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-1111.png",
                MimeType = "image/png",
                Size = 100
            });
        _mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-1111.png");

        _mockGoogleValidator = new Mock<IGoogleTokenValidator>();
        
        _customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Enforce Rate Limits & Cooldowns
                var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(EnvConfiguration));
                if (descriptor != null)
                {
                    EnvConfiguration originalConfig;
                    if (descriptor.ImplementationInstance is EnvConfiguration instance)
                    {
                        originalConfig = instance;
                    }
                    else
                    {
                        using var tempProvider = services.BuildServiceProvider();
                        originalConfig = tempProvider.GetRequiredService<EnvConfiguration>();
                    }
                    originalConfig.Security.DisableRateLimits = false;
                    services.Replace(ServiceDescriptor.Singleton<EnvConfiguration>(originalConfig));
                }

                // Inject Mock Storage
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));

                // Inject Mock Google ID Token Validator
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => _mockGoogleValidator.Object));

                // Inject Mock IHttpClientFactory
                var mockHttpClientFactory = new Mock<IHttpClientFactory>();
                var mockClient = new HttpClient(_mockProfileHttpMessageHandler)
                {
                    BaseAddress = new Uri("https://localhost")
                };
                mockHttpClientFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(mockClient);
                services.Replace(ServiceDescriptor.Singleton<IHttpClientFactory>(mockHttpClientFactory.Object));
            });
        });

        _client = _customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
    }

    private async Task SeedDefaultRolesAsync()
    {
        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new Role
            {
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic app access",
                IsSystem = true,
                IsActive = true
            });
        }
        await db.SaveChangesAsync();
    }

    private async Task<(User User, HttpClient Client)> CreateAuthenticatedUserAsync(string email, string username, string password = "SecurePassword123!")
    {
        await SeedDefaultRolesAsync();
        
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
            var user = new UserBuilder()
                .WithEmail(email)
                .WithUsername(username)
                .WithFullName("Luc Profile User")
                .WithPassword(password)
                .WithStatus(UserStatus.ACTIVE)
                .WithRole(userRole)
                .Build();
            
            db.Users.Add(user);
            await db.SaveChangesAsync();
            
            var profile = new UserProfile
            {
                UserId = user.Id,
                Username = user.Username,
                Bio = "Original Bio",
                Location = "Hanoi",
                PhoneNumber = "+84901234567",
                ProfileVisibility = "public",
                RecruiterVisibility = true,
                AiTalentDiscovery = "disabled",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.UserProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        var loginClient = _customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await loginClient.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var authenticatedClient = _customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
        authenticatedClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var seededUser = await db.Users.Include(u => u.AuthProviders).FirstAsync(u => u.Email == email);
            return (seededUser, authenticatedClient);
        }
    }

    // ==========================================
    // VIEW PROFILE TESTS (PROF-001 - PROF-003)
    // ==========================================

    [Fact]
    public async Task PROF_001_View_Own_Profile_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof001@gmail.com", "prof001user");

        var response = await client.GetAsync("/api/v1/users/profile");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var profile = await response.Content.ReadFromJsonAsync<ProfileResponse>();
        profile.Should().NotBeNull();
        profile!.UserId.Should().Be(user.Id);
        profile.Username.Should().Be(user.Username);
        profile.FullName.Should().Be("Luc Profile User");
        profile.Bio.Should().Be("Original Bio");
        profile.Location.Should().Be("Hanoi");
    }

    [Fact]
    public async Task PROF_002_View_Public_Profile_Other_User_Success()
    {
        var (otherUser, _) = await CreateAuthenticatedUserAsync("prof002@gmail.com", "prof002user");

        var response = await _client.GetAsync($"/api/v1/users/profile/public/{otherUser.Username}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var publicProfile = await response.Content.ReadFromJsonAsync<PublicProfileResponse>();
        publicProfile.Should().NotBeNull();
        publicProfile!.Username.Should().Be(otherUser.Username);
        publicProfile.FullName.Should().Be("Luc Profile User");
    }

    [Fact]
    public async Task PROF_003_View_Private_Profile_Other_User_Returns_NotFound()
    {
        var (otherUser, _) = await CreateAuthenticatedUserAsync("prof003@gmail.com", "prof003user");

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.UserProfiles.FirstAsync(p => p.UserId == otherUser.Id);
            profile.ProfileVisibility = "private";
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync($"/api/v1/users/profile/public/{otherUser.Username}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==========================================
    // EDIT AVATAR TESTS (PROF-004 - PROF-008)
    // ==========================================

    [Fact]
    public async Task PROF_004_Upload_Avatar_Valid_PNG_Success()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof004@gmail.com", "prof004user");

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[100]);
        fileContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("image/png");
        form.Add(fileContent, "file", "avatar.png");

        var response = await client.PostAsync("/api/v1/users/profile/avatar", form);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadRes = await response.Content.ReadFromJsonAsync<AvatarUploadResponse>();
        uploadRes.Should().NotBeNull();
        uploadRes!.AvatarUrl.Should().Be("https://signed-url.com/avatars/user-custom-key-1111.png");
    }

    [Fact]
    public async Task PROF_005_Upload_Avatar_Exceeds_Size_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof005@gmail.com", "prof005user");

        using var form = new MultipartFormDataContent();
        // 2MB + 1 byte
        var fileContent = new ByteArrayContent(new byte[StorageConstants.MaxProfileSize + 1]);
        fileContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("image/png");
        form.Add(fileContent, "file", "big_avatar.png");

        var response = await client.PostAsync("/api/v1/users/profile/avatar", form);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_006_Upload_Avatar_Invalid_MimeType_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof006@gmail.com", "prof006user");

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[100]);
        fileContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("application/pdf");
        form.Add(fileContent, "file", "document.pdf");

        var response = await client.PostAsync("/api/v1/users/profile/avatar", form);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_007_Sync_Avatar_GitHub_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof007@gmail.com", "prof007user");

        // Seed active GitHub AuthProvider for the user
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "github",
                ProviderKey = "git-12345",
                ProviderAccountId = "git_user",
                ProviderUsername = "git_user",
                ProviderAvatarUrl = "https://github.com/avatar/prof007.png",
                ScopeValidationStatus = ProviderScopeStatus.Valid,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.AuthProviders.Add(provider);
            await db.SaveChangesAsync();
        }

        var syncRequest = new SyncAvatarRequest(ProviderName: "github");
        var response = await client.PostAsJsonAsync("/api/v1/users/profile/avatar/sync", syncRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify avatar URL is updated in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.AvatarUrl.Should().Be("https://github.com/avatar/prof007.png");
            dbUser.AvatarSource.Should().Be(AvatarSource.GitHub);
        }
    }

    [Fact]
    public async Task PROF_008_Delete_Avatar_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof008@gmail.com", "prof008user");

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.AvatarUrl = "https://cverify.ai/avatars/old.png";
            dbUser.AvatarSource = AvatarSource.Uploaded;
            await db.SaveChangesAsync();
        }

        var response = await client.DeleteAsync("/api/v1/users/profile/avatar");
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify avatar URL is cleared in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.AvatarUrl.Should().BeNullOrEmpty();
            dbUser.AvatarSource.Should().Be(AvatarSource.Default);
        }
    }

    // ==========================================
    // PROFILE SETTINGS TESTS (PROF-009 - PROF-015)
    // ==========================================

    [Fact]
    public async Task PROF_009_Update_Bio_Correct_Length_Success()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof009@gmail.com", "prof009user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var bio160 = new string('b', 160);
        var updateRequest = new UpdateProfileRequest(
            FullName: "Luc Fullname Updated",
            Bio: bio160,
            Location: "Vietnam",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Software Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string> { "https://github.com/luc" },
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await response.Content.ReadFromJsonAsync<ProfileResponse>();
        updated.Should().NotBeNull();
        updated!.Bio.Should().Be(bio160);
    }

    [Fact]
    public async Task PROF_010_Update_Bio_Exceeds_Length_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof010@gmail.com", "prof010user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        // Code limit is MaxLength(1000)
        var bio1001 = new string('b', 1001);
        var updateRequest = new UpdateProfileRequest(
            FullName: "Luc Fullname Updated",
            Bio: bio1001,
            Location: "Vietnam",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Software Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string> { "https://github.com/luc" },
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_011_Update_PhoneNumber_Valid_Success()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof011@gmail.com", "prof011user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var updateRequest = new UpdateProfileRequest(
            FullName: "Luc Fullname Updated",
            Bio: "My Bio",
            Location: "Vietnam",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Software Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string>(),
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PROF_012_Update_PhoneNumber_Invalid_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof012@gmail.com", "prof012user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var updateRequest = new UpdateProfileRequest(
            FullName: "Luc Fullname Updated",
            Bio: "My Bio",
            Location: "Vietnam",
            PhoneNumber: "abcdef", // non-numeric
            BirthDate: null,
            Headline: "Software Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string>(),
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_013_Update_Visibility_Private_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof013@gmail.com", "prof013user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var updateRequest = new UpdateProfileRequest(
            FullName: "Luc Fullname",
            Bio: "My Bio",
            Location: "Vietnam",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Software Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "private",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string>(),
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify visibility in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.UserProfiles.FirstAsync(p => p.UserId == user.Id);
            profile.ProfileVisibility.Should().Be("private");
        }
    }

    [Fact]
    public async Task PROF_014_Update_Multiple_Fields_Success()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof014@gmail.com", "prof014user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var updateRequest = new UpdateProfileRequest(
            FullName: "Multi Name",
            Bio: "Multi Bio",
            Location: "Multi Location",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Multi Headline",
            Company: "Multi Company",
            Pronouns: "they/them",
            CustomPronouns: null,
            PublicEmail: "multi@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string> { "https://linkedin.com/in/multi" },
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        var response = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await response.Content.ReadFromJsonAsync<ProfileResponse>();
        updated.Should().NotBeNull();
        updated!.FullName.Should().Be("Multi Name");
        updated.Bio.Should().Be("Multi Bio");
        updated.Location.Should().Be("Multi Location");
        updated.Headline.Should().Be("Multi Headline");
        updated.Company.Should().Be("Multi Company");
    }

    [Fact]
    public async Task PROF_015_Update_Optimistic_Concurrency_Conflict_Returns_Conflict()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof015@gmail.com", "prof015user");

        var profileRes = await client.GetFromJsonAsync<ProfileResponse>("/api/v1/users/profile");
        var version = profileRes!.Version;

        var updateRequest1 = new UpdateProfileRequest(
            FullName: "Update A",
            Bio: "Bio A",
            Location: "Vietnam",
            PhoneNumber: "+84901234567",
            BirthDate: null,
            Headline: "Architect",
            Company: "CVerify",
            Pronouns: "he/him",
            CustomPronouns: null,
            PublicEmail: "luc@gmail.com",
            ProfileVisibility: "public",
            RecruiterVisibility: true,
            AiTalentDiscovery: "disabled",
            SocialLinks: new List<string>(),
            AiSuggestionsJson: null,
            CvTemplateId: "professional",
            CvThemeColor: "#000000",
            IsCvPublished: true,
            CvLayoutConfigJson: null,
            Version: version
        );

        // 1. First update succeeds (Version changes)
        var response1 = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest1);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Second update using obsolete Version fails with 409 Conflict
        var updateRequest2 = updateRequest1 with { FullName = "Update B", Version = version };
        var response2 = await client.PutAsJsonAsync("/api/v1/users/profile", updateRequest2);
        response2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ==========================================
    // SETTING USERNAME TESTS (PROF-016 - PROF-020)
    // ==========================================

    [Fact]
    public async Task PROF_016_Update_Username_Valid_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof016@gmail.com", "prof016user");

        var request = new UpdateUsernameRequest(NewUsername: "prof016new");
        var response = await client.PutAsJsonAsync("/api/v1/users/profile/username", request);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify username updated in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.Username.Should().Be("prof016new");
        }
    }

    [Fact]
    public async Task PROF_017_Update_Username_Too_Short_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof017@gmail.com", "prof017user");

        var request = new UpdateUsernameRequest(NewUsername: "ab"); // length 2
        var response = await client.PutAsJsonAsync("/api/v1/users/profile/username", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_018_Update_Username_With_Space_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof018@gmail.com", "prof018user");

        var request = new UpdateUsernameRequest(NewUsername: "my name"); // has space
        var response = await client.PutAsJsonAsync("/api/v1/users/profile/username", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_019_Update_Username_Already_Taken_Conflict()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof019@gmail.com", "prof019user");
        var (otherUser, _) = await CreateAuthenticatedUserAsync("prof019_other@gmail.com", "takenusername");

        var request = new UpdateUsernameRequest(NewUsername: "takenusername");
        var response = await client.PutAsJsonAsync("/api/v1/users/profile/username", request);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task PROF_020_Update_Username_Cooldown_Fails()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof020@gmail.com", "prof020user");

        // Force LastUsernameChangeAt to UtcNow to trigger 30 days cooldown
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.LastUsernameChangeAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        var request = new UpdateUsernameRequest(NewUsername: "prof020new");
        var response = await client.PutAsJsonAsync("/api/v1/users/profile/username", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("once every 30 days");
    }

    // ==========================================
    // EMAIL SETUP TESTS (PROF-021 - PROF-024)
    // ==========================================

    [Fact]
    public async Task PROF_021_Add_Secondary_Email_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof021@gmail.com", "prof021user");

        // 1. Send OTP
        var sendOtpRes = await client.PostAsJsonAsync("/api/auth/emails/send-otp", new { Email = "prof021_sec@gmail.com" });
        sendOtpRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var otpData = await sendOtpRes.Content.ReadFromJsonAsync<SendOtpResponse>();
        var challengeId = otpData!.ChallengeId;

        // Retrieve OTP plain text from DB Outbox
        using var scope1 = _customFactory.Services.CreateScope();
        var db1 = scope1.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxMessage = await db1.OutboxMessages.FirstAsync(m => m.Type == "EmailOtpVerification" && m.Payload.Contains("prof021_sec@gmail.com"));
        var payloadDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(outboxMessage.Payload);
        var plainOtp = payloadDict!["Otp"].ToString();

        // 2. Verify OTP and link
        var verifyRequest = new AuthController.VerifyEmailLinkOtpRequest
        {
            Email = "prof021_sec@gmail.com",
            Code = plainOtp!,
            ChallengeId = challengeId
        };
        var verifyRes = await client.PostAsJsonAsync("/api/auth/emails/verify-otp", verifyRequest);
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Check DB
        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var linked = await db2.Users.FirstAsync(u => u.Id == user.Id);
        linked.LinkedEmails.Should().ContainSingle(e => e.Email == "prof021_sec@gmail.com" && e.IsVerified);
    }

    [Fact]
    public async Task PROF_022_Add_Secondary_Email_Already_Exists_Fails()
    {
        var (_, client) = await CreateAuthenticatedUserAsync("prof022@gmail.com", "prof022user");
        await CreateAuthenticatedUserAsync("prof022_other@gmail.com", "prof022other");

        // Try adding other user's primary email
        var sendOtpRes = await client.PostAsJsonAsync("/api/auth/emails/send-otp", new { Email = "prof022_other@gmail.com" });
        sendOtpRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PROF_023_Make_Secondary_Email_Primary_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof023@gmail.com", "prof023user");

        // Seed a verified secondary email
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.LinkedEmails.Add(new LinkedEmail
            {
                Id = Guid.CreateVersion7(),
                Email = "prof023_sec@gmail.com",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                VerifiedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Call promote primary endpoint
        var makePrimaryRequest = new AuthController.MakePrimaryEmailRequest
        {
            Email = "prof023_sec@gmail.com",
            Password = "SecurePassword123!"
        };
        var response = await client.PostAsJsonAsync("/api/auth/emails/make-primary", makePrimaryRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify main email swapped in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.Email.Should().Be("prof023_sec@gmail.com");
            dbUser.LinkedEmails.Should().ContainSingle(e => e.Email == "prof023@gmail.com"); // old primary is now secondary
        }
    }

    [Fact]
    public async Task PROF_024_Delete_Secondary_Email_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof024@gmail.com", "prof024user");

        Guid linkedEmailId;
        // Seed secondary email
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            var le = new LinkedEmail
            {
                Id = Guid.CreateVersion7(),
                Email = "prof024_sec@gmail.com",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow
            };
            dbUser.LinkedEmails.Add(le);
            await db.SaveChangesAsync();
            linkedEmailId = le.Id;
        }

        // Delete secondary email
        var response = await client.DeleteAsync($"/api/auth/emails/{linkedEmailId}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify secondary email is removed from DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.LinkedEmails.Should().BeEmpty();
        }
    }

    // ==========================================
    // OAUTH LINKING TESTS (PROF-025 - PROF-031)
    // ==========================================

    [Fact]
    public async Task PROF_025_Link_Google_Account_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof025@gmail.com", "prof025user");

        // Mock Google token claims
        _mockGoogleValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new GoogleJsonWebSignature.Payload
            {
                Subject = "google-sub-12345",
                Email = "prof025@gmail.com",
                EmailVerified = true,
                Name = "Google Display Name",
                Picture = "https://google.com/avatar.png"
            });

        var request = new LinkGoogleRequest(IdToken: "google-link-token");
        var response = await client.PostAsJsonAsync("/api/auth/providers/google", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify AuthProvider added in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.Include(u => u.AuthProviders).FirstAsync(u => u.Id == user.Id);
            dbUser.AuthProviders.Should().ContainSingle(ap => ap.ProviderName.ToLower() == "google" && ap.ProviderKey == "google-sub-12345");
        }
    }

    [Fact]
    public async Task PROF_026_Unlink_Google_Account_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof026@gmail.com", "prof026user");

        // Seed provider
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "google",
                ProviderKey = "google-sub-12345",
                ProviderAccountId = "google_user",
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.AuthProviders.Add(provider);
            await db.SaveChangesAsync();
        }

        var response = await client.DeleteAsync("/api/auth/providers/google");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify provider is soft deleted in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = await db.AuthProviders.IgnoreQueryFilters().FirstAsync(ap => ap.UserId == user.Id && ap.ProviderName == "google");
            provider.DeletedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task PROF_027_Link_GitHub_Callback_Stage1_Redirects_With_PendingId()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof027@gmail.com", "prof027user");

        // Put the oauth state cookie
        client.DefaultRequestHeaders.Add("Cookie", "oauth_state_github=state123");

        var response = await client.GetAsync("/api/auth/callback/github?code=code123&state=state123");
        response.StatusCode.Should().Be(HttpStatusCode.Redirect);

        var redirectUrl = response.Headers.Location?.AbsoluteUri ?? "";
        redirectUrl.Should().Contain("link_pending_id=");

        // Verify PendingAuthProvider exists in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pending = await db.PendingAuthProviders.FirstOrDefaultAsync(pap => pap.UserId == user.Id && pap.ProviderName == "github");
            pending.Should().NotBeNull();
            pending!.ProviderKey.Should().Be("12345678"); // defined in MockProfileHttpMessageHandler response
        }
    }

    [Fact]
    public async Task PROF_028_Confirm_Link_GitHub_2Step_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof028@gmail.com", "prof028user");

        Guid pendingId = Guid.CreateVersion7();
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pending = new PendingAuthProvider
            {
                Id = pendingId,
                UserId = user.Id,
                ProviderName = "github",
                ProviderKey = "12345678",
                ProviderAccountId = "github_user_acc",
                ProviderUsername = "github_user_acc",
                ProviderDisplayName = "GitHub Display Name",
                EncryptedAccessToken = "EncryptedAccess",
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10),
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.PendingAuthProviders.Add(pending);
            await db.SaveChangesAsync();
        }

        var response = await client.PostAsync($"/api/auth/providers/confirm/{pendingId}", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify provider is added, pending provider is removed
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hasPending = await db.PendingAuthProviders.AnyAsync(pap => pap.Id == pendingId);
            hasPending.Should().BeFalse();

            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
            provider.Should().NotBeNull();
            provider!.ProviderKey.Should().Be("12345678");
        }
    }

    [Fact]
    public async Task PROF_029_Disconnect_GitHub_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof029@gmail.com", "prof029user");

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "github",
                ProviderKey = "github-sub-12345",
                ProviderAccountId = "github_user",
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.AuthProviders.Add(provider);
            await db.SaveChangesAsync();
        }

        var response = await client.DeleteAsync("/api/auth/providers/github");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify provider is soft deleted in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = await db.AuthProviders.IgnoreQueryFilters().FirstAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
            provider.DeletedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task PROF_030_Link_GitLab_Callback_Stage1_Redirects_With_PendingId()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof030@gmail.com", "prof030user");

        client.DefaultRequestHeaders.Add("Cookie", "oauth_state_gitlab=state123");

        var response = await client.GetAsync("/api/auth/callback/gitlab?code=code123&state=state123");
        response.StatusCode.Should().Be(HttpStatusCode.Redirect);

        var redirectUrl = response.Headers.Location?.AbsoluteUri ?? "";
        redirectUrl.Should().Contain("link_pending_id=");

        // Verify PendingAuthProvider exists in DB for gitlab
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pending = await db.PendingAuthProviders.FirstOrDefaultAsync(pap => pap.UserId == user.Id && pap.ProviderName == "gitlab");
            pending.Should().NotBeNull();
            pending!.ProviderKey.Should().Be("87654321"); // defined in MockProfileHttpMessageHandler response
        }
    }

    [Fact]
    public async Task PROF_031_Disconnect_GitLab_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof031@gmail.com", "prof031user");

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "gitlab",
                ProviderKey = "gitlab-sub-12345",
                ProviderAccountId = "gitlab_user",
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.AuthProviders.Add(provider);
            await db.SaveChangesAsync();
        }

        var response = await client.DeleteAsync("/api/auth/providers/gitlab");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify provider is soft deleted in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = await db.AuthProviders.IgnoreQueryFilters().FirstAsync(ap => ap.UserId == user.Id && ap.ProviderName == "gitlab");
            provider.DeletedAt.Should().NotBeNull();
        }
    }

    // ==========================================
    // ACCOUNT DELETION TESTS (PROF-032 - PROF-035)
    // ==========================================

    [Fact]
    public async Task PROF_032_Delete_Account_PasswordAuth_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof032@gmail.com", "prof032user");

        var deleteRequest = new InitiateDeletionRequest(
            Password: "SecurePassword123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        );

        var response = await client.PostAsJsonAsync("/api/users/me/delete-request", deleteRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        data.Should().NotBeNull();
        data!.Success.Should().BeTrue();

        // Verify status in DB is DELETION_PENDING
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.Status.Should().Be(UserStatus.DELETION_PENDING);
        }
    }

    [Fact]
    public async Task PROF_033_Delete_Account_ConfirmationPhrase_Invalid_Fails()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof033@gmail.com", "prof033user");

        var deleteRequest = new InitiateDeletionRequest(
            Password: "SecurePassword123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "wrong phrase"
        );

        var response = await client.PostAsJsonAsync("/api/users/me/delete-request", deleteRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var data = await response.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        data.Should().NotBeNull();
        data!.Success.Should().BeFalse();
        data.ErrorCode.Should().Be("INVALID_CONFIRMATION_PHRASE");

        // Verify status remains ACTIVE
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.Status.Should().Be(UserStatus.ACTIVE);
        }
    }

    [Fact]
    public async Task PROF_034_Delete_Account_SoleOwner_Blocked_Returns_BlockingOrganizations()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof034@gmail.com", "prof034user");

        // Seed Organization and make user the Sole Owner
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CVerify Organization Sole Owner Test",
                TaxCode = "9999999999",
                Email = "orgowner@gmail.com",
                Username = "sole-owner-org",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);

            var authority = new OrganizationAuthority
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = "organization_owner",
                JoinedAt = DateTimeOffset.UtcNow
            };
            db.OrganizationAuthorities.Add(authority);
            await db.SaveChangesAsync();
        }

        var deleteRequest = new InitiateDeletionRequest(
            Password: "SecurePassword123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        );

        var response = await client.PostAsJsonAsync("/api/users/me/delete-request", deleteRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var data = await response.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        data.Should().NotBeNull();
        data!.Success.Should().BeFalse();
        data.ErrorCode.Should().Be("ORGANIZATION_OWNER_PREVENT_DELETE");
        data.BlockingOrganizations.Should().NotBeNullOrEmpty();
        data.BlockingOrganizations!.First().Username.Should().Be("sole-owner-org");
    }

    [Fact]
    public async Task PROF_035_Reactivate_Account_During_DeletionPending_Success()
    {
        var (user, client) = await CreateAuthenticatedUserAsync("prof035@gmail.com", "prof035user");

        // 1. Put user into DELETION_PENDING
        var deleteRequest = new InitiateDeletionRequest(
            Password: "SecurePassword123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        );
        var deleteResponse = await client.PostAsJsonAsync("/api/users/me/delete-request", deleteRequest);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Perform Login while de-activated to trigger Reactivation Token generation
        var loginClient = _customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var loginRequest = new LoginRequest(Email: "prof035@gmail.com", Password: "SecurePassword123!");
        var loginResponse = await loginClient.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var authRes = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        authRes.Should().NotBeNull();
        authRes!.Status.Should().Be("DELETION_PENDING");
        authRes.NextStep.Should().StartWith("REACTIVATE:");

        var reactivationToken = authRes.NextStep.Split("REACTIVATE:")[1];

        // 3. Call reactivate endpoint
        var reactivateRequest = new ReactivateRequest(ReactivationToken: reactivationToken);
        var reactivateResponse = await _client.PostAsJsonAsync("/api/auth/reactivate", reactivateRequest);
        reactivateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify user status is ACTIVE again in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FirstAsync(u => u.Id == user.Id);
            dbUser.Status.Should().Be(UserStatus.ACTIVE);
            dbUser.DeletedAt.Should().BeNull();
        }
    }
}

// Intercepts and mocks external web requests
public class MockProfileHttpMessageHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, System.Threading.CancellationToken cancellationToken)
    {
        var requestUrl = request.RequestUri?.AbsoluteUri ?? "";
        
        // VietQR Mock Response
        if (requestUrl.Contains("api.vietqr.io"))
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"name\":\"CÔNG TY TNHH PHẦN MỀM FPT\",\"status\":\"đang hoạt động\"}}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            return Task.FromResult(response);
        }
        
        // GitHub Access Token Exchange
        if (requestUrl.Contains("github.com/login/oauth/access_token"))
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"access_token\":\"mock-github-access-token\",\"token_type\":\"bearer\",\"scope\":\"user:email\"}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            return Task.FromResult(response);
        }
        
        // GitHub Profile Detail Query
        if (requestUrl.Contains("api.github.com/user"))
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"id\":12345678,\"login\":\"mock-github-username\",\"email\":\"github_user@cverify.ai\",\"avatar_url\":\"https://github.com/avatar/mock-github-avatar\",\"name\":\"GitHub Display Name\",\"html_url\":\"https://github.com/mock-github-username\"}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            return Task.FromResult(response);
        }
        
        // GitLab Access Token Exchange
        if (requestUrl.Contains("gitlab.com/oauth/token"))
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"access_token\":\"mock-gitlab-access-token\",\"token_type\":\"bearer\",\"expires_in\":7200}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            return Task.FromResult(response);
        }
        
        // GitLab Profile Detail Query
        if (requestUrl.Contains("gitlab.com/api/v4/user"))
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"id\":87654321,\"username\":\"mock-gitlab-username\",\"email\":\"gitlab_user@cverify.ai\",\"avatar_url\":\"https://gitlab.com/avatar/mock-gitlab-avatar\",\"name\":\"GitLab Display Name\",\"web_url\":\"https://gitlab.com/mock-gitlab-username\"}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            return Task.FromResult(response);
        }
        
        return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.NotFound));
    }
}
