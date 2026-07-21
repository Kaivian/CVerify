using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IObservabilityMetricsCollector
{
    Task<SystemMetricsResponseDto> CollectMetricsAsync();
    void RecordRequestStart();
    void RecordRequestEnd();
}
