using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class SchedulesController : ApiControllerBase
{
    private readonly ScheduleService _schedules;
    public SchedulesController(PermissionService permissions, ScheduleService schedules) : base(permissions) => _schedules = schedules;

    [HttpGet("schedules")]
    public async Task<IActionResult> GetList() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _schedules.GetListAsync(t!.Id, Request.Query, u!, Permissions)); }
    [HttpGet("schedules/upcoming")]
    public async Task<IActionResult> Upcoming() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _schedules.GetUpcomingAsync(t!.Id, Request.Query, u!, Permissions)); }
    [HttpGet("classes/{classId:int}/schedules")]
    public async Task<IActionResult> ByClass(int classId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessClassAsync(t!.Id, u!, classId)) return StatusCode(403, new { message = "Forbidden: class is outside your scope" }); return Ok(await _schedules.GetByClassAsync(t.Id, classId)); }
    [HttpPost("classes/{classId:int}/schedules/preview")]
    public async Task<IActionResult> Preview(int classId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _schedules.PreviewAsync(t!.Id, classId, body)); }
    [HttpPost("classes/{classId:int}/schedules/generate")]
    public async Task<IActionResult> Generate(int classId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _schedules.GenerateAsync(t!.Id, classId, body)); }
    [HttpGet("schedules/{id:int}")]
    public async Task<IActionResult> GetById(int id) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessScheduleAsync(t!.Id, u!, id)) return StatusCode(403, new { message = "Forbidden: schedule is outside your scope" }); var r = await _schedules.GetByIdAsync(t.Id, id); return r is null ? NotFound(new { message = "Schedule not found" }) : Ok(r); }
    [HttpPut("schedules/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _schedules.UpdateAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Schedule not found" }) : Ok(r); }
    [HttpPatch("schedules/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _schedules.CancelAsync(t!.Id, id, body.Str("note")); return r is null ? NotFound(new { message = "Schedule not found" }) : Ok(r); }
    [HttpGet("schedules/{id:int}/history")]
    public async Task<IActionResult> History(int id) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessScheduleAsync(t!.Id, u!, id)) return StatusCode(403, new { message = "Forbidden: schedule is outside your scope" }); return Ok(await _schedules.GetHistoryAsync(t.Id, id)); }
    [HttpGet("schedules/{scheduleId:int}/attendance")]
    public async Task<IActionResult> Attendance(int scheduleId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessScheduleAsync(t!.Id, u!, scheduleId)) return StatusCode(403, new { message = "Forbidden: schedule is outside your scope" }); return Ok(await _schedules.GetAttendanceByScheduleAsync(t.Id, scheduleId)); }
    [HttpPost("schedules/{scheduleId:int}/attendance")]
    public async Task<IActionResult> SaveAttendance(int scheduleId, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessScheduleAsync(t!.Id, u!, scheduleId, write: true)) return StatusCode(403, new { message = "Forbidden: schedule is outside your scope" }); await _schedules.SaveAttendanceAsync(t.Id, scheduleId, body, u!.Id); return Ok(new { message = "Attendance saved" }); }
    [HttpGet("students/{studentId:int}/attendance")]
    public async Task<IActionResult> StudentAttendance(int studentId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessStudentAsync(t!.Id, u!, studentId)) return StatusCode(403, new { message = "Forbidden: student data is outside your scope" }); return Ok(await _schedules.GetStudentAttendanceAsync(t.Id, studentId)); }
}
