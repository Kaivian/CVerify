namespace CVerify.API.Modules.SourceCode.Models;

public record CanonicalRepositoryIdentity(
    string ProviderType,       // e.g. "github", "gitlab"
    string ProviderRepoId,     // e.g. external repository ID
    string CanonicalUrl        // e.g. normalized HTML URL
);
