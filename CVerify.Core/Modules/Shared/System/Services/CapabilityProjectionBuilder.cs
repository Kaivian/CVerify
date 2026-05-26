using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ICapabilityProjectionBuilder
{
    Task<string> ResolveCanonicalIdAsync(string rawTerm, CancellationToken cancellationToken);
    Task<CapabilityRegistry?> GetCapabilityRegistryAsync(string canonicalId, CancellationToken cancellationToken);
}

public class CapabilityProjectionBuilder : ICapabilityProjectionBuilder
{
    private readonly ApplicationDbContext _context;

    public CapabilityProjectionBuilder(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<string> ResolveCanonicalIdAsync(string rawTerm, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawTerm)) return string.Empty;

        var term = rawTerm.Trim();

        // 1. Direct match check
        var directMatch = await _context.CapabilityRegistries
            .AnyAsync(cr => cr.CapabilityId.ToLower() == term.ToLower(), cancellationToken);
        if (directMatch)
        {
            return term;
        }

        // 2. Alias resolution
        var alias = await _context.CapabilityAliases
            .FirstOrDefaultAsync(ca => ca.AliasName.ToLower() == term.ToLower(), cancellationToken);
        if (alias != null)
        {
            return await ResolveCanonicalIdAsync(alias.CanonicalId, cancellationToken);
        }

        // 3. Deprecated redirect resolution
        var registryItem = await _context.CapabilityRegistries
            .FirstOrDefaultAsync(cr => cr.CapabilityId.ToLower() == term.ToLower(), cancellationToken);
        if (registryItem != null && registryItem.Status == "Deprecated" && !string.IsNullOrEmpty(registryItem.DeprecatedById))
        {
            return await ResolveCanonicalIdAsync(registryItem.DeprecatedById, cancellationToken);
        }

        return term; // Fallback to raw term
    }

    public async Task<CapabilityRegistry?> GetCapabilityRegistryAsync(string canonicalId, CancellationToken cancellationToken)
    {
        return await _context.CapabilityRegistries
            .Include(cr => cr.DeprecatedBy)
            .FirstOrDefaultAsync(cr => cr.CapabilityId.ToLower() == canonicalId.ToLower(), cancellationToken);
    }
}
