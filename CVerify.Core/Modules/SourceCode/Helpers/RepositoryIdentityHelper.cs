using System;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.SourceCode.Models;

namespace CVerify.API.Modules.SourceCode.Helpers;

public static class RepositoryIdentityHelper
{
    public static CanonicalRepositoryIdentity GetIdentity(this SourceCodeRepository repo)
    {
        if (repo == null)
        {
            throw new ArgumentNullException(nameof(repo));
        }

        var providerType = repo.AuthProvider?.ProviderName?.ToLowerInvariant() ?? "unknown";
        return new CanonicalRepositoryIdentity(
            ProviderType: providerType,
            ProviderRepoId: repo.ExternalRepositoryId,
            CanonicalUrl: NormalizeUrl(repo.HtmlUrl)
        );
    }

    public static string NormalizeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return string.Empty;
        }

        var clean = url.Trim().ToLowerInvariant();

        // Remove git suffixes
        if (clean.EndsWith(".git"))
        {
            clean = clean.Substring(0, clean.Length - 4);
        }

        // Convert SSH formats to standard HTTPS
        clean = clean.Replace("git@github.com:", "https://github.com/");
        clean = clean.Replace("git@gitlab.com:", "https://gitlab.com/");

        // Remove trailing slashes
        if (clean.EndsWith("/"))
        {
            clean = clean.TrimEnd('/');
        }

        return clean;
    }
}
