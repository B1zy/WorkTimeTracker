using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkTimeTracker.Models;

namespace WorkTimeTracker.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkSessionsController : ControllerBase
    {
        private readonly WorkSessionContext _context;

        public WorkSessionsController(WorkSessionContext context)
        {
            _context = context;
        }

        // GET: api/WorkSessions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkSession>>> GetWorkSession()
        {
            return await _context.WorkSession.ToListAsync();
        }

        // GET: api/WorkSessions/5
        [HttpGet("{id}")]
        public async Task<ActionResult<WorkSession>> GetWorkSession(int id)
        {
            var workSession = await _context.WorkSession.FindAsync(id);

            if (workSession == null)
            {
                return NotFound();
            }

            return workSession;
        }

        // PUT: api/WorkSessions/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutWorkSession(int id, WorkSession workSession)
        {
            if (id != workSession.Id)
            {
                return BadRequest();
            }

            _context.Entry(workSession).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!WorkSessionExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/WorkSessions
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<WorkSession>> PostWorkSession(WorkSession workSession)
        {
            _context.WorkSession.Add(workSession);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetWorkSession", new { id = workSession.Id }, workSession);
        }

        // DELETE: api/WorkSessions/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkSession(int id)
        {
            var workSession = await _context.WorkSession.FindAsync(id);
            if (workSession == null)
            {
                return NotFound();
            }

            _context.WorkSession.Remove(workSession);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool WorkSessionExists(int id)
        {
            return _context.WorkSession.Any(e => e.Id == id);
        }
    }
}
