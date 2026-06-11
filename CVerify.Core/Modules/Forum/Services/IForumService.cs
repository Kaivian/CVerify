using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Forum.DTOs;

namespace CVerify.API.Modules.Forum.Services;

public interface IForumService
{
    // Category Operations
    Task<IEnumerable<CategoryResponse>> GetCategoriesAsync(Guid? organizationId, string? userRole, CancellationToken cancellationToken);
    Task<CategoryResponse> GetCategoryByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, Guid? organizationId, CancellationToken cancellationToken);
    Task<CategoryResponse> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken);
    Task DeleteCategoryAsync(Guid id, CancellationToken cancellationToken);

    // Tag Operations
    Task<IEnumerable<TagResponse>> GetTagsAsync(CancellationToken cancellationToken);
    Task<IEnumerable<TagResponse>> GetTrendingTagsAsync(CancellationToken cancellationToken);
    Task MergeTagsAsync(string sourceSlug, string targetSlug, CancellationToken cancellationToken);

    // Topic Operations
    Task<ForumPagedResult<TopicListItemResponse>> GetTopicsAsync(ForumTopicSearchQuery query, Guid? currentUserId, string? userRole, CancellationToken cancellationToken);
    Task<TopicResponse> GetTopicBySlugAsync(string slug, Guid? currentUserId, CancellationToken cancellationToken);
    Task<TopicResponse> CreateTopicAsync(CreateTopicRequest request, Guid authorId, CancellationToken cancellationToken);
    Task<TopicResponse> UpdateTopicAsync(Guid id, UpdateTopicRequest request, Guid currentUserId, CancellationToken cancellationToken);
    Task DeleteTopicAsync(Guid id, Guid currentUserId, string? userRole, CancellationToken cancellationToken);
    Task<TopicResponse> PerformModeratorActionOnTopicAsync(Guid id, string action, string? reason, Guid moderatorId, CancellationToken cancellationToken);

    // Reply Operations
    Task<IEnumerable<ReplyResponse>> GetTopicRepliesAsync(Guid topicId, Guid? currentUserId, CancellationToken cancellationToken);
    Task<ReplyResponse> CreateReplyAsync(Guid topicId, CreateReplyRequest request, Guid authorId, CancellationToken cancellationToken);
    Task<ReplyResponse> UpdateReplyAsync(Guid replyId, UpdateReplyRequest request, Guid currentUserId, CancellationToken cancellationToken);
    Task DeleteReplyAsync(Guid replyId, Guid currentUserId, string? userRole, CancellationToken cancellationToken);
    Task<ReplyResponse> AcceptSolutionAsync(Guid replyId, Guid currentUserId, CancellationToken cancellationToken);

    // Voting & Reactions
    Task VoteOnTopicAsync(Guid topicId, VoteRequest request, Guid userId, CancellationToken cancellationToken);
    Task VoteOnReplyAsync(Guid replyId, VoteRequest request, Guid userId, CancellationToken cancellationToken);
    Task ReactToTopicAsync(Guid topicId, ReactionRequest request, Guid userId, CancellationToken cancellationToken);
    Task ReactToReplyAsync(Guid replyId, ReactionRequest request, Guid userId, CancellationToken cancellationToken);

    // Bookmarks & Follows
    Task ToggleBookmarkTopicAsync(Guid topicId, Guid userId, CancellationToken cancellationToken);
    Task ToggleFollowTopicAsync(Guid topicId, Guid userId, CancellationToken cancellationToken);

    // Moderation & Reports
    Task ReportContentAsync(CreateReportRequest request, Guid reporterId, CancellationToken cancellationToken);
    Task<ForumPagedResult<ReportResponse>> GetReportsAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task ResolveReportAsync(Guid reportId, ResolveReportRequest request, Guid moderatorId, CancellationToken cancellationToken);

    // User Profile
    Task<UserMiniDto> GetUserMiniProfileAsync(Guid userId, CancellationToken cancellationToken);
}
