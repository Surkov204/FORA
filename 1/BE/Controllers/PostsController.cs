using FORA.Data;
using FORA.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.EntityFrameworkCore;

namespace FORA.Controllers;

[Authorize]
public sealed class PostsController(AppDbContext db) : ODataController
{
    [EnableQuery(
        AllowedQueryOptions = AllowedQueryOptions.Select | AllowedQueryOptions.Filter |
            AllowedQueryOptions.OrderBy | AllowedQueryOptions.Top | AllowedQueryOptions.Skip |
            AllowedQueryOptions.Count | AllowedQueryOptions.SkipToken,
        AllowedFunctions = AllowedFunctions.Contains | AllowedFunctions.StartsWith | AllowedFunctions.EndsWith,
        AllowedArithmeticOperators = AllowedArithmeticOperators.None,
        AllowedOrderByProperties = "Id,UserId,CreatedAt",
        MaxSkip = 10000,
        MaxNodeCount = 40,
        PageSize = 20)]
    public IActionResult Get()
    {
        return Ok(db.Posts.AsNoTracking().Select(post => new PostQueryDto
        {
            Id = post.Id,
            UserId = post.UserId,
            Content = post.Content,
            CreatedAt = post.CreatedAt,
            UserDisplayName = post.User.Profile == null ? null : post.User.Profile.DisplayName
        }));
    }
}
