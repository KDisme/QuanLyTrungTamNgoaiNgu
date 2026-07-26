using System.Text.Json;
using System.Text.Json.Serialization;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Middleware;
using LanguageCenter.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Keep exact dictionary keys returned from PostgreSQL aliases; camelCase normal DTO properties.
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = null;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddScoped<DbService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<PermissionService>();
builder.Services.AddScoped<ActivityLogService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<BranchService>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<ScheduleService>();
builder.Services.AddScoped<FeeService>();
builder.Services.AddScoped<HomeworkService>();
builder.Services.AddScoped<HomeworkQuestionBankService>();
builder.Services.AddScoped<ExamService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<DashboardService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
        else
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
    });
});

var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseStaticFiles();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", backend = "ASP.NET Core Web API", database = "PostgreSQL" }));

app.Run();
