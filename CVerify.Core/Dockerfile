# ==============================================================================
# CVERIFY CORE ASP.NET CORE v10 DOCKERFILE
# ==============================================================================

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["CVerify.API.csproj", "./"]
RUN dotnet restore "CVerify.API.csproj"

# Copy everything else and build the project
COPY . .
RUN dotnet publish "CVerify.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Production runner stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5000

ENTRYPOINT ["dotnet", "CVerify.API.dll"]
