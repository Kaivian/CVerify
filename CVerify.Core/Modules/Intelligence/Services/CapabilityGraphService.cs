using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ICapabilityGraphService
{
    Task<CapabilityNode?> GetNodeBySlugAsync(string slug);
    Task<CapabilityNode?> ResolveCapabilityAsync(string nameOrAlias);
    Task<List<CapabilityNode>> GetConnectedNodesAsync(Guid nodeId, string relationshipType);
    Task AddNodeAsync(CapabilityNode node);
    Task AddEdgeAsync(Guid sourceId, Guid targetId, string relationshipType, double weight = 1.0);
}

public class CapabilityGraphService : ICapabilityGraphService
{
    private readonly ApplicationDbContext _context;

    public CapabilityGraphService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CapabilityNode?> GetNodeBySlugAsync(string slug)
    {
        return await _context.CapabilityNodes
            .FirstOrDefaultAsync(n => n.Slug == slug)
            .ConfigureAwait(false);
    }

    public async Task<CapabilityNode?> ResolveCapabilityAsync(string nameOrAlias)
    {
        var cleanName = nameOrAlias.Trim().ToLowerInvariant();

        // 1. Direct name match
        var directNode = await _context.CapabilityNodes
            .FirstOrDefaultAsync(n => n.Name.ToLower() == cleanName || n.Slug == cleanName)
            .ConfigureAwait(false);

        if (directNode != null) return directNode;

        // 2. Alias match
        var alias = await _context.CapabilityAliases
            .FirstOrDefaultAsync(a => a.AliasName.ToLower() == cleanName)
            .ConfigureAwait(false);

        if (alias != null)
        {
            // Resolve alias CanonicalId (string) to capability nodes (if matches by name/slug)
            return await _context.CapabilityNodes
                .FirstOrDefaultAsync(n => n.Slug == alias.CanonicalId || n.Name == alias.CanonicalCapability.DisplayName)
                .ConfigureAwait(false);
        }

        return null;
    }

    public async Task<List<CapabilityNode>> GetConnectedNodesAsync(Guid nodeId, string relationshipType)
    {
        return await _context.CapabilityEdges
            .Where(e => e.SourceNodeId == nodeId && e.RelationshipType == relationshipType)
            .Select(e => e.TargetNode)
            .ToListAsync()
            .ConfigureAwait(false);
    }

    public async Task AddNodeAsync(CapabilityNode node)
    {
        _context.CapabilityNodes.Add(node);
        await _context.SaveChangesAsync().ConfigureAwait(false);
    }

    public async Task AddEdgeAsync(Guid sourceId, Guid targetId, string relationshipType, double weight = 1.0)
    {
        var edge = new CapabilityEdge
        {
            SourceNodeId = sourceId,
            TargetNodeId = targetId,
            RelationshipType = relationshipType,
            Weight = weight
        };

        _context.CapabilityEdges.Add(edge);
        await _context.SaveChangesAsync().ConfigureAwait(false);
    }
}
