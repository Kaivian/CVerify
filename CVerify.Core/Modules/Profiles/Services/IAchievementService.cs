using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

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
