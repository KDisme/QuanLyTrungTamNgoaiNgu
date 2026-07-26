using System.Collections;
using System.Data;
using System.Text.Json;
using Dapper;
using Npgsql;

namespace LanguageCenter.Api.Infrastructure;

public sealed class DbService
{
    private readonly DbConnectionFactory _factory;

    public DbService(DbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<NpgsqlConnection> OpenConnectionAsync()
    {
        var conn = _factory.Create();
        await conn.OpenAsync();
        return conn;
    }

    public async Task<List<Dictionary<string, object?>>> QueryAsync(string sql, object? param = null, IDbTransaction? tx = null)
    {
        if (tx?.Connection is not null)
        {
            var txRows = await tx.Connection.QueryAsync(sql, param, tx);
            return txRows.Select(ToDictionary).ToList();
        }

        await using var conn = await OpenConnectionAsync();
        var rows = await conn.QueryAsync(sql, param);
        return rows.Select(ToDictionary).ToList();
    }

    public async Task<Dictionary<string, object?>?> QuerySingleAsync(string sql, object? param = null, IDbTransaction? tx = null)
    {
        if (tx?.Connection is not null)
        {
            var txRow = await tx.Connection.QueryFirstOrDefaultAsync(sql, param, tx);
            return txRow is null ? null : ToDictionary(txRow);
        }

        await using var conn = await OpenConnectionAsync();
        var row = await conn.QueryFirstOrDefaultAsync(sql, param);
        return row is null ? null : ToDictionary(row);
    }

    public async Task<T?> ScalarAsync<T>(string sql, object? param = null, IDbTransaction? tx = null)
    {
        if (tx?.Connection is not null)
        {
            return await tx.Connection.ExecuteScalarAsync<T?>(sql, param, tx);
        }

        await using var conn = await OpenConnectionAsync();
        return await conn.ExecuteScalarAsync<T?>(sql, param);
    }

    public async Task<int> ExecuteAsync(string sql, object? param = null, IDbTransaction? tx = null)
    {
        if (tx?.Connection is not null)
        {
            return await tx.Connection.ExecuteAsync(sql, param, tx);
        }

        await using var conn = await OpenConnectionAsync();
        return await conn.ExecuteAsync(sql, param);
    }

    private static Dictionary<string, object?> ToDictionary(dynamic row)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var values = (IDictionary<string, object>)row;
        foreach (var pair in values)
        {
            dict[pair.Key] = Normalize(pair.Value);
        }
        return dict;
    }

    private static object? Normalize(object? value)
    {
        if (value is null || value is DBNull) return null;
        if (value is DateTime dt) return dt.Kind == DateTimeKind.Unspecified ? dt.ToString("yyyy-MM-ddTHH:mm:ss") : dt.ToUniversalTime().ToString("O");
        if (value is DateOnly d) return d.ToString("yyyy-MM-dd");
        if (value is TimeOnly t) return t.ToString("HH:mm:ss");
        if (value is JsonDocument doc) return JsonSerializer.Deserialize<object>(doc.RootElement.GetRawText());
        if (value is JsonElement el) return JsonSerializer.Deserialize<object>(el.GetRawText());
        if (value is Array array && value is not byte[])
        {
            return array.Cast<object?>().Select(Normalize).ToArray();
        }
        if (value is IEnumerable enumerable && value is not string && value is not byte[])
        {
            var list = new List<object?>();
            foreach (var item in enumerable) list.Add(Normalize(item));
            return list;
        }
        return value;
    }
}
