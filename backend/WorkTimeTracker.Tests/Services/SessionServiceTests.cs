using Microsoft.EntityFrameworkCore;
using WorkTimeTracker.Models;
using WorkTimeTracker.Services;

namespace WorkTimeTracker.Tests.Services;

public class SessionServiceTests
{
    // Fresh, isolated in-memory database per test -- a unique db name means
    // tests never see each other's data even when run in parallel.
    private static WorkSessionContext NewContext()
    {
        var options = new DbContextOptionsBuilder<WorkSessionContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new WorkSessionContext(options);
    }

    private static WorkSession MakeSession(
        DateOnly? date = null,
        TimeOnly? start = null,
        TimeOnly? end = null,
        string name = "Test session") => new()
    {
        Name = name,
        Description = "",
        Location = WorkLocation.InOffice,
        EntryType = EntryType.Working,
        Date = date ?? new DateOnly(2026, 8, 31),
        Start = start ?? new TimeOnly(9, 0),
        End = end ?? new TimeOnly(17, 0),
    };

    [Fact]
    public void CreateSession_AddsSessionToDatabase()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var session = MakeSession();

        service.CreateSession(session);

        Assert.Single(context.WorkSession);
        Assert.True(session.Id > 0);
    }

    [Fact]
    public void CreateSession_ThrowsArgumentException_WhenEndNotAfterStart()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var session = MakeSession(start: new TimeOnly(17, 0), end: new TimeOnly(9, 0));

        Assert.Throws<ArgumentException>(() => service.CreateSession(session));
        Assert.Empty(context.WorkSession);
    }

    [Fact]
    public void CreateSession_ThrowsArgumentException_WhenEndEqualsStart()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var time = new TimeOnly(9, 0);
        var session = MakeSession(start: time, end: time);

        Assert.Throws<ArgumentException>(() => service.CreateSession(session));
    }

    [Fact]
    public void UpdateSession_ThrowsKeyNotFoundException_WhenSessionDoesNotExist()
    {
        using var context = NewContext();
        var service = new SessionService(context);

        Assert.Throws<KeyNotFoundException>(() => service.UpdateSession(999, MakeSession()));
    }

    [Fact]
    public void UpdateSession_ThrowsArgumentException_WhenEndNotAfterStart()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var existing = MakeSession();
        service.CreateSession(existing);

        var badUpdate = MakeSession(start: new TimeOnly(17, 0), end: new TimeOnly(9, 0));

        Assert.Throws<ArgumentException>(() => service.UpdateSession(existing.Id, badUpdate));
    }

    [Fact]
    public void UpdateSession_UpdatesAllMutableFields()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var existing = MakeSession(name: "Original");
        service.CreateSession(existing);

        var updated = new WorkSession
        {
            Id = existing.Id,
            Name = "Updated",
            Description = "New description",
            Location = WorkLocation.Remote,
            EntryType = EntryType.Sick,
            Date = new DateOnly(2026, 9, 1),
            Start = new TimeOnly(10, 0),
            End = new TimeOnly(11, 0),
        };

        service.UpdateSession(existing.Id, updated);

        var stored = service.GetSessionById(existing.Id);
        Assert.NotNull(stored);
        Assert.Equal("Updated", stored!.Name);
        Assert.Equal("New description", stored.Description);
        Assert.Equal(WorkLocation.Remote, stored.Location);
        Assert.Equal(EntryType.Sick, stored.EntryType);
        Assert.Equal(new DateOnly(2026, 9, 1), stored.Date);
        Assert.Equal(new TimeOnly(10, 0), stored.Start);
        Assert.Equal(new TimeOnly(11, 0), stored.End);
    }

    [Fact]
    public void DeleteSession_ThrowsKeyNotFoundException_WhenSessionDoesNotExist()
    {
        using var context = NewContext();
        var service = new SessionService(context);

        Assert.Throws<KeyNotFoundException>(() => service.DeleteSession(999));
    }

    [Fact]
    public void DeleteSession_RemovesSession()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        var session = MakeSession();
        service.CreateSession(session);

        service.DeleteSession(session.Id);

        Assert.Null(service.GetSessionById(session.Id));
    }

    [Fact]
    public void GetSessionById_ReturnsNull_WhenNotFound()
    {
        using var context = NewContext();
        var service = new SessionService(context);

        Assert.Null(service.GetSessionById(999));
    }

    [Fact]
    public void GetSessions_ReturnsOnlySessionsWithinDateRange()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        service.CreateSession(MakeSession(date: new DateOnly(2026, 8, 1)));
        service.CreateSession(MakeSession(date: new DateOnly(2026, 8, 15)));
        service.CreateSession(MakeSession(date: new DateOnly(2026, 9, 1)));

        var result = service.GetSessions(new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(2, result.Count);
        Assert.All(result, s => Assert.True(s.Date >= new DateOnly(2026, 8, 1) && s.Date <= new DateOnly(2026, 8, 31)));
    }

    [Fact]
    public void GetTotalHours_SumsDurationsWithinRange()
    {
        using var context = NewContext();
        var service = new SessionService(context);
        // 8 hours, in range
        service.CreateSession(MakeSession(date: new DateOnly(2026, 8, 10), start: new TimeOnly(9, 0), end: new TimeOnly(17, 0)));
        // 4 hours, in range
        service.CreateSession(MakeSession(date: new DateOnly(2026, 8, 11), start: new TimeOnly(9, 0), end: new TimeOnly(13, 0)));
        // 2 hours, out of range
        service.CreateSession(MakeSession(date: new DateOnly(2026, 9, 1), start: new TimeOnly(9, 0), end: new TimeOnly(11, 0)));

        var total = service.GetTotalHours(new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(12m, total);
    }
}
