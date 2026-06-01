using System;
using System.Linq;
using NetArchTest.Rules;
using Xunit;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.UnitTests.Architecture;

/// <summary>
/// Architectural boundary validation tests ensuring correct modular dependencies.
/// </summary>
public class ModularBoundaryTests
{
    private static readonly string[] FeatureModules = { "Auth", "Recovery", "Profiles", "Admin", "AiChat" };

    [Fact]
    public void Features_ShouldNot_DependOnOtherFeatures()
    {
        // Arrange
        var assembly = typeof(User).Assembly;

        foreach (var feature in FeatureModules)
        {
            var otherFeatures = FeatureModules
                .Where(f => f != feature);

            // Recovery module is allowed to depend on Auth module
            if (feature == "Recovery")
            {
                otherFeatures = otherFeatures.Where(f => f != "Auth");
            }

            var otherFeaturesArray = otherFeatures
                .Select(f => $"CVerify.API.Modules.{f}")
                .ToArray();

            // Act
            var result = Types.InAssembly(assembly)
                .That()
                .ResideInNamespace($"CVerify.API.Modules.{feature}")
                .ShouldNot()
                .HaveDependencyOnAny(otherFeaturesArray)
                .GetResult();

            // Assert
            Assert.True(result.IsSuccessful, $"Feature module '{feature}' depends on other features. Failed types: " +
                string.Join(", ", result.FailingTypes?.Select(t => t.FullName) ?? Array.Empty<string>()));
        }
    }

    [Fact]
    public void Shared_ShouldNot_DependOnFeatures()
    {
        // Arrange
        var assembly = typeof(User).Assembly;
        var featureNamespaces = FeatureModules
            .Select(f => $"CVerify.API.Modules.{f}")
            .ToArray();

        // Act
        var result = Types.InAssembly(assembly)
            .That()
            .ResideInNamespace("CVerify.API.Modules.Shared")
            .And()
            .DoNotHaveName("ApplicationDbContext")
            .And()
            .DoNotHaveName("DbInitializer")
            .And()
            .DoNotHaveName("TokenCleanupBackgroundJob")
            .And()
            .DoNotHaveName("User")
            .ShouldNot()
            .HaveDependencyOnAny(featureNamespaces)
            .GetResult();

        // Assert
        Assert.True(result.IsSuccessful, "Shared module depends on feature modules. Failed types: " +
            string.Join(", ", result.FailingTypes?.Select(t => t.FullName) ?? Array.Empty<string>()));
    }
}
