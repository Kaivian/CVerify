using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Auth.Services;
using Microsoft.Extensions.Options;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.UnitTests.Templates;

/// <summary>
/// Unit tests for <see cref="EmailTemplateService"/>, executing file loader and Scriban compilation tests under isolation.
/// </summary>
public class EmailTemplateServiceTests : IDisposable
{
    private readonly string _templatesDirectory;
    private readonly EmailTemplateService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailTemplateServiceTests"/> class.
    /// </summary>
    public EmailTemplateServiceTests()
    {
        _templatesDirectory = Path.Combine(AppContext.BaseDirectory, "TestTemplates_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_templatesDirectory);

        // Configure default legacy templates behavior for existing tests to ensure backward compatibility
        var legacySettings = new EmailSettings
        {
            UseLegacyEmailTemplates = true
        };
        var options = Microsoft.Extensions.Options.Options.Create(legacySettings);
        _service = new EmailTemplateService(options, _templatesDirectory);
    }

    /// <inheritdoc />
    public void Dispose()
    {
        // Recursively clean up generated test files to avoid workspace polution
        if (Directory.Exists(_templatesDirectory))
        {
            try
            {
                Directory.Delete(_templatesDirectory, true);
            }
            catch
            {
                // Suppress file locks on recycled threads
            }
        }
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldRenderPlaceholdersCorrectly()
    {
        // Arrange
        var templateName = "test_simple.html";
        var content = "Hello {{ full_name }}! Welcome to {{ destination }}.";
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content);

        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc" },
            { "destination", "Tokyo" }
        };

        // Act
        var result = await _service.RenderTemplateAsync(templateName, model);

        // Assert
        result.Should().Be("Hello Luc! Welcome to Tokyo.");
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldThrowWhenTemplateNotFound()
    {
        // Arrange
        var templateName = "missing_template.html";
        var model = new Dictionary<string, object>();

        // Act & Assert
        var act = async () => await _service.RenderTemplateAsync(templateName, model).ConfigureAwait(false);
        await act.Should().ThrowAsync<EmailSendingException>()
            .WithMessage("*not found at physical path*");
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldThrowWhenTemplateHasSyntaxErrors()
    {
        // Arrange
        var templateName = "invalid_syntax.html";
        // Invalid Scriban layout: unclosed structural control statement (if block)
        var content = "Hello {{ if true }}";
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content);

        var model = new Dictionary<string, object>();

        // Act & Assert
        var act = async () => await _service.RenderTemplateAsync(templateName, model).ConfigureAwait(false);
        await act.Should().ThrowAsync<EmailSendingException>()
            .WithMessage("*Compilation errors in Scriban template*");
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldRenderGracefullyWithEmptyModelPlaceholders()
    {
        // Arrange
        var templateName = "empty_placeholders.html";
        var content = "Hi {{ full_name }}! Code is {{ code }}.";
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content);

        var model = new Dictionary<string, object>();

        // Act
        var result = await _service.RenderTemplateAsync(templateName, model);

        // Assert
        // Scriban handles undefined models gracefully by replacing with blank spaces
        result.Should().Be("Hi ! Code is .");
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldRenderWithMasterLayoutAndComponents_WhenLegacyModeIsDisabled()
    {
        // Arrange
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Layouts"));
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Components"));
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Verification"));

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Layouts", "MasterLayout.html"),
            "<html>[Layout] {{ include 'Components/EmailHeader.html' }} - {{ content }} - {{ include 'Components/EmailFooter.html' }}</html>"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Components", "EmailHeader.html"),
            "HeaderContent"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Components", "EmailFooter.html"),
            "FooterContent"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Verification", "VerificationEmail.html"),
            "VerificationContent: {{ full_name }}"
        );

        var settings = new EmailSettings
        {
            UseLegacyEmailTemplates = false
        };
        var service = new EmailTemplateService(Options.Create(settings), _templatesDirectory);

        var model = new Dictionary<string, object>
        {
            { "full_name", "Bob" }
        };

        // Act
        var result = await service.RenderTemplateAsync("VerificationEmail.html", model).ConfigureAwait(false);

        // Assert
        result.Should().Be("<html>[Layout] HeaderContent - VerificationContent: Bob - FooterContent</html>");
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldInjectBrandingAndColors_WhenLegacyModeIsDisabled()
    {
        // Arrange
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Layouts"));
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Components"));
        Directory.CreateDirectory(Path.Combine(_templatesDirectory, "Verification"));

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Layouts", "MasterLayout.html"),
            "<html>Layout [{{ product_name }}] - {{ content }}</html>"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Components", "EmailHeader.html"),
            "Header"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Components", "EmailFooter.html"),
            "Footer"
        );

        await File.WriteAllTextAsync(
            Path.Combine(_templatesDirectory, "Verification", "VerificationEmail.html"),
            "Accent: {{ colors.accent }}, Text: {{ colors.text }}"
        );

        var settings = new EmailSettings
        {
            UseLegacyEmailTemplates = false,
            ProductName = "CVerifyTest",
            Colors = new EmailColors
            {
                Accent = "#ff9900",
                Text = "#333333"
            }
        };
        var service = new EmailTemplateService(Options.Create(settings), _templatesDirectory);

        var model = new Dictionary<string, object>();

        // Act
        var result = await service.RenderTemplateAsync("VerificationEmail.html", model).ConfigureAwait(false);

        // Assert
        result.Should().Be("<html>Layout [CVerifyTest] - Accent: #ff9900, Text: #333333</html>");
    }
}
