using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class UsersController : ApiControllerBase
{
    private readonly UserService _users;
    public UsersController(PermissionService permissions, UserService users) : base(permissions) => _users = users;

    [HttpGet("users")]
    public async Task<IActionResult> GetAll()
    {
        var (tenant, _, error) = await RequireContextAsync(true, "admin", "staff");
        if (error is not null) return error;
        return Ok(await _users.GetAllAsync(tenant!.Id, Request.Query));
    }

    [HttpGet("users/{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var (tenant, user, error) = await RequireContextAsync();
        if (error is not null) return error;
        if (!Permissions.HasAnyRole(user, "admin", "staff") && user!.Id != id) return StatusCode(403, new { message = "Forbidden: only own data is allowed" });
        var result = await _users.GetByIdAsync(tenant!.Id, id);
        return result is null ? NotFound(new { message = "User not found" }) : Ok(result);
    }

    [HttpPost("users")]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        var (tenant, user, error) = await RequireContextAsync(true, "admin", "staff");
        if (error is not null) return error;
        var result = await _users.CreateAsync(tenant!.Id, body, user!);
        return Created($"/api/{RouteData.Values["tenantSlug"]}/users/{result?["id"]}", result);
    }

    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] JsonElement body)
    {
        var (tenant, user, error) = await RequireContextAsync();
        if (error is not null) return error;
        if (!Permissions.HasAnyRole(user, "admin", "staff") && user!.Id != id) return StatusCode(403, new { message = "Forbidden: only own data is allowed" });
        if (user!.Id == id)
        {
            var nextIsActive = body.Bool("isActive", "is_active");
            if (nextIsActive is false) return BadRequest(new { message = "Không thể tự khoá chính tài khoản đang đăng nhập" });
            var roles = body.StringArray("roles");
            if (roles.Count > 0 && !roles.Contains("admin") && Permissions.HasAnyRole(user, "admin")) return BadRequest(new { message = "Không thể tự gỡ quyền admin của chính tài khoản đang đăng nhập" });
        }
        var result = await _users.UpdateAsync(tenant!.Id, id, body, user);
        return result is null ? NotFound(new { message = "User not found" }) : Ok(result);
    }

    [HttpPatch("users/{id:int}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var (tenant, user, error) = await RequireContextAsync(true, "admin");
        if (error is not null) return error;
        if (user!.Id == id) return BadRequest(new { message = "Không thể tự khoá chính tài khoản đang đăng nhập" });
        var current = await _users.GetByIdAsync(tenant!.Id, id);
        if (current is null) return NotFound(new { message = "User not found" });
        using var doc = JsonDocument.Parse($"{{\"isActive\":{(!Convert.ToBoolean(current["is_active"])).ToString().ToLowerInvariant()}}}");
        return Ok(await _users.UpdateAsync(tenant.Id, id, doc.RootElement, user));
    }

    [HttpPost("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] JsonElement body)
    {
        var (tenant, user, error) = await RequireContextAsync(true, "admin");
        if (error is not null) return error;
        var result = await _users.ResetPasswordAsync(tenant!.Id, id, body.Str("password"), user!);
        if (result is null) return NotFound(new { message = "User not found" });
        var temp = result.GetType().GetProperty("temporaryPassword")?.GetValue(result);
        return Ok(new { message = "Đã đặt lại mật khẩu", temporaryPassword = temp });
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (tenant, user, error) = await RequireContextAsync(true, "admin");
        if (error is not null) return error;
        if (user!.Id == id) return BadRequest(new { message = "Không thể xoá chính tài khoản đang đăng nhập" });
        var ok = await _users.DeleteAsync(tenant!.Id, id, user);
        return ok ? Ok(new { message = "Xoá tài khoản thành công" }) : NotFound(new { message = "User not found" });
    }
}
