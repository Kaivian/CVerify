using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.System.DTOs;

public class DatabaseStatusResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("database")]
    public string Database { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }
}
