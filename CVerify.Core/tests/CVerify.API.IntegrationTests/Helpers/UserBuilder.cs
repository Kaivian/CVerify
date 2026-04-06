using System;
using CVerify.API.Core.Entities;

namespace CVerify.API.IntegrationTests.Helpers;

public class UserBuilder
{
    private string _email = "test@example.com";
    private string _password = "Password123!";
    private string _fullName = "Test User";
    private UserStatus _status = UserStatus.EMAIL_VERIFY_PENDING;
    private Guid _roleId = Guid.Empty;
    private Role? _role = null;

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
        var user = new User
        {
            Email = _email,
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
