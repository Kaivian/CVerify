using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using FluentAssertions;
using CVerify.API.Application.Exceptions;
using CVerify.API.Infrastructure.Services;
using Xunit;

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
        _templatesDirectory = Path.Combine(AppContext.BaseDirectory, "Infrastructure", "EmailTemplates");
        
        // Ensure test environment directory is cleanly established
        Directory.CreateDirectory(_templatesDirectory);
        _service = new EmailTemplateService();
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
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content).ConfigureAwait(false);

        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc" },
            { "destination", "Tokyo" }
        };

        // Act
        var result = await _service.RenderTemplateAsync(templateName, model).ConfigureAwait(false);

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
            .WithMessage("*not found at physical path*").ConfigureAwait(false);
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldThrowWhenTemplateHasSyntaxErrors()
    {
        // Arrange
        var templateName = "invalid_syntax.html";
        // Invalid Scriban layout: unclosed structural control statement (if block)
        var content = "Hello {{ if true }}";
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content).ConfigureAwait(false);

        var model = new Dictionary<string, object>();

        // Act & Assert
        var act = async () => await _service.RenderTemplateAsync(templateName, model).ConfigureAwait(false);
        await act.Should().ThrowAsync<EmailSendingException>()
            .WithMessage("*Compilation errors in Scriban template*").ConfigureAwait(false);
    }

    [Fact]
    public async Task RenderTemplateAsync_ShouldRenderGracefullyWithEmptyModelPlaceholders()
    {
        // Arrange
        var templateName = "empty_placeholders.html";
        var content = "Hi {{ full_name }}! Code is {{ code }}.";
        await File.WriteAllTextAsync(Path.Combine(_templatesDirectory, templateName), content).ConfigureAwait(false);

        var model = new Dictionary<string, object>();

        // Act
        var result = await _service.RenderTemplateAsync(templateName, model).ConfigureAwait(false);

        // Assert
        // Scriban handles undefined models gracefully by replacing with blank spaces
        result.Should().Be("Hi ! Code is .");
    }
}
