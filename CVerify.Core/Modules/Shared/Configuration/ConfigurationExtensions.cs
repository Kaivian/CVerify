using System.Text.RegularExpressions;

namespace CVerify.API.Modules.Shared.Configuration;

public static class ConfigurationExtensions
{
    private static readonly Regex EnvPattern =
        new(@"\$\{([^}]+)\}", RegexOptions.Compiled);

    public static string ResolveEnvironmentVariables(this string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value;

        return EnvPattern.Replace(value, match =>
        {
            var envKey = match.Groups[1].Value;

            return Environment.GetEnvironmentVariable(envKey) ?? "";
        });
    }
}
