using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class HomeworkQuestionBankService
{
    private readonly DbService _db;
    public HomeworkQuestionBankService(DbService db) => _db = db;

    public async Task<object> ListAsync(int tenantId, IQueryCollection query)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); var conditions = new List<string> { "tenant_id=@tenantId" };
        if (!string.IsNullOrWhiteSpace(query["category"])) { conditions.Add("category=@category"); p.Add("category", query["category"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["search"])) { conditions.Add("question_text ILIKE @search"); p.Add("search", $"%{query["search"]}%"); }
        return await _db.QueryAsync($"SELECT * FROM homework_question_bank WHERE {string.Join(" AND ", conditions)} ORDER BY created_at DESC", p);
    }

    public Task<Dictionary<string, object?>?> CreateAsync(int tenantId, JsonElement body, int userId) => _db.QuerySingleAsync("""INSERT INTO homework_question_bank (tenant_id, question_type, question_text, help_text, score, correct_answer, options, category, created_by) VALUES (@tenantId,@type,@text,@help,@score,@correct,CAST(@options AS jsonb),@category,@userId) RETURNING *""", new { tenantId, type = body.Str("questionType", "question_type") ?? "multiple_choice_4", text = body.Str("questionText", "question_text"), help = body.Str("helpText", "help_text"), score = body.Dec("score") ?? 1, correct = body.Str("correctAnswer", "correct_answer"), options = body.Json("options"), category = body.Str("category"), userId });
    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int id, JsonElement body)
    {
        var c = await _db.QuerySingleAsync("SELECT * FROM homework_question_bank WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id }); if (c is null) return null;
        return await _db.QuerySingleAsync("""UPDATE homework_question_bank SET question_type=@type, question_text=@text, help_text=@help, score=@score, correct_answer=@correct, options=CAST(@options AS jsonb), category=@category, updated_at=NOW() WHERE tenant_id=@tenantId AND id=@id RETURNING *""", new { tenantId, id, type = body.Str("questionType", "question_type") ?? c["question_type"], text = body.Str("questionText", "question_text") ?? c["question_text"], help = body.Str("helpText", "help_text") ?? c["help_text"], score = body.Dec("score") ?? Convert.ToDecimal(c["score"] ?? 1), correct = body.Str("correctAnswer", "correct_answer") ?? c["correct_answer"], options = body.TryGet(out _, "options") ? body.Json("options") : System.Text.Json.JsonSerializer.Serialize(c["options"] ?? new object[0]), category = body.Str("category") ?? c["category"] });
    }
    public Task<int> DeleteAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM homework_question_bank WHERE tenant_id=@tenantId AND id=@id", new { tenantId, id });
    public async Task<object> BulkCreateAsync(int tenantId, JsonElement body, int userId)
    {
        var created = new List<Dictionary<string, object?>>();
        foreach (var item in body.Array("questions", "items"))
        {
            var row = await CreateAsync(tenantId, item, userId); if (row is not null) created.Add(row);
        }
        return new { created };
    }
    public Task<List<Dictionary<string, object?>>> UsageAsync(int tenantId, int id) => _db.QueryAsync("""SELECT ha.id, ha.title, haq.order_number FROM homework_assignment_questions haq JOIN homework_assignments ha ON ha.id=haq.assignment_id WHERE haq.tenant_id=@tenantId AND haq.bank_question_id=@id ORDER BY ha.created_at DESC""", new { tenantId, id });
}
