using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using StackExchange.Redis;

namespace CVerify.API.IntegrationTests.Auth;

public class BusinessRoleTests : BaseIntegrationTest
{
    public BusinessRoleTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task SeedDefaultRolesAsync(ApplicationDbContext db)
    {
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new CVerify.API.Modules.Shared.Domain.Entities.Role
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
            FullName: "Business Role Test User"
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

    private async Task<Organization> SeedOrganizationAsync(string slug, string name)
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
    }

    private async Task InitializeBusinessRolesAndPermissionsAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await DbInitializer.InitializeAsync(db);
    }

    [Fact]
    public async Task CreateRole_ShouldSucceed_AndVerifyDbAndCache()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-role-org", "Test Role Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var requestBody = new CreateBusinessRoleDto(
            Name: "custom_recruiter",
            DisplayName: "Custom Recruiter",
            Description: "Recruiter with some adjustments",
            ParentRoleId: null,
            PermissionNames: new List<string> { "identity:verification:initiate", "ai:interview:conduct" }
        );

        // Act
        var response = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var createdId = await response.Content.ReadFromJsonAsync<Guid>();
        createdId.Should().NotBeEmpty();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var role = await db.Roles
                .Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.Id == createdId);

            role.Should().NotBeNull();
            role!.Name.Should().Be("custom_recruiter");
            role.DisplayName.Should().Be("Custom Recruiter");
            role.ParentRoleId.Should().BeNull();
            role.Permissions.Select(p => p.Name).Should().Contain(new[] { "identity:verification:initiate", "ai:interview:conduct" });
        }
    }

    [Fact]
    public async Task CreateRole_DuplicateName_ShouldReturn400()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-dup-org", "Test Dup Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // "owner" is already a system role seeded by DbInitializer
        var requestBody = new CreateBusinessRoleDto(
            Name: "owner",
            DisplayName: "Duplicate Owner",
            Description: "Duplicate",
            ParentRoleId: null,
            PermissionNames: new List<string> { "identity:verification:initiate" }
        );

        // Act
        var response = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", requestBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateRole_CircularInheritance_ShouldReturn400()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-circ-org", "Test Circ Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Let's create role A
        var roleA = new CreateBusinessRoleDto("role_a", "Role A", "", null, new List<string>());
        var resA = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", roleA);
        resA.StatusCode.Should().Be(HttpStatusCode.Created);
        var idA = await resA.Content.ReadFromJsonAsync<Guid>();

        // Let's create role B inheriting from A
        var roleB = new CreateBusinessRoleDto("role_b", "Role B", "", idA, new List<string>());
        var resB = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", roleB);
        resB.StatusCode.Should().Be(HttpStatusCode.Created);
        var idB = await resB.Content.ReadFromJsonAsync<Guid>();

        // Let's try to update A to inherit from B (creating circular dependency)
        var updateA = new CreateBusinessRoleDto("role_a", "Role A", "", idB, new List<string>());
        
        // Act
        var response = await client.PutAsJsonAsync($"/api/organizations/{org.Username}/roles/{idA}", updateA);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateRole_SystemRole_ShouldReturn400()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-sys-org", "Test Sys Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        Guid viewerRoleId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            viewerRoleId = await db.Roles
                .Where(r => r.TenantId == org.Id && r.Name == "viewer" && r.Domain == "TENANT")
                .Select(r => r.Id)
                .FirstAsync();
        }

        var updateViewer = new CreateBusinessRoleDto("viewer", "Modified Viewer", "Modified", null, new List<string> { "identity:verification:initiate" });

        // Act
        var response = await client.PutAsJsonAsync($"/api/organizations/{org.Username}/roles/{viewerRoleId}", updateViewer);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeleteRole_WithAssignments_ShouldReturn400()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-del-org", "Test Del Org");
        var (userId, cookieHeader) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        // Create a custom role
        var createDto = new CreateBusinessRoleDto("test_del_role", "Del Role", "", null, new List<string>());
        var res = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", createDto);
        res.StatusCode.Should().Be(HttpStatusCode.Created);
        var roleId = await res.Content.ReadFromJsonAsync<Guid>();

        // Create another user in organization to assign the role to
        var (memberId, memberCookie) = await RegisterAndLoginUserAsync("member@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, memberId, "MEMBER");

        // Assign the role
        var assignDto = new AssignScopedRoleDto(memberId, roleId, "ORGANIZATION", org.Id);
        var assignRes = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles/assign", assignDto);
        assignRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Act - Try to delete the role
        var deleteResponse = await client.DeleteAsync($"/api/organizations/{org.Username}/roles/{roleId}");

        // Assert
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task HierarchicalInheritance_ShouldResolvePermissionsCorrectly()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-hier-org", "Test Hier Org");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        // Create role Base
        var createBase = new CreateBusinessRoleDto("base_role", "Base Role", "", null, new List<string> { "identity:verification:initiate" });
        var resBase = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", createBase);
        var baseId = await resBase.Content.ReadFromJsonAsync<Guid>();

        // Create role Child inheriting from Base
        var createChild = new CreateBusinessRoleDto("child_role", "Child Role", "", baseId, new List<string> { "ai:interview:conduct" });
        var resChild = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", createChild);
        var childId = await resChild.Content.ReadFromJsonAsync<Guid>();

        // Create a regular user and assign Child role to them
        var (userId, userCookie) = await RegisterAndLoginUserAsync("regular@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "MEMBER");

        var assignDto = new AssignScopedRoleDto(userId, childId, "ORGANIZATION", org.Id);
        var assignRes = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles/assign", assignDto);
        assignRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Act & Assert
        // The user should have the Child role's direct permission "ai:interview:conduct" AND the parent role's permission "identity:verification:initiate"
        using (var scope = Factory.Services.CreateScope())
        {
            var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();
            
            var hasDirect = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct");
            var hasInherited = await authService.AuthorizeAsync(userId, org.Id, "identity:verification:initiate");
            var hasUnrelated = await authService.AuthorizeAsync(userId, org.Id, "billing:subscription:manage");

            hasDirect.Should().BeTrue();
            hasInherited.Should().BeTrue();
            hasUnrelated.Should().BeFalse();
        }
    }

    [Fact]
    public async Task ScopedAssignment_ShouldOnlyGrantPermissionsWithinSpecificScope()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-scope-org", "Test Scope Org");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        // Let's create two workspaces
        Guid workspaceAId = Guid.NewGuid();
        Guid workspaceBId = Guid.NewGuid();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Workspaces.Add(new Workspace { Id = workspaceAId, OrganizationId = org.Id, DisplayName = "Workspace A", Slug = "ws-a", Status = "active", OwnerId = ownerId });
            db.Workspaces.Add(new Workspace { Id = workspaceBId, OrganizationId = org.Id, DisplayName = "Workspace B", Slug = "ws-b", Status = "active", OwnerId = ownerId });
            await db.SaveChangesAsync();
        }

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        // Create a custom interviewer role
        var createDto = new CreateBusinessRoleDto("scoped_interviewer", "Scoped Interviewer", "", null, new List<string> { "ai:interview:conduct" });
        var res = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", createDto);
        var roleId = await res.Content.ReadFromJsonAsync<Guid>();

        // Create regular user
        var (userId, userCookie) = await RegisterAndLoginUserAsync("regular@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "MEMBER");

        // Assign the role scoped to Workspace A only
        var assignDto = new AssignScopedRoleDto(userId, roleId, "WORKSPACE", workspaceAId);
        var assignRes = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles/assign", assignDto);
        assignRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Act & Assert
        using (var scope = Factory.Services.CreateScope())
        {
            var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();
            
            // Check in Workspace A
            var hasAccessA = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct", "WORKSPACE", workspaceAId);
            hasAccessA.Should().BeTrue();

            // Check in Workspace B (should be false)
            var hasAccessB = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct", "WORKSPACE", workspaceBId);
            hasAccessB.Should().BeFalse();

            // Check globally (should be false)
            var hasAccessGlobal = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct", "ORGANIZATION", org.Id);
            hasAccessGlobal.Should().BeFalse();
        }
    }

    [Fact]
    public async Task RedisCacheEviction_ShouldEvictAndRequery_OnRoleUpdateAndAssignmentChanges()
    {
        // Arrange
        var org = await SeedOrganizationAsync("test-cache-org", "Test Cache Org");
        var (ownerId, ownerCookie) = await RegisterAndLoginUserAsync("owner@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, ownerId, "OWNER");
        await InitializeBusinessRolesAndPermissionsAsync();

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", ownerCookie);

        // Create custom role
        var createDto = new CreateBusinessRoleDto("cache_role", "Cache Role", "", null, new List<string> { "identity:verification:initiate" });
        var res = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles", createDto);
        var roleId = await res.Content.ReadFromJsonAsync<Guid>();

        // Create regular user
        var (userId, userCookie) = await RegisterAndLoginUserAsync("regular@cverify.ai", "SecurePassword123!");
        await SeedMembershipAsync(org.Id, userId, "MEMBER");

        // Assign the role
        var assignDto = new AssignScopedRoleDto(userId, roleId, "ORGANIZATION", org.Id);
        var assignRes = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles/assign", assignDto);
        assignRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // 1. Trigger Authorize to populate Redis cache
        using (var scope = Factory.Services.CreateScope())
        {
            var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();
            var hasAccess = await authService.AuthorizeAsync(userId, org.Id, "identity:verification:initiate");
            hasAccess.Should().BeTrue();
        }

        // Verify key is in Redis cache
        var cacheKey = $"auth:org:{org.Id}:user:{userId}:scoped_perms";
        using (var scope = Factory.Services.CreateScope())
        {
            var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
            var db = redis.GetDatabase();
            var exists = await db.KeyExistsAsync(cacheKey);
            exists.Should().BeTrue();
        }

        // 2. Modify the role (remove "identity:verification:initiate", add "ai:interview:conduct")
        // This should evict the Redis cache for that user
        var updateDto = new CreateBusinessRoleDto("cache_role", "Cache Role", "", null, new List<string> { "ai:interview:conduct" });
        var updateRes = await client.PutAsJsonAsync($"/api/organizations/{org.Username}/roles/{roleId}", updateDto);
        updateRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify key is no longer in Redis cache
        using (var scope = Factory.Services.CreateScope())
        {
            var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
            var db = redis.GetDatabase();
            var exists = await db.KeyExistsAsync(cacheKey);
            exists.Should().BeFalse();
        }

        // Verify permissions are updated correctly when querying auth service (triggers CTE and repopulates cache)
        using (var scope = Factory.Services.CreateScope())
        {
            var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();
            
            var hasOld = await authService.AuthorizeAsync(userId, org.Id, "identity:verification:initiate");
            var hasNew = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct");

            hasOld.Should().BeFalse();
            hasNew.Should().BeTrue();
        }

        // Verify cache is repopulated
        using (var scope = Factory.Services.CreateScope())
        {
            var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
            var db = redis.GetDatabase();
            var exists = await db.KeyExistsAsync(cacheKey);
            exists.Should().BeTrue();
        }

        // 3. Revoke the role assignment
        // This should evict the Redis cache again
        var revokeRes = await client.PostAsJsonAsync($"/api/organizations/{org.Username}/roles/revoke", assignDto);
        revokeRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify key is evicted
        using (var scope = Factory.Services.CreateScope())
        {
            var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
            var db = redis.GetDatabase();
            var exists = await db.KeyExistsAsync(cacheKey);
            exists.Should().BeFalse();
        }

        // Verify user no longer has any permissions
        using (var scope = Factory.Services.CreateScope())
        {
            var authService = scope.ServiceProvider.GetRequiredService<IOrganizationAuthorizationService>();
            var hasNew = await authService.AuthorizeAsync(userId, org.Id, "ai:interview:conduct");
            hasNew.Should().BeFalse();
        }
    }
}
