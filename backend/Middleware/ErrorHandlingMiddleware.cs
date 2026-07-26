using Npgsql;
using System.Text.Json;

namespace LanguageCenter.Api.Middleware;

public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Dữ liệu đã tồn tại", detail = ex.ConstraintName }));
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("VALIDATION:", StringComparison.Ordinal))
        {
            context.Response.StatusCode = StatusCodes.Status422UnprocessableEntity;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = ex.Message.Replace("VALIDATION:", string.Empty).Trim() }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled API error");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Internal server error", detail = ex.Message }));
        }
    }
}
