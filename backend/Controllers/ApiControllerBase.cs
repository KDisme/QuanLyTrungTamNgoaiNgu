using LanguageCenter.Api.Models;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected readonly PermissionService Permissions;

    protected ApiControllerBase(PermissionService permissions)
    {
        Permissions = permissions;
    }

    protected async Task<(Tenant? Tenant, CurrentUser? User, IActionResult? Error)> RequireContextAsync(bool requireAuth = true, params string[] roles)
    {
        var tenantSlug = Convert.ToString(RouteData.Values["tenantSlug"]);
        if (string.IsNullOrWhiteSpace(tenantSlug)) return (null, null, BadRequest(new { message = "Tenant slug is required" }));
        var tenant = await Permissions.ResolveTenantAsync(tenantSlug);
        if (tenant is null) return (null, null, NotFound(new { message = "Tenant not found" }));
        if (!tenant.IsActive) return (tenant, null, StatusCode(403, new { message = "Tenant is inactive" }));
        if (!requireAuth) return (tenant, null, null);
        var user = await Permissions.GetCurrentUserAsync(HttpContext, tenant.Id);
        if (user is null) return (tenant, null, Unauthorized(new { message = "Invalid or expired token" }));
        if (roles.Length > 0 && !Permissions.HasAnyRole(user, roles)) return (tenant, user, StatusCode(403, new { message = "Forbidden: insufficient permissions" }));
        return (tenant, user, null);
    }
}
