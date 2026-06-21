using System;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IJobRankingStrategy
{
    double CalculateRank(JobVacancy job, CandidateSearchProfile profile, MatchingEvaluation evaluation);
}

public class WeightedJobRankingStrategy : IJobRankingStrategy
{
    public double CalculateRank(JobVacancy job, CandidateSearchProfile profile, MatchingEvaluation evaluation)
    {
        if (evaluation == null) return 0.0;

        // Base score is the matching aggregate score (0 to 100)
        double score = evaluation.AggregateScore;

        // Bonus for recency of the job (higher score if published recently)
        var ageInDays = (DateTimeOffset.UtcNow - job.CreatedAt).TotalDays;
        double recencyBonus = Math.Max(0, 10 - ageInDays) * 0.5; // Up to 5 points bonus for jobs posted within 10 days

        return score + recencyBonus;
    }
}
