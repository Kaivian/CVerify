using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Service responsible for physical file rendering using Scriban template compilation.
/// </summary>
public interface IEmailTemplateService
{
    /// <summary>
    /// Loads a physical HTML layout and resolves dynamic model replacements.
    /// </summary>
    /// <param name="templateName">The filename of the target Scriban template.</param>
    /// <param name="model">Key-value dictionary containing template parameters.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    /// <returns>A fully compiled responsive HTML body string.</returns>
    Task<string> RenderTemplateAsync(
        string templateName,
        Dictionary<string, object> model,
        CancellationToken cancellationToken = default);
}
