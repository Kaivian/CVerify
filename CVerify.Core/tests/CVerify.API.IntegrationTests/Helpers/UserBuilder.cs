
using System;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.IntegrationTests.Helpers;

public class UserBuilder
{
    private string _email = "test@example.com";
    private string _password = "Password123!";
    private string _fullName = "Test User";
    private UserStatus _status = UserStatus.EMAIL_VERIFY_PENDING;
    private Guid _roleId = Guid.Empty;
    private Role? _role = null;

    private string? _username = null;

    public UserBuilder WithUsername(string username)
    {
        _username = username;
        return this;
    }

    public UserBuilder WithEmail(string email)
    {
        _email = email;
        return this;
    }

    public UserBuilder WithPassword(string password)
    {
        _password = password;
        return this;
    }

    public UserBuilder WithFullName(string fullName)
    {
        _fullName = fullName;
        return this;
    }

    public UserBuilder WithStatus(UserStatus status)
    {
        _status = status;
        return this;
    }

    public UserBuilder WithRole(Guid roleId)
    {
        _roleId = roleId;
        return this;
    }

    public UserBuilder WithRole(Role role)
    {
        _role = role;
        return this;
    }

    public User Build()
    {
        var finalUsername = _username;
        if (string.IsNullOrEmpty(finalUsername))
        {
            var localPart = _email.Split('@')[0].ToLowerInvariant();
            var clean = new System.Text.StringBuilder();
            foreach (var c in localPart)
            {
                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_')
                {
                    clean.Append(c);
                }
            }
            finalUsername = clean.ToString();
            if (finalUsername.Length < 3) finalUsername = "user_" + Guid.NewGuid().ToString("N").Substring(0, 5);
            if (finalUsername.Length > 32) finalUsername = finalUsername.Substring(0, 32);
        }

        var user = new User
        {
            Email = _email,
            Username = finalUsername,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(_password),
            FullName = _fullName,
            Status = _status,
            CreatedAt = DateTimeOffset.UtcNow.UtcDateTime,
            UpdatedAt = DateTimeOffset.UtcNow.UtcDateTime
        };

        if (_role != null)
        {
            user.Roles.Add(_role);
        }
        else if (_roleId != Guid.Empty)
        {
            user.Roles.Add(new Role { Id = _roleId, Name = "USER", DisplayName = "User", IsActive = true });
        }

        return user;
    }
}
