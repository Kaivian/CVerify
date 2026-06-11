using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICareerService
{
    Task<CareerPreferencesDashboardResponse> GetCareerDashboardAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<CareerPreferencesDashboardResponse> UpdateCareerPreferenceAsync(
        Guid userId, 
        UpdateCareerPreferenceRequest request, 
        CancellationToken cancellationToken = default);

    Task<CareerPreferencesDashboardResponse> AcceptAiSuggestionsAsync(
        Guid userId,
        AcceptAiSuggestionsRequest request,
        CancellationToken cancellationToken = default);
}
