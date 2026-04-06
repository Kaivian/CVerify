using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class Message
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ConversationId { get; set; }

    [ForeignKey(nameof(ConversationId))]
    public virtual Conversation Conversation { get; set; } = null!;

    [Required]
    public MessageRole Role { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    [Required]
    public StreamingState StreamingState { get; set; } = StreamingState.Pending;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
