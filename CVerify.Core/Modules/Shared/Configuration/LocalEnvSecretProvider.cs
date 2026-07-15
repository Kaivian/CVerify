using System;

namespace CVerify.API.Modules.Shared.Configuration;

public class LocalEnvSecretProvider : ISecretProvider
{
    public string GetSecret(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return "";

        // Standard OS environment variable lookup
        return Environment.GetEnvironmentVariable(key) ?? "";
    }
}
