using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class FeeService
{
    private readonly DbService _db;
    private readonly ActivityLogService _logs;
    public FeeService(DbService db, ActivityLogService logs) { _db = db; _logs = logs; }

    public Task<List<Dictionary<string, object?>>> GetTemplatesAsync(int tenantId) => _db.QueryAsync("SELECT * FROM fee_templates WHERE tenant_id=@tenantId ORDER BY name", new { tenantId });
    public Task<Dictionary<string, object?>?> CreateTemplateAsync(int tenantId, JsonElement body) => _db.QuerySingleAsync("""INSERT INTO fee_templates (tenant_id, name, description, amount, is_active) VALUES (@tenantId,@name,@description,@amount,COALESCE(@isActive,TRUE)) RETURNING *""", new { tenantId, name = body.Str("name"), description = body.Str("description"), amount = body.Dec("amount"), isActive = body.Bool("isActive", "is_active") });
    public async Task<Dictionary<string, object?>?> UpdateTemplateAsync(int tenantId, int id, JsonElement body)
    {
        var c = await _db.QuerySingleAsync("SELECT * FROM fee_templates WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id }); if (c is null) return null;
        return await _db.QuerySingleAsync("UPDATE fee_templates SET name=@name, description=@description, amount=@amount, is_active=@isActive, updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *", new { tenantId, id, name = body.Str("name") ?? c["name"], description = body.Str("description") ?? c["description"], amount = body.Dec("amount") ?? Convert.ToDecimal(c["amount"] ?? 0), isActive = body.Bool("isActive", "is_active") ?? Convert.ToBoolean(c["is_active"] ?? true) });
    }

    public async Task<object> GetCollectionsAsync(int tenantId, IQueryCollection query)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); var conditions = new List<string> { "fc.tenant_id=@tenantId" };
        if (!string.IsNullOrWhiteSpace(query["status"])) { conditions.Add("fc.status=@status"); p.Add("status", query["status"].ToString()); }
        var rows = await _db.QueryAsync($"""SELECT fc.*, COUNT(fci.id) AS item_count, COALESCE(SUM(fci.amount_due),0) AS total_amount, COALESCE(SUM(fci.amount_paid),0) AS paid_amount FROM fee_collections fc LEFT JOIN fee_collection_items fci ON fci.collection_id=fc.id AND fci.tenant_id=fc.tenant_id WHERE {string.Join(" AND ", conditions)} GROUP BY fc.id ORDER BY fc.created_at DESC""", p);
        return rows;
    }

    public async Task<Dictionary<string, object?>?> GetCollectionByIdAsync(int tenantId, int id)
    {
        var row = await _db.QuerySingleAsync("SELECT * FROM fee_collections WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id }); if (row is null) return null;
        row["items"] = await _db.QueryAsync("""SELECT fci.*, u.full_name AS student_name, sp.student_code FROM fee_collection_items fci JOIN users u ON u.id=fci.student_id LEFT JOIN student_profiles sp ON sp.user_id=u.id AND sp.tenant_id=u.tenant_id WHERE fci.collection_id=@id AND fci.tenant_id=@tenantId ORDER BY u.full_name""", new { tenantId, id });
        return row;
    }

    public async Task<Dictionary<string, object?>?> CreateCollectionAsync(int tenantId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var row = await _db.QuerySingleAsync("""INSERT INTO fee_collections (tenant_id, name, description, due_date, status, created_by) VALUES (@tenantId,@name,@description,@dueDate,'draft',@createdBy) RETURNING *""", new { tenantId, name = body.Str("name"), description = body.Str("description"), dueDate = body.Str("dueDate", "due_date"), createdBy = actor.Id }, tx);
            var collectionId = Convert.ToInt32(row!["id"]);
            foreach (var item in body.Array("items"))
            {
                await _db.ExecuteAsync("""INSERT INTO fee_collection_items (tenant_id, collection_id, student_id, amount_due, amount_paid, status, note) VALUES (@tenantId,@collectionId,@studentId,COALESCE(@finalAmount,@amount-COALESCE(@discountAmount,0)),0,'pending',NULL)""", new { tenantId, collectionId, studentId = item.Int("studentId", "student_id"), amount = item.Dec("amount") ?? 0, discountAmount = item.Dec("discountAmount", "discount_amount") ?? 0, finalAmount = item.Dec("finalAmount", "final_amount") }, tx);
            }
            await tx.CommitAsync(); await _logs.LogAsync(tenantId, actor, "create", "fee_collection", collectionId, Convert.ToString(row["name"]), $"đã tạo đợt thu \"{row["name"]}\"");
            return await GetCollectionByIdAsync(tenantId, collectionId);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public Task<Dictionary<string, object?>?> SetCollectionStatusAsync(int tenantId, int id, string status) => _db.QuerySingleAsync("UPDATE fee_collections SET status=@status, updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *", new { tenantId, id, status });

    public async Task<Dictionary<string, object?>?> RecordPaymentAsync(int tenantId, int itemId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var amount = body.Dec("amount", "paidAmount", "paid_amount") ?? 0;
            var tran = await _db.QuerySingleAsync("""INSERT INTO fee_transactions (tenant_id, item_id, amount, payment_method, note, collected_by) VALUES (@tenantId,@itemId,@amount,@paymentMethod,@note,@recordedBy) RETURNING *""", new { tenantId, itemId, amount, paymentMethod = body.Str("paymentMethod", "payment_method"), note = body.Str("note"), recordedBy = actor.Id }, tx);
            await _db.ExecuteAsync("""UPDATE fee_collection_items SET amount_paid=COALESCE(amount_paid,0)+@amount, status=CASE WHEN COALESCE(amount_paid,0)+@amount >= amount_due THEN 'paid' ELSE 'partial' END, updated_at=NOW() WHERE id=@itemId AND tenant_id=@tenantId""", new { tenantId, itemId, amount }, tx);
            await tx.CommitAsync(); return tran;
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public Task<List<Dictionary<string, object?>>> GetTransactionHistoryAsync(int tenantId, int itemId) => _db.QueryAsync("""SELECT ft.*, u.full_name AS recorded_by_name FROM fee_transactions ft LEFT JOIN users u ON u.id=ft.collected_by WHERE ft.tenant_id=@tenantId AND ft.item_id=@itemId AND ft.is_cancelled=FALSE ORDER BY ft.created_at DESC""", new { tenantId, itemId });

    public async Task<Dictionary<string, object?>?> CancelTransactionAsync(int tenantId, int id)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var tran = await _db.QuerySingleAsync("UPDATE fee_transactions SET is_cancelled=TRUE, cancelled_at=NOW() WHERE id=@id AND tenant_id=@tenantId AND is_cancelled=FALSE RETURNING *", new { tenantId, id }, tx);
            if (tran is not null)
            {
                await _db.ExecuteAsync("""UPDATE fee_collection_items SET amount_paid=GREATEST(COALESCE(amount_paid,0)-@amount,0), status=CASE WHEN GREATEST(COALESCE(amount_paid,0)-@amount,0) <= 0 THEN 'pending' WHEN GREATEST(COALESCE(amount_paid,0)-@amount,0) < amount_due THEN 'partial' ELSE 'paid' END WHERE id=@itemId AND tenant_id=@tenantId""", new { tenantId, itemId = Convert.ToInt32(tran["item_id"]!), amount = Convert.ToDecimal(tran["amount"] ?? 0) }, tx);
            }
            await tx.CommitAsync(); return tran;
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public Task<List<Dictionary<string, object?>>> GetStudentCollectionsAsync(int tenantId, int studentId) => _db.QueryAsync("""SELECT fc.*, fci.id AS item_id, fci.amount_due AS amount, 0::numeric AS discount_amount, fci.amount_due AS final_amount, fci.amount_paid AS paid_amount, fci.status AS item_status FROM fee_collection_items fci JOIN fee_collections fc ON fc.id=fci.collection_id WHERE fci.tenant_id=@tenantId AND fci.student_id=@studentId ORDER BY fc.due_date DESC NULLS LAST""", new { tenantId, studentId });

    public async Task<object> GetExpensesAsync(int tenantId, IQueryCollection query)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); var conditions = new List<string> { "tenant_id=@tenantId" };
        if (!string.IsNullOrWhiteSpace(query["category"])) { conditions.Add("category=@category"); p.Add("category", query["category"].ToString()); }
        return await _db.QueryAsync($"SELECT * FROM expenses WHERE {string.Join(" AND ", conditions)} ORDER BY expense_date DESC, created_at DESC", p);
    }
    public Task<Dictionary<string, object?>?> CreateExpenseAsync(int tenantId, JsonElement body) => _db.QuerySingleAsync("""INSERT INTO expenses (tenant_id, description, category, amount, expense_date, payment_method, created_by) VALUES (@tenantId,@description,@category,@amount,@expenseDate,@paymentMethod,@createdBy) RETURNING *""", new { tenantId, description = body.Str("description", "title", "name"), category = body.Str("category"), amount = body.Dec("amount") ?? 0, expenseDate = body.Str("expenseDate", "expense_date"), paymentMethod = body.Str("paymentMethod", "payment_method"), createdBy = body.Int("createdBy", "created_by") });
    public async Task<Dictionary<string, object?>?> UpdateExpenseAsync(int tenantId, int id, JsonElement body)
    {
        var c = await _db.QuerySingleAsync("SELECT * FROM expenses WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id }); if (c is null) return null;
        return await _db.QuerySingleAsync("""UPDATE expenses SET description=@description, category=@category, amount=@amount, expense_date=@expenseDate, payment_method=@paymentMethod, updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *""", new { tenantId, id, description = body.Str("description", "title", "name") ?? c["description"], category = body.Str("category") ?? c["category"], amount = body.Dec("amount") ?? Convert.ToDecimal(c["amount"] ?? 0), expenseDate = body.Str("expenseDate", "expense_date") ?? c["expense_date"], paymentMethod = body.Str("paymentMethod", "payment_method") ?? c["payment_method"] });
    }
    public Task<int> DeleteExpenseAsync(int tenantId, int id) => _db.ExecuteAsync("DELETE FROM expenses WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id });
}
