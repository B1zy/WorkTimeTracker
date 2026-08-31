using Microsoft.AspNetCore.Diagnostics;

namespace WorkTimeTracker.Services;

// Catches anything that escapes controller-level try/catch (DB errors, bugs,
// etc.) so a request fails as a logged, generic JSON error instead of an
// unlogged crash or a response that leaks exception details/stack traces.
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception processing {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new
        {
            title = "An unexpected error occurred.",
            status = StatusCodes.Status500InternalServerError,
        }, cancellationToken);

        return true;
    }
}
