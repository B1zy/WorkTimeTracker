using WorkTimeTracker.Models;

namespace WorkTimeTracker.Services;

public class SessionService : ISessionService
{
    private readonly WorkSessionContext _context;
    
    public SessionService(WorkSessionContext context)
    {
        _context = context;
    }

    public List<WorkSession> GetAllSessions()
    {
        return _context.WorkSession.ToList();
    }

    public WorkSession? GetSessionById(int id)
    {
        return _context.WorkSession.Find(id);
    }

    public void CreateSession(WorkSession session)
    {
        if (session.End <= session.Start)
        {
            throw new ArgumentException("End time must be after start time.");
        }
        _context.WorkSession.Add(session);
        _context.SaveChanges();
        
    }

    public void UpdateSession(int id, WorkSession session)
    {
        if (session.End <= session.Start)
        {
            throw new ArgumentException("End time must be after start time.");
        }
        var existing = _context.WorkSession.Find(id);
        if (existing is null)
        {
            throw new KeyNotFoundException($"Work session {id} not found.");
        }

        existing.Name = session.Name;
        existing.Description = session.Description;
        existing.Location = session.Location;
        existing.EntryType = session.EntryType;
        existing.Date = session.Date;
        existing.Start = session.Start;
        existing.End = session.End;
        _context.SaveChanges();
        
    }
    
    public void DeleteSession(int id)
    {
        var session = _context.WorkSession.Find(id);
        if (session is null)
        {
            throw new KeyNotFoundException($"Work session {id} not found.");
        }

        _context.WorkSession.Remove(session);
        _context.SaveChanges();
    }

    public List<WorkSession> GetSessions(DateOnly startDate, DateOnly endDate)
    {
        return _context.WorkSession
            .Where(s => s.Date >= startDate && s.Date <= endDate)
            .ToList();
    }

    public decimal GetTotalHours(DateOnly startDate, DateOnly endDate)
    {
        return _context.WorkSession
            .Where(s => s.Date >= startDate && s.Date <= endDate)
            .Sum(s => (decimal)(s.End - s.Start).TotalHours);
        
    }
}