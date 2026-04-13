namespace CVerify.API.Modules.Shared.Domain.Enums;

public enum ProviderScopeStatus
{
    Valid = 0,
    Revoked = 1,
    Expired = 2,
    Degraded = 3,
    ReconnectRequired = 4
}
