using Microsoft.AspNetCore.Mvc;
using Moq;
using WorkTimeTracker.Controllers;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Models;
using WorkTimeTracker.Services;

namespace WorkTimeTracker.Tests.Controllers;

public class WorkSessionsControllerTests
{
    private static WorkSessionWriteDto MakeDto(string name = "Test") => new()
    {
        Name = name,
        Description = "",
        Location = WorkLocation.InOffice,
        EntryType = EntryType.Working,
        Date = new DateOnly(2026, 8, 31),
        Start = new TimeOnly(9, 0),
        End = new TimeOnly(17, 0),
    };

    [Fact]
    public void GetWorkSession_ById_ReturnsNotFound_WhenSessionMissing()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.GetSessionById(1)).Returns((WorkSession?)null);
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.GetWorkSession(1);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public void GetWorkSession_ById_ReturnsSession_WhenFound()
    {
        var session = new WorkSession { Id = 1, Name = "Found" };
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.GetSessionById(1)).Returns(session);
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.GetWorkSession(1);

        Assert.Equal(session, result.Value);
    }

    [Fact]
    public void PostWorkSession_ReturnsCreatedAtAction_OnSuccess()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.CreateSession(It.IsAny<WorkSession>()))
            .Callback<WorkSession>(s => s.Id = 42); // mimics the DB assigning an id on save
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.PostWorkSession(MakeDto());

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var body = Assert.IsType<WorkSession>(created.Value);
        Assert.Equal(42, body.Id);
    }

    [Fact]
    public void PostWorkSession_IgnoresAnyClientSuppliedId()
    {
        // The DTO has no Id property at all, so there's nothing to overpost --
        // this pins that the entity handed to the service always starts at 0
        // regardless of what the (now-impossible) client id would have been.
        var mockService = new Mock<ISessionService>();
        WorkSession? captured = null;
        mockService.Setup(s => s.CreateSession(It.IsAny<WorkSession>()))
            .Callback<WorkSession>(s => captured = s);
        var controller = new WorkSessionsController(mockService.Object);

        controller.PostWorkSession(MakeDto());

        Assert.NotNull(captured);
        Assert.Equal(0, captured!.Id);
    }

    [Fact]
    public void PostWorkSession_ReturnsBadRequest_WhenServiceThrowsArgumentException()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.CreateSession(It.IsAny<WorkSession>()))
            .Throws(new ArgumentException("End time must be after start time."));
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.PostWorkSession(MakeDto());

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("End time must be after start time.", badRequest.Value);
    }

    [Fact]
    public void PutWorkSession_UsesRouteIdRegardlessOfDtoContent()
    {
        // No Id field exists on the DTO -- the id the service receives must
        // come from the route parameter every time.
        var mockService = new Mock<ISessionService>();
        int? capturedId = null;
        mockService.Setup(s => s.UpdateSession(It.IsAny<int>(), It.IsAny<WorkSession>()))
            .Callback<int, WorkSession>((id, _) => capturedId = id);
        var controller = new WorkSessionsController(mockService.Object);

        controller.PutWorkSession(7, MakeDto());

        Assert.Equal(7, capturedId);
    }

    [Fact]
    public void PutWorkSession_ReturnsNotFound_WhenServiceThrowsKeyNotFoundException()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.UpdateSession(It.IsAny<int>(), It.IsAny<WorkSession>()))
            .Throws(new KeyNotFoundException());
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.PutWorkSession(1, MakeDto());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void PutWorkSession_ReturnsBadRequest_WhenServiceThrowsArgumentException()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.UpdateSession(It.IsAny<int>(), It.IsAny<WorkSession>()))
            .Throws(new ArgumentException("bad range"));
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.PutWorkSession(1, MakeDto());

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("bad range", badRequest.Value);
    }

    [Fact]
    public void PutWorkSession_ReturnsNoContent_OnSuccess()
    {
        var mockService = new Mock<ISessionService>();
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.PutWorkSession(1, MakeDto());

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public void DeleteWorkSession_ReturnsNotFound_WhenServiceThrowsKeyNotFoundException()
    {
        var mockService = new Mock<ISessionService>();
        mockService.Setup(s => s.DeleteSession(1)).Throws(new KeyNotFoundException());
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.DeleteWorkSession(1);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void DeleteWorkSession_ReturnsNoContent_OnSuccess()
    {
        var mockService = new Mock<ISessionService>();
        var controller = new WorkSessionsController(mockService.Object);

        var result = controller.DeleteWorkSession(1);

        Assert.IsType<NoContentResult>(result);
        mockService.Verify(s => s.DeleteSession(1), Times.Once);
    }
}
