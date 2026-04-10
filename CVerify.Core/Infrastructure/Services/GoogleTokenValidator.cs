using System.Threading.Tasks;
using Google.Apis.Auth;
using CVerify.API.Application.Interfaces;

namespace CVerify.API.Infrastructure.Services;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken, GoogleJsonWebSignature.ValidationSettings settings)
    {
        return GoogleJsonWebSignature.ValidateAsync(idToken, settings);
    }
}
