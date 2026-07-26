using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class ClassesController : ApiControllerBase
{
    private readonly ClassService _classes;
    public ClassesController(PermissionService permissions, ClassService classes) : base(permissions) => _classes = classes;

    [HttpGet("classes")]
    public async Task<IActionResult> GetAll() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _classes.GetAllAsync(t!.Id, Request.Query, u!, Permissions)); }
    [HttpGet("classes/next-code")]
    public async Task<IActionResult> NextCode() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _classes.GetNextCodeAsync(t!.Id)); }
    [HttpGet("classes/{id:int}")]
    public async Task<IActionResult> GetById(int id) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessClassAsync(t!.Id, u!, id)) return StatusCode(403, new { message = "Forbidden: class is outside your scope" }); var r = await _classes.GetByIdAsync(t.Id, id); return r is null ? NotFound(new { message = "Class not found" }) : Ok(r); }
    [HttpPost("classes")]
    public async Task<IActionResult> Create([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _classes.CreateAsync(t!.Id, body, u!)); }
    [HttpPut("classes/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _classes.UpdateAsync(t!.Id, id, body, u!); return r is null ? NotFound(new { message = "Class not found" }) : Ok(r); }
    [HttpDelete("classes/{id:int}")]
    public async Task<IActionResult> Delete(int id) { var (t, u, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _classes.DeleteAsync(t!.Id, id, u!); return Ok(new { message = "Deleted successfully" }); }
    [HttpPost("classes/{id:int}/students")]
    public async Task<IActionResult> AddStudent(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; await _classes.AddStudentAsync(t!.Id, id, body.Int("studentId", "student_id") ?? 0); return Ok(new { message = "Student added" }); }
    [HttpDelete("classes/{id:int}/students/{studentId:int}")]
    public async Task<IActionResult> RemoveStudent(int id, int studentId) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; await _classes.RemoveStudentAsync(t!.Id, id, studentId); return Ok(new { message = "Student removed" }); }
    [HttpGet("students/{studentId:int}/classes")]
    public async Task<IActionResult> GetByStudent(int studentId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessStudentAsync(t!.Id, u!, studentId)) return StatusCode(403, new { message = "Forbidden: student data is outside your scope" }); return Ok(await _classes.GetByStudentAsync(t.Id, studentId)); }
}
