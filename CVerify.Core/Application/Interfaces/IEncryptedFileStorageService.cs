using System.IO;
using System.Threading.Tasks;

namespace CVerify.API.Application.Interfaces;

public interface IEncryptedFileStorageService
{
    Task<(string storagePath, string encryptionIv)> EncryptAndSaveFileAsync(Stream fileStream, string fileName);
    Task<Stream> ReadAndDecryptFileAsync(string storagePath, string encryptionIv);
    Task DeleteFileAsync(string storagePath);
}
