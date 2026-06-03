using System.Threading.Tasks;
using Google.Apis.Auth;

namespace CVerify.API.Modules.Auth.Services;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken, GoogleJsonWebSignature.ValidationSettings settings)
    {
        return GoogleJsonWebSignature.ValidateAsync(idToken, settings);
    }
}
