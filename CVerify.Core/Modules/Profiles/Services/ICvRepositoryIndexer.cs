using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICvRepositoryIndexer
{
    Task IndexUserCvRepositoriesAsync(Guid userId, CancellationToken cancellationToken);
}
