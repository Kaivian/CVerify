using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class AiCancellationManagerTests
{
    private readonly IAiCancellationManager _manager;

    public AiCancellationManagerTests()
    {
        _manager = new AiCancellationManager();
    }

    [Fact]
    public void Register_ShouldProvideLinkedCancellationToken()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        using var externalCts = new CancellationTokenSource();

        // Act
        var token = _manager.Register(sessionId, externalCts.Token);

        // Assert
        token.Should().NotBeNull();
        token.IsCancellationRequested.Should().BeFalse();

        // Cleanup
        _manager.Unregister(sessionId);
    }

    [Fact]
    public void Cancel_ShouldTriggerCancellationOnLinkedToken()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        var token = _manager.Register(sessionId, CancellationToken.None);

        // Act
        _manager.Cancel(sessionId);

        // Assert
        token.IsCancellationRequested.Should().BeTrue();
    }

    [Fact]
    public void Register_AlreadyRegisteredSession_ShouldCancelOldAndRegisterNew()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        var firstToken = _manager.Register(sessionId, CancellationToken.None);

        // Act
        var secondToken = _manager.Register(sessionId, CancellationToken.None);

        // Assert
        firstToken.IsCancellationRequested.Should().BeTrue();
        secondToken.IsCancellationRequested.Should().BeFalse();

        // Cleanup
        _manager.Unregister(sessionId);
    }

    [Fact]
    public void Cancel_NonExistentSession_ShouldBeIdempotentAndNotThrow()
    {
        // Arrange
        var sessionId = Guid.NewGuid();

        // Act & Assert
        Action act = () => _manager.Cancel(sessionId);
        act.Should().NotThrow();
    }

    [Fact]
    public void Unregister_ShouldCleanupAndNotThrow()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        _manager.Register(sessionId, CancellationToken.None);

        // Act & Assert
        Action act = () => _manager.Unregister(sessionId);
        act.Should().NotThrow();

        // Double unregister should also be safe
        Action act2 = () => _manager.Unregister(sessionId);
        act2.Should().NotThrow();
    }

    [Fact]
    public async Task Concurrency_ShouldHandleRapidRegisterCancelUnregister()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        int tasksCount = 50;
        var tasks = new Task[tasksCount];

        // Act
        for (int i = 0; i < tasksCount; i++)
        {
            var index = i;
            tasks[i] = Task.Run(() =>
            {
                if (index % 3 == 0)
                {
                    _manager.Register(sessionId, CancellationToken.None);
                }
                else if (index % 3 == 1)
                {
                    _manager.Cancel(sessionId);
                }
                else
                {
                    _manager.Unregister(sessionId);
                }
            });
        }

        // Assert
        Func<Task> act = async () => await Task.WhenAll(tasks);
        await act.Should().NotThrowAsync();
    }
}
