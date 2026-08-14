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

// Solo local app served from a plain static file server (Live Server, `npx serve`, etc.),
// so the frontend's port isn't fixed. Allowing any origin is fine here since there's no
// auth/credentials involved.
const string DevCorsPolicy = "DevCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

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