using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Forum.DTOs;
using CVerify.API.Modules.Forum.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Forum.Services;

public class ForumService : IForumService
{
    private readonly ApplicationDbContext _context;
    private readonly IActivityEventPublisher _eventPublisher;

    public ForumService(ApplicationDbContext context, IActivityEventPublisher eventPublisher)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _eventPublisher = eventPublisher ?? throw new ArgumentNullException(nameof(eventPublisher));
    }

    #region Helper Methods

    private string GenerateSlug(string title)
    {
        string str = title.ToLowerInvariant();
        // Convert spaces & invalid characters to dashes
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        str = Regex.Replace(str, @"\s+", " ").Trim();
        str = Regex.Replace(str, @"\s", "-");
        // Suffix with unique token to guarantee uniqueness
        string uniqueToken = Guid.NewGuid().ToString("N").Substring(0, 8);
        return $"{str}-{uniqueToken}";
    }

    private async Task AwardReputationPointsAsync(Guid userId, int points, CancellationToken cancellationToken)
    {
        var reputation = await _context.ForumReputations.FirstOrDefaultAsync(r => r.UserId == userId, cancellationToken);
        if (reputation == null)
        {
            reputation = new ForumReputation
            {
                UserId = userId,
                Points = 0,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _context.ForumReputations.Add(reputation);
        }

        reputation.Points += points;
        if (reputation.Points < 0) reputation.Points = 0; // Guard against negative reputation
        reputation.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Check and award badges
        await EvaluateBadgesAsync(userId, reputation.Points, cancellationToken);
    }

    private async Task EvaluateBadgesAsync(Guid userId, int currentPoints, CancellationToken cancellationToken)
    {
        // 1. Top Contributor Badge (1000 reputation points)
        if (currentPoints >= 1000)
        {
            await AwardBadgeIfEligibleAsync(userId, "top_contributor", cancellationToken);
        }

        // 2. First Post Badge (First topic/reply)
        var postCount = await _context.ForumTopics.CountAsync(t => t.AuthorId == userId, cancellationToken) +
                        await _context.ForumReplies.CountAsync(r => r.AuthorId == userId, cancellationToken);
        if (postCount >= 1)
        {
            await AwardBadgeIfEligibleAsync(userId, "first_post", cancellationToken);
        }

        // 3. Community Helper (5 accepted solutions)
        var acceptedCount = await _context.ForumReplies.CountAsync(r => r.AuthorId == userId && r.IsAcceptedSolution, cancellationToken);
        if (acceptedCount >= 5)
        {
            await AwardBadgeIfEligibleAsync(userId, "community_helper", cancellationToken);
        }
    }

    private async Task AwardBadgeIfEligibleAsync(Guid userId, string criteriaCode, CancellationToken cancellationToken)
    {
        var badge = await _context.ForumBadges.FirstOrDefaultAsync(b => b.CriteriaCode == criteriaCode, cancellationToken);
        if (badge == null) return;

        var alreadyAwarded = await _context.ForumUserBadges.AnyAsync(ub => ub.UserId == userId && ub.BadgeId == badge.Id, cancellationToken);
        if (!alreadyAwarded)
        {
            _context.ForumUserBadges.Add(new ForumUserBadge
            {
                UserId = userId,
                BadgeId = badge.Id,
                AwardedAt = DateTimeOffset.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<UserMiniDto> GetUserMiniProfileAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await MapUserToMiniDtoAsync(userId, cancellationToken);
    }

    private async Task<UserMiniDto> MapUserToMiniDtoAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            return new UserMiniDto { Id = userId, FullName = "Deleted User" };
        }

        var reputation = await _context.ForumReputations
            .Where(r => r.UserId == userId)
            .Select(r => r.Points)
            .FirstOrDefaultAsync(cancellationToken);

        // Check verification states
        bool isCandidateVerified = await _context.CandidateAssessments.AnyAsync(ca => ca.UserId == userId && ca.Status == "Completed", cancellationToken);
        bool isBusinessVerified = await _context.Users.AnyAsync(u => u.Id == userId && u.Roles.Any(r => r.Name == "BUSINESS"), cancellationToken);

        return new UserMiniDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Username = user.Username,
            AvatarUrl = user.AvatarUrl,
            Reputation = reputation,
            IsCandidateVerified = isCandidateVerified,
            IsBusinessVerified = isBusinessVerified
        };
    }

    #endregion

    #region Category Operations

    public async Task<IEnumerable<CategoryResponse>> GetCategoriesAsync(Guid? organizationId, string? userRole, CancellationToken cancellationToken)
    {
        var query = _context.ForumCategories
            .Where(c => c.DeletedAt == null && c.OrganizationId == organizationId);

        var list = await query
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync(cancellationToken);

        return list.Select(c => new CategoryResponse
        {
            Id = c.Id,
            OrganizationId = c.OrganizationId,
            Name = c.Name,
            Slug = c.Slug,
            Description = c.Description,
            IconName = c.IconName,
            DisplayOrder = c.DisplayOrder,
            IsPrivate = c.IsPrivate,
            IsArchived = c.IsArchived,
            RequiredRole = c.RequiredRole,
            CreatedAt = c.CreatedAt
        });
    }

    public async Task<CategoryResponse> GetCategoryByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var c = await _context.ForumCategories.FirstOrDefaultAsync(cat => cat.Id == id && cat.DeletedAt == null, cancellationToken);
        if (c == null) throw new ResourceNotFoundException("CATEGORY_NOT_FOUND");

        return new CategoryResponse
        {
            Id = c.Id,
            OrganizationId = c.OrganizationId,
            Name = c.Name,
            Slug = c.Slug,
            Description = c.Description,
            IconName = c.IconName,
            DisplayOrder = c.DisplayOrder,
            IsPrivate = c.IsPrivate,
            IsArchived = c.IsArchived,
            RequiredRole = c.RequiredRole,
            CreatedAt = c.CreatedAt
        };
    }

    public async Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, Guid? organizationId, CancellationToken cancellationToken)
    {
        string slug = string.IsNullOrEmpty(request.Slug) ? GenerateSlug(request.Name) : request.Slug;

        var category = new ForumCategory
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = organizationId,
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            IconName = request.IconName,
            DisplayOrder = request.DisplayOrder,
            IsPrivate = request.IsPrivate,
            IsArchived = false,
            RequiredRole = request.RequiredRole,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.ForumCategories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);

        return new CategoryResponse
        {
            Id = category.Id,
            OrganizationId = category.OrganizationId,
            Name = category.Name,
            Slug = category.Slug,
            Description = category.Description,
            IconName = category.IconName,
            DisplayOrder = category.DisplayOrder,
            IsPrivate = category.IsPrivate,
            IsArchived = category.IsArchived,
            RequiredRole = category.RequiredRole,
            CreatedAt = category.CreatedAt
        };
    }

    public async Task<CategoryResponse> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await _context.ForumCategories.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, cancellationToken);
        if (category == null) throw new ResourceNotFoundException("CATEGORY_NOT_FOUND");

        category.Name = request.Name;
        if (!string.IsNullOrEmpty(request.Slug)) category.Slug = request.Slug;
        category.Description = request.Description;
        category.IconName = request.IconName;
        category.DisplayOrder = request.DisplayOrder;
        category.IsPrivate = request.IsPrivate;
        category.IsArchived = request.IsArchived;
        category.RequiredRole = request.RequiredRole;
        category.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return new CategoryResponse
        {
            Id = category.Id,
            OrganizationId = category.OrganizationId,
            Name = category.Name,
            Slug = category.Slug,
            Description = category.Description,
            IconName = category.IconName,
            DisplayOrder = category.DisplayOrder,
            IsPrivate = category.IsPrivate,
            IsArchived = category.IsArchived,
            RequiredRole = category.RequiredRole,
            CreatedAt = category.CreatedAt
        };
    }

    public async Task DeleteCategoryAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await _context.ForumCategories.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, cancellationToken);
        if (category == null) throw new ResourceNotFoundException("CATEGORY_NOT_FOUND");

        category.DeletedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }

    #endregion

    #region Tag Operations

    public async Task<IEnumerable<TagResponse>> GetTagsAsync(CancellationToken cancellationToken)
    {
        return await _context.ForumTags
            .Where(t => !t.IsArchived)
            .OrderBy(t => t.Name)
            .Select(t => new TagResponse
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                IsArchived = t.IsArchived,
                TopicCount = t.TopicTags.Count
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<TagResponse>> GetTrendingTagsAsync(CancellationToken cancellationToken)
    {
        // Trending defined as tags with the most topic associations
        return await _context.ForumTags
            .Where(t => !t.IsArchived)
            .OrderByDescending(t => t.TopicTags.Count)
            .Take(10)
            .Select(t => new TagResponse
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                IsArchived = t.IsArchived,
                TopicCount = t.TopicTags.Count
            })
            .ToListAsync(cancellationToken);
    }

    public async Task MergeTagsAsync(string sourceSlug, string targetSlug, CancellationToken cancellationToken)
    {
        var sourceTag = await _context.ForumTags.FirstOrDefaultAsync(t => t.Slug == sourceSlug, cancellationToken);
        var targetTag = await _context.ForumTags.FirstOrDefaultAsync(t => t.Slug == targetSlug, cancellationToken);

        if (sourceTag == null) throw new ResourceNotFoundException("SOURCE_TAG_NOT_FOUND");
        if (targetTag == null) throw new ResourceNotFoundException("TARGET_TAG_NOT_FOUND");

        // Load all topic links for source tag
        var topicTags = await _context.ForumTopicTags.Where(tt => tt.TagId == sourceTag.Id).ToListAsync(cancellationToken);

        foreach (var tt in topicTags)
        {
            // Check if topic is already associated with target tag
            var targetExists = await _context.ForumTopicTags.AnyAsync(xt => xt.TopicId == tt.TopicId && xt.TagId == targetTag.Id, cancellationToken);
            if (!targetExists)
            {
                _context.ForumTopicTags.Add(new ForumTopicTag
                {
                    TopicId = tt.TopicId,
                    TagId = targetTag.Id
                });
            }
            _context.ForumTopicTags.Remove(tt);
        }

        sourceTag.IsArchived = true;
        await _context.SaveChangesAsync(cancellationToken);
    }

    #endregion

    #region Topic Operations

    public async Task<ForumPagedResult<TopicListItemResponse>> GetTopicsAsync(ForumTopicSearchQuery query, Guid? currentUserId, string? userRole, CancellationToken cancellationToken)
    {
        var dbQuery = _context.ForumTopics
            .Include(t => t.Category)
            .Include(t => t.TopicTags)
            .ThenInclude(tt => tt.Tag)
            .Where(t => t.DeletedAt == null && !t.IsPendingReview && t.OrganizationId == query.OrganizationId);

        // Filter by Category
        if (query.CategoryId.HasValue)
        {
            dbQuery = dbQuery.Where(t => t.CategoryId == query.CategoryId.Value);
        }

        // Filter by Tag
        if (!string.IsNullOrEmpty(query.Tag))
        {
            dbQuery = dbQuery.Where(t => t.TopicTags.Any(tt => tt.Tag.Slug == query.Tag));
        }

        // Search text
        if (!string.IsNullOrEmpty(query.Search))
        {
            string searchLower = query.Search.ToLowerInvariant();
            dbQuery = dbQuery.Where(t => t.Title.ToLower().Contains(searchLower) || t.Content.ToLower().Contains(searchLower));
        }

        // Apply filters
        if (!string.IsNullOrEmpty(query.Filter))
        {
            switch (query.Filter.ToLowerInvariant())
            {
                case "trending":
                    dbQuery = dbQuery.OrderByDescending(t => t.ViewCount + (t.ReplyCount * 5) + (t.Score * 2));
                    break;
                case "most_viewed":
                    dbQuery = dbQuery.OrderByDescending(t => t.ViewCount);
                    break;
                case "unanswered":
                    dbQuery = dbQuery.Where(t => t.ReplyCount == 0);
                    break;
                case "solved":
                    dbQuery = dbQuery.Where(t => t.IsSolved);
                    break;
                case "bookmarked":
                    if (currentUserId.HasValue)
                    {
                        dbQuery = dbQuery.Where(t => t.Bookmarks.Any(b => b.UserId == currentUserId.Value));
                    }
                    break;
                case "following":
                    if (currentUserId.HasValue)
                    {
                        dbQuery = dbQuery.Where(t => t.Follows.Any(f => f.UserId == currentUserId.Value));
                    }
                    break;
                default:
                    // default latest is handled below
                    break;
            }
        }

        // Default sorting
        if (string.IsNullOrEmpty(query.Filter) || query.Filter.ToLowerInvariant() == "latest")
        {
            dbQuery = dbQuery.OrderByDescending(t => t.IsPinned).ThenByDescending(t => t.LastActivityAt);
        }

        int totalItems = await dbQuery.CountAsync(cancellationToken);
        int totalPages = (int)Math.Ceiling((double)totalItems / query.PageSize);
        if (totalPages == 0) totalPages = 1;

        var items = await dbQuery
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var listResponse = new List<TopicListItemResponse>();
        foreach (var t in items)
        {
            var authorDto = await MapUserToMiniDtoAsync(t.AuthorId, cancellationToken);
            bool isBookmarked = currentUserId.HasValue && await _context.ForumBookmarks.AnyAsync(b => b.TopicId == t.Id && b.UserId == currentUserId.Value, cancellationToken);
            bool isFollowing = currentUserId.HasValue && await _context.ForumFollows.AnyAsync(f => f.TopicId == t.Id && f.UserId == currentUserId.Value, cancellationToken);

            string? userVote = null;
            if (currentUserId.HasValue)
            {
                var vote = await _context.ForumVotes.FirstOrDefaultAsync(v => v.TopicId == t.Id && v.UserId == currentUserId.Value, cancellationToken);
                userVote = vote?.VoteType;
            }

            // Excerpt extraction
            string excerpt = t.Content.Length > 200 ? t.Content.Substring(0, 200) + "..." : t.Content;
            // Basic HTML strip
            excerpt = Regex.Replace(excerpt, "<.*?>", string.Empty);

            listResponse.Add(new TopicListItemResponse
            {
                Id = t.Id,
                CategoryId = t.CategoryId,
                CategoryName = t.Category.Name,
                CategorySlug = t.Category.Slug,
                OrganizationId = t.OrganizationId,
                Author = authorDto,
                Title = t.Title,
                Slug = t.Slug,
                Excerpt = excerpt,
                AiExcerpt = t.AiExcerpt,
                ViewCount = t.ViewCount,
                ReplyCount = t.ReplyCount,
                Score = t.Score,
                IsPinned = t.IsPinned,
                IsLocked = t.IsLocked,
                IsSolved = t.IsSolved,
                IsFeatured = t.IsFeatured,
                IsBookmarked = isBookmarked,
                IsFollowing = isFollowing,
                UserVote = userVote,
                Tags = t.TopicTags.Select(tt => tt.Tag.Name).ToList(),
                LastActivityAt = t.LastActivityAt,
                CreatedAt = t.CreatedAt
            });
        }

        return new ForumPagedResult<TopicListItemResponse>
        {
            Items = listResponse,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    public async Task<TopicResponse> GetTopicBySlugAsync(string slug, Guid? currentUserId, CancellationToken cancellationToken)
    {
        var t = await _context.ForumTopics
            .Include(x => x.Category)
            .Include(x => x.TopicTags)
            .ThenInclude(tt => tt.Tag)
            .FirstOrDefaultAsync(x => x.Slug == slug && x.DeletedAt == null, cancellationToken);

        if (t == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        // Increment ViewCount using thread-safe Redis-style buffer or immediate increment for now
        t.ViewCount += 1;
        await _context.SaveChangesAsync(cancellationToken);

        var authorDto = await MapUserToMiniDtoAsync(t.AuthorId, cancellationToken);
        bool isBookmarked = currentUserId.HasValue && await _context.ForumBookmarks.AnyAsync(b => b.TopicId == t.Id && b.UserId == currentUserId.Value, cancellationToken);
        bool isFollowing = currentUserId.HasValue && await _context.ForumFollows.AnyAsync(f => f.TopicId == t.Id && f.UserId == currentUserId.Value, cancellationToken);

        string? userVote = null;
        if (currentUserId.HasValue)
        {
            var vote = await _context.ForumVotes.FirstOrDefaultAsync(v => v.TopicId == t.Id && v.UserId == currentUserId.Value, cancellationToken);
            userVote = vote?.VoteType;
        }

        // Get Reactions
        var reactionCounts = await _context.ForumReactions
            .Where(r => r.TopicId == t.Id)
            .GroupBy(r => r.ReactionType)
            .Select(g => new ReactionCountDto
            {
                ReactionType = g.Key,
                Count = g.Count(),
                UserReacted = currentUserId.HasValue && g.Any(r => r.UserId == currentUserId.Value)
            })
            .ToListAsync(cancellationToken);

        return new TopicResponse
        {
            Id = t.Id,
            CategoryId = t.CategoryId,
            CategoryName = t.Category.Name,
            CategorySlug = t.Category.Slug,
            OrganizationId = t.OrganizationId,
            Author = authorDto,
            Title = t.Title,
            Slug = t.Slug,
            Content = t.Content,
            AiExcerpt = t.AiExcerpt,
            ViewCount = t.ViewCount,
            ReplyCount = t.ReplyCount,
            Score = t.Score,
            IsPinned = t.IsPinned,
            IsLocked = t.IsLocked,
            IsSolved = t.IsSolved,
            IsFeatured = t.IsFeatured,
            IsBookmarked = isBookmarked,
            IsFollowing = isFollowing,
            UserVote = userVote,
            Tags = t.TopicTags.Select(tt => tt.Tag.Name).ToList(),
            Reactions = reactionCounts,
            LastActivityAt = t.LastActivityAt,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        };
    }

    public async Task<TopicResponse> CreateTopicAsync(CreateTopicRequest request, Guid authorId, CancellationToken cancellationToken)
    {
        var category = await _context.ForumCategories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.DeletedAt == null, cancellationToken);
        if (category == null) throw new ResourceNotFoundException("CATEGORY_NOT_FOUND");
        if (category.IsArchived) throw new BusinessRuleException("CATEGORY_ARCHIVED", "Cannot post in archived category.");

        string slug = GenerateSlug(request.Title);

        var topic = new ForumTopic
        {
            Id = Guid.CreateVersion7(),
            CategoryId = request.CategoryId,
            OrganizationId = request.OrganizationId,
            AuthorId = authorId,
            Title = request.Title,
            Slug = slug,
            Content = request.Content,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            LastActivityAt = DateTimeOffset.UtcNow
        };

        _context.ForumTopics.Add(topic);

        // Process Tags
        foreach (var tagName in request.Tags.Distinct())
        {
            var cleanedTagName = tagName.Trim();
            var tagSlug = cleanedTagName.ToLowerInvariant().Replace(" ", "-");

            var tag = await _context.ForumTags.FirstOrDefaultAsync(tag => tag.Slug == tagSlug, cancellationToken);
            if (tag == null)
            {
                tag = new ForumTag
                {
                    Id = Guid.CreateVersion7(),
                    Name = cleanedTagName,
                    Slug = tagSlug,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.ForumTags.Add(tag);
            }

            _context.ForumTopicTags.Add(new ForumTopicTag
            {
                TopicId = topic.Id,
                TagId = tag.Id
            });
        }

        // Auto-follow own topic
        _context.ForumFollows.Add(new ForumFollow
        {
            TopicId = topic.Id,
            UserId = authorId,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        // Award Reputation points (+5 points for creating topic)
        await AwardReputationPointsAsync(authorId, 5, cancellationToken);

        // Publish Outbox Event for AI integration, spam moderation and notifications
        await _eventPublisher.PublishAsync(
            "FORUM_TOPIC_CREATED",
            "forum_topic",
            topic.Id,
            topic.OrganizationId,
            authorId,
            new { Title = topic.Title },
            visibility: topic.OrganizationId.HasValue ? "organization" : "public"
        );

        return await GetTopicBySlugAsync(topic.Slug, authorId, cancellationToken);
    }

    public async Task<TopicResponse> UpdateTopicAsync(Guid id, UpdateTopicRequest request, Guid currentUserId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        // Validate Ownership or Mod/Admin
        if (topic.AuthorId != currentUserId)
        {
            throw new AuthorizationException("FORUM_FORBIDDEN", "You are not the author of this topic.");
        }

        if (topic.IsLocked) throw new BusinessRuleException("TOPIC_LOCKED", "Topic is locked and cannot be edited.");

        // Record History
        _context.ForumTopicHistories.Add(new ForumTopicHistory
        {
            Id = Guid.CreateVersion7(),
            TopicId = topic.Id,
            EditedById = currentUserId,
            Title = topic.Title,
            Content = topic.Content,
            EditedAt = DateTimeOffset.UtcNow
        });

        topic.Title = request.Title;
        topic.Content = request.Content;
        topic.UpdatedAt = DateTimeOffset.UtcNow;

        // Clear existing tags
        var existingTags = await _context.ForumTopicTags.Where(tt => tt.TopicId == topic.Id).ToListAsync(cancellationToken);
        _context.ForumTopicTags.RemoveRange(existingTags);

        // Map new tags
        foreach (var tagName in request.Tags.Distinct())
        {
            var cleanedTagName = tagName.Trim();
            var tagSlug = cleanedTagName.ToLowerInvariant().Replace(" ", "-");

            var tag = await _context.ForumTags.FirstOrDefaultAsync(tg => tg.Slug == tagSlug, cancellationToken);
            if (tag == null)
            {
                tag = new ForumTag
                {
                    Id = Guid.CreateVersion7(),
                    Name = cleanedTagName,
                    Slug = tagSlug,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.ForumTags.Add(tag);
            }

            _context.ForumTopicTags.Add(new ForumTopicTag
            {
                TopicId = topic.Id,
                TagId = tag.Id
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await GetTopicBySlugAsync(topic.Slug, currentUserId, cancellationToken);
    }

    public async Task DeleteTopicAsync(Guid id, Guid currentUserId, string? userRole, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        // Verify Ownership or Mod/Admin
        bool isModerator = userRole == "ADMIN" || userRole == "MODERATOR";
        if (topic.AuthorId != currentUserId && !isModerator)
        {
            throw new AuthorizationException("FORUM_FORBIDDEN", "You are not authorized to delete this topic.");
        }

        topic.DeletedAt = DateTimeOffset.UtcNow;

        // Write Mod Log if moderator performed deletion
        if (isModerator && topic.AuthorId != currentUserId)
        {
            _context.ForumModerationLogs.Add(new ForumModerationLog
            {
                Id = Guid.CreateVersion7(),
                ModeratorId = currentUserId,
                TargetType = "TOPIC",
                TargetId = topic.Id,
                Action = "DELETE",
                Reason = "Content Violation",
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<TopicResponse> PerformModeratorActionOnTopicAsync(Guid id, string action, string? reason, Guid moderatorId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        switch (action.ToUpperInvariant())
        {
            case "LOCK":
                topic.IsLocked = true;
                break;
            case "UNLOCK":
                topic.IsLocked = false;
                break;
            case "PIN":
                topic.IsPinned = true;
                break;
            case "UNPIN":
                topic.IsPinned = false;
                break;
            case "RESTORE":
                // Soft deletes restore logic
                break;
            default:
                throw new ValidationException($"Invalid moderation action: {action}");
        }

        topic.UpdatedAt = DateTimeOffset.UtcNow;

        _context.ForumModerationLogs.Add(new ForumModerationLog
        {
            Id = Guid.CreateVersion7(),
            ModeratorId = moderatorId,
            TargetType = "TOPIC",
            TargetId = topic.Id,
            Action = action.ToUpperInvariant(),
            Reason = reason ?? "Moderator Action",
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        // Publish Moderator Action Event
        await _eventPublisher.PublishAsync(
            "FORUM_TOPIC_MODERATED",
            "forum_topic",
            topic.Id,
            topic.OrganizationId,
            moderatorId,
            new { Action = action, Reason = reason },
            visibility: topic.OrganizationId.HasValue ? "organization" : "public"
        );

        return await GetTopicBySlugAsync(topic.Slug, moderatorId, cancellationToken);
    }

    #endregion

    #region Reply Operations

    public async Task<IEnumerable<ReplyResponse>> GetTopicRepliesAsync(Guid topicId, Guid? currentUserId, CancellationToken cancellationToken)
    {
        // Enforce tree hierarchy fetching only root level replies (ParentReplyId == null)
        var rootReplies = await _context.ForumReplies
            .Where(r => r.TopicId == topicId && r.ParentReplyId == null && r.DeletedAt == null)
            .OrderBy(r => r.IsAcceptedSolution ? 0 : 1) // Accepted answer floats to top
            .ThenBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        var list = new List<ReplyResponse>();
        foreach (var r in rootReplies)
        {
            list.Add(await MapReplyToResponseAsync(r, currentUserId, cancellationToken));
        }

        return list;
    }

    private async Task<ReplyResponse> MapReplyToResponseAsync(ForumReply r, Guid? currentUserId, CancellationToken cancellationToken)
    {
        var authorDto = await MapUserToMiniDtoAsync(r.AuthorId, cancellationToken);

        string? userVote = null;
        if (currentUserId.HasValue)
        {
            var vote = await _context.ForumVotes.FirstOrDefaultAsync(v => v.ReplyId == r.Id && v.UserId == currentUserId.Value, cancellationToken);
            userVote = vote?.VoteType;
        }

        var reactionCounts = await _context.ForumReactions
            .Where(x => x.ReplyId == r.Id)
            .GroupBy(x => x.ReactionType)
            .Select(g => new ReactionCountDto
            {
                ReactionType = g.Key,
                Count = g.Count(),
                UserReacted = currentUserId.HasValue && g.Any(x => x.UserId == currentUserId.Value)
            })
            .ToListAsync(cancellationToken);

        // Fetch children recursively
        var children = await _context.ForumReplies
            .Where(c => c.ParentReplyId == r.Id && c.DeletedAt == null)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        var childDtos = new List<ReplyResponse>();
        foreach (var c in children)
        {
            childDtos.Add(await MapReplyToResponseAsync(c, currentUserId, cancellationToken));
        }

        return new ReplyResponse
        {
            Id = r.Id,
            TopicId = r.TopicId,
            Author = authorDto,
            ParentReplyId = r.ParentReplyId,
            Content = r.Content,
            QuoteText = r.QuoteText,
            IsAcceptedSolution = r.IsAcceptedSolution,
            Score = r.Score,
            UserVote = userVote,
            Reactions = reactionCounts,
            ChildReplies = childDtos,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt
        };
    }

    public async Task<ReplyResponse> CreateReplyAsync(Guid topicId, CreateReplyRequest request, Guid authorId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == topicId && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");
        if (topic.IsLocked) throw new BusinessRuleException("TOPIC_LOCKED", "Cannot reply to a locked topic.");

        // Hierarchy Depth check (max 3 levels nested)
        if (request.ParentReplyId.HasValue)
        {
            var parent = await _context.ForumReplies.FindAsync(new object[] { request.ParentReplyId.Value }, cancellationToken);
            if (parent == null || parent.TopicId != topicId) throw new ResourceNotFoundException("PARENT_REPLY_NOT_FOUND");

            // Check grand-parent depth
            if (parent.ParentReplyId.HasValue)
            {
                var grandParent = await _context.ForumReplies.FindAsync(new object[] { parent.ParentReplyId.Value }, cancellationToken);
                if (grandParent != null && grandParent.ParentReplyId.HasValue)
                {
                    // Restrict nesting deeper than 3: reset parent to grand-parent or throw
                    throw new BusinessRuleException("REPLY_DEPTH_EXCEEDED", "Maximum nested replies depth is 3 levels.");
                }
            }
        }

        var reply = new ForumReply
        {
            Id = Guid.CreateVersion7(),
            TopicId = topicId,
            AuthorId = authorId,
            ParentReplyId = request.ParentReplyId,
            Content = request.Content,
            QuoteText = request.QuoteText,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.ForumReplies.Add(reply);

        // Update topic reply count & activity timestamp
        topic.ReplyCount += 1;
        topic.LastActivityAt = DateTimeOffset.UtcNow;

        // Auto-follow topic for replier
        var isFollowing = await _context.ForumFollows.AnyAsync(f => f.TopicId == topicId && f.UserId == authorId, cancellationToken);
        if (!isFollowing)
        {
            _context.ForumFollows.Add(new ForumFollow
            {
                TopicId = topicId,
                UserId = authorId,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Award Reputation Points (+2 points for replying)
        await AwardReputationPointsAsync(authorId, 2, cancellationToken);

        // Publish Event
        await _eventPublisher.PublishAsync(
            "FORUM_REPLY_CREATED",
            "forum_reply",
            reply.Id,
            topic.OrganizationId,
            authorId,
            new { TopicId = topic.Id, ParentReplyId = reply.ParentReplyId },
            visibility: topic.OrganizationId.HasValue ? "organization" : "public"
        );

        return await MapReplyToResponseAsync(reply, authorId, cancellationToken);
    }

    public async Task<ReplyResponse> UpdateReplyAsync(Guid replyId, UpdateReplyRequest request, Guid currentUserId, CancellationToken cancellationToken)
    {
        var reply = await _context.ForumReplies
            .Include(x => x.Topic)
            .FirstOrDefaultAsync(r => r.Id == replyId && r.DeletedAt == null, cancellationToken);
        if (reply == null) throw new ResourceNotFoundException("REPLY_NOT_FOUND");

        if (reply.AuthorId != currentUserId)
        {
            throw new AuthorizationException("FORUM_FORBIDDEN", "You are not the author of this reply.");
        }

        if (reply.Topic.IsLocked) throw new BusinessRuleException("TOPIC_LOCKED", "Topic is locked and reply cannot be edited.");

        // Record history
        _context.ForumReplyHistories.Add(new ForumReplyHistory
        {
            Id = Guid.CreateVersion7(),
            ReplyId = reply.Id,
            EditedById = currentUserId,
            Content = reply.Content,
            EditedAt = DateTimeOffset.UtcNow
        });

        reply.Content = request.Content;
        reply.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return await MapReplyToResponseAsync(reply, currentUserId, cancellationToken);
    }

    public async Task DeleteReplyAsync(Guid replyId, Guid currentUserId, string? userRole, CancellationToken cancellationToken)
    {
        var reply = await _context.ForumReplies
            .Include(r => r.Topic)
            .FirstOrDefaultAsync(r => r.Id == replyId && r.DeletedAt == null, cancellationToken);
        if (reply == null) throw new ResourceNotFoundException("REPLY_NOT_FOUND");

        bool isModerator = userRole == "ADMIN" || userRole == "MODERATOR";
        if (reply.AuthorId != currentUserId && !isModerator)
        {
            throw new AuthorizationException("FORUM_FORBIDDEN", "You are not authorized to delete this reply.");
        }

        reply.DeletedAt = DateTimeOffset.UtcNow;

        // Decrement reply count on topic
        reply.Topic.ReplyCount -= 1;
        if (reply.Topic.ReplyCount < 0) reply.Topic.ReplyCount = 0;

        if (isModerator && reply.AuthorId != currentUserId)
        {
            _context.ForumModerationLogs.Add(new ForumModerationLog
            {
                Id = Guid.CreateVersion7(),
                ModeratorId = currentUserId,
                TargetType = "REPLY",
                TargetId = reply.Id,
                Action = "DELETE",
                Reason = "Content Violation",
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<ReplyResponse> AcceptSolutionAsync(Guid replyId, Guid currentUserId, CancellationToken cancellationToken)
    {
        var reply = await _context.ForumReplies
            .Include(r => r.Topic)
            .FirstOrDefaultAsync(r => r.Id == replyId && r.DeletedAt == null, cancellationToken);
        if (reply == null) throw new ResourceNotFoundException("REPLY_NOT_FOUND");

        // Verify that current user is the author of the parent topic
        if (reply.Topic.AuthorId != currentUserId)
        {
            throw new AuthorizationException("FORUM_FORBIDDEN", "Only the topic author can accept a solution.");
        }

        // Toggle or set accepted solution status
        bool wasAccepted = reply.IsAcceptedSolution;

        if (!wasAccepted)
        {
            // Clear other accepted answers in this topic
            var otherReplies = await _context.ForumReplies.Where(x => x.TopicId == reply.TopicId && x.IsAcceptedSolution).ToListAsync(cancellationToken);
            foreach (var r in otherReplies)
            {
                r.IsAcceptedSolution = false;
                // Revoke points from previously accepted author
                await AwardReputationPointsAsync(r.AuthorId, -20, cancellationToken);
            }

            reply.IsAcceptedSolution = true;
            reply.Topic.IsSolved = true;
            await _context.SaveChangesAsync(cancellationToken);

            // Award points (+20 points for accepted solution)
            await AwardReputationPointsAsync(reply.AuthorId, 20, cancellationToken);

            // Publish Accept Event
            await _eventPublisher.PublishAsync(
                "FORUM_ANSWER_ACCEPTED",
                "forum_reply",
                reply.Id,
                reply.Topic.OrganizationId,
                currentUserId,
                new { TopicId = reply.TopicId },
                visibility: reply.Topic.OrganizationId.HasValue ? "organization" : "public"
            );
        }
        else
        {
            reply.IsAcceptedSolution = false;
            reply.Topic.IsSolved = false;
            await _context.SaveChangesAsync(cancellationToken);

            // Revoke points
            await AwardReputationPointsAsync(reply.AuthorId, -20, cancellationToken);
        }

        return await MapReplyToResponseAsync(reply, currentUserId, cancellationToken);
    }

    #endregion

    #region Voting & Reactions

    public async Task VoteOnTopicAsync(Guid topicId, VoteRequest request, Guid userId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == topicId && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        var existingVote = await _context.ForumVotes.FirstOrDefaultAsync(v => v.TopicId == topicId && v.UserId == userId, cancellationToken);

        int oldScoreContribution = existingVote == null ? 0 : (existingVote.VoteType == "UPVOTE" ? 1 : -1);
        int newScoreContribution = request.VoteType == "UPVOTE" ? 1 : -1;

        if (existingVote == null)
        {
            _context.ForumVotes.Add(new ForumVote
            {
                Id = Guid.CreateVersion7(),
                TopicId = topicId,
                UserId = userId,
                VoteType = request.VoteType,
                CreatedAt = DateTimeOffset.UtcNow
            });
            topic.Score += newScoreContribution;
            await AwardReputationPointsAsync(topic.AuthorId, newScoreContribution * 10, cancellationToken);
        }
        else if (existingVote.VoteType == request.VoteType)
        {
            // Toggle off (remove vote)
            _context.ForumVotes.Remove(existingVote);
            topic.Score -= oldScoreContribution;
            await AwardReputationPointsAsync(topic.AuthorId, -oldScoreContribution * 10, cancellationToken);
        }
        else
        {
            // Switch vote type
            existingVote.VoteType = request.VoteType;
            topic.Score = topic.Score - oldScoreContribution + newScoreContribution;
            await AwardReputationPointsAsync(topic.AuthorId, (newScoreContribution - oldScoreContribution) * 10, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task VoteOnReplyAsync(Guid replyId, VoteRequest request, Guid userId, CancellationToken cancellationToken)
    {
        var reply = await _context.ForumReplies.FirstOrDefaultAsync(r => r.Id == replyId && r.DeletedAt == null, cancellationToken);
        if (reply == null) throw new ResourceNotFoundException("REPLY_NOT_FOUND");

        var existingVote = await _context.ForumVotes.FirstOrDefaultAsync(v => v.ReplyId == replyId && v.UserId == userId, cancellationToken);

        int oldScoreContribution = existingVote == null ? 0 : (existingVote.VoteType == "UPVOTE" ? 1 : -1);
        int newScoreContribution = request.VoteType == "UPVOTE" ? 1 : -1;

        if (existingVote == null)
        {
            _context.ForumVotes.Add(new ForumVote
            {
                Id = Guid.CreateVersion7(),
                ReplyId = replyId,
                UserId = userId,
                VoteType = request.VoteType,
                CreatedAt = DateTimeOffset.UtcNow
            });
            reply.Score += newScoreContribution;
            await AwardReputationPointsAsync(reply.AuthorId, newScoreContribution * 10, cancellationToken);
        }
        else if (existingVote.VoteType == request.VoteType)
        {
            _context.ForumVotes.Remove(existingVote);
            reply.Score -= oldScoreContribution;
            await AwardReputationPointsAsync(reply.AuthorId, -oldScoreContribution * 10, cancellationToken);
        }
        else
        {
            existingVote.VoteType = request.VoteType;
            reply.Score = reply.Score - oldScoreContribution + newScoreContribution;
            await AwardReputationPointsAsync(reply.AuthorId, (newScoreContribution - oldScoreContribution) * 10, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ReactToTopicAsync(Guid topicId, ReactionRequest request, Guid userId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == topicId && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        var existingReaction = await _context.ForumReactions
            .FirstOrDefaultAsync(r => r.TopicId == topicId && r.UserId == userId && r.ReactionType == request.ReactionType, cancellationToken);

        if (existingReaction == null)
        {
            _context.ForumReactions.Add(new ForumReaction
            {
                Id = Guid.CreateVersion7(),
                TopicId = topicId,
                UserId = userId,
                ReactionType = request.ReactionType,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        else
        {
            _context.ForumReactions.Remove(existingReaction);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ReactToReplyAsync(Guid replyId, ReactionRequest request, Guid userId, CancellationToken cancellationToken)
    {
        var reply = await _context.ForumReplies.FirstOrDefaultAsync(r => r.Id == replyId && r.DeletedAt == null, cancellationToken);
        if (reply == null) throw new ResourceNotFoundException("REPLY_NOT_FOUND");

        var existingReaction = await _context.ForumReactions
            .FirstOrDefaultAsync(r => r.ReplyId == replyId && r.UserId == userId && r.ReactionType == request.ReactionType, cancellationToken);

        if (existingReaction == null)
        {
            _context.ForumReactions.Add(new ForumReaction
            {
                Id = Guid.CreateVersion7(),
                ReplyId = replyId,
                UserId = userId,
                ReactionType = request.ReactionType,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        else
        {
            _context.ForumReactions.Remove(existingReaction);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    #endregion

    #region Bookmarks & Follows

    public async Task ToggleBookmarkTopicAsync(Guid topicId, Guid userId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == topicId && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        var bookmark = await _context.ForumBookmarks.FirstOrDefaultAsync(b => b.TopicId == topicId && b.UserId == userId, cancellationToken);
        if (bookmark == null)
        {
            _context.ForumBookmarks.Add(new ForumBookmark
            {
                TopicId = topicId,
                UserId = userId,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        else
        {
            _context.ForumBookmarks.Remove(bookmark);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ToggleFollowTopicAsync(Guid topicId, Guid userId, CancellationToken cancellationToken)
    {
        var topic = await _context.ForumTopics.FirstOrDefaultAsync(t => t.Id == topicId && t.DeletedAt == null, cancellationToken);
        if (topic == null) throw new ResourceNotFoundException("TOPIC_NOT_FOUND");

        var follow = await _context.ForumFollows.FirstOrDefaultAsync(f => f.TopicId == topicId && f.UserId == userId, cancellationToken);
        if (follow == null)
        {
            _context.ForumFollows.Add(new ForumFollow
            {
                TopicId = topicId,
                UserId = userId,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        else
        {
            _context.ForumFollows.Remove(follow);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    #endregion

    #region Moderation & Reports

    public async Task ReportContentAsync(CreateReportRequest request, Guid reporterId, CancellationToken cancellationToken)
    {
        if (!request.TopicId.HasValue && !request.ReplyId.HasValue && !request.ReportedUserId.HasValue)
        {
            throw new ValidationException("Must specify either TopicId, ReplyId, or ReportedUserId to file a report.");
        }

        var report = new ForumReport
        {
            Id = Guid.CreateVersion7(),
            TopicId = request.TopicId,
            ReplyId = request.ReplyId,
            ReportedUserId = request.ReportedUserId,
            ReporterUserId = reporterId,
            Reason = request.Reason,
            Status = "PENDING",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.ForumReports.Add(report);
        await _context.SaveChangesAsync(cancellationToken);

        // Publish Report Event (can trigger emails to admin channels)
        await _eventPublisher.PublishAsync(
            "FORUM_CONTENT_REPORTED",
            "forum_report",
            report.Id,
            null,
            reporterId,
            new { Reason = report.Reason },
            visibility: "admin"
        );
    }

    public async Task<ForumPagedResult<ReportResponse>> GetReportsAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _context.ForumReports
            .Include(r => r.Topic)
            .Include(r => r.Reply)
            .Include(r => r.ReportedUser)
            .Include(r => r.ResolvedBy)
            .OrderByDescending(r => r.CreatedAt);

        int totalItems = await query.CountAsync(cancellationToken);
        int totalPages = (int)Math.Ceiling((double)totalItems / pageSize);
        if (totalPages == 0) totalPages = 1;

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var responseList = new List<ReportResponse>();
        foreach (var r in items)
        {
            var reporterDto = await MapUserToMiniDtoAsync(r.ReporterUserId, cancellationToken);
            responseList.Add(new ReportResponse
            {
                Id = r.Id,
                TopicId = r.TopicId,
                TopicTitle = r.Topic?.Title,
                ReplyId = r.ReplyId,
                ReplyExcerpt = r.Reply?.Content.Length > 100 ? r.Reply.Content.Substring(0, 100) + "..." : r.Reply?.Content,
                ReportedUserId = r.ReportedUserId,
                ReportedUserName = r.ReportedUser?.FullName,
                Reporter = reporterDto,
                Reason = r.Reason,
                Status = r.Status,
                ResolutionNotes = r.ResolutionNotes,
                CreatedAt = r.CreatedAt,
                ResolvedAt = r.ResolvedAt,
                ResolvedByName = r.ResolvedBy?.FullName
            });
        }

        return new ForumPagedResult<ReportResponse>
        {
            Items = responseList,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalPages
        };
    }

    public async Task ResolveReportAsync(Guid reportId, ResolveReportRequest request, Guid moderatorId, CancellationToken cancellationToken)
    {
        var report = await _context.ForumReports.FirstOrDefaultAsync(r => r.Id == reportId, cancellationToken);
        if (report == null) throw new ResourceNotFoundException("REPORT_NOT_FOUND");

        report.Status = request.Status;
        report.ResolutionNotes = request.ResolutionNotes;
        report.ResolvedAt = DateTimeOffset.UtcNow;
        report.ResolvedById = moderatorId;

        await _context.SaveChangesAsync(cancellationToken);
    }

    #endregion
}
