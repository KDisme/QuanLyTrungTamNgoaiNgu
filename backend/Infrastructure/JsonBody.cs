using System.Globalization;
using System.Text.Json;

namespace LanguageCenter.Api.Infrastructure;

public static class JsonBody
{
    public static string? Str(this JsonElement body, params string[] names)
    {
        if (TryGet(body, out var prop, names))
        {
            if (prop.ValueKind == JsonValueKind.Null || prop.ValueKind == JsonValueKind.Undefined) return null;
            return prop.ValueKind == JsonValueKind.String ? prop.GetString() : prop.ToString();
        }
        return null;
    }

    public static int? Int(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind == JsonValueKind.Null) return null;
        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt32(out var i)) return i;
        return int.TryParse(prop.ToString(), out var parsed) ? parsed : null;
    }

    public static long? Long(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind == JsonValueKind.Null) return null;
        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt64(out var i)) return i;
        return long.TryParse(prop.ToString(), out var parsed) ? parsed : null;
    }

    public static decimal? Dec(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind == JsonValueKind.Null) return null;
        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetDecimal(out var i)) return i;
        return decimal.TryParse(prop.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    public static bool? Bool(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind == JsonValueKind.Null) return null;
        if (prop.ValueKind == JsonValueKind.True) return true;
        if (prop.ValueKind == JsonValueKind.False) return false;
        return bool.TryParse(prop.ToString(), out var parsed) ? parsed : null;
    }

    public static string Json(this JsonElement body, params string[] names)
    {
        if (TryGet(body, out var prop, names)) return prop.GetRawText();
        return "{}";
    }

    public static List<string> StringArray(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind != JsonValueKind.Array) return [];
        return prop.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.String ? x.GetString() : x.ToString()).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().Distinct().ToList();
    }

    public static List<JsonElement> Array(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind != JsonValueKind.Array) return [];
        return prop.EnumerateArray().Select(x => x.Clone()).ToList();
    }

    public static bool TryGet(this JsonElement body, out JsonElement prop, params string[] names)
    {
        foreach (var name in names)
        {
            if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out prop)) return true;
        }
        if (body.ValueKind == JsonValueKind.Object)
        {
            foreach (var p in body.EnumerateObject())
            {
                if (names.Any(n => string.Equals(p.Name, n, StringComparison.OrdinalIgnoreCase)))
                {
                    prop = p.Value;
                    return true;
                }
            }
        }
        prop = default;
        return false;
    }

    public static object? DbJsonOrNull(this JsonElement body, params string[] names)
    {
        if (!TryGet(body, out var prop, names) || prop.ValueKind == JsonValueKind.Null || prop.ValueKind == JsonValueKind.Undefined) return null;
        return prop.GetRawText();
    }
}
