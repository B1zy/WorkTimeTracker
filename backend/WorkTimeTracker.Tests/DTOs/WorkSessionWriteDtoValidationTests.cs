using System.ComponentModel.DataAnnotations;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Models;

namespace WorkTimeTracker.Tests.DTOs;

public class WorkSessionWriteDtoValidationTests
{
    private static WorkSessionWriteDto MakeValidDto() => new()
    {
        Name = "Test",
        Description = "",
        Location = WorkLocation.InOffice,
        EntryType = EntryType.Working,
        Date = new DateOnly(2026, 8, 31),
        Start = new TimeOnly(9, 0),
        End = new TimeOnly(17, 0),
    };

    private static List<ValidationResult> Validate(WorkSessionWriteDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void ValidDto_PassesValidation()
    {
        Assert.Empty(Validate(MakeValidDto()));
    }

    [Fact]
    public void Name_AllowsEmptyString()
    {
        // Intentional: the frontend relies on this to fall back to the entry
        // type label on the timeline. See the [StringLength] comment on the DTO.
        var dto = MakeValidDto();
        dto.Name = "";

        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Name_AllowsExactly200Characters()
    {
        var dto = MakeValidDto();
        dto.Name = new string('a', 200);

        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Name_Rejects201Characters()
    {
        var dto = MakeValidDto();
        dto.Name = new string('a', 201);

        var results = Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains("Name"));
    }

    [Fact]
    public void Description_AllowsExactly1000Characters()
    {
        var dto = MakeValidDto();
        dto.Description = new string('a', 1000);

        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Description_Rejects1001Characters()
    {
        var dto = MakeValidDto();
        dto.Description = new string('a', 1001);

        var results = Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains("Description"));
    }
}
