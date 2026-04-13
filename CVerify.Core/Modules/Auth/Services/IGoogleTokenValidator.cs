using System.Threading.Tasks;
using Google.Apis.Auth;

namespace CVerify.API.Modules.Auth.Services;

public interface IGoogleTokenValidator
{
    Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken, GoogleJsonWebSignature.ValidationSettings settings);
}
