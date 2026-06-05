using System;
using System.Threading.Tasks;

namespace CVerify.API.Modules.SourceCode.Services;

public interface IRepositoryAnalysisQueue
{
    Task EnqueueJobAsync(Guid jobId);
    Task<Guid?> DequeueJobAsync();
}
