using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class WorkspacePostModuleSeeder : IPublicWorkspaceModuleSeeder
{
    public string ModuleName => "Workspace Posts Seeder";

    public async Task SeedModuleAsync(Guid organizationId, object orgDto, ApplicationDbContext context)
    {
        if (orgDto is not PublicWorkspaceSeeder.SeedOrganizationAggregate aggregateDto)
        {
            throw new ArgumentException("Invalid organization DTO type passed to WorkspacePostModuleSeeder.", nameof(orgDto));
        }

        // Fetch a valid author for the post from the organization members list
        var authorUserId = await context.OrganizationMemberships
            .Where(om => om.OrganizationId == organizationId && om.Status == "active")
            .Select(om => om.UserId)
            .FirstOrDefaultAsync();

        if (authorUserId == Guid.Empty)
        {
            // Fallback: Use the first active user in the database
            authorUserId = await context.Users
                .Where(u => u.Status == CVerify.API.Modules.Shared.Domain.Enums.UserStatus.ACTIVE)
                .Select(u => u.Id)
                .FirstOrDefaultAsync();

            if (authorUserId == Guid.Empty)
            {
                // If no users exist, skip post creation to prevent FK violations
                return;
            }
        }

        foreach (var postDto in aggregateDto.Posts)
        {
            // Idempotency check: lookup existing post by content hash or exact content
            var contentHash = postDto.Content.Trim();
            var existingPost = await context.WorkspacePosts
                .FirstOrDefaultAsync(p => p.OrganizationId == organizationId && p.Content == contentHash);

            if (existingPost != null)
            {
                // Update post stats (Upsert)
                existingPost.Category = postDto.Category;
                existingPost.Images = postDto.Images;
                existingJobPostStats(existingPost, postDto.Likes, postDto.SharesCount);
                existingPost.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                // Create new post
                var newPost = new WorkspacePost
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = organizationId,
                    CreatedByUserId = authorUserId,
                    Category = postDto.Category,
                    Content = postDto.Content,
                    Images = postDto.Images,
                    Likes = postDto.Likes,
                    SharesCount = postDto.SharesCount,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.WorkspacePosts.Add(newPost);
            }
        }
        await context.SaveChangesAsync();
    }

    private static void existingJobPostStats(WorkspacePost post, int likes, int shares)
    {
        post.Likes = likes > 0 ? likes : post.Likes;
        post.SharesCount = shares > 0 ? shares : post.SharesCount;
    }
}
