using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/portal")]
public sealed class PortalController : ControllerBase
{
    private readonly AuthService _auth;
    public PortalController(AuthService auth) => _auth = auth;

    [HttpPost("find-tenant")]
    public async Task<IActionResult> FindTenant([FromBody] JsonElement body)
    {
        var email = body.Str("email");
        if (string.IsNullOrWhiteSpace(email)) return BadRequest(new { message = "Email is required" });
        var tenants = await _auth.PortalFindTenantAsync(email);
        if (tenants.Count == 0) return NotFound(new { message = "No tenant found for this email" });
        return Ok(new { tenants });
    }
}

[Route("api/{tenantSlug}/auth")]
public sealed class AuthController : ApiControllerBase
{
    private readonly AuthService _auth;

    public AuthController(PermissionService permissions, AuthService auth) : base(permissions)
    {
        _auth = auth;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] JsonElement body)
    {
        var (tenant, _, error) = await RequireContextAsync(requireAuth: false);
        if (error is not null) return error;
        var identifier = body.Str("identifier");
        var password = body.Str("password");
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(password))
            return BadRequest(new { message = "Email/phone and password are required" });
        var result = await _auth.LoginAsync(tenant!.Id, identifier, password);
        if (result is null) return Unauthorized(new { message = "Email/phone hoặc mật khẩu không đúng" });
        return Ok(result);
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var (_, user, error) = await RequireContextAsync();
        if (error is not null) return error;
        return Ok(new { user });
    }
}
