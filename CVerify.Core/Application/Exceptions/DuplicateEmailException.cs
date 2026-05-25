using System;

namespace CVerify.API.Application.Exceptions;

public class DuplicateEmailException : AuthException
{
    public DuplicateEmailException(string message) 
        : base(AuthErrorCodes.EmailAlreadyExists, message)
    {
    }

    public DuplicateEmailException(string message, Exception innerException) 
        : base(AuthErrorCodes.EmailAlreadyExists, message, innerException)
    {
    }
}
