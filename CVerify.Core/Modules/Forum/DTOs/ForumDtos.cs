using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Modules.Forum.DTOs;

public class CategoryResponse
{
    public Guid Id { get; set; }
    public Guid? OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsArchived { get; set; }
    public string? RequiredRole { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class CreateCategoryRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    [MaxLength(100)]
    public string? Slug { get; set; } // Will auto-slugify if null

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? IconName { get; set; }

    public int DisplayOrder { get; set; } = 0;

    public bool IsPrivate { get; set; } = false;

    [MaxLength(50)]
    public string? RequiredRole { get; set; }
}

public class UpdateCategoryRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    [MaxLength(100)]
    public string? Slug { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? IconName { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsPrivate { get; set; }

    public bool IsArchived { get; set; }

    [MaxLength(50)]
    public string? RequiredRole { get; set; }
}

public class TagResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public bool IsArchived { get; set; }
    public int TopicCount { get; set; }
}

public class CreateTopicRequest
{
    [Required]
    public Guid CategoryId { get; set; }

    public Guid? OrganizationId { get; set; } // Set when posting in Org space

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public List<string> Tags { get; set; } = new();
}

public class UpdateTopicRequest
{
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public List<string> Tags { get; set; } = new();
}

public class UserMiniDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = null!;
    public string? Username { get; set; }
    public string? AvatarUrl { get; set; }
    public string? OrganizationName { get; set; } // If associated
    public bool IsCandidateVerified { get; set; }
    public bool IsBusinessVerified { get; set; }
    public int Reputation { get; set; }
}

public class TopicListItemResponse
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = null!;
    public string CategorySlug { get; set; } = null!;
    public Guid? OrganizationId { get; set; }
    public UserMiniDto Author { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Excerpt { get; set; } = null!; // Plaintext excerpt
    public string? AiExcerpt { get; set; }
    public int ViewCount { get; set; }
    public int ReplyCount { get; set; }
    public int Score { get; set; }
    public bool IsPinned { get; set; }
    public bool IsLocked { get; set; }
    public bool IsSolved { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsBookmarked { get; set; }
    public bool IsFollowing { get; set; }
    public string? UserVote { get; set; } // "UPVOTE", "DOWNVOTE" or null
    public List<string> Tags { get; set; } = new();
    public DateTimeOffset LastActivityAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class TopicResponse
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = null!;
    public string CategorySlug { get; set; } = null!;
    public Guid? OrganizationId { get; set; }
    public UserMiniDto Author { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Content { get; set; } = null!;
    public string? AiExcerpt { get; set; }
    public int ViewCount { get; set; }
    public int ReplyCount { get; set; }
    public int Score { get; set; }
    public bool IsPinned { get; set; }
    public bool IsLocked { get; set; }
    public bool IsSolved { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsBookmarked { get; set; }
    public bool IsFollowing { get; set; }
    public string? UserVote { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<ReactionCountDto> Reactions { get; set; } = new();
    public DateTimeOffset LastActivityAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class ReactionCountDto
{
    public string ReactionType { get; set; } = null!;
    public int Count { get; set; }
    public bool UserReacted { get; set; }
}

public class CreateReplyRequest
{
    [Required]
    public string Content { get; set; } = null!;

    public Guid? ParentReplyId { get; set; }

    [MaxLength(2000)]
    public string? QuoteText { get; set; }
}

public class UpdateReplyRequest
{
    [Required]
    public string Content { get; set; } = null!;
}

public class ReplyResponse
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public UserMiniDto Author { get; set; } = null!;
    public Guid? ParentReplyId { get; set; }
    public string Content { get; set; } = null!;
    public string? QuoteText { get; set; }
    public bool IsAcceptedSolution { get; set; }
    public int Score { get; set; }
    public string? UserVote { get; set; }
    public List<ReactionCountDto> Reactions { get; set; } = new();
    public List<ReplyResponse> ChildReplies { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class VoteRequest
{
    [Required]
    [RegularExpression("^(UPVOTE|DOWNVOTE|LIKE|HELPFUL|INSIGHTFUL)$")]
    public string VoteType { get; set; } = null!;
}

public class ReactionRequest
{
    [Required]
    [MaxLength(50)]
    public string ReactionType { get; set; } = null!;
}

public class CreateReportRequest
{
    public Guid? TopicId { get; set; }
    public Guid? ReplyId { get; set; }
    public Guid? ReportedUserId { get; set; }

    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = null!;
}

public class ReportResponse
{
    public Guid Id { get; set; }
    public Guid? TopicId { get; set; }
    public string? TopicTitle { get; set; }
    public Guid? ReplyId { get; set; }
    public string? ReplyExcerpt { get; set; }
    public Guid? ReportedUserId { get; set; }
    public string? ReportedUserName { get; set; }
    public UserMiniDto Reporter { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string Status { get; set; } = null!; // PENDING, RESOLVED, DISMISSED
    public string? ResolutionNotes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolvedByName { get; set; }
}

public class ResolveReportRequest
{
    [Required]
    [RegularExpression("^(RESOLVED|DISMISSED)$")]
    public string Status { get; set; } = null!;

    [MaxLength(1000)]
    public string? ResolutionNotes { get; set; }
}

public class ModerationActionRequest
{
    [Required]
    [RegularExpression("^(LOCK|UNLOCK|PIN|UNPIN|DELETE|RESTORE|SUSPEND_USER|UNSUSPEND_USER)$")]
    public string Action { get; set; } = null!;

    [MaxLength(500)]
    public string? Reason { get; set; }
}

public class ForumTopicSearchQuery
{
    public string? Search { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? OrganizationId { get; set; }
    public string? Tag { get; set; }
    public string? Filter { get; set; } // latest, trending, most_viewed, unanswered, solved, following, bookmarked
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class ForumPagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
}
