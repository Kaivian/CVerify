using System;
using System.Text;
using Xunit;
using Npgsql;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.UnitTests.Security;

public class DecryptTokensTest
{
    [Fact(Skip = "Debug helper script for local use")]
    public void TestDecryptTokens()
    {
        string connStr = "Host=localhost;Port=5432;Database=cverify_db_development;Username=postgres;Password=123123";
        string key = "h7X8k2P9q4W1v5Z0y3N6s9B2m5C8x1R4";

        var sb = new StringBuilder();

        using (var conn = new NpgsqlConnection(connStr))
        {
            conn.Open();
            string query = @"
                SELECT r.name, r.owner, r.default_branch, ap.id, ap.encrypted_access_token
                FROM source_code_repositories r
                JOIN auth_providers ap ON r.auth_provider_id = ap.id
                WHERE r.id = '019e9945-8c95-7bec-ae48-e61e783dae6b';";

            using (var cmd = new NpgsqlCommand(query, conn))
            using (var reader = cmd.ExecuteReader())
            {
                if (reader.Read())
                {
                    var name = reader.GetString(0);
                    var owner = reader.GetString(1);
                    var defaultBranch = reader.IsDBNull(2) ? "null" : reader.GetString(2);
                    var provId = reader.GetGuid(3).ToString();
                    var encAccess = reader.IsDBNull(4) ? null : reader.GetString(4);

                    var decAccess = encAccess != null ? EncryptionHelper.Decrypt(encAccess, key) : "NULL";

                    sb.AppendLine($"Repo: {owner}/{name} (Branch: {defaultBranch})");
                    sb.AppendLine($"ProviderId: {provId}");
                    sb.AppendLine($"Decrypted Token: {decAccess}");
                }
                else
                {
                    sb.AppendLine("Repository not found in database.");
                }
            }
        }

        Assert.Fail(sb.ToString());
    }
}
