using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class ExamService
{
    private readonly DbService _db;
    private readonly IConfiguration _config;
    public ExamService(DbService db, IConfiguration config) { _db = db; _config = config; }

    public object GetFormats() => new Dictionary<string, object>
    {
        ["TOEIC_LR"] = new { code = "TOEIC_LR", label = "TOEIC hai kỹ năng", examType = "TOEIC", skills = new[] { "Listening", "Reading" }, durationMinutes = 120, totalQuestions = 200 },
        ["TOEIC_4_SKILLS"] = new { code = "TOEIC_4_SKILLS", label = "TOEIC bốn kỹ năng", examType = "TOEIC", skills = new[] { "Listening", "Reading", "Speaking", "Writing" }, durationMinutes = 200, totalQuestions = 219 },
        ["VSTEP_4_SKILLS"] = new { code = "VSTEP_4_SKILLS", label = "VSTEP bốn kỹ năng", examType = "VSTEP", skills = new[] { "Listening", "Reading", "Writing", "Speaking" }, durationMinutes = 179, totalQuestions = 80 }
    };

    public async Task<object> UploadMediaAsync(IFormFile file)
    {
        var max = long.TryParse(_config["Upload:MaxFileSizeBytes"], out var m) ? m : 104857600;
        if (file.Length > max) throw new InvalidOperationException("VALIDATION: File quá lớn");
        var allowed = file.ContentType.StartsWith("image/") || file.ContentType.StartsWith("audio/") || file.ContentType == "application/pdf";
        if (!allowed) throw new InvalidOperationException("VALIDATION: Chỉ cho phép upload hình ảnh, audio hoặc PDF");
        var dir = _config["Upload:ExamPath"] ?? "wwwroot/uploads/exams";
        Directory.CreateDirectory(dir);
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Random.Shared.Next(100000000, 999999999)}{ext}";
        var path = Path.Combine(dir, fileName);
        await using var stream = File.Create(path);
        await file.CopyToAsync(stream);
        var prefix = _config["Upload:PublicPrefix"] ?? "/uploads/exams";
        return new { url = $"{prefix}/{fileName}", filename = fileName, originalName = file.FileName, mimeType = file.ContentType, size = file.Length };
    }

    public async Task<object> ListGroupsAsync(int tenantId, IQueryCollection query) => await _db.QueryAsync("SELECT * FROM exam_question_groups WHERE tenant_id=@tenantId ORDER BY created_at DESC", new { tenantId });

    public async Task<object> ListQuestionsAsync(int tenantId, IQueryCollection query)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); var conditions = new List<string> { "q.tenant_id=@tenantId" };
        foreach (var key in new[] { "skill", "part", "questionType", "question_type", "examFormat", "format_code" })
        {
            if (!string.IsNullOrWhiteSpace(query[key])) { var col = key switch { "questionType" => "question_type", "examFormat" => "format_code", _ => key }; conditions.Add($"q.{col}=@{col}"); p.Add(col, query[key].ToString()); }
        }
        if (!string.IsNullOrWhiteSpace(query["search"])) { conditions.Add("q.question_text ILIKE @search"); p.Add("search", $"%{query["search"]}%"); }
        return await _db.QueryAsync($"SELECT q.* FROM exam_questions q WHERE {string.Join(" AND ", conditions)} ORDER BY q.created_at DESC", p);
    }

    public async Task<Dictionary<string, object?>?> GetQuestionAsync(int tenantId, int id)
    {
        var q = await _db.QuerySingleAsync("SELECT * FROM exam_questions WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (q is null) return null;
        q["options"] = await _db.QueryAsync("SELECT * FROM exam_question_options WHERE question_id=@id ORDER BY option_label", new { tenantId, id });
        return q;
    }

    public async Task<Dictionary<string, object?>?> CreateQuestionAsync(int tenantId, int userId, JsonElement body)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var q = await _db.QuerySingleAsync("""INSERT INTO exam_questions (tenant_id, format_code, skill, part, question_type, question_text, explanation, audio_url, image_url, group_key, created_by, metadata) VALUES (@tenantId,@examFormat,@skill,@part,@type,@text,@explanation,@audio,@image,@groupKey,@userId,CAST(@metadata AS jsonb)) RETURNING *""", new { tenantId, examFormat = body.Str("examFormat", "format_code"), skill = body.Str("skill"), part = body.Str("part"), type = body.Str("questionType", "question_type"), text = body.Str("questionText", "question_text"), explanation = body.Str("explanation"), audio = body.Str("audioUrl", "audio_url"), image = body.Str("imageUrl", "image_url"), groupKey = body.Str("groupKey", "group_key"), userId, metadata = body.Json("metadata") }, tx);
            await ReplaceOptions(tenantId, Convert.ToInt32(q!["id"]), body, tx);
            await tx.CommitAsync(); return await GetQuestionAsync(tenantId, Convert.ToInt32(q["id"]));
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<Dictionary<string, object?>?> UpdateQuestionAsync(int tenantId, int id, JsonElement body)
    {
        var current = await _db.QuerySingleAsync("SELECT * FROM exam_questions WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (current is null) return null;
        await _db.ExecuteAsync("""UPDATE exam_questions SET format_code=@examFormat, skill=@skill, part=@part, question_type=@type, question_text=@text, explanation=@explanation, audio_url=@audio, image_url=@image, group_key=@groupKey, metadata=CAST(@metadata AS jsonb), updated_at=NOW() WHERE tenant_id=@tenantId AND id=@id""", new { tenantId, id, examFormat = body.Str("examFormat", "format_code") ?? current["format_code"], skill = body.Str("skill") ?? current["skill"], part = body.Str("part") ?? current["part"], type = body.Str("questionType", "question_type") ?? current["question_type"], text = body.Str("questionText", "question_text") ?? current["question_text"], explanation = body.Str("explanation") ?? current["explanation"], audio = body.Str("audioUrl", "audio_url") ?? current["audio_url"], image = body.Str("imageUrl", "image_url") ?? current["image_url"], groupKey = body.Str("groupKey", "group_key") ?? current["group_key"], metadata = body.TryGet(out _, "metadata") ? body.Json("metadata") : "{}" });
        return await GetQuestionAsync(tenantId, id);
    }
    public Task<int> DeleteQuestionAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM exam_questions WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });

    public async Task<object> ListExamSetsAsync(int tenantId, IQueryCollection query) => await _db.QueryAsync("SELECT * FROM exam_sets WHERE tenant_id=@tenantId ORDER BY created_at DESC", new { tenantId });
    public async Task<Dictionary<string, object?>?> GetExamSetAsync(int tenantId, int id) { var row = await _db.QuerySingleAsync("SELECT * FROM exam_sets WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (row is null) return null; row["questions"] = await _db.QueryAsync("SELECT * FROM exam_set_questions WHERE tenant_id=@tenantId AND exam_set_id=@id ORDER BY order_number", new { tenantId, id }); return row; }
    public async Task<Dictionary<string, object?>?> CreateExamSetAsync(int tenantId, int userId, JsonElement body)
    {
        var row = await _db.QuerySingleAsync("""INSERT INTO exam_sets (tenant_id, title, format_code, description, duration_minutes, created_by, settings) VALUES (@tenantId,@name,@format,@description,@duration,@userId,CAST(@metadata AS jsonb)) RETURNING *""", new { tenantId, name = body.Str("name"), format = body.Str("examFormat", "format_code"), description = body.Str("description"), duration = body.Int("durationMinutes", "duration_minutes"), userId, metadata = body.Json("metadata") });
        return row is null ? null : await GetExamSetAsync(tenantId, Convert.ToInt32(row["id"]));
    }
    public async Task<Dictionary<string, object?>?> UpdateExamSetAsync(int tenantId, int id, JsonElement body) { var c = await _db.QuerySingleAsync("SELECT * FROM exam_sets WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (c is null) return null; await _db.ExecuteAsync("UPDATE exam_sets SET title=@name, format_code=@format, description=@description, duration_minutes=@duration, settings=CAST(@metadata AS jsonb), updated_at=NOW() WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id, name = body.Str("name") ?? c["title"], format = body.Str("examFormat", "format_code") ?? c["format_code"], description = body.Str("description") ?? c["description"], duration = body.Int("durationMinutes", "duration_minutes") ?? (c["duration_minutes"] is null ? null : Convert.ToInt32(c["duration_minutes"])), metadata = body.TryGet(out _, "metadata") ? body.Json("metadata") : "{}" }); return await GetExamSetAsync(tenantId, id); }
    public Task<int> DeleteExamSetAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM exam_sets WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });
    public async Task<Dictionary<string, object?>?> GenerateExamSetAsync(int tenantId, int userId, JsonElement body) => await CreateExamSetAsync(tenantId, userId, body);

    public async Task<object> ListMockExamsAsync(int tenantId, IQueryCollection query) => await _db.QueryAsync("SELECT * FROM mock_exams WHERE tenant_id=@tenantId ORDER BY created_at DESC", new { tenantId });
    public async Task<Dictionary<string, object?>?> GetMockExamAsync(int tenantId, int id) { var row = await _db.QuerySingleAsync("SELECT * FROM mock_exams WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (row is null) return null; row["students"] = await _db.QueryAsync("SELECT mes.*, u.full_name AS student_name FROM mock_exam_students mes JOIN users u ON u.id=mes.student_id WHERE mes.tenant_id=@tenantId AND mes.mock_exam_id=@id ORDER BY u.full_name", new { tenantId, id }); return row; }
    public Task<Dictionary<string, object?>?> CreateMockExamAsync(int tenantId, JsonElement body) => _db.QuerySingleAsync("""INSERT INTO mock_exams (tenant_id, exam_set_id, class_id, title, note, start_time, end_time, attempt_limit, status) VALUES (@tenantId,@examSetId,@classId,@title,@description,@startAt,@endAt,@attemptLimit,COALESCE(@status,'draft')) RETURNING *""", new { tenantId, examSetId = body.Int("examSetId", "exam_set_id"), classId = body.Int("classId", "class_id"), title = body.Str("title", "name"), description = body.Str("description"), startAt = body.Str("startAt", "start_at"), endAt = body.Str("endAt", "end_at"), attemptLimit = body.Int("attemptLimit", "attempt_limit") ?? 1, status = body.Str("status") });
    public async Task<Dictionary<string, object?>?> UpdateMockExamAsync(int tenantId, int id, JsonElement body) { var c = await _db.QuerySingleAsync("SELECT * FROM mock_exams WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (c is null) return null; return await _db.QuerySingleAsync("""UPDATE mock_exams SET exam_set_id=@examSetId, class_id=@classId, title=@title, note=@description, start_time=@startAt, end_time=@endAt, attempt_limit=@attemptLimit, status=@status, updated_at=NOW() WHERE tenant_id=@tenantId AND id=@id RETURNING *""", new { tenantId, id, examSetId = body.Int("examSetId", "exam_set_id") ?? (c["exam_set_id"] is null ? null : Convert.ToInt32(c["exam_set_id"])), classId = body.Int("classId", "class_id") ?? (c["class_id"] is null ? null : Convert.ToInt32(c["class_id"])), title = body.Str("title", "name") ?? c["title"], description = body.Str("description") ?? c["note"], startAt = body.Str("startAt", "start_at") ?? c["start_time"], endAt = body.Str("endAt", "end_at") ?? c["end_time"], attemptLimit = body.Int("attemptLimit", "attempt_limit") ?? Convert.ToInt32(c["attempt_limit"] ?? 1), status = body.Str("status") ?? c["status"] }); }
    public Task<int> DeleteMockExamAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM mock_exams WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });

    public Task<Dictionary<string, object?>?> StartAttemptAsync(int tenantId, int mockExamStudentId) => _db.QuerySingleAsync("""UPDATE mock_exam_students SET status='in_progress', started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE tenant_id=@tenantId AND id=@mockExamStudentId RETURNING *""", new { tenantId, mockExamStudentId });
    public Task<Dictionary<string, object?>?> ResetInProgressAsync(int tenantId, int mockExamStudentId) => _db.QuerySingleAsync("""UPDATE mock_exam_students SET status='assigned', started_at=NULL, submitted_at=NULL, objective_score=NULL, manual_score=NULL, total_score=NULL, overall_score=NULL, updated_at=NOW() WHERE tenant_id=@tenantId AND id=@mockExamStudentId RETURNING *""", new { tenantId, mockExamStudentId });
    public Task<Dictionary<string, object?>?> SaveAnswerAsync(int tenantId, int mockExamStudentId, JsonElement body) => _db.QuerySingleAsync("""INSERT INTO student_exam_answers (tenant_id, mock_exam_student_id, question_id, answer_text, updated_at) VALUES (@tenantId,@mockExamStudentId,@questionId,@answer,NOW()) RETURNING *""", new { tenantId, mockExamStudentId, questionId = body.Int("questionId", "question_id"), answer = body.Str("answerText", "answer_text", "answer") ?? body.Json("answer") });
    public Task<Dictionary<string, object?>?> SubmitAsync(int tenantId, int mockExamStudentId, JsonElement body) => _db.QuerySingleAsync("""UPDATE mock_exam_students SET status='submitted', submitted_at=NOW(), updated_at=NOW() WHERE tenant_id=@tenantId AND id=@mockExamStudentId RETURNING *""", new { tenantId, mockExamStudentId });
    public Task<Dictionary<string, object?>?> GradeAsync(int tenantId, int mockExamStudentId, JsonElement body) => _db.QuerySingleAsync("""UPDATE mock_exam_students SET status='graded', total_score=@score, overall_score=@score, feedback=@feedback, updated_at=NOW() WHERE tenant_id=@tenantId AND id=@mockExamStudentId RETURNING *""", new { tenantId, mockExamStudentId, score = body.Dec("score", "totalScore", "total_score"), feedback = body.Str("feedback") });

    private async Task ReplaceOptions(int tenantId, int questionId, JsonElement body, System.Data.IDbTransaction tx)
    {
        if (!body.TryGet(out var options, "options") || options.ValueKind != JsonValueKind.Array) return;
        await _db.ExecuteAsync("DELETE FROM exam_question_options WHERE question_id=@questionId", new { tenantId, questionId }, tx);
        foreach (var opt in options.EnumerateArray())
        {
            await _db.ExecuteAsync("""INSERT INTO exam_question_options (question_id, option_label, option_text, is_correct) VALUES (@questionId,@label,@text,@correct)""", new { tenantId, questionId, label = opt.Str("label", "optionLabel", "option_label"), text = opt.Str("text", "optionText", "option_text"), correct = opt.Bool("isCorrect", "is_correct") ?? false }, tx);
        }
    }
}
