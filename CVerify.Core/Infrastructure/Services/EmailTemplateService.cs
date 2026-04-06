using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Scriban;
using CVerify.API.Application.Interfaces;
using CVerify.API.Application.Exceptions;

namespace CVerify.API.Infrastructure.Services;

/// <summary>
/// Compiles physical HTML templates using the lightweight, high-performance Scriban template engine.
/// </summary>
public class EmailTemplateService : IEmailTemplateService
{
    private readonly string _templatesDirectory;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailTemplateService"/> class.
    /// </summary>
    public EmailTemplateService()
    {
        // Path matches the copied physical directory inside the build output folder
        _templatesDirectory = Path.Combine(AppContext.BaseDirectory, "Infrastructure", "EmailTemplates");
    }

    /// <inheritdoc />
    public async Task<string> RenderTemplateAsync(
        string templateName,
        Dictionary<string, object> model,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templateName);
        ArgumentNullException.ThrowIfNull(model);

        var templatePath = Path.Combine(_templatesDirectory, templateName);

        if (!File.Exists(templatePath))
        {
            throw new EmailSendingException($"Email template not found at physical path: '{templatePath}'");
        }

        try
        {
            var rawContent = await File.ReadAllTextAsync(templatePath, cancellationToken).ConfigureAwait(false);
            
            // Compile and parse physical layout via Scriban
            var scribanTemplate = Template.Parse(rawContent, templatePath);
            
            if (scribanTemplate.HasErrors)
            {
                var errors = string.Join("; ", scribanTemplate.Messages);
                throw new EmailSendingException($"Compilation errors in Scriban template '{templateName}': {errors}");
            }

            // Render fluid template asynchronously with model variables
            return await scribanTemplate.RenderAsync(model).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not EmailSendingException)
        {
            throw new EmailSendingException($"Failed to load or compile email template '{templateName}'. See inner exception.", ex);
        }
    }
}
