using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Thrown when parameters fail data validation check rules. Maps to VALIDATION.
/// </summary>
public class ValidationException : CVerifyBaseException
{
    public ValidationException(string defaultMessage) 
        : base(SystemErrorCatalog.ValidationError, ErrorCategory.VALIDATION, "system.toast.error.validation", defaultMessage)
    {
        DisplayMode = "Inline";
        ValidationErrors = new Dictionary<string, string[]>();
    }

    public ValidationException(Dictionary<string, string[]> validationErrors, string defaultMessage = "Validation failed.") 
        : base(SystemErrorCatalog.ValidationError, ErrorCategory.VALIDATION, "system.toast.error.validation", defaultMessage)
    {
        DisplayMode = "Inline";
        ValidationErrors = validationErrors;
    }
}
