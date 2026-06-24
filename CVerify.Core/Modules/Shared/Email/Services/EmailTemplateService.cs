using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Scriban;
using Scriban.Runtime;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Compiles physical HTML templates using the lightweight, high-performance Scriban template engine.
/// </summary>
public class EmailTemplateService : IEmailTemplateService
{
    private readonly string _templatesDirectory;
    private readonly EmailSettings _settings;

    private static readonly Dictionary<string, string> TemplatePathMappings = new(StringComparer.OrdinalIgnoreCase)
    {
        { "OtpVerificationEmail.html", "Authentication/OtpVerificationEmail.html" },
        { "Login2FaEmail.html", "Authentication/Login2FaEmail.html" },
        { "PasswordRecoveryEmail.html", "Authentication/PasswordRecoveryEmail.html" },
        { "WelcomeEmail.html", "Account/WelcomeEmail.html" },
        { "ResetPasswordEmail.html", "Account/ResetPasswordEmail.html" },
        { "EmailChangeVerificationEmail.html", "Account/EmailChangeVerificationEmail.html" },
        { "SecurityAlertEmail.html", "Account/SecurityAlertEmail.html" },
        { "SecurityActionEmail.html", "Account/SecurityActionEmail.html" },
        { "BusinessVerificationEmail.html", "Organization/BusinessVerificationEmail.html" },
        { "CompanyOwnerVerificationEmail.html", "Organization/CompanyOwnerVerificationEmail.html" },
        { "CompanyVerificationEmail.html", "Organization/CompanyVerificationEmail.html" },
        { "WorkspaceOnboardingEmail.html", "Organization/WorkspaceOnboardingEmail.html" },
        { "VerificationEmail.html", "Verification/VerificationEmail.html" }
    };

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailTemplateService"/> class.
    /// </summary>
    /// <param name="options">Injected email settings options.</param>
    /// <param name="templatesDirectory">Optional path override for the templates folder.</param>
    public EmailTemplateService(IOptions<EmailSettings>? options = null, string? templatesDirectory = null)
    {
        _templatesDirectory = templatesDirectory ?? Path.Combine(AppContext.BaseDirectory, "Modules", "Shared", "Email", "Templates");
        _settings = options?.Value ?? new EmailSettings();
    }

    /// <inheritdoc />
    public async Task<string> RenderTemplateAsync(
        string templateName,
        Dictionary<string, object> model,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templateName);
        ArgumentNullException.ThrowIfNull(model);

        try
        {
            if (_settings.UseLegacyEmailTemplates)
            {
                var legacyPath = Path.Combine(_templatesDirectory, "Legacy", templateName);
                if (!File.Exists(legacyPath))
                {
                    // Resilient fallback to flat root directory if Legacy subfolder copy is missing
                    var fallbackPath = Path.Combine(_templatesDirectory, templateName);
                    if (File.Exists(fallbackPath))
                    {
                        legacyPath = fallbackPath;
                    }
                    else
                    {
                        throw new EmailSendingException($"Legacy email template not found at physical path: '{legacyPath}'");
                    }
                }

                var rawContent = await File.ReadAllTextAsync(legacyPath, cancellationToken).ConfigureAwait(false);
                var scribanTemplate = Template.Parse(rawContent, legacyPath);

                if (scribanTemplate.HasErrors)
                {
                    var errors = string.Join("; ", scribanTemplate.Messages);
                    throw new EmailSendingException($"Compilation errors in Scriban template '{templateName}': {errors}");
                }

                return await scribanTemplate.RenderAsync(model).ConfigureAwait(false);
            }
            else
            {
                if (!TemplatePathMappings.TryGetValue(templateName, out var relativePath))
                {
                    relativePath = templateName;
                }

                var templatePath = Path.Combine(_templatesDirectory, relativePath);
                if (!File.Exists(templatePath))
                {
                    throw new EmailSendingException($"Email template not found at physical path: '{templatePath}'");
                }

                var rawContent = await File.ReadAllTextAsync(templatePath, cancellationToken).ConfigureAwait(false);
                var scribanTemplate = Template.Parse(rawContent, templatePath);

                if (scribanTemplate.HasErrors)
                {
                    var errors = string.Join("; ", scribanTemplate.Messages);
                    throw new EmailSendingException($"Compilation errors in Scriban template '{templateName}': {errors}");
                }

                // Construct rich rendering context with brand parameters & custom includes loader
                var context = new TemplateContext();
                context.TemplateLoader = new ScribanTemplateLoader(_templatesDirectory);

                var scriptObj = new ScriptObject();
                scriptObj["product_name"] = _settings.ProductName;
                scriptObj["ProductName"] = _settings.ProductName;
                scriptObj["support_email"] = _settings.SupportEmail;
                scriptObj["SupportEmail"] = _settings.SupportEmail;
                scriptObj["website_url"] = _settings.WebsiteUrl;
                scriptObj["WebsiteUrl"] = _settings.WebsiteUrl;
                scriptObj["asset_base_url"] = _settings.AssetBaseUrl;
                scriptObj["AssetBaseUrl"] = _settings.AssetBaseUrl;

                var colorsObj = new Dictionary<string, string>
                {
                    { "accent", _settings.Colors.Accent },
                    { "accent_light", _settings.Colors.AccentLight },
                    { "accentLight", _settings.Colors.AccentLight },
                    { "background", _settings.Colors.Background },
                    { "border", _settings.Colors.Border },
                    { "success", _settings.Colors.Success },
                    { "warning", _settings.Colors.Warning },
                    { "warning_light", _settings.Colors.WarningLight },
                    { "warningLight", _settings.Colors.WarningLight },
                    { "warning_dark", _settings.Colors.WarningDark },
                    { "warningDark", _settings.Colors.WarningDark },
                    { "danger", _settings.Colors.Danger },
                    { "danger_light", _settings.Colors.DangerLight },
                    { "dangerLight", _settings.Colors.DangerLight },
                    { "danger_dark", _settings.Colors.DangerDark },
                    { "dangerDark", _settings.Colors.DangerDark },
                    { "foreground", _settings.Colors.Foreground },
                    { "foreground_muted", _settings.Colors.ForegroundMuted },
                    { "foregroundMuted", _settings.Colors.ForegroundMuted },
                    { "text", _settings.Colors.Text },
                    { "surface", _settings.Colors.Surface },
                    { "surface_secondary", _settings.Colors.SurfaceSecondary },
                    { "surfaceSecondary", _settings.Colors.SurfaceSecondary },
                    { "surface_tertiary", _settings.Colors.SurfaceTertiary },
                    { "surfaceTertiary", _settings.Colors.SurfaceTertiary }
                };

                scriptObj["colors"] = colorsObj;
                scriptObj["Colors"] = colorsObj;

                // Bind template model parameters
                foreach (var kvp in model)
                {
                    scriptObj[kvp.Key] = kvp.Value;
                }

                context.PushGlobal(scriptObj);

                // Render content component
                var contentResult = await scribanTemplate.RenderAsync(context).ConfigureAwait(false);

                // Load and render MasterLayout wrapping the content
                var layoutPath = Path.Combine(_templatesDirectory, "Layouts", "MasterLayout.html");
                if (!File.Exists(layoutPath))
                {
                    throw new EmailSendingException($"Master layout template not found at physical path: '{layoutPath}'");
                }

                var layoutContent = await File.ReadAllTextAsync(layoutPath, cancellationToken).ConfigureAwait(false);
                var layoutTemplate = Template.Parse(layoutContent, layoutPath);

                if (layoutTemplate.HasErrors)
                {
                    var errors = string.Join("; ", layoutTemplate.Messages);
                    throw new EmailSendingException($"Compilation errors in Master Layout template: {errors}");
                }

                // Expose content and title to the layout context
                scriptObj["content"] = contentResult;
                scriptObj["title"] = templateName.Replace("Email.html", "").Replace(".html", "");

                return await layoutTemplate.RenderAsync(context).ConfigureAwait(false);
            }
        }
        catch (Exception ex) when (ex is not EmailSendingException)
        {
            throw new EmailSendingException($"Failed to load or compile email template '{templateName}'. See inner exception.", ex);
        }
    }
}

