namespace CVerify.API.Modules.Shared.Configuration;

public interface ISecretProvider
{
    string GetSecret(string key);
}
