using Microsoft.EntityFrameworkCore;

namespace WorkTimeTracker.Models;

public class WorkSessionContext :DbContext
{
    public WorkSessionContext (DbContextOptions<WorkSessionContext> options)
        : base(options)
    {
    }

    public DbSet<WorkSession> WorkSession { get; set; } = null;
}