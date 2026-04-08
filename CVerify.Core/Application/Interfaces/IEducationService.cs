using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IEducationService
{
    Task<List<EducationEntryResponse>> GetEducationEntriesAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<EducationEntryResponse> CreateEducationEntryAsync(
        Guid userId, 
        EducationEntryRequest request, 
        CancellationToken cancellationToken = default);
        
    Task<EducationEntryResponse> UpdateEducationEntryAsync(
        Guid userId, 
        Guid entryId, 
        EducationEntryRequest request, 
        CancellationToken cancellationToken = default);
        
    Task DeleteEducationEntryAsync(Guid userId, Guid entryId, CancellationToken cancellationToken = default);
    
    Task ReorderEducationEntriesAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default);
}
