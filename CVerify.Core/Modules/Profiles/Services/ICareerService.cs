using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICareerService
{
    Task<CareerPreferenceResponse> GetCareerPreferenceByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<CareerPreferenceResponse> UpdateCareerPreferenceAsync(
        Guid userId, 
        UpdateCareerPreferenceRequest request, 
        CancellationToken cancellationToken = default);
}
