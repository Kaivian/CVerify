using System;
using BenchmarkDotNet.Running;

namespace CVerify.API.Benchmarks;

/// <summary>
/// Bootstrap entry point to execute BenchmarkDotNet micro-benchmarks.
/// </summary>
public class Program
{
    /// <summary>
    /// Executes the benchmark runner.
    /// </summary>
    public static void Main(string[] args)
    {
        BenchmarkRunner.Run<EmailBenchmarks>();
    }
}
