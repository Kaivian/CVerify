using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Net;

namespace CVerify.API.Core.Entities;

public class User
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();


    [Required]
    [Column(TypeName = "citext")]
    public string Email { get; set; } = null!;

    public string? PasswordHash { get; set; }

    [Required]
    [MaxLength(255)]
    public string FullName { get; set; } = null!;

    public string? AvatarUrl { get; set; }

    [Required]
    public UserStatus Status { get; set; } = UserStatus.EMAIL_VERIFY_PENDING;

    public DateTimeOffset? EmailVerifiedAt { get; set; }

    public DateTimeOffset? LastLoginAt { get; set; }

    public IPAddress? LastLoginIp { get; set; } // Map to INET in Postgres

    public int FailedAttempts { get; set; }

    public DateTimeOffset? LastFailedAt { get; set; }

    public DateTimeOffset? LockUntil { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column

    public int SessionVersion { get; set; } = 1;

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<AuthProvider> AuthProviders { get; set; } = new List<AuthProvider>();

    public virtual ICollection<PasswordCredential> PasswordCredentials { get; set; } = new List<PasswordCredential>();

    /// <summary>
    /// Transition the user to a new status using a formal domain state machine.
    /// Throws an InvalidOperationException if the transition is invalid.
    /// </summary>
    public void TransitionTo(UserStatus newStatus)
    {
        if (Status == newStatus) return;

        bool isValid = (Status, newStatus) switch
        {
            (UserStatus.EMAIL_VERIFY_PENDING, UserStatus.ACTIVE) => true,
            (UserStatus.EMAIL_VERIFY_PENDING, UserStatus.DELETED) => true,

            (UserStatus.ACTIVE, UserStatus.SUSPENDED) => true,
            (UserStatus.ACTIVE, UserStatus.BANNED) => true,
            (UserStatus.ACTIVE, UserStatus.DELETED) => true,

            (UserStatus.SUSPENDED, UserStatus.ACTIVE) => true,
            (UserStatus.SUSPENDED, UserStatus.BANNED) => true,
            (UserStatus.SUSPENDED, UserStatus.DELETED) => true,

            (UserStatus.BANNED, UserStatus.ACTIVE) => true,
            (UserStatus.BANNED, UserStatus.DELETED) => true,

            _ => false
        };

        if (!isValid)
        {
            throw new InvalidOperationException($"Invalid user status transition from {Status} to {newStatus}.");
        }

        Status = newStatus;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
