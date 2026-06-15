using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class OrganizationFollower
{
    public Guid UserId { get; set; }

    public Guid OrganizationId { get; set; }

    public DateTimeOffset FollowedAt { get; set; } = DateTimeOffset.UtcNow;

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;
}
