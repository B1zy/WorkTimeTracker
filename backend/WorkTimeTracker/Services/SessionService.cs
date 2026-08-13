using WorkTimeTracker.Models;

namespace WorkTimeTracker.Services;

public class SessionService : ISessionService
{
    private readonly WorkSessionContext _context;
    
    public SessionService(WorkSessionContext context)
    {
        _context = context;
    }

    public void CreateSession(WorkSession session)
    {
        
        _context.WorkSession.Add(session);
        _context.SaveChanges();
        
    }

    public void UpdateSession(int id, WorkSession session)
    {
        _context.WorkSession.Update(_context.WorkSession.Find(id));
        _context.SaveChanges();
    }
    
    public void DeleteSession(int id)
    {
        _context.WorkSession.Remove(_context.WorkSession.Find(id));
        _context.SaveChanges();
    }

    public List<WorkSession> GetSessions(DateOnly startDate, DateOnly endDate)
    {
        
        return List<WorkSession>
    }

    public decimal GetTotalHours(DateOnly startDate, DateOnly endDate)
    {
        return 
    };

}