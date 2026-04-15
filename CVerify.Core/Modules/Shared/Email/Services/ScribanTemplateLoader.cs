using System;
using System.IO;
using System.Threading.Tasks;
using Scriban;
using Scriban.Parsing;
using Scriban.Runtime;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// A custom template loader for Scriban that resolves layout and component files relative to the base templates directory.
/// </summary>
public class ScribanTemplateLoader : ITemplateLoader
{
    private readonly string _baseDirectory;

    /// <summary>
    /// Initializes a new instance of the <see cref="ScribanTemplateLoader"/> class.
    /// </summary>
    /// <param name="baseDirectory">The root directory for email templates.</param>
    public ScribanTemplateLoader(string baseDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(baseDirectory);
        _baseDirectory = Path.GetFullPath(baseDirectory);
    }

    /// <inheritdoc />
    public string GetPath(TemplateContext context, SourceSpan callerSpan, string templateName)
    {
        // Resolve absolute path safely relative to the base directory
        var combinedPath = Path.Combine(_baseDirectory, templateName);
        var resolvedPath = Path.GetFullPath(combinedPath);

        // Security Guard: Prevent directory traversal out of the templates folder
        if (!resolvedPath.StartsWith(_baseDirectory, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Access denied: Template path '{templateName}' is outside of the configured templates directory.");
        }

        return resolvedPath;
    }

    /// <inheritdoc />
    public string Load(TemplateContext context, SourceSpan callerSpan, string templatePath)
    {
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException($"Template file not found at path: {templatePath}", templatePath);
        }

        return File.ReadAllText(templatePath);
    }

    /// <inheritdoc />
    public async ValueTask<string> LoadAsync(TemplateContext context, SourceSpan callerSpan, string templatePath)
    {
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException($"Template file not found at path: {templatePath}", templatePath);
        }

        return await File.ReadAllTextAsync(templatePath).ConfigureAwait(false);
    }
}
