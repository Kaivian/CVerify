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
using CVerify.API.Modules.Auth.Entities;

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
        var bootstrapService = scope.ServiceProvider.GetRequiredService<IOrganizationBootstrapService>();

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

        await DbInitializer.InitializeAsync(db);

        if (role == "OWNER" || role == "REPRESENTATIVE")
        {
            await bootstrapService.BootstrapOrganizationAsync(orgId, userId);
        }
        else
        {
            await bootstrapService.SeedDefaultRolesForTenantAsync(orgId);
            var viewerRole = await db.Roles.FirstOrDefaultAsync(r => r.TenantId == orgId && r.Name == "viewer");
            if (viewerRole != null)
            {
                db.RoleAssignments.Add(new RoleAssignment
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    RoleId = viewerRole.Id,
                    ScopeType = "ORGANIZATION",
                    ScopeId = orgId,
                    AssignedAt = DateTimeOffset.UtcNow
                });
                await db.SaveChangesAsync();
            }
        }
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

    [Fact]
    public async Task CreateWorkspace_Authorized_ShouldSucceed_AndVerifyDbAndAuditLog()
    {
        // Arrange
        var org = await SeedOrganizationAsync("create-org", "Create Organization");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner-create@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new CreateWorkspaceRequestDto(
            DisplayName: "Test Workspace",
            Slug: "test-ws-slug",
            Description: "A description of the test workspace"
        );

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<WorkspaceDto>();
        created.Should().NotBeNull();
        created!.DisplayName.Should().Be("Test Workspace");
        created.Slug.Should().Be("test-ws-slug");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var workspace = await db.Workspaces
                .Include(w => w.Owner)
                .FirstOrDefaultAsync(w => w.Id == created.Id);

            workspace.Should().NotBeNull();
            workspace!.DisplayName.Should().Be("Test Workspace");
            workspace.Slug.Should().Be("test-ws-slug");
            workspace.Description.Should().Be("A description of the test workspace");
            workspace.OwnerId.Should().Be(userId);
            workspace.Status.Should().Be("active");

            // Verify workspace level member was automatically added as workspace_admin
            var isMember = await db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == workspace.Id && wm.UserId == userId && wm.Role == "workspace_admin");
            isMember.Should().BeTrue();

            // Verify Audit Log is populated
            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_CREATED");
            auditLog.Should().NotBeNull();
            auditLog!.Description.Should().Contain("test-ws-slug");
        }
    }

    [Fact]
    public async Task CreateWorkspace_Unauthorized_ShouldReturnForbidden()
    {
        // Arrange
        var org = await SeedOrganizationAsync("unauth-create-org", "Unauth Create Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("member-create@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "MEMBER");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new CreateWorkspaceRequestDto(
            DisplayName: "Unauthorized Workspace",
            Slug: "unauth-ws-slug"
        );

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetWorkspacesList_Authorized_ShouldReturnPaginatedAndFilterableWorkspaces()
    {
        // Arrange
        var org = await SeedOrganizationAsync("list-org", "List Organization");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner-list@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = Guid.CreateVersion7(), OrganizationId = org.Id, DisplayName = "Workspace Alpha", Slug = "alpha-ws", Status = "active", OwnerId = userId });
            db.Workspaces.Add(new Workspace { Id = Guid.CreateVersion7(), OrganizationId = org.Id, DisplayName = "Workspace Beta", Slug = "beta-ws", Status = "archived", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act 1: Get active workspaces
        var responseActive = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces?status=active");
        responseActive.StatusCode.Should().Be(HttpStatusCode.OK);
        var activeList = await responseActive.Content.ReadFromJsonAsync<PaginatedWorkspacesResponseDto>();
        activeList.Should().NotBeNull();
        activeList!.TotalCount.Should().Be(1);
        activeList.Items.Should().ContainSingle();
        activeList.Items[0].DisplayName.Should().Be("Workspace Alpha");
        activeList.Items[0].OwnerUser.UserId.Should().Be(userId);

        // Act 2: Get archived workspaces
        var responseArchived = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces?status=archived");
        responseArchived.StatusCode.Should().Be(HttpStatusCode.OK);
        var archivedList = await responseArchived.Content.ReadFromJsonAsync<PaginatedWorkspacesResponseDto>();
        archivedList.Should().NotBeNull();
        archivedList!.TotalCount.Should().Be(1);
        archivedList.Items[0].DisplayName.Should().Be("Workspace Beta");

        // Act 3: Search
        var responseSearch = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces?search=Alpha");
        responseSearch.StatusCode.Should().Be(HttpStatusCode.OK);
        var searchList = await responseSearch.Content.ReadFromJsonAsync<PaginatedWorkspacesResponseDto>();
        searchList.Should().NotBeNull();
        searchList!.TotalCount.Should().Be(1);
        searchList.Items[0].DisplayName.Should().Be("Workspace Alpha");
    }

    [Fact]
    public async Task UpdateWorkspace_Authorized_ShouldSucceed_AndVerifyAuditLog()
    {
        // Arrange
        var org = await SeedOrganizationAsync("update-org", "Update Organization");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner-update@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Original Name", Slug = "orig-slug", Description = "orig-desc", Status = "active", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new UpdateWorkspaceRequestDto(
            DisplayName: "Updated Name",
            Slug: "updated-slug",
            Description: "updated-desc",
            Status: "active"
        );

        // Act
        var response = await customClient.PatchAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<WorkspaceDto>();
        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("Updated Name");
        result.Slug.Should().Be("updated-slug");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.FindAsync(workspaceId);
            ws.Should().NotBeNull();
            ws!.DisplayName.Should().Be("Updated Name");
            ws.Slug.Should().Be("updated-slug");
            ws.Description.Should().Be("updated-desc");

            // Verify Audit Log is populated with old and new state
            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_UPDATED");
            auditLog.Should().NotBeNull();
            auditLog!.OldStateJson.Should().Contain("Original Name");
            auditLog.NewStateJson.Should().Contain("Updated Name");
        }
    }

    [Fact]
    public async Task DeleteWorkspace_Authorized_ShouldSucceed_AndSoftDelete()
    {
        // Arrange
        var org = await SeedOrganizationAsync("delete-org", "Delete Organization");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner-delete@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "To Delete", Slug = "delete-slug", Status = "active", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.DeleteAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == workspaceId);
            ws.Should().NotBeNull();
            ws!.DeletedAt.Should().NotBeNull();

            // Verify it does not appear in normal queries
            var activeWs = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == workspaceId);
            activeWs.Should().BeNull();

            // Verify Audit Log contains WORKSPACE_DELETED
            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_DELETED");
            auditLog.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task ArchiveAndRestoreWorkspace_Authorized_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("archive-org", "Archive Organization");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner-archive@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "To Archive", Slug = "archive-slug", Status = "active", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act 1: Archive
        var responseArchive = await customClient.PostAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/archive", null);
        responseArchive.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.FindAsync(workspaceId);
            ws!.Status.Should().Be("archived");

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_ARCHIVED");
            auditLog.Should().NotBeNull();
        }

        // Act 2: Restore
        var responseRestore = await customClient.PostAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/restore", null);
        responseRestore.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.FindAsync(workspaceId);
            ws!.Status.Should().Be("active");

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_RESTORED");
            auditLog.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task TransferWorkspaceOwnership_Authorized_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("transfer-org", "Transfer Organization");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner-trans@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");

        var (memberId, memberCookie) = await RegisterAndLoginUserAsync("member-trans@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, memberId, "MEMBER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Transfer Workspace", Slug = "trans-slug", Status = "active", OwnerId = ownerId });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceId, UserId = ownerId, Role = "workspace_admin", JoinedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceId, UserId = memberId, Role = "workspace_member", JoinedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        var requestBody = new TransferWorkspaceOwnershipRequestDto(NewOwnerId: memberId);

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/transfer-ownership", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.FindAsync(workspaceId);
            ws!.OwnerId.Should().Be(memberId);

            // Verify the new owner is now workspace_admin
            var newOwnerMembership = await db.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == memberId);
            newOwnerMembership!.Role.Should().Be("workspace_admin");

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_OWNERSHIP_TRANSFERRED");
            auditLog.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task TransferWorkspaceOwnership_NotMember_ShouldFail()
    {
        // Arrange
        var org = await SeedOrganizationAsync("transfer-fail-org", "Transfer Fail Organization");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner-trans-fail@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");

        var (nonMemberId, _) = await RegisterAndLoginUserAsync("non-member-trans@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, nonMemberId, "MEMBER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Transfer Fail Workspace", Slug = "trans-fail-slug", Status = "active", OwnerId = ownerId });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceId, UserId = ownerId, Role = "workspace_admin", JoinedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        var requestBody = new TransferWorkspaceOwnershipRequestDto(NewOwnerId: nonMemberId);

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/transfer-ownership", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("New owner must be a member");
    }

    [Fact]
    public async Task WorkspaceLevelMembersManagement_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("members-org", "Members Management Org");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner-mem@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");

        var (memberId, _) = await RegisterAndLoginUserAsync("member-mem@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, memberId, "MEMBER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Members Workspace", Slug = "members-slug", Status = "active", OwnerId = ownerId });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceId, UserId = ownerId, Role = "workspace_admin", JoinedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        // Act 1: Add Member
        var addDto = new AddWorkspaceMemberRequestDto(UserId: memberId, Role: "workspace_member");
        var addResponse = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members", addDto);
        addResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var exists = await db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == memberId && wm.Role == "workspace_member");
            exists.Should().BeTrue();

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_MEMBER_ADDED");
            auditLog.Should().NotBeNull();
        }

        // Act 2: Get Members
        var getResponse = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var members = await getResponse.Content.ReadFromJsonAsync<List<WorkspaceMemberItemDto>>();
        members.Should().NotBeNull();
        members.Should().HaveCount(2);

        // Act 3: Update Role
        var updateRoleDto = new UpdateWorkspaceMemberRoleRequestDto(Role: "workspace_admin");
        var updateResponse = await customClient.PatchAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members/{memberId}", updateRoleDto);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var wm = await db.WorkspaceMembers.FirstOrDefaultAsync(x => x.WorkspaceId == workspaceId && x.UserId == memberId);
            wm!.Role.Should().Be("workspace_admin");

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_MEMBER_ROLE_UPDATED");
            auditLog.Should().NotBeNull();
        }

        // Act 4: Remove Member
        var deleteResponse = await customClient.DeleteAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members/{memberId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var exists = await db.WorkspaceMembers.AnyAsync(x => x.WorkspaceId == workspaceId && x.UserId == memberId);
            exists.Should().BeFalse();

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(al => al.OrganizationId == org.Id && al.EventType == "WORKSPACE_MEMBER_REMOVED");
            auditLog.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task PermissionBoundaryIsolation_ShouldBeEnforced()
    {
        // Arrange
        var org = await SeedOrganizationAsync("boundary-org", "Boundary Organization");

        var (adminUserId, adminCookie) = await RegisterAndLoginUserAsync("workspace-admin@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, adminUserId, "MEMBER");

        var (otherUserId, _) = await RegisterAndLoginUserAsync("other-user@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, otherUserId, "MEMBER");

        var workspaceAId = Guid.CreateVersion7();
        var workspaceBId = Guid.CreateVersion7();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Seed two workspaces
            db.Workspaces.Add(new Workspace { Id = workspaceAId, OrganizationId = org.Id, DisplayName = "Workspace A", Slug = "ws-a", Status = "active", OwnerId = otherUserId });
            db.Workspaces.Add(new Workspace { Id = workspaceBId, OrganizationId = org.Id, DisplayName = "Workspace B", Slug = "ws-b", Status = "active", OwnerId = otherUserId });

            // Make adminUserId a workspace_admin in Workspace A only
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceAId, UserId = adminUserId, Role = "workspace_admin", JoinedAt = DateTimeOffset.UtcNow });
            // Make otherUserId the owner/member in both workspaces
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceAId, UserId = otherUserId, Role = "workspace_member", JoinedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceBId, UserId = otherUserId, Role = "workspace_member", JoinedAt = DateTimeOffset.UtcNow });

            await db.SaveChangesAsync();
        }



        Guid adminRoleId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var adminRole = await db.Roles.FirstAsync(r => r.TenantId == org.Id && r.Name == "administrator" && r.Domain == "TENANT");
            adminRoleId = adminRole.Id;

            // Assign administrator role to adminUserId scoped to Workspace A only
            db.RoleAssignments.Add(new RoleAssignment
            {
                Id = Guid.CreateVersion7(),
                UserId = adminUserId,
                RoleId = adminRoleId,
                ScopeType = "WORKSPACE",
                ScopeId = workspaceAId,
                AssignedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", adminCookie);

        // Act & Assert 1: Authorized to manage members in Workspace A
        var getMembersResponseA = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces/{workspaceAId}/members");
        getMembersResponseA.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act & Assert 2: NOT Authorized to manage members in Workspace B
        var getMembersResponseB = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces/{workspaceBId}/members");
        getMembersResponseB.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Act & Assert 3: NOT Authorized to update Workspace A metadata (this is an organization-level update requiring organization:workspaces:update permission)
        var updateRequestDto = new UpdateWorkspaceRequestDto(
            DisplayName: "Hacked Workspace A",
            Slug: "ws-a-hacked",
            Description: "Hacked description",
            Status: "active"
        );
        var updateResponse = await customClient.PatchAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceAId}", updateRequestDto);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task SeedCompanyCredentialAsync(Guid orgId, string username, string password)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var credential = new OrganizationCredential
        {
            OrganizationId = orgId,
            Username = username,
            PasswordHash = hash,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.OrganizationCredentials.Add(credential);
        await db.SaveChangesAsync();
    }

    private async Task<string> LoginCompanyAsync(string username, string password)
    {
        var loginRequest = new OrganizationLoginRequest(OrganizationUsername: username, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/company-login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieHeader = setCookie.Split(';')[0];
        return cookieHeader;
    }

    [Fact]
    public async Task BusinessAccount_GetWorkspacesList_OwnOrg_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-list-org", "Biz List Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-list-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-list-org", "SecureBiz123!");
        var (userId, _) = await RegisterAndLoginUserAsync("dummy-list@cverify.ai", "SecurePassword123!");

        // Add a workspace
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = org.Id,
                DisplayName = "Workspace Charlie",
                Slug = "charlie-ws",
                Status = "active",
                OwnerId = userId
            });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces?status=active");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var activeList = await response.Content.ReadFromJsonAsync<PaginatedWorkspacesResponseDto>();
        activeList.Should().NotBeNull();
        activeList!.TotalCount.Should().Be(1);
        activeList.Items.Should().ContainSingle();
        activeList.Items[0].DisplayName.Should().Be("Workspace Charlie");
    }

    [Fact]
    public async Task BusinessAccount_GetWorkspacesList_OtherOrg_ShouldBeForbidden()
    {
        // Arrange
        var org1 = await SeedOrganizationAsync("biz-list-org1", "Biz List Org 1");
        await SeedCompanyCredentialAsync(org1.Id, "biz-list-org1", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-list-org1", "SecureBiz123!");

        var org2 = await SeedOrganizationAsync("biz-list-org2", "Biz List Org 2");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.GetAsync($"/api/organizations/{org2.Username}/workspaces?status=active");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task BusinessAccount_CreateWorkspace_OwnOrg_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-create-org", "Biz Create Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-create-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-create-org", "SecureBiz123!");
        var (userId, _) = await RegisterAndLoginUserAsync("dummy-create@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new CreateWorkspaceRequestDto(
            DisplayName: "Business Workspace",
            Slug: "biz-ws-slug",
            Description: "A business workspace description"
        );

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<WorkspaceDto>();
        created.Should().NotBeNull();
        created!.DisplayName.Should().Be("Business Workspace");
        created.Slug.Should().Be("biz-ws-slug");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == created.Id);
            workspace.Should().NotBeNull();
            workspace!.DisplayName.Should().Be("Business Workspace");
            workspace.Slug.Should().Be("biz-ws-slug");
            workspace.OwnerId.Should().Be(userId);
        }
    }

    [Fact]
    public async Task BusinessAccount_CreateWorkspace_OtherOrg_ShouldBeForbidden()
    {
        // Arrange
        var org1 = await SeedOrganizationAsync("biz-create-org1", "Biz Create Org 1");
        await SeedCompanyCredentialAsync(org1.Id, "biz-create-org1", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-create-org1", "SecureBiz123!");

        var org2 = await SeedOrganizationAsync("biz-create-org2", "Biz Create Org 2");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new CreateWorkspaceRequestDto(
            DisplayName: "Unauthorized Business Workspace",
            Slug: "unauth-biz-ws-slug"
        );

        // Act
        var response = await customClient.PostAsJsonAsync($"/api/organizations/{org2.Username}/workspaces", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task BusinessAccount_UpdateWorkspace_OwnOrg_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-update-org", "Biz Update Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-update-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-update-org", "SecureBiz123!");
        var (userId, _) = await RegisterAndLoginUserAsync("dummy-update@cverify.ai", "SecurePassword123!");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Old Workspace Name", Slug = "old-slug", Description = "old-desc", Status = "active", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new UpdateWorkspaceRequestDto(
            DisplayName: "New Workspace Name",
            Slug: "new-slug",
            Description: "new-desc",
            Status: "active"
        );

        // Act
        var response = await customClient.PatchAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<WorkspaceDto>();
        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("New Workspace Name");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.FindAsync(workspaceId);
            ws.Should().NotBeNull();
            ws!.DisplayName.Should().Be("New Workspace Name");
        }
    }

    [Fact]
    public async Task BusinessAccount_DeleteWorkspace_OwnOrg_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-delete-org", "Biz Delete Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-delete-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-delete-org", "SecureBiz123!");
        var (userId, _) = await RegisterAndLoginUserAsync("dummy-delete@cverify.ai", "SecurePassword123!");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "ToDelete", Slug = "del-slug", Status = "active", OwnerId = userId });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act
        var response = await customClient.DeleteAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ws = await db.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == workspaceId);
            ws.Should().NotBeNull();
            ws!.DeletedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task BusinessAccount_WorkspaceMembersManagement_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-mem-org", "Biz Mem Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-mem-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-mem-org", "SecureBiz123!");

        var (ownerUserId, _) = await RegisterAndLoginUserAsync("owner-biz-mem@cverify.ai", "SecurePassword123!");
        var (memberId, _) = await RegisterAndLoginUserAsync("member-biz-mem@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerUserId, "OWNER");
        await SeedMembershipAsync(org.Id, memberId, "MEMBER");

        var workspaceId = Guid.CreateVersion7();
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceId, OrganizationId = org.Id, DisplayName = "Biz Workspace", Slug = "biz-slug", Status = "active", OwnerId = ownerUserId });
            db.WorkspaceMembers.Add(new WorkspaceMember { Id = Guid.CreateVersion7(), WorkspaceId = workspaceId, UserId = ownerUserId, Role = "workspace_admin", JoinedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Act 1: Add Member
        var addDto = new AddWorkspaceMemberRequestDto(UserId: memberId, Role: "workspace_member");
        var addResponse = await customClient.PostAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members", addDto);
        addResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var exists = await db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == memberId && wm.Role == "workspace_member");
            exists.Should().BeTrue();
        }

        // Act 2: Get Members
        var getResponse = await customClient.GetAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var members = await getResponse.Content.ReadFromJsonAsync<List<WorkspaceMemberItemDto>>();
        members.Should().NotBeNull();
        members.Should().ContainSingle(wm => wm.UserId == memberId);

        // Act 3: Update Role
        var updateRoleDto = new UpdateWorkspaceMemberRoleRequestDto(Role: "workspace_admin");
        var updateResponse = await customClient.PatchAsJsonAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members/{memberId}", updateRoleDto);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var wm = await db.WorkspaceMembers.FirstOrDefaultAsync(x => x.WorkspaceId == workspaceId && x.UserId == memberId);
            wm!.Role.Should().Be("workspace_admin");
        }

        // Act 4: Remove Member
        var deleteResponse = await customClient.DeleteAsync($"/api/organizations/{org.Username}/workspaces/{workspaceId}/members/{memberId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var exists = await db.WorkspaceMembers.AnyAsync(x => x.WorkspaceId == workspaceId && x.UserId == memberId);
            exists.Should().BeFalse();
        }
    }

    [Fact]
    public async Task BusinessAccount_UpdateOrganizationSettings_OwnOrg_ShouldSucceed()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-settings-org", "Biz Settings Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-settings-org", "SecureBiz123!");
        var cookieHeader = await LoginCompanyAsync("biz-settings-org", "SecureBiz123!");

        var customClient = Factory.CreateClient();
        customClient.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new UpdateWorkspaceDetailsRequestDto(
            Description: "Updated Description",
            CompanyType: "Tech",
            CompanySize: "10-50",
            BranchCount: 2,
            IndustryTags: new List<string> { "Software" },
            BenefitTags: new List<string> { "Insurance" },
            ContactName: "New Name",
            ContactPhone: "+84900000003",
            ContactEmail: "updated@company.com",
            City: "HCMC",
            DetailAddress: "123 Street",
            GoogleMapsEmbedUrl: null,
            LinkedinUrl: null,
            FacebookUrl: null,
            TwitterUrl: null,
            Website: null,
            Mission: null,
            Vision: null,
            CoreValues: null,
            Founded: null
        );

        // Act
        var response = await customClient.PatchAsJsonAsync($"/api/workspace/{org.Username}", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var updatedOrg = await db.Organizations.FirstOrDefaultAsync(o => o.Id == org.Id);
            updatedOrg.Should().NotBeNull();
            updatedOrg!.Description.Should().Be("Updated Description");
            updatedOrg.ContactName.Should().Be("New Name");
        }
    }

    [Fact]
    public async Task BusinessAccount_IsMemberAsync_ShouldReturnTrueForOwnOrg()
    {
        // Arrange
        var org = await SeedOrganizationAsync("biz-ismember-org", "Biz IsMember Org");
        await SeedCompanyCredentialAsync(org.Id, "biz-ismember-org", "SecureBiz123!");

        using var scope = Factory.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();

        // Act
        var isMember = await authService.IsMemberAsync(org.Id, org.Id);

        // Assert
        isMember.Should().BeTrue();
    }
}

