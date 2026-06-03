using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Services;

public static class RegisterResponseFactory
{
    public static RegisterResponse Create(UserStatus status) => status switch
    {
        UserStatus.EMAIL_VERIFY_PENDING => new RegisterResponse(
            StatusCode: "REGISTRATION_PENDING_VERIFY",
            UiAction: "SHOW_WARNING_TOAST",
            Message: "An unverified registration already exists for this email. We have resent your verification link. Please check your inbox or reset your password if needed."
        ),
        UserStatus.ACTIVE => new RegisterResponse(
            StatusCode: "REGISTRATION_ALREADY_ACTIVE",
            UiAction: "SHOW_SUCCESS_TOAST",
            Message: "If your email is valid and not already registered, we've sent a verification link. Otherwise, please log in."
        ),
        _ => new RegisterResponse(
            StatusCode: "REGISTRATION_EXISTS",
            UiAction: "SHOW_WARNING_TOAST",
            Message: "This email address is already associated with an active account."
        )
    };

    public static RegisterResponse Success() => new RegisterResponse(
        StatusCode: "REGISTRATION_SUCCESS",
        UiAction: "SHOW_SUCCESS_TOAST",
        Message: "Registration successful. A verification link has been sent to your email."
    );
}
