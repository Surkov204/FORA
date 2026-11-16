using System.Security.Claims;
using FORA.DTOs;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FORA.Controllers;

[ApiController, Route("api/comments")]
public sealed class CommentsController(ICommentService comments) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [Authorize, HttpPost]
    public async Task<IActionResult> Create(CreateCommentDto request) =>
        Respond(await comments.AddAsync(CurrentUserId, request));

    [Authorize, HttpPut("{commentId:int}")]
    public async Task<IActionResult> Update(int commentId, UpdateCommentDto request) =>
        Respond(await comments.UpdateAsync(CurrentUserId, commentId, request));

    [Authorize, HttpDelete("{commentId:int}")]
    public async Task<IActionResult> Delete(int commentId) =>
        Respond(await comments.DeleteAsync(CurrentUserId, commentId));

    [HttpGet("post/{postId:int}")]
    public async Task<IActionResult> Page(int postId, int? parentCommentId, int? beforeId) =>
        Respond(await comments.GetPageAsync(postId, parentCommentId, beforeId));

    [HttpGet("post/{postId:int}/target/{commentId:int}")]
    public async Task<IActionResult> Target(int postId, int commentId) =>
        Respond(await comments.GetTargetAsync(postId, commentId));

    private IActionResult Respond(ServiceResult result) => StatusCode(result.StatusCode, result.Data);
}
