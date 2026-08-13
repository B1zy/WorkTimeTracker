using Microsoft.CodeAnalysis;
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
        var existing = _context.WorkSession.Find(id);
        existing.Name = session.Name;
        existing.Description = session.Description;
        existing.Location = session.Location;
        existing.Date = session.Date;
        existing.Start = session.Start;
        existing.End = session.End;
        _context.SaveChanges();
        
    }
    
    public void DeleteSession(int id)
    {
        var session = _context.WorkSession.Find(id);
        _context.WorkSession.Remove(session);
        _context.SaveChanges();
    }

    public List<WorkSession> GetSessions(DateOnly startDate, DateOnly endDate)
    {
        _context.WorkSession
            .Where(s => s.Date >= startDate && s.Date <= endDate)
            .ToList();
        return _context.WorkSession.ToList();
    }

    public decimal GetTotalHours(DateOnly startDate, DateOnly endDate)
    {
        return _context.WorkSession
            .Where(s => s.Date >= startDate && s.Date <= endDate)
            .Sum(s => (decimal)(s.End - s.Start).TotalHours);
        
    }
}