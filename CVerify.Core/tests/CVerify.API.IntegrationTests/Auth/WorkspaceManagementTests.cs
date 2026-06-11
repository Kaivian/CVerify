using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.Storage.DTOs;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.IntegrationTests.Auth;

public class WorkspaceManagementTests : BaseIntegrationTest
{
    private readonly Mock<IStorageService> _mockStorage;

    public WorkspaceManagementTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
        _mockStorage = new Mock<IStorageService>();
    }

    private async Task SeedDefaultRolesAsync(ApplicationDbContext db)
    {
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new Role
            {
                Id = Guid.Parse("018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d"),
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic application access",
                IsSystem = true,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }
    }

    private async Task<(Guid UserId, string CookieHeader)> RegisterAndLoginUserAsync(string email, string password)
    {
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await SeedDefaultRolesAsync(db);
        }

        // Register user
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: password,
            ConfirmPassword: password,
            FullName: "Workspace Test User"
        );
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        regResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        Guid userId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            user.Should().NotBeNull();
            user!.Status = UserStatus.ACTIVE;
            user.EmailVerifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        // Login user
        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieHeader = setCookie.Split(';')[0];
        return (userId, cookieHeader);
    }

    private async Task<Organization> SeedOrganizationAsync(string slug, string name, string? bannerKey = null, string? logoKey = null)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = "TAX" + Guid.NewGuid().ToString("N").Substring(0, 10),
            Name = name,
            Email = $"{slug}@company.com",
            Username = slug,
            Status = "active",
            VerificationLevel = 2,
            IsVerified = true,
            RepresentativeName = "Rep Name",
            RepresentativeEmail = "rep@company.com",
            RepresentativePhone = "+84900000002",
            BannerUrl = bannerKey,
            LogoUrl = logoKey,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        db.Organizations.Add(org);
        await db.SaveChangesAsync();
        return org;
    }

    private async Task SeedMembershipAsync(Guid orgId, Guid userId, string role)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var membership = new OrganizationMembership
        {
            OrganizationId = orgId,
            UserId = userId,
            Role = role,
            Status = "active",
            JoinedAt = DateTimeOffset.UtcNow
        };

        db.OrganizationMemberships.Add(membership);
        await db.SaveChangesAsync();

        // Initialize business roles and run migration script to populate role assignments
        await DbInitializer.InitializeAsync(db);
    }

    [Fact]
    public async Task GetWorkspaceDetails_Anonymous_ShouldReturnPublicDetailsAndEmptyPermissions()
    {
        // Arrange
        var org = await SeedOrganizationAsync("anon-org", "Anonymous Company", "banners/anon.jpg", "logos/anon.png");

        _mockStorage.Setup(s => s.GetSignedUrlAsync("banners/anon.jpg", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/banners/anon.jpg");
        _mockStorage.Setup(s => s.GetSignedUrlAsync("logos/anon.png", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/logos/anon.png");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // Act
        var response = await customClient.GetAsync($"/api/workspace/{org.Username}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<WorkspaceDetailsDto>();
        details.Should().NotBeNull();
        details!.OrganizationName.Should().Be("Anonymous Company");
        details.OrganizationSlug.Should().Be(org.Username);
        details.UserRole.Should().BeNull();
        details.Permissions.Should().BeEmpty();
        details.BannerUrl.Should().Be("https://signed-url.com/banners/anon.jpg");
        details.LogoUrl.Should().Be("https://signed-url.com/logos/anon.png");
    }

    [Fact]
    public async Task GetWorkspaceDetails_AuthenticatedNonMember_ShouldReturnPublicDetailsAndEmptyPermissions()
    {
        // Arrange
        var org = await SeedOrganizationAsync("non-member-org", "Non Member Company");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("nonmember@cverify.ai", "SecurePassword123!");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.GetAsync($"/api/workspace/{org.Username}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<WorkspaceDetailsDto>();
        details.Should().NotBeNull();
        details!.UserRole.Should().BeNull();
        details.Permissions.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWorkspaceDetails_AuthenticatedOwner_ShouldReturnRoleAndAllPermissions()
    {
        // Arrange
        var org = await SeedOrganizationAsync("owner-org", "Owner Company");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.GetAsync($"/api/workspace/{org.Username}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<WorkspaceDetailsDto>();
        details.Should().NotBeNull();
        details!.UserRole.Should().Be("OWNER");
        details.Permissions.Should().Contain(OrganizationPermissions.EditProfile);
    }

    [Fact]
    public async Task GetWorkspaceDetails_AuthenticatedRepresentative_ShouldReturnRoleAndEditProfilePermission()
    {
        // Arrange
        var org = await SeedOrganizationAsync("rep-org", "Rep Company");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("rep@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "REPRESENTATIVE");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.GetAsync($"/api/workspace/{org.Username}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<WorkspaceDetailsDto>();
        details.Should().NotBeNull();
        details!.UserRole.Should().Be("REPRESENTATIVE");
        details.Permissions.Should().Contain(OrganizationPermissions.EditProfile);
    }

    [Fact]
    public async Task UploadBannerAndAvatar_Unauthenticated_ShouldReturn401()
    {
        // Arrange
        var org = await SeedOrganizationAsync("unauth-org", "Unauth Company");
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "banner.png");

        // Act
        var responseBanner = await Client.PostAsync($"/api/workspace/{org.Username}/banner", content);
        var responseAvatar = await Client.PostAsync($"/api/workspace/{org.Username}/avatar", content);

        // Assert
        responseBanner.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        responseAvatar.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UploadBannerAndAvatar_UnauthorizedMember_ShouldReturn403()
    {
        // Arrange
        var org = await SeedOrganizationAsync("member-only-org", "Member Company");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("memberonly@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "MEMBER");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "banner.png");

        // Act
        var responseBanner = await customClient.PostAsync($"/api/workspace/{org.Username}/banner", content);
        var responseAvatar = await customClient.PostAsync($"/api/workspace/{org.Username}/avatar", content);

        // Assert
        responseBanner.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        responseAvatar.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UploadBannerAndAvatar_AuthorizedRepresentative_ShouldSucceedAndDeleteOldFiles()
    {
        // Arrange
        var org = await SeedOrganizationAsync("edit-org", "Editable Company", "banners/old.jpg", "logos/old.png");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("authorized@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "REPRESENTATIVE");

        var deletedBanner = false;
        var deletedLogo = false;

        _mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream s, string name, string mime, StorageModule module, Dictionary<string, string> meta, CancellationToken ct) => new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = $"profiles/seeded/{name}",
                MimeType = mime,
                Size = 100
            });

        _mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string key, TimeSpan expiry, CancellationToken ct) => $"https://signed-url.com/{key}");

        _mockStorage.Setup(s => s.DeleteFileAsync("banners/old.jpg", It.IsAny<CancellationToken>()))
            .Callback(() => deletedBanner = true)
            .Returns(Task.CompletedTask);

        _mockStorage.Setup(s => s.DeleteFileAsync("logos/old.png", It.IsAny<CancellationToken>()))
            .Callback(() => deletedLogo = true)
            .Returns(Task.CompletedTask);

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => _mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // 1. Upload Banner
        using var bannerContent = new MultipartFormDataContent();
        var bannerStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var bannerFileContent = new StreamContent(bannerStream);
        bannerFileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        bannerContent.Add(bannerFileContent, "file", "new-banner.jpg");

        var responseBanner = await customClient.PostAsync($"/api/workspace/{org.Username}/banner", bannerContent);

        // Assert Banner
        responseBanner.StatusCode.Should().Be(HttpStatusCode.OK);
        var bannerResult = await responseBanner.Content.ReadFromJsonAsync<AvatarUploadResponse>();
        bannerResult.Should().NotBeNull();
        bannerResult!.AvatarUrl.Should().Be("https://signed-url.com/profiles/seeded/new-banner.jpg");
        deletedBanner.Should().BeTrue();

        // 2. Upload Avatar
        using var avatarContent = new MultipartFormDataContent();
        var avatarStream = new MemoryStream(new byte[] { 5, 6, 7, 8 });
        var avatarFileContent = new StreamContent(avatarStream);
        avatarFileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        avatarContent.Add(avatarFileContent, "file", "new-logo.png");

        var responseAvatar = await customClient.PostAsync($"/api/workspace/{org.Username}/avatar", avatarContent);

        // Assert Avatar
        responseAvatar.StatusCode.Should().Be(HttpStatusCode.OK);
        var avatarResult = await responseAvatar.Content.ReadFromJsonAsync<AvatarUploadResponse>();
        avatarResult.Should().NotBeNull();
        avatarResult!.AvatarUrl.Should().Be("https://signed-url.com/profiles/seeded/new-logo.png");
        deletedLogo.Should().BeTrue();

        // 3. Verify Database values updated
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var updatedOrg = await db.Organizations.FirstOrDefaultAsync(o => o.Id == org.Id);
            updatedOrg.Should().NotBeNull();
            updatedOrg!.BannerUrl.Should().Be("profiles/seeded/new-banner.jpg");
            updatedOrg.LogoUrl.Should().Be("profiles/seeded/new-logo.png");
        }
    }
}
