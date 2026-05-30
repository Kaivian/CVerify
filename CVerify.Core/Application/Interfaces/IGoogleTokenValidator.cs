using System.Threading.Tasks;
using Google.Apis.Auth;

namespace CVerify.API.Application.Interfaces;

public interface IGoogleTokenValidator
{
    Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken, GoogleJsonWebSignature.ValidationSettings settings);
}
