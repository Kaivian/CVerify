using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("security_rules")]
public class SecurityRule
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(100)]
    public string Code { get; set; } = null!; // e.g., SEC_RULE_BRUTE_FORCE

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = null!;

    [Required]
    public string Description { get; set; } = null!;

    [Required]
    public bool IsEnabled { get; set; } = true;

    [Required]
    [MaxLength(20)]
    public string Severity { get; set; } = "Medium"; // Low, Medium, High, Critical

    [Column(TypeName = "jsonb")]
    public string ConfigurationJson { get; set; } = "{}"; // e.g. {"threshold": 5, "windowMinutes": 15}

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
