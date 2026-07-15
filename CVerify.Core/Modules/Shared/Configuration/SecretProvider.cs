namespace CVerify.API.Modules.Shared.Configuration;

public static class SecretProvider
{
    public static ISecretProvider Active { get; set; } = new LocalEnvSecretProvider();
}
