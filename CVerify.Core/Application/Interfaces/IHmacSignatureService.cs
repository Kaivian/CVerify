namespace CVerify.API.Application.Interfaces;

public interface IHmacSignatureService
{
    string ComputeSignature(string method, string url, string body, string timestamp, string nonce);
    (string Signature, string Timestamp, string Nonce) CreateSignatureHeaders(string method, string url, string body);
}
