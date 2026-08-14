using WorkTimeTracker.Models;

namespace WorkTimeTracker.Services;

public interface ISessionService
{
    public List<WorkSession> GetAllSessions();
    public WorkSession? GetSessionById(int id);
    public void CreateSession(WorkSession session);
    public void UpdateSession(int id, WorkSession session);
    public void DeleteSession(int id);
    public List<WorkSession> GetSessions(DateOnly startDate, DateOnly endDate);
    public decimal GetTotalHours(DateOnly startDate, DateOnly endDate);

}