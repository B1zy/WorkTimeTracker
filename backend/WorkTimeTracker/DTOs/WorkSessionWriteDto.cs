using System.ComponentModel.DataAnnotations;
using WorkTimeTracker.Models;

namespace WorkTimeTracker.DTOs;

// Request body shape for create/update. Deliberately has no Id: the id comes
// from the route on PUT and is server-assigned on POST, so a client can't
// overpost one to target/clobber an arbitrary row.
public class WorkSessionWriteDto
{
    // No [Required]/MinimumLength: the frontend intentionally allows an empty
    // name (it falls back to showing the entry type on the timeline instead).
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;

    public WorkLocation Location { get; set; }
    public EntryType EntryType { get; set; } = EntryType.Working;
    public DateOnly Date { get; set; }
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
}
