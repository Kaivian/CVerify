using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CVerify.API.Modules.Shared.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        // 1. Load env variables from .env if present
        try
        {
            var currentDir = new DirectoryInfo(Directory.GetCurrentDirectory());
            string? envPath = null;
            while (currentDir != null)
            {
                var path = Path.Combine(currentDir.FullName, ".env");
                if (File.Exists(path))
                {
                    envPath = path;
                    break;
                }
                currentDir = currentDir.Parent;
            }

            if (envPath != null)
            {
                foreach (var line in File.ReadAllLines(envPath))
                {
                    var parts = line.Split('=', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 2 && !parts[0].StartsWith("#"))
                    {
                        var key = parts[0].Trim();
                        var val = parts[1].Trim();
                        // Strip surrounding quotes
                        val = val.Trim('"').Trim('\'');
                        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                        {
                            Environment.SetEnvironmentVariable(key, val);
                        }
                    }
                }
            }
        }
        catch
        {
            // Ignore env loading failures at design time
        }

        // 2. Resolve database credentials from environment or defaults
        var host = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
        var port = Environment.GetEnvironmentVariable("DB_PORT") ?? "5432";
        var name = Environment.GetEnvironmentVariable("DB_NAME") ?? "cverify";
        var user = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
        var pass = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "postgres";

        var connectionString = $"Host={host};Port={port};Database={name};Username={user};Password={pass}";

        var builder = new DbContextOptionsBuilder<ApplicationDbContext>();
        builder.UseNpgsql(connectionString, o => o
            .MapEnum<CVerify.API.Modules.Shared.Domain.Enums.UserStatus>("user_status")
            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
            .UseSnakeCaseNamingConvention();

        return new ApplicationDbContext(builder.Options);
    }
}
