using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface ICareerService
{
    Task<CareerPreferenceResponse> GetCareerPreferenceByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<CareerPreferenceResponse> UpdateCareerPreferenceAsync(
        Guid userId, 
        UpdateCareerPreferenceRequest request, 
        CancellationToken cancellationToken = default);
}
