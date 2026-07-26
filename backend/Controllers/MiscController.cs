using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class MiscController : ApiControllerBase
{
    private readonly DashboardService _dashboard;
    private readonly NotificationService _notifications;
    private readonly ActivityLogService _logs;

    public MiscController(PermissionService permissions, DashboardService dashboard, NotificationService notifications, ActivityLogService logs) : base(permissions)
    {
        _dashboard = dashboard;
        _notifications = notifications;
        _logs = logs;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        var (t, _, e) = await RequireContextAsync();
        if (e is not null) return e;
        int? month = int.TryParse(Request.Query["month"], out var m) ? m : null;
        int? year  = int.TryParse(Request.Query["year"],  out var y) ? y : null;
        return Ok(await _dashboard.GetStatsAsync(t!.Id, month, year));
    }
    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _notifications.ListAsync(t!.Id, u!.Id, Request.Query)); }
    [HttpGet("notifications/unread-count")]
    public async Task<IActionResult> UnreadCount() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(new { count = await _notifications.UnreadCountAsync(t!.Id, u!.Id) }); }
    [HttpPatch("notifications/{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; await _notifications.MarkReadAsync(t!.Id, u!.Id, id); return Ok(new { message = "Marked as read" }); }
    [HttpPatch("notifications/read-all")]
    public async Task<IActionResult> MarkAllRead() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; await _notifications.MarkAllReadAsync(t!.Id, u!.Id); return Ok(new { message = "Marked all as read" }); }
    [HttpGet("activity-logs")]
    public async Task<IActionResult> ActivityLogs() { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Ok(await _logs.ListAsync(t!.Id, Request.Query)); }
    [HttpGet("activity-logs/actors")]
    public async Task<IActionResult> Actors() { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Ok(new { actors = await _logs.GetDistinctActorsAsync(t!.Id) }); }
}
