using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Pipelines.Shared.Storage;

public interface IArtifactStorageProvider
{
    Task SaveArtifactAsync(string path, Stream data, CancellationToken cancellationToken = default);
    Task SaveArtifactTextAsync(string path, string content, CancellationToken cancellationToken = default);
    Task<Stream> ReadArtifactAsync(string path, CancellationToken cancellationToken = default);
    Task<string> ReadArtifactTextAsync(string path, CancellationToken cancellationToken = default);
    Task DeleteArtifactAsync(string path, CancellationToken cancellationToken = default);
}
