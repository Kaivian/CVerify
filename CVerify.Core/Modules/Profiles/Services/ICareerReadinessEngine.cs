using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICareerReadinessEngine
{
    Task<CareerReadinessReportDto> CalculateReadinessAsync(
        CareerPreference career,
        CancellationToken cancellationToken = default);
}
