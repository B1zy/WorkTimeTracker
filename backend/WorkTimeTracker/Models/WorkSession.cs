namespace WorkTimeTracker.Models;

public enum WorkLocation
{
    Remote,
    InOffice,
    Other
}

public class WorkSession
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public WorkLocation Location { get; set; }
    public DateOnly Date { get; set; }
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
}