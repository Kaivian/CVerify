using System.Collections.Generic;

namespace CVerify.API.Application.Exceptions.Catalogs;

public static class ProfileErrorCatalog
{
    public static readonly Dictionary<string, ErrorDefinition> Definitions = new()
    {
        {
            ProfileErrorCodes.ProfileConcurrencyConflict,
            new(ProfileErrorCodes.ProfileConcurrencyConflict, ErrorCategory.BUSINESS, "profile.toast.error.concurrency", "This profile has been modified by another process. Please reload and try again.")
        },
        {
            ProfileErrorCodes.UsernameCooldownActive,
            new(ProfileErrorCodes.UsernameCooldownActive, ErrorCategory.BUSINESS, "profile.toast.error.username_cooldown", "You can only change your username once every 30 days.")
        },
        {
            ProfileErrorCodes.UsernameAlreadyExists,
            new(ProfileErrorCodes.UsernameAlreadyExists, ErrorCategory.BUSINESS, "profile.toast.error.username_exists", "This username is already taken.")
        },
        {
            ProfileErrorCodes.ProfileNotFound,
            new(ProfileErrorCodes.ProfileNotFound, ErrorCategory.BUSINESS, "profile.toast.error.not_found", "Profile not found.")
        },
        {
            ProfileErrorCodes.EducationNotFound,
            new(ProfileErrorCodes.EducationNotFound, ErrorCategory.BUSINESS, "profile.toast.error.education_not_found", "Education entry not found.")
        },
        {
            ProfileErrorCodes.AchievementNotFound,
            new(ProfileErrorCodes.AchievementNotFound, ErrorCategory.BUSINESS, "profile.toast.error.achievement_not_found", "Achievement entry not found.")
        },
        {
            ProfileErrorCodes.AttachmentNotFound,
            new(ProfileErrorCodes.AttachmentNotFound, ErrorCategory.BUSINESS, "profile.toast.error.attachment_not_found", "Attachment not found.")
        }
    };
}
