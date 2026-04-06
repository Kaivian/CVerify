using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// EF Core DbCommandInterceptor that logs SQL queries exceeding a configured execution threshold.
/// </summary>
public class SlowQueryInterceptor : DbCommandInterceptor
{
    private readonly IAppLogger _logger;
    private readonly EnvConfiguration _envConfig;

    public SlowQueryInterceptor(IAppLogger logger, EnvConfiguration envConfig)
    {
        _logger = logger;
        _envConfig = envConfig;
    }

    public override DbDataReader ReaderExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result)
    {
        CheckSlowQuery(command, eventData);
        return base.ReaderExecuted(command, eventData, result);
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        CheckSlowQuery(command, eventData);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override int NonQueryExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result)
    {
        CheckSlowQuery(command, eventData);
        return base.NonQueryExecuted(command, eventData, result);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        CheckSlowQuery(command, eventData);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override object? ScalarExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result)
    {
        CheckSlowQuery(command, eventData);
        return base.ScalarExecuted(command, eventData, result);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result,
        CancellationToken cancellationToken = default)
    {
        CheckSlowQuery(command, eventData);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }

    private void CheckSlowQuery(DbCommand command, CommandExecutedEventData eventData)
    {
        var threshold = _envConfig.Database.SlowQueryThresholdMs;
        var durationMs = eventData.Duration.TotalMilliseconds;

        if (durationMs > threshold)
        {
            _logger.LogDatabase(
                Microsoft.Extensions.Logging.LogLevel.Warning,
                $"Slow database command detected: query execution took {durationMs:F2}ms (Threshold: {threshold}ms). SQL: {command.CommandText}"
            );
        }
    }
}
