using System.Text.Json;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class ActivityLogService
{
    private readonly DbService _db;
    public ActivityLogService(DbService db) => _db = db;

    public async Task LogAsync(int tenantId, CurrentUser? actor, string actionType, string entityType, int? entityId, string? entityName, string description, object? metadata = null)
    {
        try
        {
            await _db.ExecuteAsync(
                """
                INSERT INTO activity_logs (tenant_id, actor_id, actor_name, actor_role, action_type, entity_type, entity_id, entity_name, description, metadata)
                VALUES (@tenantId, @actorId, @actorName, @actorRole, @actionType, @entityType, @entityId, @entityName, @description, CAST(@metadata AS jsonb))
                """,
                new
                {
                    tenantId,
                    actorId = actor?.Id,
                    actorName = actor?.FullName,
                    actorRole = actor?.Roles.FirstOrDefault(),
                    actionType,
                    entityType,
                    entityId,
                    entityName,
                    description,
                    metadata = metadata is null ? "{}" : JsonSerializer.Serialize(metadata)
                });
        }
        catch
        {
            // Logging must never break the main business flow.
        }
    }

    public async Task<object> ListAsync(int tenantId, IQueryCollection query)
    {
        var conditions = new List<string> { "al.tenant_id=@tenantId" };
        var p = new Dapper.DynamicParameters();
        p.Add("tenantId", tenantId);
        if (!string.IsNullOrWhiteSpace(query["actorId"])) { conditions.Add("al.actor_id=@actorId"); p.Add("actorId", int.Parse(query["actorId"].ToString())); }
        if (!string.IsNullOrWhiteSpace(query["actionType"])) { conditions.Add("al.action_type=@actionType"); p.Add("actionType", query["actionType"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["entityType"])) { conditions.Add("al.entity_type=@entityType"); p.Add("entityType", query["entityType"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["from"])) { conditions.Add("al.created_at>=@from"); p.Add("from", query["from"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["to"])) { conditions.Add("al.created_at<=@to"); p.Add("to", query["to"].ToString()); }
        var page = int.TryParse(query["page"], out var pg) ? Math.Max(pg, 1) : 1;
        var limit = int.TryParse(query["limit"], out var lm) ? Math.Clamp(lm, 1, 200) : 30;
        p.Add("limit", limit); p.Add("offset", (page - 1) * limit);
        var where = string.Join(" AND ", conditions);
        var total = await _db.ScalarAsync<long>($"SELECT COUNT(*) FROM activity_logs al WHERE {where}", p);
        var logs = await _db.QueryAsync($"SELECT al.* FROM activity_logs al WHERE {where} ORDER BY al.created_at DESC LIMIT @limit OFFSET @offset", p);
        return new { total, page, limit, logs };
    }

    public async Task<List<Dictionary<string, object?>>> GetDistinctActorsAsync(int tenantId)
    {
        return await _db.QueryAsync(
            """
            SELECT DISTINCT actor_id AS id, actor_name AS full_name, actor_role
            FROM activity_logs
            WHERE tenant_id=@tenantId AND actor_id IS NOT NULL
            ORDER BY actor_name
            """,
            new { tenantId });
    }
}
