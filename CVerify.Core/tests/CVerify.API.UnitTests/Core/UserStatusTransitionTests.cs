
using System;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.UnitTests.Core;

/// <summary>
/// Exhaustive unit tests for the formal user status transition state machine defined in <see cref="User"/>.
/// </summary>
public class UserStatusTransitionTests
{
    [Theory]
    [InlineData(UserStatus.EMAIL_VERIFY_PENDING, UserStatus.ACTIVE)]
    [InlineData(UserStatus.EMAIL_VERIFY_PENDING, UserStatus.DELETED)]
    [InlineData(UserStatus.ACTIVE, UserStatus.SUSPENDED)]
    [InlineData(UserStatus.ACTIVE, UserStatus.BANNED)]
    [InlineData(UserStatus.ACTIVE, UserStatus.DELETED)]
    [InlineData(UserStatus.SUSPENDED, UserStatus.ACTIVE)]
    [InlineData(UserStatus.SUSPENDED, UserStatus.BANNED)]
    [InlineData(UserStatus.SUSPENDED, UserStatus.DELETED)]
    [InlineData(UserStatus.BANNED, UserStatus.ACTIVE)]
    [InlineData(UserStatus.BANNED, UserStatus.DELETED)]
    public void TransitionTo_ShouldSucceed_ForValidTransitions(UserStatus initialStatus, UserStatus targetStatus)
    {
        // Arrange
        var user = new User
        {
            Status = initialStatus
        };

        // Act
        user.TransitionTo(targetStatus);

        // Assert
        user.Status.Should().Be(targetStatus);
    }

    [Theory]
    [InlineData(UserStatus.EMAIL_VERIFY_PENDING, UserStatus.SUSPENDED)]
    [InlineData(UserStatus.EMAIL_VERIFY_PENDING, UserStatus.BANNED)]
    [InlineData(UserStatus.ACTIVE, UserStatus.EMAIL_VERIFY_PENDING)]
    [InlineData(UserStatus.SUSPENDED, UserStatus.EMAIL_VERIFY_PENDING)]
    [InlineData(UserStatus.BANNED, UserStatus.EMAIL_VERIFY_PENDING)]
    [InlineData(UserStatus.BANNED, UserStatus.SUSPENDED)]
    [InlineData(UserStatus.DELETED, UserStatus.EMAIL_VERIFY_PENDING)]
    [InlineData(UserStatus.DELETED, UserStatus.ACTIVE)]
    [InlineData(UserStatus.DELETED, UserStatus.SUSPENDED)]
    [InlineData(UserStatus.DELETED, UserStatus.BANNED)]
    public void TransitionTo_ShouldThrowInvalidOperationException_ForInvalidTransitions(UserStatus initialStatus, UserStatus targetStatus)
    {
        // Arrange
        var user = new User
        {
            Status = initialStatus
        };

        // Act
        Action act = () => user.TransitionTo(targetStatus);

        // Assert
        act.Should().Throw<InvalidOperationException>()
           .WithMessage($"*Invalid user status transition from {initialStatus} to {targetStatus}.*");
    }
}
