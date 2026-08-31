using Microsoft.AspNetCore.Mvc;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Services;

namespace WorkTimeTracker.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WeatherController : ControllerBase
    {
        private readonly IWeatherService _weatherService;

        public WeatherController(IWeatherService weatherService)
        {
            _weatherService = weatherService;
        }

        // GET: api/Weather?lat=51.5&lon=-0.1&pastDays=92
        // Proxies weatherapi.com so the API key stays server-side. Response is
        // keyed by ISO date, matching the frontend's DayWeather map shape.
        [HttpGet]
        public async Task<ActionResult<Dictionary<string, DayWeatherDto>>> GetWeather(
            [FromQuery] double lat,
            [FromQuery] double lon,
            [FromQuery] int pastDays,
            CancellationToken cancellationToken)
        {
            if (lat is < -90 or > 90 || lon is < -180 or > 180)
            {
                return BadRequest("lat/lon out of range.");
            }

            try
            {
                var result = await _weatherService.GetWeatherAsync(lat, lon, pastDays, cancellationToken);
                return Ok(result);
            }
            catch (WeatherApiException ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, ex.Message);
            }
        }
    }
}
