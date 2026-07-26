using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LanguageCenter.Api.Controllers;

[Route("api/{tenantSlug}")]
public sealed class ExamController : ApiControllerBase
{
    private readonly ExamService _exams;
    public ExamController(PermissionService permissions, ExamService exams) : base(permissions) => _exams = exams;

    [HttpGet("exam-formats")]
    public async Task<IActionResult> Formats() { var (_, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(new { formats = _exams.GetFormats() }); }
    [HttpPost("exam-media")]
    [RequestSizeLimit(104857600)]
    public async Task<IActionResult> UploadMedia([FromForm] IFormFile file) { var (_, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _exams.UploadMediaAsync(file)); }
    [HttpGet("exam-question-groups")]
    public async Task<IActionResult> Groups() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _exams.ListGroupsAsync(t!.Id, Request.Query)); }
    [HttpGet("exam-questions")]
    public async Task<IActionResult> Questions() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _exams.ListQuestionsAsync(t!.Id, Request.Query)); }
    [HttpGet("exam-questions/{id:int}")]
    public async Task<IActionResult> Question(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; var r = await _exams.GetQuestionAsync(t!.Id, id); return r is null ? NotFound(new { message = "Question not found" }) : Ok(r); }
    [HttpPost("exam-questions")]
    public async Task<IActionResult> CreateQuestion([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Created("", await _exams.CreateQuestionAsync(t!.Id, u!.Id, body)); }
    [HttpPut("exam-questions/{id:int}")]
    public async Task<IActionResult> UpdateQuestion(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; var r = await _exams.UpdateQuestionAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Question not found" }) : Ok(r); }
    [HttpDelete("exam-questions/{id:int}")]
    public async Task<IActionResult> DeleteQuestion(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _exams.DeleteQuestionAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }

    [HttpGet("exam-sets")]
    public async Task<IActionResult> ExamSets() { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _exams.ListExamSetsAsync(t!.Id, Request.Query)); }
    [HttpGet("exam-sets/{id:int}")]
    public async Task<IActionResult> ExamSet(int id) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; var r = await _exams.GetExamSetAsync(t!.Id, id); return r is null ? NotFound(new { message = "Exam set not found" }) : Ok(r); }
    [HttpPost("exam-sets")]
    public async Task<IActionResult> CreateExamSet([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _exams.CreateExamSetAsync(t!.Id, u!.Id, body)); }
    [HttpPut("exam-sets/{id:int}")]
    public async Task<IActionResult> UpdateExamSet(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _exams.UpdateExamSetAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Exam set not found" }) : Ok(r); }
    [HttpPost("exam-sets/generate")]
    public async Task<IActionResult> GenerateExamSet([FromBody] JsonElement body) { var (t, u, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _exams.GenerateExamSetAsync(t!.Id, u!.Id, body)); }
    [HttpDelete("exam-sets/{id:int}")]
    public async Task<IActionResult> DeleteExamSet(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _exams.DeleteExamSetAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }

    [HttpGet("mock-exams")]
    public async Task<IActionResult> MockExams() { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.ListMockExamsAsync(t!.Id, Request.Query)); }
    [HttpGet("mock-exams/{id:int}")]
    public async Task<IActionResult> MockExam(int id) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; var r = await _exams.GetMockExamAsync(t!.Id, id); return r is null ? NotFound(new { message = "Mock exam not found" }) : Ok(r); }
    [HttpPost("mock-exams")]
    public async Task<IActionResult> CreateMockExam([FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; return Created("", await _exams.CreateMockExamAsync(t!.Id, body)); }
    [HttpPut("mock-exams/{id:int}")]
    public async Task<IActionResult> UpdateMockExam(int id, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff"); if (e is not null) return e; var r = await _exams.UpdateMockExamAsync(t!.Id, id, body); return r is null ? NotFound(new { message = "Mock exam not found" }) : Ok(r); }
    [HttpDelete("mock-exams/{id:int}")]
    public async Task<IActionResult> DeleteMockExam(int id) { var (t, _, e) = await RequireContextAsync(true, "admin"); if (e is not null) return e; await _exams.DeleteMockExamAsync(t!.Id, id); return Ok(new { message = "Deleted successfully" }); }
    [HttpPost("mock-exam-students/{mockExamStudentId:int}/start")]
    public async Task<IActionResult> Start(int mockExamStudentId) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.StartAttemptAsync(t!.Id, mockExamStudentId)); }
    [HttpPost("mock-exam-students/{mockExamStudentId:int}/reset-in-progress")]
    public async Task<IActionResult> Reset(int mockExamStudentId) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.ResetInProgressAsync(t!.Id, mockExamStudentId)); }
    [HttpPost("mock-exam-students/{mockExamStudentId:int}/save-answer")]
    public async Task<IActionResult> SaveAnswer(int mockExamStudentId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.SaveAnswerAsync(t!.Id, mockExamStudentId, body)); }
    [HttpPost("mock-exam-students/{mockExamStudentId:int}/recording")]
    [RequestSizeLimit(104857600)]
    public async Task<IActionResult> Recording(int mockExamStudentId, [FromForm] IFormFile file) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.UploadMediaAsync(file)); }
    [HttpPost("mock-exam-students/{mockExamStudentId:int}/submit")]
    public async Task<IActionResult> Submit(int mockExamStudentId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(); if (e is not null) return e; return Ok(await _exams.SubmitAsync(t!.Id, mockExamStudentId, body)); }
    [HttpPatch("mock-exam-students/{mockExamStudentId:int}/grade")]
    public async Task<IActionResult> Grade(int mockExamStudentId, [FromBody] JsonElement body) { var (t, _, e) = await RequireContextAsync(true, "admin", "staff", "teacher"); if (e is not null) return e; return Ok(await _exams.GradeAsync(t!.Id, mockExamStudentId, body)); }
}
