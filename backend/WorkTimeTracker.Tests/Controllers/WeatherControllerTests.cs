using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using WorkTimeTracker.Controllers;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Services;

namespace WorkTimeTracker.Tests.Controllers;

public class WeatherControllerTests
{
    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(0, 181)]
    [InlineData(0, -181)]
    public async Task GetWeather_ReturnsBadRequest_WhenLatOrLonOutOfRange(double lat, double lon)
    {
        var mockService = new Mock<IWeatherService>();
        var controller = new WeatherController(mockService.Object);

        var result = await controller.GetWeather(lat, lon, pastDays: 0, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        mockService.Verify(
            s => s.GetWeatherAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Theory]
    [InlineData(90, 180)]
    [InlineData(-90, -180)]
    [InlineData(0, 0)]
    public async Task GetWeather_AcceptsBoundaryLatLon(double lat, double lon)
    {
        var mockService = new Mock<IWeatherService>();
        mockService
            .Setup(s => s.GetWeatherAsync(lat, lon, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var controller = new WeatherController(mockService.Object);

        var result = await controller.GetWeather(lat, lon, pastDays: 0, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetWeather_ReturnsOk_WithServiceResult()
    {
        var expected = new Dictionary<string, DayWeatherDto> { ["2026-08-31"] = new() { DateIso = "2026-08-31" } };
        var mockService = new Mock<IWeatherService>();
        mockService
            .Setup(s => s.GetWeatherAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var controller = new WeatherController(mockService.Object);

        var result = await controller.GetWeather(51.5, -0.1, pastDays: 5, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(expected, ok.Value);
    }

    [Fact]
    public async Task GetWeather_ReturnsBadGateway_WhenWeatherApiExceptionThrown()
    {
        var mockService = new Mock<IWeatherService>();
        mockService
            .Setup(s => s.GetWeatherAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new WeatherApiException("upstream failed"));
        var controller = new WeatherController(mockService.Object);

        var result = await controller.GetWeather(51.5, -0.1, pastDays: 5, CancellationToken.None);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status502BadGateway, statusResult.StatusCode);
        Assert.Equal("upstream failed", statusResult.Value);
    }
}
