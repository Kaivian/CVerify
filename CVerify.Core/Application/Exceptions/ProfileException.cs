using System;

namespace CVerify.API.Application.Exceptions;

public class ProfileException : BusinessRuleException
{
    public ProfileException(string code, string? customMessage = null, Exception? innerException = null)
        : base(code, customMessage, innerException)
    {
    }
}

public static class ProfileErrorCodes
{
    public const string ProfileConcurrencyConflict = "PROFILE_CONCURRENCY_CONFLICT";
    public const string UsernameCooldownActive = "PROFILE_USERNAME_COOLDOWN_ACTIVE";
    public const string UsernameAlreadyExists = "PROFILE_USERNAME_ALREADY_EXISTS";
    public const string ProfileNotFound = "PROFILE_NOT_FOUND";
    public const string EducationNotFound = "PROFILE_EDUCATION_NOT_FOUND";
    public const string AchievementNotFound = "PROFILE_ACHIEVEMENT_NOT_FOUND";
    public const string AttachmentNotFound = "PROFILE_ATTACHMENT_NOT_FOUND";
}
