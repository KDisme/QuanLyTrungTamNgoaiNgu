using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class HomeworkService
{
    private readonly DbService _db;
    private readonly PasswordService _password;
    private readonly ActivityLogService _logs;
    public HomeworkService(DbService db, PasswordService password, ActivityLogService logs) { _db = db; _password = password; _logs = logs; }

    public async Task<object> ListAsync(int tenantId, IQueryCollection query, CurrentUser user, PermissionService permissions)
    {
        var roleFilter = permissions.IsStudent(user)
            ? " AND EXISTS (SELECT 1 FROM homework_assignment_students has2 WHERE has2.assignment_id=ha.id AND has2.student_id=@userId AND has2.tenant_id=ha.tenant_id)"
            : permissions.IsTeacher(user) && !permissions.IsAdminOrStaff(user)
                ? " AND (ha.created_by=@userId OR EXISTS (SELECT 1 FROM homework_assignment_classes hac JOIN class_teachers ct ON ct.class_id=hac.class_id AND ct.tenant_id=hac.tenant_id WHERE hac.assignment_id=ha.id AND ct.teacher_id=@userId))"
                : "";
        return await _db.QueryAsync($"""
            SELECT ha.*,
                   COUNT(DISTINCT hasg.student_id) AS assigned_count,
                   COUNT(DISTINCT hs.id) AS submitted_count,
                   COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::varchar[]) AS class_names
            FROM homework_assignments ha
            LEFT JOIN homework_assignment_students hasg ON hasg.assignment_id=ha.id AND hasg.tenant_id=ha.tenant_id
            LEFT JOIN homework_submissions hs ON hs.assignment_student_id=hasg.id AND hs.tenant_id=ha.tenant_id
            LEFT JOIN homework_assignment_classes hac ON hac.assignment_id=ha.id AND hac.tenant_id=ha.tenant_id
            LEFT JOIN classes c ON c.id=hac.class_id
            WHERE ha.tenant_id=@tenantId {roleFilter}
            GROUP BY ha.id
            ORDER BY ha.created_at DESC
            """, new { tenantId, userId = user.Id });
    }

    public async Task<Dictionary<string, object?>?> GetByIdAsync(int tenantId, int id, CurrentUser user, string? password = null)
    {
        var row = await _db.QuerySingleAsync("SELECT * FROM homework_assignments WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });
        if (row is null) return null;
        if (Convert.ToBoolean(row.GetValueOrDefault("require_password") ?? false) && !string.IsNullOrWhiteSpace(Convert.ToString(row.GetValueOrDefault("password_hash"))))
        {
            if (string.IsNullOrWhiteSpace(password) || !_password.Verify(password, Convert.ToString(row["password_hash"])!))
                throw new InvalidOperationException("VALIDATION: Mật khẩu bài tập không đúng");
        }
        row.Remove("password_hash");
        row["questions"] = await _db.QueryAsync("SELECT * FROM homework_assignment_questions WHERE tenant_id=@tenantId AND assignment_id=@id ORDER BY order_number", new { tenantId, id });
        row["classes"] = await _db.QueryAsync("SELECT c.* FROM homework_assignment_classes hac JOIN classes c ON c.id=hac.class_id WHERE hac.tenant_id=@tenantId AND hac.assignment_id=@id ORDER BY c.name", new { tenantId, id });
        row["students"] = await _db.QueryAsync("""SELECT hasg.*, u.full_name AS student_name, sp.student_code FROM homework_assignment_students hasg JOIN users u ON u.id=hasg.student_id LEFT JOIN student_profiles sp ON sp.user_id=u.id AND sp.tenant_id=u.tenant_id WHERE hasg.tenant_id=@tenantId AND hasg.assignment_id=@id ORDER BY u.full_name""", new { tenantId, id });
        return row;
    }

    public Task<Dictionary<string, object?>?> GetPreviewAsync(int tenantId, int id) => _db.QuerySingleAsync("SELECT id, tenant_id, title, description, instructions, due_date, total_score, status, time_limit_minutes FROM homework_assignments WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });

    public async Task<Dictionary<string, object?>?> CreateAsync(int tenantId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var requirePassword = body.Bool("requirePassword", "require_password") ?? false;
            var rawPassword = body.Str("password");
            var row = await _db.QuerySingleAsync("""
                INSERT INTO homework_assignments (tenant_id, class_id, title, description, instructions, due_date, allow_late_submission, total_score, status, show_answers_after_submit, show_score_after_submit, require_password, password_hash, time_limit_minutes, shuffle_questions, created_by, updated_by)
                VALUES (@tenantId,@classId,@title,@description,@instructions,@dueDate,@allowLate,@totalScore,COALESCE(@status,'draft'),@showAnswers,@showScore,@requirePassword,@passwordHash,@timeLimit,@shuffle,@actorId,@actorId)
                RETURNING *
                """, new { tenantId, classId = body.Int("classId", "class_id"), title = body.Str("title"), description = body.Str("description"), instructions = body.Str("instructions"), dueDate = body.Str("dueDate", "due_date"), allowLate = body.Bool("allowLateSubmission", "allow_late_submission") ?? false, totalScore = body.Dec("totalScore", "total_score") ?? 100, status = body.Str("status"), showAnswers = body.Bool("showAnswersAfterSubmit", "show_answers_after_submit") ?? false, showScore = body.Bool("showScoreAfterSubmit", "show_score_after_submit") ?? true, requirePassword, passwordHash = requirePassword && !string.IsNullOrWhiteSpace(rawPassword) ? _password.Hash(rawPassword) : null, timeLimit = body.Int("timeLimitMinutes", "time_limit_minutes"), shuffle = body.Bool("shuffleQuestions", "shuffle_questions") ?? false, actorId = actor.Id }, tx);
            var id = Convert.ToInt32(row!["id"]);
            await ReplaceQuestions(tenantId, id, body, tx);
            await ReplaceClassesAndStudents(tenantId, id, body, tx);
            await tx.CommitAsync(); await _logs.LogAsync(tenantId, actor, "create", "homework_assignment", id, Convert.ToString(row["title"]), $"đã giao bài tập \"{row["title"]}\"");
            return await GetByIdAsync(tenantId, id, actor);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int id, JsonElement body, CurrentUser actor)
    {
        var current = await _db.QuerySingleAsync("SELECT * FROM homework_assignments WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (current is null) return null;
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            await _db.ExecuteAsync("""UPDATE homework_assignments SET title=@title, description=@description, instructions=@instructions, due_date=@dueDate, allow_late_submission=@allowLate, total_score=@totalScore, status=@status, show_answers_after_submit=@showAnswers, show_score_after_submit=@showScore, require_password=@requirePassword, password_hash=COALESCE(@passwordHash,password_hash), time_limit_minutes=@timeLimit, shuffle_questions=@shuffle, updated_by=@actorId, updated_at=NOW() WHERE tenant_id=@tenantId AND id=@id""", new { tenantId, id, title = body.Str("title") ?? current["title"], description = body.Str("description") ?? current["description"], instructions = body.Str("instructions") ?? current["instructions"], dueDate = body.Str("dueDate", "due_date") ?? current["due_date"], allowLate = body.Bool("allowLateSubmission", "allow_late_submission") ?? Convert.ToBoolean(current["allow_late_submission"] ?? false), totalScore = body.Dec("totalScore", "total_score") ?? Convert.ToDecimal(current["total_score"] ?? 100), status = body.Str("status") ?? current["status"], showAnswers = body.Bool("showAnswersAfterSubmit", "show_answers_after_submit") ?? Convert.ToBoolean(current["show_answers_after_submit"] ?? false), showScore = body.Bool("showScoreAfterSubmit", "show_score_after_submit") ?? Convert.ToBoolean(current["show_score_after_submit"] ?? true), requirePassword = body.Bool("requirePassword", "require_password") ?? Convert.ToBoolean(current["require_password"] ?? false), passwordHash = string.IsNullOrWhiteSpace(body.Str("password")) ? null : _password.Hash(body.Str("password")!), timeLimit = body.Int("timeLimitMinutes", "time_limit_minutes") ?? (current["time_limit_minutes"] is null ? null : Convert.ToInt32(current["time_limit_minutes"])), shuffle = body.Bool("shuffleQuestions", "shuffle_questions") ?? Convert.ToBoolean(current["shuffle_questions"] ?? false), actorId = actor.Id }, tx);
            if (body.TryGet(out _, "questions")) await ReplaceQuestions(tenantId, id, body, tx);
            if (body.TryGet(out _, "classIds", "class_ids", "classes")) await ReplaceClassesAndStudents(tenantId, id, body, tx);
            await tx.CommitAsync(); return await GetByIdAsync(tenantId, id, actor);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public Task<int> DeleteAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM homework_assignments WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });

    public async Task<Dictionary<string, object?>?> SubmitAsync(int tenantId, int assignmentId, JsonElement body, CurrentUser student)
    {
        var assignmentStudent = await _db.QuerySingleAsync("SELECT * FROM homework_assignment_students WHERE tenant_id=@tenantId AND assignment_id=@assignmentId AND student_id=@studentId", new { tenantId, assignmentId, studentId = student.Id });
        if (assignmentStudent is null) throw new InvalidOperationException("VALIDATION: Bạn chưa được giao bài tập này");
        var row = await _db.QuerySingleAsync("""INSERT INTO homework_submissions (tenant_id, assignment_student_id, answers, status, total_score, feedback, submitted_by) VALUES (@tenantId,@assignmentStudentId,CAST(@answers AS jsonb),'submitted',0,@feedback,@studentId) ON CONFLICT (assignment_student_id) DO UPDATE SET answers=CAST(@answers AS jsonb), status='submitted', submitted_at=NOW(), submitted_by=@studentId, updated_at=NOW() RETURNING *""", new { tenantId, assignmentStudentId = assignmentStudent["id"], answers = body.Json("answers"), feedback = body.Str("feedback"), studentId = student.Id });
        await _db.ExecuteAsync("UPDATE homework_assignment_students SET status='submitted', submitted_at=NOW(), updated_at=NOW() WHERE id=@id", new { id = assignmentStudent["id"] });
        return row;
    }

    public async Task<Dictionary<string, object?>?> GradeAsync(int tenantId, int submissionId, JsonElement body, CurrentUser grader)
    {
        var row = await _db.QuerySingleAsync("""UPDATE homework_submissions SET total_score=@score, feedback=@feedback, status='graded', graded_by=@graderId, graded_at=NOW(), updated_at=NOW() WHERE tenant_id=@tenantId AND id=@submissionId RETURNING *""", new { tenantId, submissionId, score = body.Dec("totalScore", "total_score", "score") ?? 0, feedback = body.Str("feedback"), graderId = grader.Id });
        if (row is not null) await _db.ExecuteAsync("UPDATE homework_assignment_students SET total_score=@score, feedback=@feedback, status='graded', updated_at=NOW() WHERE id=@asid", new { score = body.Dec("totalScore", "total_score", "score") ?? 0, feedback = body.Str("feedback"), asid = row["assignment_student_id"] });
        return row;
    }

    private async Task ReplaceQuestions(int tenantId, int assignmentId, JsonElement body, System.Data.IDbTransaction tx)
    {
        var questions = body.Array("questions");
        await _db.ExecuteAsync("DELETE FROM homework_assignment_questions WHERE tenant_id=@tenantId AND assignment_id=@assignmentId", new { tenantId, assignmentId }, tx);
        var order = 1;
        foreach (var q in questions)
        {
            await _db.ExecuteAsync("""INSERT INTO homework_assignment_questions (tenant_id, assignment_id, order_number, question_type, question_text, help_text, is_required, score, correct_answer, options, metadata, bank_question_id) VALUES (@tenantId,@assignmentId,@order,@type,@text,@help,@required,@score,@correct,CAST(@options AS jsonb),CAST(@metadata AS jsonb),@bankId)""", new { tenantId, assignmentId, order = q.Int("orderNumber", "order_number") ?? order++, type = q.Str("questionType", "question_type") ?? "multiple_choice_4", text = q.Str("questionText", "question_text") ?? "", help = q.Str("helpText", "help_text"), required = q.Bool("isRequired", "is_required") ?? true, score = q.Dec("score") ?? 1, correct = q.Str("correctAnswer", "correct_answer"), options = q.Json("options"), metadata = q.Json("metadata"), bankId = q.Int("bankQuestionId", "bank_question_id") }, tx);
        }
    }

    private async Task ReplaceClassesAndStudents(int tenantId, int assignmentId, JsonElement body, System.Data.IDbTransaction tx)
    {
        var classIds = new List<int>();
        if (body.TryGet(out var arr, "classIds", "class_ids", "classes") && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var i)) classIds.Add(i);
                if (el.ValueKind == JsonValueKind.Object && el.TryGet(out var idProp, "id") && idProp.TryGetInt32(out var oi)) classIds.Add(oi);
            }
        }
        var single = body.Int("classId", "class_id"); if (single.HasValue) classIds.Add(single.Value);
        await _db.ExecuteAsync("DELETE FROM homework_assignment_classes WHERE tenant_id=@tenantId AND assignment_id=@assignmentId", new { tenantId, assignmentId }, tx);
        foreach (var classId in classIds.Distinct()) await _db.ExecuteAsync("INSERT INTO homework_assignment_classes (tenant_id, assignment_id, class_id) VALUES (@tenantId,@assignmentId,@classId) ON CONFLICT DO NOTHING", new { tenantId, assignmentId, classId }, tx);
        await _db.ExecuteAsync("""INSERT INTO homework_assignment_students (tenant_id, assignment_id, student_id, status) SELECT DISTINCT @tenantId, @assignmentId, cs.student_id, 'assigned' FROM class_students cs WHERE cs.tenant_id=@tenantId AND cs.class_id = ANY(@classIds) AND cs.status='active' ON CONFLICT (assignment_id, student_id) DO NOTHING""", new { tenantId, assignmentId, classIds = classIds.Distinct().ToArray() }, tx);
    }
}
