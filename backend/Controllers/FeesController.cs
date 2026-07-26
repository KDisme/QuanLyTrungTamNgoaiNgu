using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class FeesController : ApiControllerBase
{
    private readonly FeeService _fees;
    public FeesController(PermissionService permissions, FeeService fees) : base(permissions) => _fees = fees;

    [HttpGet("fee-templates")]
    public async Task<IActionResult> GetTemplates() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _fees.GetTemplatesAsync(t!.Id)); }
    [HttpPost("fee-templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _fees.CreateTemplateAsync(t!.Id, body)); }
    [HttpPut("fee-templates/{id:int}")]
    public async Task<IActionResult> UpdateTemplate(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; var r = await _fees.UpdateTemplateAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Fee template not found" }) : Ok(r); }
    [HttpGet("fee-collections")]
    public async Task<IActionResult> GetCollections() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _fees.GetCollectionsAsync(t!.Id, Request.Query)); }
    [HttpGet("fee-collections/{id:int}")]
    public async Task<IActionResult> GetCollection(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _fees.GetCollectionByIdAsync(t!.Id, id); return r is null ? NotFound(new { message = "Fee collection not found" }) : Ok(r); }
    [HttpPost("fee-collections")]
    public async Task<IActionResult> CreateCollection([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _fees.CreateCollectionAsync(t!.Id, body, u!)); }
    [HttpPatch("fee-collections/{id:int}/activate")]
    public async Task<IActionResult> Activate(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _fees.SetCollectionStatusAsync(t!.Id, id, "active")); }
    [HttpPatch("fee-collections/{id:int}/close")]
    public async Task<IActionResult> Close(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _fees.SetCollectionStatusAsync(t!.Id, id, "closed")); }
    [HttpPatch("fee-collections/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Ok(await _fees.SetCollectionStatusAsync(t!.Id, id, "cancelled")); }
    [HttpPost("fee-items/{itemId:int}/pay")]
    public async Task<IActionResult> Pay(int itemId, [FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _fees.RecordPaymentAsync(t!.Id, itemId, body, u!)); }
    [HttpGet("fee-items/{itemId:int}/history")]
    public async Task<IActionResult> History(int itemId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessFeeItemAsync(t!.Id, u!, itemId)) return StatusCode(403, new { message = "Forbidden: fee item is outside your scope" }); return Ok(await _fees.GetTransactionHistoryAsync(t.Id, itemId)); }
    [HttpPatch("fee-transactions/{id:int}/cancel")]
    public async Task<IActionResult> CancelTransaction(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Ok(await _fees.CancelTransactionAsync(t!.Id, id)); }
    [HttpGet("students/{studentId:int}/fee-collections")]
    public async Task<IActionResult> StudentCollections(int studentId) { var (t, u, e) = await RequireContextAsync(); if (e is not null) return e; if (!await Permissions.CanAccessStudentAsync(t!.Id, u!, studentId)) return StatusCode(403, new { message = "Forbidden: student data is outside your scope" }); return Ok(await _fees.GetStudentCollectionsAsync(t.Id, studentId)); }
    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Ok(await _fees.GetExpensesAsync(t!.Id, Request.Query)); }
    [HttpPost("expenses")]
    public async Task<IActionResult> CreateExpense([FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _fees.CreateExpenseAsync(t!.Id, body)); }
    [HttpPut("expenses/{id:int}")]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _fees.UpdateExpenseAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Expense not found" }) : Ok(r); }
    [HttpDelete("expenses/{id:int}")]
    public async Task<IActionResult> DeleteExpense(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _fees.DeleteExpenseAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }
}
