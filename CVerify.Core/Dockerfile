# ==============================================================================
# CVERIFY CORE ASP.NET CORE v10 PRODUCTION DOCKERFILE
# ==============================================================================
# Multi-stage, pinned noble base images, non-root execution, BuildKit cached.
# ==============================================================================

# 1. Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0.102-noble AS build
WORKDIR /src

# Copy project file and restore using BuildKit NuGet cache mount
COPY ["CVerify.API.csproj", "./"]
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore "CVerify.API.csproj"

# Copy remaining source code and publish
COPY . .
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet publish "CVerify.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 2. Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0.2-noble AS final
WORKDIR /app

# Install curl for healthcheck (noble uses apt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy published files with ownership mapped to pre-defined non-root 'app' user
COPY --from=build --chown=app:app /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

USER app

EXPOSE 5000

HEALTHCHECK --interval=5s --timeout=5s --retries=5 --start-period=10s \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "CVerify.API.dll"]
