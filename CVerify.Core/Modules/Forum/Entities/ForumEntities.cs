using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Forum.Entities;

[Table("forum_categories")]
public class ForumCategory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = null!;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? IconName { get; set; }

    public int DisplayOrder { get; set; } = 0;

    public bool IsPrivate { get; set; } = false;

    public bool IsArchived { get; set; } = false;

    [MaxLength(50)]
    public string? RequiredRole { get; set; } // Role needed to write in category (e.g. "BUSINESS" for hiring)

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<ForumTopic> Topics { get; set; } = new List<ForumTopic>();
    public virtual ICollection<ForumCategoryModerator> Moderators { get; set; } = new List<ForumCategoryModerator>();
}

[Table("forum_category_moderators")]
public class ForumCategoryModerator
{
    public Guid CategoryId { get; set; }

    [ForeignKey(nameof(CategoryId))]
    public virtual ForumCategory Category { get; set; } = null!;

    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_topics")]
public class ForumTopic
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid CategoryId { get; set; }

    [ForeignKey(nameof(CategoryId))]
    public virtual ForumCategory Category { get; set; } = null!;

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    public Guid AuthorId { get; set; }

    [ForeignKey(nameof(AuthorId))]
    public virtual User Author { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Slug { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public string? AiExcerpt { get; set; } // AI Summary

    public int ViewCount { get; set; } = 0;

    public int ReplyCount { get; set; } = 0;

    public int Score { get; set; } = 0; // Calculated dynamically from votes

    public bool IsPinned { get; set; } = false;

    public bool IsLocked { get; set; } = false;

    public bool IsSolved { get; set; } = false;

    public bool IsFeatured { get; set; } = false;

    public bool IsArchived { get; set; } = false;

    public bool IsPendingReview { get; set; } = false; // For AI screening

    public DateTimeOffset LastActivityAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<ForumReply> Replies { get; set; } = new List<ForumReply>();
    public virtual ICollection<ForumTopicTag> TopicTags { get; set; } = new List<ForumTopicTag>();
    public virtual ICollection<ForumBookmark> Bookmarks { get; set; } = new List<ForumBookmark>();
    public virtual ICollection<ForumFollow> Follows { get; set; } = new List<ForumFollow>();
    public virtual ICollection<ForumVote> Votes { get; set; } = new List<ForumVote>();
    public virtual ICollection<ForumReaction> Reactions { get; set; } = new List<ForumReaction>();
    public virtual ICollection<ForumTopicHistory> EditHistory { get; set; } = new List<ForumTopicHistory>();
}

[Table("forum_replies")]
public class ForumReply
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic Topic { get; set; } = null!;

    public Guid AuthorId { get; set; }

    [ForeignKey(nameof(AuthorId))]
    public virtual User Author { get; set; } = null!;

    public Guid? ParentReplyId { get; set; }

    [ForeignKey(nameof(ParentReplyId))]
    public virtual ForumReply? ParentReply { get; set; }

    [Required]
    public string Content { get; set; } = null!;

    [MaxLength(2000)]
    public string? QuoteText { get; set; } // Captures referenced reply content if quote-reply is used

    public bool IsAcceptedSolution { get; set; } = false;

    public int Score { get; set; } = 0;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<ForumReply> ChildReplies { get; set; } = new List<ForumReply>();
    public virtual ICollection<ForumVote> Votes { get; set; } = new List<ForumVote>();
    public virtual ICollection<ForumReaction> Reactions { get; set; } = new List<ForumReaction>();
    public virtual ICollection<ForumReplyHistory> EditHistory { get; set; } = new List<ForumReplyHistory>();
}

[Table("forum_tags")]
public class ForumTag
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Slug { get; set; } = null!;

    public bool IsArchived { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<ForumTopicTag> TopicTags { get; set; } = new List<ForumTopicTag>();
}

[Table("forum_topic_tags")]
public class ForumTopicTag
{
    public Guid TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic Topic { get; set; } = null!;

    public Guid TagId { get; set; }

    [ForeignKey(nameof(TagId))]
    public virtual ForumTag Tag { get; set; } = null!;
}

[Table("forum_votes")]
public class ForumVote
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic? Topic { get; set; }

    public Guid? ReplyId { get; set; }

    [ForeignKey(nameof(ReplyId))]
    public virtual ForumReply? Reply { get; set; }

    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string VoteType { get; set; } = null!; // "UPVOTE", "DOWNVOTE", "LIKE", "HELPFUL", "INSIGHTFUL"

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_reactions")]
public class ForumReaction
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic? Topic { get; set; }

    public Guid? ReplyId { get; set; }

    [ForeignKey(nameof(ReplyId))]
    public virtual ForumReply? Reply { get; set; }

    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ReactionType { get; set; } = null!; // Emoji string representation (e.g. "thumbs_up", "heart")

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_bookmarks")]
public class ForumBookmark
{
    public Guid TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic Topic { get; set; } = null!;

    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_follows")]
public class ForumFollow
{
    public Guid TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic Topic { get; set; } = null!;

    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_reports")]
public class ForumReport
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic? Topic { get; set; }

    public Guid? ReplyId { get; set; }

    [ForeignKey(nameof(ReplyId))]
    public virtual ForumReply? Reply { get; set; }

    public Guid? ReportedUserId { get; set; }

    [ForeignKey(nameof(ReportedUserId))]
    public virtual User? ReportedUser { get; set; }

    public Guid ReporterUserId { get; set; }

    [ForeignKey(nameof(ReporterUserId))]
    public virtual User ReporterUser { get; set; } = null!;

    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "PENDING"; // "PENDING", "RESOLVED", "DISMISSED"

    [MaxLength(1000)]
    public string? ResolutionNotes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ResolvedAt { get; set; }

    public Guid? ResolvedById { get; set; }

    [ForeignKey(nameof(ResolvedById))]
    public virtual User? ResolvedBy { get; set; }
}

[Table("forum_reputations")]
public class ForumReputation
{
    [Key]
    [ForeignKey(nameof(User))]
    public Guid UserId { get; set; }

    public virtual User User { get; set; } = null!;

    public int Points { get; set; } = 0;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_badges")]
public class ForumBadge
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string IconName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string CriteriaCode { get; set; } = null!; // E.g., "first_post", "accepted_solutions_5"

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_user_badges")]
public class ForumUserBadge
{
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public Guid BadgeId { get; set; }

    [ForeignKey(nameof(BadgeId))]
    public virtual ForumBadge Badge { get; set; } = null!;

    public DateTimeOffset AwardedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_moderation_logs")]
public class ForumModerationLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid ModeratorId { get; set; }

    [ForeignKey(nameof(ModeratorId))]
    public virtual User Moderator { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TargetType { get; set; } = null!; // "TOPIC", "REPLY", "USER"

    public Guid TargetId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Action { get; set; } = null!; // "LOCK", "UNLOCK", "PIN", "UNPIN", "DELETE", "RESTORE", "SUSPEND_USER", "UNSUSPEND_USER"

    [MaxLength(500)]
    public string? Reason { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_topic_histories")]
public class ForumTopicHistory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid TopicId { get; set; }

    [ForeignKey(nameof(TopicId))]
    public virtual ForumTopic Topic { get; set; } = null!;

    public Guid EditedById { get; set; }

    [ForeignKey(nameof(EditedById))]
    public virtual User EditedBy { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public DateTimeOffset EditedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("forum_reply_histories")]
public class ForumReplyHistory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid ReplyId { get; set; }

    [ForeignKey(nameof(ReplyId))]
    public virtual ForumReply Reply { get; set; } = null!;

    public Guid EditedById { get; set; }

    [ForeignKey(nameof(EditedById))]
    public virtual User EditedBy { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public DateTimeOffset EditedAt { get; set; } = DateTimeOffset.UtcNow;
}
