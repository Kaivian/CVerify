namespace CVerify.API.Application.Security.OtpPolicies;

public class OtpPolicyDefinition
{
    public int Length { get; set; } = 6;
    public string AllowedCharacters { get; set; } = "Numeric"; // "Numeric" or "Alphanumeric"
    public int CooldownSeconds { get; set; } = 60;
    public int ExpirationSeconds { get; set; } = 300;
    public int MaxRetries { get; set; } = 3;
    public int MaxResends { get; set; } = 5;
    public string EmailTemplate { get; set; } = "OtpVerificationEmail.html";
}
