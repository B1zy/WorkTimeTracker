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
    Lunch
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