using Microsoft.AspNetCore.Mvc;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Models;
using WorkTimeTracker.Services;

namespace WorkTimeTracker.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkSessionsController : ControllerBase
    {
        private readonly ISessionService _sessionService;

        public WorkSessionsController(ISessionService sessionService)
        {
            _sessionService = sessionService;
        }

        // GET: api/WorkSessions?startDate=2026-08-10&endDate=2026-08-14
        [HttpGet]
        public ActionResult<IEnumerable<WorkSession>> GetWorkSession(DateOnly startDate, DateOnly endDate)
        {
            return _sessionService.GetSessions(startDate, endDate);
        }

        // GET: api/WorkSessions/5
        [HttpGet("{id}")]
        public ActionResult<WorkSession> GetWorkSession(int id)
        {
            var workSession = _sessionService.GetSessionById(id);

            if (workSession == null)
            {
                return NotFound();
            }

            return workSession;
        }

        // PUT: api/WorkSessions/5
        // Binds a DTO (not the entity) with no Id field, so the id always comes
        // from the route -- a client can't overpost one to target a different row.
        [HttpPut("{id}")]
        public IActionResult PutWorkSession(int id, WorkSessionWriteDto dto)
        {
            var workSession = ToEntity(dto, id);

            try
            {
                _sessionService.UpdateSession(id, workSession);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }

            return NoContent();
        }

        // POST: api/WorkSessions
        // Binds a DTO (not the entity), so a client can't overpost an Id or any
        // other field the entity might gain later.
        [HttpPost]
        public ActionResult<WorkSession> PostWorkSession(WorkSessionWriteDto dto)
        {
            var workSession = ToEntity(dto, id: 0);

            try
            {
                _sessionService.CreateSession(workSession);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }

            return CreatedAtAction(nameof(GetWorkSession), new { id = workSession.Id }, workSession);
        }

        private static WorkSession ToEntity(WorkSessionWriteDto dto, int id) => new()
        {
            Id = id,
            Name = dto.Name?.Trim() ?? string.Empty,
            Description = dto.Description?.Trim() ?? string.Empty,
            Location = dto.Location,
            EntryType = dto.EntryType,
            Date = dto.Date,
            Start = dto.Start,
            End = dto.End,
        };

        // DELETE: api/WorkSessions/5
        [HttpDelete("{id}")]
        public IActionResult DeleteWorkSession(int id)
        {
            try
            {
                _sessionService.DeleteSession(id);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }

            return NoContent();
        }
    }
}
