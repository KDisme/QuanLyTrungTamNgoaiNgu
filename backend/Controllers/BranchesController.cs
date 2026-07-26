using System.Text.Json;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class BranchesController : ApiControllerBase
{
    private readonly BranchService _branches;
    public BranchesController(PermissionService permissions, BranchService branches) : base(permissions) => _branches = branches;

    [HttpGet("branches")]
    public async Task<IActionResult> GetAll() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _branches.GetAllAsync(t!.Id, Request.Query)); }
    [HttpGet("branches/{id:int}")]
    public async Task<IActionResult> GetById(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; var r = await _branches.GetByIdAsync(t!.Id, id); return r is null ? NotFound(new { message = "Branch not found" }) : Ok(r); }
    [HttpPost("branches")]
    public async Task<IActionResult> Create([FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Created("", await _branches.CreateAsync(t!.Id, body)); }
    [HttpPut("branches/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; var r = await _branches.UpdateAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Branch not found" }) : Ok(r); }
    [HttpDelete("branches/{id:int}")]
    public async Task<IActionResult> Delete(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _branches.DeleteAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }
    [HttpPost("branches/{id:int}/rooms")]
    public async Task<IActionResult> AddRoom(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; return Created("", await _branches.AddRoomAsync(t!.Id, id, body)); }
    [HttpPut("branches/{id:int}/rooms/{roomId:int}")]
    public async Task<IActionResult> UpdateRoom(int id, int roomId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; var r = await _branches.UpdateRoomAsync(t!.Id, roomId, body); return r is null ? NotFound(new { message = "Room not found" }) : Ok(r); }
    [HttpDelete("branches/{id:int}/rooms/{roomId:int}")]
    public async Task<IActionResult> DeleteRoom(int id, int roomId) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _branches.DeleteRoomAsync(t!.Id, roomId); return Ok(new { message = "Room deleted successfully" }); }
}
