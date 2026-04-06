using System;
using CVerify.API.Application.Exceptions.Catalogs;

namespace CVerify.API.Application.Exceptions;

/// <summary>
/// Exception thrown when email delivery, rendering, or transport validation fails.
/// </summary>
public class EmailSendingException : ExternalServiceException
{
    public EmailSendingException()
        : base(SystemErrorCatalog.SmtpOutage)
    {
    }

    public EmailSendingException(string message)
        : base(SystemErrorCatalog.SmtpOutage, message)
    {
    }

    public EmailSendingException(string message, Exception innerException)
        : base(SystemErrorCatalog.SmtpOutage, message, innerException)
    {
    }
}
