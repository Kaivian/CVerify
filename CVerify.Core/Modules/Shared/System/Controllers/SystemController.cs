using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.System.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SystemController : ControllerBase {
    private readonly ISystemService _systemService;

    public SystemController(ISystemService systemService)
    {
        _systemService = systemService;
    }

    [HttpGet("database-status")]
    public async Task<IActionResult> GetDatabaseStatus()
    {
        var result = await _systemService.CheckDatabaseStatusAsync();

        if (!result.Success)
        {
            return StatusCode(503, result);
        }

        return Ok(result);
    }
    
    [HttpGet("status")]
    public IActionResult GetStatus() {
        return Ok(new {
            Status = "Online",
            Message = "CVerify System is operational."
        });
    }

    [HttpGet("health")]
    public async Task<IActionResult> GetHealth() {
        var result = await _systemService.CheckSystemHealthAsync();

        if (!result.Success)
        {
            return StatusCode(503, result);
        }

        return Ok(result);
    }

    [HttpGet("ping")]
    public IActionResult Ping() {
        return Ok(new {
            success = true,
            message = "pong",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("version")]
    public IActionResult GetVersion() {
        return Ok(new {
            success = true,
            version = "1.0.0",
            environment = "Development",
            buildDate = "2026-05-14",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("info")]
    public IActionResult GetInfo() {
        return Ok(new {
            Application = "CVerify Server",
            Framework = ".NET 10.0",
            OS = global::System.Runtime.InteropServices.RuntimeInformation.OSDescription
        });
    }
}

