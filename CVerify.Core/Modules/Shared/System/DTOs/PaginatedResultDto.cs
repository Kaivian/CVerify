using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.System.DTOs;

public record PaginatedResultDto<T>(
    IEnumerable<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
