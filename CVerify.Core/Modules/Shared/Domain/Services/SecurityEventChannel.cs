using System.Threading.Channels;
using CVerify.API.Modules.Shared.Domain.Models;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class SecurityEventChannel
{
    private readonly Channel<SecurityEventCreationContext> _channel;

    public SecurityEventChannel()
    {
        // Unbounded channel configured for single reader (the hosted worker job) and multi-writer
        _channel = Channel.CreateUnbounded<SecurityEventCreationContext>(new UnboundedChannelOptions
        {
            SingleReader = true,
            AllowSynchronousContinuations = false
        });
    }

    public ChannelWriter<SecurityEventCreationContext> Writer => _channel.Writer;
    public ChannelReader<SecurityEventCreationContext> Reader => _channel.Reader;
}
