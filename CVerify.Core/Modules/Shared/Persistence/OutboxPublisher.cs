using System;
using System.Text.Json;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Email.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public interface IOutboxPublisher
{
    Task PublishAsync<T>(string eventType, T payload) where T : class;
    void Enqueue<T>(string eventType, T payload) where T : class;
}

public class OutboxPublisher : IOutboxPublisher
{
    private readonly ApplicationDbContext _context;

    public OutboxPublisher(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task PublishAsync<T>(string eventType, T payload) where T : class
    {
        Enqueue(eventType, payload);
        await _context.SaveChangesAsync().ConfigureAwait(false);
    }

    public void Enqueue<T>(string eventType, T payload) where T : class
    {
        var message = new OutboxMessage
        {
            Id = Guid.CreateVersion7(),
            Type = eventType,
            Payload = JsonSerializer.Serialize(payload),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.OutboxMessages.Add(message);
    }
}
