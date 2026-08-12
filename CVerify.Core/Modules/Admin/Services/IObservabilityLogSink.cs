using System.Collections.Generic;
using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IObservabilityLogSink
{
    Task AddLogEntryAsync(ObservabilityLogEntryDto entry);
    IEnumerable<ObservabilityLogEntryDto> GetRecentLogs(string service = "ALL", int count = 200);
    void ClearLogs(string service = "ALL");
}
