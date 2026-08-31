using System.Text.Json.Serialization;
using WorkTimeTracker.Models;
using WorkTimeTracker.Services;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddDbContext<WorkSessionContext>(opt => opt.UseSqlite("Data Source=worksession.db"));
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddHttpClient();
// Solo local app served from a plain static file server (Live Server, `npx serve`, etc.),
// so the frontend's port isn't fixed. Allowing any origin is fine here since there's no
// auth/credentials involved -- but the method/header list is still narrowed to what the
// app actually uses, rather than opening both up wholesale.
const string DevCorsPolicy = "DevCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy =>
    {
        policy.AllowAnyOrigin()
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders("Content-Type");
    });
});

// Unhandled exceptions are logged and turned into a generic 500 rather than
// crashing the request or leaking exception details to the client.
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

// Apply any pending EF Core migrations on startup so the SQLite file always
// has the current schema without a separate manual migration step.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<WorkSessionContext>().Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors(DevCorsPolicy);

app.UseAuthorization();

app.MapControllers();

app.Run();