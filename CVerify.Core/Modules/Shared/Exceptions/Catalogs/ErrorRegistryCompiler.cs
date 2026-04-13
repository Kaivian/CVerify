using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Shared.Exceptions.Catalogs;

/// <summary>
/// Aggregates and compiles all modular domain registries, validating code uniqueness at static invocation.
/// </summary>
public static class ErrorRegistryCompiler
{
    private static readonly Dictionary<string, ErrorDefinition> CompiledRegistry = new();

    static ErrorRegistryCompiler()
    {
        // Register Auth catalog
        MergeCatalog(AuthErrorCatalog.Definitions);
        
        // Register System catalog
        MergeCatalog(SystemErrorCatalog.Definitions);

        // Register Profile catalog
        MergeCatalog(ProfileErrorCatalog.Definitions);
    }

    private static void MergeCatalog(Dictionary<string, ErrorDefinition> catalog)
    {
        foreach (var (code, definition) in catalog)
        {
            if (CompiledRegistry.ContainsKey(code))
            {
                throw new InvalidOperationException($"[Error Registry Drift] Duplicate error code registration detected: '{code}'. Operations halted.");
            }
            CompiledRegistry.Add(code, definition);
        }
    }

    /// <summary>
    /// Resolves the registered ErrorDefinition, or provides an anonymized Unknown configuration as a fallback.
    /// </summary>
    public static ErrorDefinition Get(string code)
    {
        if (string.IsNullOrEmpty(code))
        {
            return SystemErrorCatalog.Definitions[SystemErrorCatalog.UnexpectedError];
        }

        return CompiledRegistry.TryGetValue(code, out var definition) 
            ? definition 
            : new ErrorDefinition(code, ErrorCategory.UNKNOWN, "system.toast.error.unexpected", "An unexpected error occurred.");
    }
}
