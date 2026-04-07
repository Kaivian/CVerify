using System;
using System.Text.Json.Serialization;

namespace CVerify.API.Application.DTOs;

/// <summary>
/// Standardized system health status response payload.
/// </summary>
public class SystemHealthResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("environment")]
    public string Environment { get; set; } = string.Empty;

    [JsonPropertyName("services")]
    public HealthServices Services { get; set; } = new();
}

/// <summary>
/// Status of individual infrastructure components.
/// </summary>
public class HealthServices
{
    [JsonPropertyName("database")]
    public string Database { get; set; } = string.Empty;

    [JsonPropertyName("auth")]
    public string Auth { get; set; } = string.Empty;

    [JsonPropertyName("redis")]
    public string Redis { get; set; } = string.Empty;

    [JsonPropertyName("ai")]
    public string Ai { get; set; } = string.Empty;

    [JsonPropertyName("cloudflare")]
    public string Cloudflare { get; set; } = string.Empty;
}
