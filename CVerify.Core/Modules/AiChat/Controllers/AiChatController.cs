
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.AiChat.Enums;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.AiChat.Controllers;

[ApiController]
[Route("api/ai/chat")]
[Authorize]
[EnableRateLimiting("AiChatLimit")]
public class AiChatController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IHmacSignatureService _hmacService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AiChatController> _logger;

    public AiChatController(
        ApplicationDbContext dbContext,
        IHmacSignatureService hmacService,
        IHttpClientFactory httpClientFactory,
        ILogger<AiChatController> logger)
    {
        _dbContext = dbContext;
        _hmacService = hmacService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    [HttpPost("stream")]
    [Produces("text/event-stream")]
    public async Task StreamChat([FromBody] StreamChatRequest request, CancellationToken cancellationToken)
    {
        // 1. Get authenticated user
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            Response.ContentType = "application/json";
            await Response.WriteAsJsonAsync(new { message = "Unauthorized or invalid claims." }, cancellationToken);
            return;
        }

        // 2. Validate request
        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            Response.ContentType = "application/json";
            await Response.WriteAsJsonAsync(new { message = "Prompt cannot be empty." }, cancellationToken);
            return;
        }

        // 3. Pre-flight health probe check against FastAPI AI microservice with timeout protection
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(5));

        var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
        try
        {
            HttpResponseMessage healthResponse;
            try
            {
                healthResponse = await httpClient.GetAsync("/health/ready", cts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("FastAPI readiness probe timed out after 5 seconds.");
                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine readiness check timed out." }, cancellationToken);
                return;
            }
            catch (HttpRequestException ex) when (ex.InnerException is System.Net.Sockets.SocketException socketEx &&
                                                 (socketEx.SocketErrorCode == System.Net.Sockets.SocketError.ConnectionRefused ||
                                                  socketEx.SocketErrorCode == System.Net.Sockets.SocketError.HostUnreachable))
            {
                _logger.LogError(ex, "FastAPI readiness check failed: Connection refused or host unreachable. SocketErrorCode={SocketErrorCode}", socketEx.SocketErrorCode);
                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine is unreachable." }, cancellationToken);
                return;
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("DNS") || ex.InnerException is System.Net.Sockets.SocketException s && s.SocketErrorCode == System.Net.Sockets.SocketError.HostNotFound)
            {
                _logger.LogError(ex, "FastAPI readiness check failed: DNS resolution failure.");
                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine DNS resolution failed." }, cancellationToken);
                return;
            }

            var healthContent = await healthResponse.Content.ReadAsStringAsync(cancellationToken);

            if (!healthResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "FastAPI readiness probe failed. StatusCode={StatusCode}, Response={Response}",
                    healthResponse.StatusCode,
                    healthContent
                );

                if (healthResponse.StatusCode == HttpStatusCode.NotFound)
                {
                    Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                    Response.ContentType = "application/json";
                    await Response.WriteAsJsonAsync(new { error = "AI readiness endpoint is misconfigured or unavailable." }, cancellationToken);
                    return;
                }

                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine reported unhealthy readiness state." }, cancellationToken);
                return;
            }

            // Verify valid JSON structure
            try
            {
                using var jsonDoc = JsonDocument.Parse(healthContent);
                var root = jsonDoc.RootElement;
                if (!root.TryGetProperty("status", out var statusProp) || statusProp.GetString() != "ready")
                {
                    _logger.LogWarning("FastAPI readiness response has unhealthy status: {Status}", statusProp.GetString() ?? "unknown");
                    Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                    Response.ContentType = "application/json";
                    await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine is not ready." }, cancellationToken);
                    return;
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "FastAPI readiness check failed: Invalid JSON response returned: {Response}", healthContent);
                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant readiness response is corrupt." }, cancellationToken);
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reach FastAPI readiness endpoint during pre-flight check.");
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            Response.ContentType = "application/json";
            await Response.WriteAsJsonAsync(new { error = "CVerify AI Assistant engine is currently offline. Please try again in a few moments." }, cancellationToken);
            return;
        }

        // 4. Resolve or create Conversation
        Conversation conversation;
        if (request.ConversationId.HasValue)
        {
            conversation = await _dbContext.Conversations
                .FirstOrDefaultAsync(c => c.Id == request.ConversationId.Value && c.UserId == userId, cancellationToken);

            if (conversation == null)
            {
                Response.StatusCode = StatusCodes.Status404NotFound;
                Response.ContentType = "application/json";
                await Response.WriteAsJsonAsync(new { message = "Conversation not found." }, cancellationToken);
                return;
            }
        }
        else
        {
            conversation = new Conversation
            {
                UserId = userId,
                Title = request.Prompt.Length > 30 ? request.Prompt.Substring(0, 30) + "..." : request.Prompt
            };
            _dbContext.Conversations.Add(conversation);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        // 5. Save User Message
        var userMessage = new Message
        {
            ConversationId = conversation.Id,
            Role = MessageRole.User,
            Content = request.Prompt,
            StreamingState = StreamingState.Completed
        };
        _dbContext.Messages.Add(userMessage);

        // Save Assistant Message shell as Pending
        var assistantMessage = new Message
        {
            ConversationId = conversation.Id,
            Role = MessageRole.Assistant,
            Content = string.Empty,
            StreamingState = StreamingState.Pending
        };
        _dbContext.Messages.Add(assistantMessage);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 6. Fetch previous 10 messages for context
        var history = await _dbContext.Messages
            .Where(m => m.ConversationId == conversation.Id && m.Id != assistantMessage.Id && m.StreamingState == StreamingState.Completed)
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new { role = m.Role.ToString().ToLowerInvariant(), content = m.Content })
            .ToListAsync(cancellationToken);

        // 7. Formulate request tracing and correlation ID
        var correlationId = HttpContext.Items.TryGetValue("CorrelationId", out var cId)
            ? cId?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();

        // 8. Prepare Payload and call microservice
        var payload = new
        {
            messages = history
        };
        var payloadJson = JsonSerializer.Serialize(payload);

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/v1/chat/stream")
        {
            Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
        };

        // Create HMAC headers
        var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", "/api/v1/chat/stream", payloadJson);

        requestMessage.Headers.Add("X-Client-Id", "cverify-core");
        requestMessage.Headers.Add("X-Timestamp", timestamp);
        requestMessage.Headers.Add("X-Nonce", nonce);
        requestMessage.Headers.Add("X-Correlation-Id", correlationId);
        requestMessage.Headers.Add("X-Signature", signature);

        // Set response headers to prevent reverse proxy buffering
        Response.Headers.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-transform";
        Response.Headers.Connection = "keep-alive";
        Response.Headers.Append("X-Accel-Buffering", "no");

        HttpResponseMessage responseMessage;
        try
        {
            responseMessage = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to FastAPI microservice for CorrelationId: {CorrelationId}", correlationId);
            assistantMessage.StreamingState = StreamingState.Failed;
            assistantMessage.Content = "Unable to reach the travel brain microservice. Please check connection and try again.";
            await _dbContext.SaveChangesAsync(CancellationToken.None); // save even if request was cancelled

            await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { error = "Unable to connect to microservice." })}\n\n", cancellationToken);
            return;
        }

        if (!responseMessage.IsSuccessStatusCode)
        {
            var errorBody = await responseMessage.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("FastAPI microservice returned error status {StatusCode}: {ErrorBody} for CorrelationId: {CorrelationId}",
                responseMessage.StatusCode, errorBody, correlationId);

            assistantMessage.StreamingState = StreamingState.Failed;
            assistantMessage.Content = "The AI service encountered an error processing this request.";
            await _dbContext.SaveChangesAsync(CancellationToken.None);

            await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { error = "Service encountered an error." })}\n\n", cancellationToken);
            return;
        }

        // Update assistant message status to Streaming
        assistantMessage.StreamingState = StreamingState.Streaming;
        await _dbContext.SaveChangesAsync(CancellationToken.None);

        var responseStream = await responseMessage.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(responseStream);

        var fullContentBuilder = new StringBuilder();

        // 9. Stream chunks with custom SSE heartbeats
        try
        {
            var readTask = reader.ReadLineAsync(cancellationToken).AsTask();

            while (true)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    break;
                }

                // Wait up to 10 seconds for a line before emitting a keep-alive ping frame
                var delayTask = Task.Delay(10000, cancellationToken);
                var completedTask = await Task.WhenAny(readTask, delayTask);

                if (completedTask == delayTask)
                {
                    // Emit SSE ping frame to prevent reverse proxies/browsers from killing the connection
                    await Response.WriteAsync(": ping\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
                else
                {
                    var line = await readTask;

                    if (line == null)
                    {
                        // End of stream reached
                        break;
                    }

                    // Re-start the read task immediately for the next loop
                    readTask = reader.ReadLineAsync(cancellationToken).AsTask();

                    if (string.IsNullOrEmpty(line))
                    {
                        continue;
                    }

                    // Send the line directly to the client browser
                    await Response.WriteAsync($"{line}\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);

                    // Parse standard SSE token: e.g., "data: {"token": "hello"}"
                    if (line.StartsWith("data: "))
                    {
                        var dataStr = line.Substring(6).Trim();
                        if (dataStr == "[DONE]")
                        {
                            break;
                        }

                        try
                        {
                            using var doc = JsonDocument.Parse(dataStr);
                            if (doc.RootElement.TryGetProperty("token", out var tokenProp))
                            {
                                var token = tokenProp.GetString();
                                if (!string.IsNullOrEmpty(token))
                                {
                                    fullContentBuilder.Append(token);
                                }
                            }
                        }
                        catch
                        {
                            // Ignore parse errors on raw meta frames
                        }
                    }
                }
            }

            // Successfully finished stream!
            assistantMessage.Content = fullContentBuilder.ToString();
            assistantMessage.StreamingState = StreamingState.Completed;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Stream request cancelled by user for CorrelationId: {CorrelationId}", correlationId);
            assistantMessage.Content = fullContentBuilder.ToString() + "\n\n[Generation cancelled by user]";
            assistantMessage.StreamingState = StreamingState.Cancelled;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during SSE token streaming for CorrelationId: {CorrelationId}", correlationId);
            assistantMessage.Content = fullContentBuilder.ToString() + "\n\n[Generation stopped due to stream failure]";
            assistantMessage.StreamingState = StreamingState.Failed;
        }
        finally
        {
            // Save state updates using non-cancelled token to ensure it persists in all cases
            conversation.UpdatedAt = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(CancellationToken.None);
        }
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var conversations = await _dbContext.Conversations
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(conversations);
    }

    [HttpGet("conversations/{id}/messages")]
    public async Task<IActionResult> GetConversationMessages(Guid id, CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var conversation = await _dbContext.Conversations
            .AnyAsync(c => c.Id == id && c.UserId == userId, cancellationToken);

        if (!conversation)
        {
            return NotFound("Conversation not found.");
        }

        var messages = await _dbContext.Messages
            .Where(m => m.ConversationId == id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id,
                m.ConversationId,
                role = m.Role.ToString().ToLowerInvariant(),
                m.Content,
                streamingState = m.StreamingState.ToString(),
                m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(messages);
    }

    [HttpDelete("conversations/{id}")]
    public async Task<IActionResult> DeleteConversation(Guid id, CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var conversation = await _dbContext.Conversations
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken);

        if (conversation == null)
        {
            return NotFound("Conversation not found.");
        }

        _dbContext.Conversations.Remove(conversation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}

public class StreamChatRequest
{
    public Guid? ConversationId { get; set; }
    public string Prompt { get; set; } = null!;
}
