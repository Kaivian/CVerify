using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Pipelines.Shared.AI.Entities;

namespace CVerify.API.Pipelines.Shared.AI;

public class PromptRegistry : IPromptRegistry
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PromptRegistry> _logger;
    private readonly string _promptsBaseDir;

    public PromptRegistry(ApplicationDbContext context, ILogger<PromptRegistry> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _promptsBaseDir = Path.Combine(AppContext.BaseDirectory, "Pipelines", "Shared", "AI", "Prompts");
    }

    public async Task<string> GetPromptAsync(string promptId, CancellationToken cancellationToken = default)
    {
        string version = "v1.0.0";
        var deployment = await _context.PromptDeployments
            .FirstOrDefaultAsync(d => d.PromptId == promptId, cancellationToken);

        if (deployment != null)
        {
            version = deployment.ActiveVersion;
        }
        else
        {
            _logger.LogWarning("Active prompt deployment metadata not found in database for prompt {PromptId}. Falling back to default version '{Version}'.", promptId, version);
        }

        var filePath = Path.Combine(_promptsBaseDir, promptId, $"{version}.txt");
        if (!File.Exists(filePath))
        {
            // Try relative directory fallback for development
            filePath = Path.Combine(Directory.GetCurrentDirectory(), "Pipelines", "Shared", "AI", "Prompts", promptId, $"{version}.txt");
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Git-versioned prompt template file not found: {filePath}. Ensure the file is checked into repository and copied to build output.");
            }
        }

        var template = await File.ReadAllTextAsync(filePath, Encoding.UTF8, cancellationToken);

        // Optional Integrity Check: If db deployment exists, check sha256 hash
        if (deployment != null)
        {
            var computedHash = ComputeSha256Hash(template);
            if (!string.Equals(computedHash, deployment.Sha256Hash, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Prompt integrity check mismatch for {PromptId} {Version}. DB hash: {DbHash}, File hash: {FileHash}",
                    promptId, version, deployment.Sha256Hash, computedHash);
            }
        }

        return template;
    }

    private static string ComputeSha256Hash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var sb = new StringBuilder();
        foreach (var b in bytes)
        {
            sb.Append(b.ToString("x2"));
        }
        return sb.ToString();
    }
}
