using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.Storage.DTOs;
using CVerify.API.Modules.Shared.Storage.Enums;

namespace CVerify.API.IntegrationTests.Auth;

/// <summary>
/// Verifies the end-to-end integration lifecycle for user profile avatars and ownership flags.
/// Ensures that subsequent Google OAuth logins do not overwrite custom user-uploaded avatars,
/// that linking Google retains the existing avatar, and that deletion/synchronization behave correctly.
/// </summary>
public class AvatarOwnershipTests : BaseIntegrationTest
{
    public AvatarOwnershipTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task SeedDefaultRolesAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new Role
            {
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic application access",
                IsSystem = true,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }
    }

    private async Task<string> RegisterAndPasswordLoginUserAsync(string email, string password)
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Register new profile via endpoint
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: password,
            ConfirmPassword: password,
            FullName: "Test Local User"
        );
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest).ConfigureAwait(false);
        regResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Activate profile manually in database
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email).ConfigureAwait(false);
            user.Should().NotBeNull();
            user!.Status = UserStatus.ACTIVE;
            user.EmailVerifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        // Login to get access token cookie
        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest).ConfigureAwait(false);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        return setCookie.Split(';')[0];
    }

    [Fact]
    public async Task Google_Registration_Then_Upload_Avatar_Then_Google_Login_Should_Not_Overwrite_Custom_Avatar()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // 1. Configure google validator for registration
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-1111",
                Email = "google-user-1111@cverify.ai",
                EmailVerified = true,
                Name = "Google Test User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        // Configure storage mock
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-1111.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-1111.png");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // 2. Register via Google Login
        var loginResponse1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        loginResponse1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify initial state in DB
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-1111@cverify.ai").ConfigureAwait(false);
            user.Should().NotBeNull();
            user!.AvatarUrl.Should().Be("http://googleusercontent.com/avatar-original.jpg");
            user.AvatarSource.Should().Be(AvatarSource.Google);
        }

        // Authenticate client
        var setCookie = loginResponse1.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 3. Upload custom avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");

        var uploadResponse = await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify custom upload in DB
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-1111@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-1111.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);
        }

        // 4. Subsequent Google Login where Google returns a new avatar
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-1111",
                Email = "google-user-1111@cverify.ai",
                EmailVerified = true,
                Name = "Google Test User",
                Picture = "http://googleusercontent.com/avatar-updated.jpg"
            });

        // Trigger subsequent login
        var loginResponse2 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-2")).ConfigureAwait(false);
        loginResponse2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify manual upload remains untouched
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-1111@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-1111.png"); // Unchanged
            user.AvatarSource.Should().Be(AvatarSource.Uploaded); // Unchanged

            // Provider avatar URL metadata should have been updated in the DB
            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "Google").ConfigureAwait(false);
            provider.Should().NotBeNull();
            provider!.ProviderAvatarUrl.Should().Be("http://googleusercontent.com/avatar-updated.jpg");
        }
    }

    [Fact]
    public async Task Link_Google_Provider_Should_Retain_Custom_Uploaded_Avatar()
    {
        var email = "link-user-2222@cverify.ai";
        var password = "SecurePassword123!";

        // Mock Storage
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-2222.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-2222.png");

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-2222",
                Email = email,
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // 1. Register & Login via local flow
        var cookieVal = await RegisterAndPasswordLoginUserAsync(email, password).ConfigureAwait(false);
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 2. Upload custom avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");

        var uploadResponse = await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Link Google account
        var linkResponse = await customClient.PostAsJsonAsync("/api/auth/providers/google", new LinkGoogleRequest(IdToken: "link-token-2")).ConfigureAwait(false);
        linkResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. Verify manual avatar and source remain untouched
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email).ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-2222.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);

            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "google").ConfigureAwait(false);
            provider.Should().NotBeNull();
            provider!.ProviderAvatarUrl.Should().Be("http://googleusercontent.com/avatar-original.jpg");
        }
    }

    [Fact]
    public async Task Google_Avatar_Updates_Externally_Should_Update_ProviderAvatarUrl_Metadata_But_Not_Display_Avatar_If_Uploaded()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-3333",
                Email = "google-user-3333@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        // Mock Storage
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-3333.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-3333.png");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // Register Google user
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        var cookieVal = login1.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token")).Split(';')[0];
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // Upload avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");
        await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);

        // Change avatar URL returned by Google
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-3333",
                Email = "google-user-3333@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-brandnew.jpg"
            });

        // Google login again
        var login2 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-2")).ConfigureAwait(false);
        login2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify active avatar is unchanged, but provider avatar metadata is updated
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-3333@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-3333.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);

            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "Google").ConfigureAwait(false);
            provider!.ProviderAvatarUrl.Should().Be("http://googleusercontent.com/avatar-brandnew.jpg");
        }
    }

    [Fact]
    public async Task Google_Avatar_Updates_Externally_Should_Update_Display_Avatar_If_Source_Is_Google()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-4444",
                Email = "google-user-4444@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // Register Google user
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        login1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Change picture returned by Google
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-4444",
                Email = "google-user-4444@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-new.jpg"
            });

        // Google login again
        var login2 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-2")).ConfigureAwait(false);
        login2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify display avatar updated since active source is Google
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-4444@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("http://googleusercontent.com/avatar-new.jpg");
            user.AvatarSource.Should().Be(AvatarSource.Google);
        }
    }

    [Fact]
    public async Task Multiple_Consecutive_OAuth_Logins_Should_Maintain_Stable_Ownership()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-5555",
                Email = "google-user-5555@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        // Mock Storage
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-5555.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-5555.png");

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // 1. Google Register
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        var cookieVal = login1.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token")).Split(';')[0];
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 2. Upload manual avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");
        await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);

        // 3. Perform 3 consecutive logins
        for (int i = 2; i <= 4; i++)
        {
            var loginN = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: $"token-{i}")).ConfigureAwait(false);
            loginN.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        // 4. Verify user avatar remains custom
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-5555@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-5555.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);
        }
    }

    [Fact]
    public async Task Avatar_Deletion_Should_Clean_Up_Physical_Storage_And_Subsequent_Logins_Should_Not_Restore_It()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-6666",
                Email = "google-user-6666@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        // Mock Storage
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-6666.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-6666.png");

        // Verify DeleteFileAsync is physically called
        var deleteCalled = false;
        mockStorage.Setup(s => s.DeleteFileAsync("avatars/user-custom-key-6666.png", It.IsAny<CancellationToken>()))
            .Callback(() => deleteCalled = true)
            .Returns(Task.CompletedTask);

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // 1. Google Register
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        var cookieVal = login1.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token")).Split(';')[0];
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 2. Upload manual avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");
        await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);

        // Verify DB uploaded state
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-6666@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-6666.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);
        }

        // 3. Call DELETE api/v1/users/profile/avatar
        var deleteResponse = await customClient.DeleteAsync("/api/v1/users/profile/avatar").ConfigureAwait(false);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Assert physical storage deletion occurred and source reset to Default
        deleteCalled.Should().BeTrue();

        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-6666@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().BeNull();
            user.AvatarSource.Should().Be(AvatarSource.Default);
        }

        // 4. Subsequent Google Login
        var login2 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-2")).ConfigureAwait(false);
        login2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert subsequent login does NOT automatically restore the picture
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-6666@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().BeNull(); // Still null
            user.AvatarSource.Should().Be(AvatarSource.Default); // Still Default
        }
    }

    [Fact]
    public async Task Sync_Avatar_Should_Explicitly_Synchronize_With_Provider()
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Mock Validator
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = "google-subject-7777",
                Email = "google-user-7777@cverify.ai",
                EmailVerified = true,
                Name = "Google User",
                Picture = "http://googleusercontent.com/avatar-original.jpg"
            });

        // Mock Storage
        var mockStorage = new Mock<IStorageService>();
        mockStorage.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<StorageModule>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageFileDto
            {
                Bucket = "profile-bucket",
                ObjectKey = "avatars/user-custom-key-7777.png",
                MimeType = "image/png",
                Size = 1000
            });
        mockStorage.Setup(s => s.GetSignedUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed-url.com/avatars/user-custom-key-7777.png");

        // Verify DeleteFileAsync is physically called when syncing
        var deleteCalled = false;
        mockStorage.Setup(s => s.DeleteFileAsync("avatars/user-custom-key-7777.png", It.IsAny<CancellationToken>()))
            .Callback(() => deleteCalled = true)
            .Returns(Task.CompletedTask);

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
                services.Replace(ServiceDescriptor.Scoped<IStorageService>(_ => mockStorage.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // 1. Google Register
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "token-1")).ConfigureAwait(false);
        var cookieVal = login1.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token")).Split(';')[0];
        customClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 2. Upload manual avatar
        using var content = new MultipartFormDataContent();
        var fileStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(streamContent, "file", "avatar.png");
        await customClient.PostAsync("/api/v1/users/profile/avatar", content).ConfigureAwait(false);

        // Verify DB uploaded state
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-7777@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("avatars/user-custom-key-7777.png");
            user.AvatarSource.Should().Be(AvatarSource.Uploaded);
        }

        // 3. Call POST api/v1/users/profile/avatar/sync
        var syncRequest = new SyncAvatarRequest(ProviderName: "google");
        var syncResponse = await customClient.PostAsJsonAsync("/api/v1/users/profile/avatar/sync", syncRequest).ConfigureAwait(false);
        syncResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify old manual file is deleted physically and DB matches Google provider
        deleteCalled.Should().BeTrue();

        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "google-user-7777@cverify.ai").ConfigureAwait(false);
            user!.AvatarUrl.Should().Be("http://googleusercontent.com/avatar-original.jpg");
            user.AvatarSource.Should().Be(AvatarSource.Google);

            var log = await db.ProfileActivityLogs.FirstOrDefaultAsync(l => l.UserId == user.Id && l.ActionType == "SYNC_AVATAR").ConfigureAwait(false);
            log.Should().NotBeNull();
        }
    }
}
