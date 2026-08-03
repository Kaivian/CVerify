using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ITechnologyNormalizationService
{
    Task<NormalizedSkillResult> NormalizeAsync(string rawName, CancellationToken cancellationToken = default);
}

public record NormalizedSkillResult(
    string SkillId,
    string NormalizedName,
    string SfiaCategory,
    string OnetCode,
    bool Found
);
