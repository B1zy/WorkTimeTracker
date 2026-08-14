using Microsoft.AspNetCore.Mvc;
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
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public IActionResult PutWorkSession(int id, WorkSession workSession)
        {
            if (id != workSession.Id)
            {
                return BadRequest();
            }

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
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public ActionResult<WorkSession> PostWorkSession(WorkSession workSession)
        {
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
