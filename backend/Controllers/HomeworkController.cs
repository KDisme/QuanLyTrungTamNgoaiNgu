using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class HomeworkController : ApiControllerBase
{
    private readonly HomeworkService _homework;
    private readonly HomeworkQuestionBankService _bank;
    public HomeworkController(PermissionService permissions, HomeworkService homework, HomeworkQuestionBankService bank) : base(permissions) { _homework = homework; _bank = bank; }

    [HttpGet("homework-assignments")]
    public async Task<IActionResult> List() { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _homework.ListAsync(t!.Id, Request.Query, u!, Permissions)); }
    [HttpGet("homework-assignments/{id:int}")]
    public async Task<IActionResult> GetById(int id, [FromQuery] string? password) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; var r = await _homework.GetByIdAsync(t!.Id, id, u!, password); return r is null ? NotFound(new { message = "Homework assignment not found" }) : Ok(r); }
    [HttpGet("homework-assignments/{id:int}/preview")]
    public async Task<IActionResult> Preview(int id) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; var r = await _homework.GetPreviewAsync(t!.Id, id); return r is null ? NotFound(new { message = "Homework assignment not found" }) : Ok(r); }
    [HttpPost("homework-assignments")]
    public async Task<IActionResult> Create([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Created("", await _homework.CreateAsync(t!.Id, body, u!)); }
    [HttpPut("homework-assignments/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; var r = await _homework.UpdateAsync(t!.Id, id, body, u!); return r is null ? NotFound(new { message = "Homework assignment not found" }) : Ok(r); }
    [HttpDelete("homework-assignments/{id:int}")]
    public async Task<IActionResult> Delete(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; await _homework.DeleteAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }
    [HttpPost("homework-assignments/{id:int}/submit")]
    public async Task<IActionResult> Submit(int id, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _homework.SubmitAsync(t!.Id, id, body, u!)); }
    [HttpPatch("homework-submissions/{submissionId:int}/grade")]
    public async Task<IActionResult> Grade(int submissionId, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Ok(await _homework.GradeAsync(t!.Id, submissionId, body, u!)); }

    [HttpGet("homework-question-bank")]
    public async Task<IActionResult> BankList() { var (t, _, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Ok(await _bank.ListAsync(t!.Id, Request.Query)); }
    [HttpPost("homework-question-bank")]
    public async Task<IActionResult> BankCreate([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Created("", await _bank.CreateAsync(t!.Id, body, u!.Id)); }
    [HttpPost("homework-question-bank/bulk")]
    public async Task<IActionResult> BankBulk([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Created("", await _bank.BulkCreateAsync(t!.Id, body, u!.Id)); }
    [HttpPut("homework-question-bank/{id:int}")]
    public async Task<IActionResult> BankUpdate(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; var r = await _bank.UpdateAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Question not found" }) : Ok(r); }
    [HttpDelete("homework-question-bank/{id:int}")]
    public async Task<IActionResult> BankDelete(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; await _bank.DeleteAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }
    [HttpGet("homework-question-bank/{id:int}/usage")]
    public async Task<IActionResult> BankUsage(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "teacher"); if (e is not null) return e; return Ok(await _bank.UsageAsync(t!.Id, id)); }
}
