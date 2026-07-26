using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;

namespace LanguageCenter.Api.Services;

public sealed class BranchService
{
    private readonly DbService _db;
    public BranchService(DbService db) => _db = db;

    public async Task<object> GetAllAsync(int tenantId, IQueryCollection query)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId);
        var conditions = new List<string> { "b.tenant_id=@tenantId" };
        if (!string.IsNullOrWhiteSpace(query["search"])) { conditions.Add("(b.name ILIKE @search OR b.address ILIKE @search OR b.phone ILIKE @search)"); p.Add("search", $"%{query["search"]}%"); }
        var rows = await _db.QueryAsync($"""
            SELECT b.*,
                   COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name, 'code', r.code, 'capacity', r.capacity, 'status', r.status, 'is_active', (r.status='active')) ORDER BY r.name) FILTER (WHERE r.id IS NOT NULL), '[]') AS rooms
            FROM branches b
            LEFT JOIN rooms r ON r.branch_id=b.id AND r.tenant_id=b.tenant_id
            WHERE {string.Join(" AND ", conditions)}
            GROUP BY b.id
            ORDER BY b.name
            """, p);
        return rows;
    }

    public async Task<Dictionary<string, object?>?> GetByIdAsync(int tenantId, int id)
    {
        var branch = await _db.QuerySingleAsync("SELECT * FROM branches WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id });
        if (branch is null) return null;
        branch["rooms"] = await _db.QueryAsync("SELECT * FROM rooms WHERE branch_id=@id AND tenant_id=@tenantId ORDER BY name", new { tenantId, id });
        return branch;
    }

    public async Task<Dictionary<string, object?>?> CreateAsync(int tenantId, JsonElement body)
    {
        return await _db.QuerySingleAsync(
            """INSERT INTO branches (tenant_id, name, code, address, phone, status) VALUES (@tenantId,@name,@code,@address,@phone,COALESCE(@status,'active')) RETURNING *""",
            new { tenantId, name = body.Str("name"), code = body.Str("code"), address = body.Str("address"), phone = body.Str("phone"), status = body.Str("status") ?? (body.Bool("isActive", "is_active") == false ? "inactive" : "active") });
    }

    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int id, JsonElement body)
    {
        var current = await GetByIdAsync(tenantId, id); if (current is null) return null;
        return await _db.QuerySingleAsync(
            """UPDATE branches SET name=@name, code=@code, address=@address, phone=@phone, status=@status, updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *""",
            new { tenantId, id, name = body.Str("name") ?? current["name"], code = body.Str("code") ?? current["code"], address = body.Str("address") ?? current["address"], phone = body.Str("phone") ?? current["phone"], status = body.Str("status") ?? (body.Bool("isActive", "is_active") is bool active ? (active ? "active" : "inactive") : current["status"]) });
    }

    public async Task<bool> DeleteAsync(int tenantId, int id) => await _db.ExecuteAsync("DELETE FROM branches WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id }) > 0;

    public async Task<Dictionary<string, object?>?> AddRoomAsync(int tenantId, int branchId, JsonElement body)
    {
        return await _db.QuerySingleAsync("""INSERT INTO rooms (tenant_id, branch_id, name, code, capacity, status) VALUES (@tenantId,@branchId,@name,@code,COALESCE(@capacity,0),COALESCE(@status,'active')) RETURNING *""", new { tenantId, branchId, name = body.Str("name"), code = body.Str("code"), capacity = body.Int("capacity"), status = body.Str("status") ?? (body.Bool("isActive", "is_active") == false ? "inactive" : "active") });
    }

    public async Task<Dictionary<string, object?>?> UpdateRoomAsync(int tenantId, int roomId, JsonElement body)
    {
        var current = await _db.QuerySingleAsync("SELECT * FROM rooms WHERE id=@roomId AND tenant_id=@tenantId", new { tenantId, roomId }); if (current is null) return null;
        return await _db.QuerySingleAsync("""UPDATE rooms SET name=@name, code=@code, capacity=@capacity, status=@status, updated_at=NOW() WHERE id=@roomId AND tenant_id=@tenantId RETURNING *""", new { tenantId, roomId, name = body.Str("name") ?? current["name"], code = body.Str("code") ?? current["code"], capacity = body.Int("capacity") ?? (current["capacity"] is null ? 0 : Convert.ToInt32(current["capacity"])), status = body.Str("status") ?? (body.Bool("isActive", "is_active") is bool active ? (active ? "active" : "inactive") : current["status"]) });
    }

    public async Task<bool> DeleteRoomAsync(int tenantId, int roomId) => await _db.ExecuteAsync("DELETE FROM rooms WHERE id=@roomId AND tenant_id=@tenantId", new { tenantId, roomId }) > 0;
}
