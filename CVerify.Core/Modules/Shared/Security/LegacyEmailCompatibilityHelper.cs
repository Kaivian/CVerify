using System;
using System.Text;

namespace CVerify.API.Modules.Shared.Security;

/// <summary>
/// Contains legacy email normalization logic for backward compatibility.
/// 
/// DEPRECATION NOTICE:
/// This is a temporary compatibility layer for legacy accounts created under
/// the old Gmail-specific normalization rules (where dots were removed and plus-aliases ignored).
/// It is scheduled for retirement after all user accounts are verified and migrated.
/// </summary>
[Obsolete("This compatibility helper is deprecated and will be removed once legacy account migration is completed.")]
public static class LegacyEmailCompatibilityHelper
{
    public static string ApplyOldGmailNormalization(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        var trimmed = email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var parts = trimmed.Split('@');
        if (parts.Length != 2) return trimmed;
        var local = parts[0];
        var domain = parts[1];
        if (domain == "gmail.com")
        {
            var plusIndex = local.IndexOf('+');
            if (plusIndex >= 0)
            {
                local = local[..plusIndex];
            }
            local = local.Replace(".", "");
        }
        return $"{local}@{domain}";
    }
}
