namespace WorkTimeTracker.Models;

public enum WorkLocation
{
    Remote,
    InOffice,
    Other
}

public enum EntryType
{
    Working,
    Sick,
    OvertimeCompensation,
    Appointment,
    Lunch,
    // Appended, not inserted -- this is a plain INTEGER column with no CHECK
    // constraint (see the AddEntryType migration), so a new value here needs
    // no migration of its own, but existing rows' numeric values must stay
    // stable.
    Vacation
}

public class WorkSession
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public WorkLocation Location { get; set; }
    public EntryType EntryType { get; set; } = EntryType.Working;
    public DateOnly Date { get; set; }
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
}