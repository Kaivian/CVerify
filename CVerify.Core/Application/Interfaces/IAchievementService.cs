using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IAchievementService
{
    Task<List<AcademicAchievementResponse>> GetAchievementsAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<AcademicAchievementResponse> CreateAchievementAsync(
        Guid userId, 
        AcademicAchievementRequest request, 
        CancellationToken cancellationToken = default);
        
    Task<AcademicAchievementResponse> UpdateAchievementAsync(
        Guid userId, 
        Guid achievementId, 
        AcademicAchievementRequest request, 
        CancellationToken cancellationToken = default);
        
    Task DeleteAchievementAsync(Guid userId, Guid achievementId, CancellationToken cancellationToken = default);
    
    Task ReorderAchievementsAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default);
}
