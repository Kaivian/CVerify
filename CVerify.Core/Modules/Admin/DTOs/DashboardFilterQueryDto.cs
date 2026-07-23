using System;

namespace CVerify.API.Modules.Admin.DTOs;

public class DashboardFilterQueryDto
{
    public string TimeRange { get; set; } = "24h"; // 10m, 30m, 1h, 6h, 24h, 7d, custom
    public DateTimeOffset? CustomStartDate { get; set; }
    public DateTimeOffset? CustomEndDate { get; set; }
    public string Environment { get; set; } = "all"; // all, development, staging, production
    public string OrganizationId { get; set; } = "all"; // all, or specific org ID/slug
    public string AiProvider { get; set; } = "all"; // all, openai, anthropic, gemini, local
    public string Region { get; set; } = "all"; // all, us-east, us-west, eu-central, ap-southeast
    public string Status { get; set; } = "all"; // all, healthy, warning, critical, offline

    public DateTimeOffset GetStartTime()
    {
        var now = DateTimeOffset.UtcNow;
        if (TimeRange == "custom" && CustomStartDate.HasValue)
        {
            return CustomStartDate.Value;
        }

        return TimeRange?.ToLowerInvariant() switch
        {
            "10m" => now.AddMinutes(-10),
            "30m" => now.AddMinutes(-30),
            "1h" => now.AddHours(-1),
            "6h" => now.AddHours(-6),
            "24h" => now.AddHours(-24),
            "7d" => now.AddDays(-7),
            _ => now.AddHours(-24)
        };
    }

    public DateTimeOffset GetEndTime()
    {
        if (TimeRange == "custom" && CustomEndDate.HasValue)
        {
            return CustomEndDate.Value;
        }

        return DateTimeOffset.UtcNow;
    }

    public string GetCacheSuffix()
    {
        return $"{TimeRange}_{Environment}_{OrganizationId}_{AiProvider}_{Region}_{Status}";
    }
}
