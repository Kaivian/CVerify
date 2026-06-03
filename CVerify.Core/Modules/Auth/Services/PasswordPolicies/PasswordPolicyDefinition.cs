namespace CVerify.API.Modules.Auth.Services.PasswordPolicies;

public class PasswordPolicyDefinition
{
    public int MinimumLength { get; set; } = 8;
    public bool RequireUppercase { get; set; } = true;
    public bool RequireLowercase { get; set; } = true;
    public bool RequireDigit { get; set; } = true;
    public bool RequireSpecialCharacter { get; set; } = true;
    public string SpecialCharacterPattern { get; set; } = @"[@$!%*?&#^()_\-+=\[\]{}|\\:;""'<>,.?/~`]";
}
