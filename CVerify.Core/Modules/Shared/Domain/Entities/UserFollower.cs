using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("user_followers")]
public class UserFollower
{
    public Guid FollowerId { get; set; }

    [ForeignKey(nameof(FollowerId))]
    public virtual User Follower { get; set; } = null!;

    public Guid FolloweeId { get; set; }

    [ForeignKey(nameof(FolloweeId))]
    public virtual User Followee { get; set; } = null!;

    public DateTimeOffset FollowedAt { get; set; } = DateTimeOffset.UtcNow;
}
