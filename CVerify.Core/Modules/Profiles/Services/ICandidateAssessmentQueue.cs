using System;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICandidateAssessmentQueue
{
    Task EnqueueAssessmentAsync(Guid assessmentId);
    Task<Guid?> DequeueAssessmentAsync();
}
