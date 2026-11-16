param([string]$BaseUrl = 'http://localhost:5106', [switch]$CheckUI)
$ErrorActionPreference = 'Stop'
$config = Get-Content (Join-Path $PSScriptRoot '../appsettings.json') -Raw | ConvertFrom-Json
if (!$env:Jwt__Key) { throw 'Set Jwt__Key to the same secret used by the test API.' }
$connectionString = $env:ConnectionStrings__DefaultConnection
if (!$connectionString) { $connectionString = $config.ConnectionStrings.DefaultConnection }
$connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$connection.Open()
$marker = 'social-smoke-' + [Guid]::NewGuid().ToString('N')
$ids = @()

function Sql([string]$text) {
    $command = $connection.CreateCommand()
    $command.CommandText = $text
    try { $command.ExecuteScalar() } finally { $command.Dispose() }
}
function Encode([byte[]]$bytes) { [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_') }
function Token([int]$id) {
    $header = Encode ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
    $claims = @{ sub = "$id"; iss = $config.Jwt.Issuer; aud = $config.Jwt.Audience; exp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 600 }
    $payload = Encode ([Text.Encoding]::UTF8.GetBytes(($claims | ConvertTo-Json -Compress)))
    $hmac = New-Object Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($env:Jwt__Key)
    try { $signature = Encode ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$header.$payload"))) } finally { $hmac.Dispose() }
    "$header.$payload.$signature"
}
function Api([string]$method, [string]$path, $body = $null, [string]$bearer = $script:tokenA, [string]$prefix = '/api') {
    $parameters = @{ Uri = "$BaseUrl$prefix$path"; Method = $method; ContentType = 'application/json' }
    if ($bearer) { $parameters.Headers = @{ Authorization = "Bearer $bearer" } }
    if ($null -ne $body) { $parameters.Body = $body | ConvertTo-Json -Compress }
    Invoke-RestMethod @parameters
}
function Assert($condition, [string]$message) { if (!$condition) { throw "FAIL: $message" }; Write-Output "PASS: $message" }
function ExpectStatus([int]$expected, [scriptblock]$operation) {
    try { & $operation | Out-Null } catch { if ([int]$_.Exception.Response.StatusCode -eq $expected) { return }; throw }
    throw "Expected HTTP $expected"
}

try {
    # Fixture-only password for signing in through Chrome against the disposable database.
    $passwordHash = if ($CheckUI) { '$2a$11$R11HWcPCb9ntlWVNGbZwduyS9A/xcBvczDUiJlmj.LC7TRCVcaeH.' } else { 'not-a-login-password' }
    foreach ($suffix in @('a','b')) {
        $id = Sql "INSERT INTO Users (Email,PasswordHash,IsEmailVerified,CreatedAt) OUTPUT INSERTED.Id VALUES ('$marker-$suffix@example.invalid','$passwordHash',1,SYSUTCDATETIME());"
        $ids += [int]$id
        Sql "INSERT INTO UserProfiles (UserId,DisplayName,Bio,CreatedAt) VALUES ($id,'$marker-$suffix','Smoke test',SYSUTCDATETIME());" | Out-Null
    }
    $script:tokenA = Token $ids[0]
    $tokenB = Token $ids[1]
    ExpectStatus 401 { Api GET '/social/feed' $null 'invalid-token' }
    Assert $true 'Unauthenticated feed rejected'
    $post = Api POST '/posts' @{ content = "$marker original" } $tokenB
    $postId = $post.id
    ExpectStatus 401 { Api GET '/odata/Posts' -bearer '' -prefix '' }
    ExpectStatus 401 { Api GET '/odata/Posts' -bearer 'invalid-token' -prefix '' }
    ExpectStatus 401 { Api GET '/odata/Posts' -bearer (Token 0) -prefix '' }
    Assert $true 'OData requires a valid user token'
    $filter = [uri]::EscapeDataString("Id eq $postId and contains(Content,'$marker')")
    $query = '/odata/Posts?$filter={0}&$select=Id,Content&$orderby=Id%20desc&$top=1&$count=true' -f $filter
    $odata = Api GET $query -prefix ''
    Assert ($odata.'@odata.count' -eq 1 -and @($odata.value).Count -eq 1 -and
        $odata.value[0].Id -eq $postId -and $odata.value[0].Content -eq "$marker original" -and
        !$odata.value[0].PSObject.Properties['UserId']) 'OData filters, orders, counts, and selects posts'
    ExpectStatus 400 { Api GET '/odata/Posts?$top=51' -prefix '' }
    ExpectStatus 400 { Api GET '/odata/Posts?$skip=10001' -prefix '' }
    ExpectStatus 400 { Api GET '/odata/Posts?$expand=User' -prefix '' }
    ExpectStatus 400 { Api GET '/odata/Posts?$select=PasswordHash' -prefix '' }
    Assert $true 'OData enforces query limits and the post schema'
    $feed = Api GET "/social/feed?q=$marker"
    Assert (@($feed.items).Count -eq 1) 'Search returns matching post'
    $people = Api GET "/social/people?q=$marker"
    Assert (@($people).Count -eq 1 -and $people[0].userId -eq $ids[1]) 'People search excludes self'
    ExpectStatus 400 { Api PUT "/social/follow/$($ids[0])" @{ active = $true } }
    Assert $true 'Cannot follow yourself'
    Api PUT "/social/follow/$($ids[1])" @{ active = $true } | Out-Null
    Api PUT "/social/follow/$($ids[1])" @{ active = $true } | Out-Null
    $following = Api GET "/social/feed?tab=following&q=$marker"
    Assert (@($following.items).Count -eq 1) 'Following feed and repeated follow work'
    $stats = Api GET '/social/stats'
    Assert ($stats.followingCount -eq 1) 'Following count persisted'
    Api PUT "/social/bookmarks/$postId" @{ active = $true } | Out-Null
    Api PUT "/social/bookmarks/$postId" @{ active = $true } | Out-Null
    $saved = Api GET "/social/feed?tab=saved&q=$marker"
    Assert (@($saved.items).Count -eq 1 -and $saved.items[0].isSaved) 'Saved feed and repeated save work'
    if ($CheckUI) {
        @{ token = $script:tokenA } | ConvertTo-Json -Compress | node (Join-Path $PSScriptRoot 'Test-FeedUI.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Browser UI verification failed' }
    }
    $otherSaved = Api GET "/social/feed?tab=saved&q=$marker" $null $tokenB
    Assert (@($otherSaved.items).Count -eq 0) 'Saved posts are private per account'
    ExpectStatus 403 { Api PUT "/social/posts/$postId" @{ content = 'Unauthorized edit' } }
    Assert $true 'Cannot edit another user post'
    ExpectStatus 400 { Api PUT "/social/posts/$postId" @{ content = '   ' } $tokenB }
    Assert $true 'Empty edit rejected'
    Api PUT "/social/posts/$postId" @{ content = "$marker edited" } $tokenB | Out-Null
    $edited = Api GET "/social/feed?q=$marker"
    Assert ($edited.items[0].content -eq "$marker edited") 'Owner edit persisted'
    ExpectStatus 400 { Api GET '/social/feed?page=0' }
    Assert $true 'Invalid pagination rejected'
    Api PUT "/social/bookmarks/$postId" @{ active = $false } | Out-Null
    $saved = Api GET "/social/feed?tab=saved&q=$marker"
    Assert (@($saved.items).Count -eq 0) 'Unsave removes saved post'
    Api PUT "/social/follow/$($ids[1])" @{ active = $false } | Out-Null
    $following = Api GET "/social/feed?tab=following&q=$marker"
    Assert (@($following.items).Count -eq 0) 'Unfollow removes following post'
    Api PUT "/social/bookmarks/$postId" @{ active = $true } | Out-Null
    Api DELETE "/posts/$postId" $null $tokenB | Out-Null
    $saved = Api GET "/social/feed?tab=saved&q=$marker"
    Assert (@($saved.items).Count -eq 0) 'Delete cascades saved post'

    ExpectStatus 401 { Api GET '/notifications' -bearer '' }
    $followInbox = Api GET '/notifications' -bearer $tokenB
    $followAlert = @($followInbox.items | Where-Object kind -eq 'follow')
    Assert ($followAlert.Count -eq 1 -and $followAlert[0].actorId -eq $ids[0] -and $followInbox.unread -eq 1) 'Repeated follow creates one private notification'
    ExpectStatus 404 { Api PUT "/notifications/$($followAlert[0].id)/read" }
    Api PUT "/notifications/$($followAlert[0].id)/read" -bearer $tokenB | Out-Null
    Api PUT "/notifications/$($followAlert[0].id)/read" -bearer $tokenB | Out-Null
    Assert ((Api GET '/notifications' -bearer $tokenB).unread -eq 0) 'Only the recipient can mark an individual notification as read'

    $badPoll = @{ options = @('Same', ' same '); durationHours = 24 }
    ExpectStatus 400 { Api POST '/posts' @{ content = "$marker invalid"; poll = $badPoll } }
    ExpectStatus 401 { Api POST '/hubs/polls/negotiate?negotiateVersion=1' -bearer '' }
    $pollPost = Api POST '/posts' @{
        content = "$marker poll"
        poll = @{ options = @('Library', 'Sports courts', 'Student network'); durationHours = 24 }
    }
    Assert ($pollPost.id -gt 0) 'Poll creation validates distinct options and requires authentication for live updates'
    $pollPath = "/posts/$($pollPost.id)/poll"
    ExpectStatus 409 { Api PUT "/social/posts/$($pollPost.id)" @{ content = 'Different poll question' } }
    ExpectStatus 400 { Api PUT "$pollPath/vote" @{ optionNumber = 4 } }
    ExpectStatus 401 { Api PUT "$pollPath/vote" @{ optionNumber = 1 } -bearer '' }
    $vote = Api PUT "$pollPath/vote" @{ optionNumber = 2 }
    $retry = Api PUT "$pollPath/vote" @{ optionNumber = 2 }
    ExpectStatus 409 { Api PUT "$pollPath/vote" @{ optionNumber = 1 } }
    Assert ($vote.myOption -eq 2 -and $retry.options[1].voteCount -eq 1) 'Vote is authenticated, idempotent, and immutable'
    $otherView = Api GET $pollPath -bearer $tokenB
    $profilePosts = Api GET "/profile/$($ids[0])/posts" -bearer $tokenB
    $profilePoll = ($profilePosts | Where-Object { $_.id -eq $pollPost.id }).poll
    Assert ($null -eq $otherView.myOption -and $null -ne $profilePoll -and
        $profilePoll.options[1].voteCount -eq 1) 'Poll results omit other voters and appear on the profile'
    Sql "UPDATE PostPolls SET ClosesAt = DATEADD(minute, -1, SYSDATETIMEOFFSET()) WHERE PostId = $($pollPost.id);" | Out-Null
    ExpectStatus 409 { Api PUT "$pollPath/vote" @{ optionNumber = 1 } -bearer $tokenB }
    Api DELETE "/posts/$($pollPost.id)" | Out-Null
    ExpectStatus 404 { Api GET $pollPath }
    Assert ((Sql "SELECT COUNT(*) FROM PostPollVotes WHERE PostId = $($pollPost.id);") -eq 0) 'Expired polls reject new votes and deleting a post removes its poll'

    if ($CheckUI) {
        Sql "UPDATE UserProfiles SET DisplayName = 'Minh' WHERE UserId = $($ids[0]); UPDATE UserProfiles SET DisplayName = 'Lan' WHERE UserId = $($ids[1]);" | Out-Null
        @{ tokenA = $script:tokenA; tokenB = $tokenB; question = 'Which project should we choose?';
            email = "$marker-a@example.invalid"; password = 'Fora-Disposable-UI!77' } |
            ConvertTo-Json -Compress | node (Join-Path $PSScriptRoot 'Test-SocialUI.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Browser poll or discussion verification failed' }
    }

    $discussion = Api POST '/posts' @{ content = "$marker discussion"; mediaUrls = @('https://example.invalid/image.png') }
    $discussionId = $discussion.id
    $root = (Api POST '/comments' @{ postId = $discussionId; content = 'Original comment' }).comment
    $reply = (Api POST '/comments' @{ postId = $discussionId; parentCommentId = $root.id; content = 'Reply' } $tokenB).comment
    $authorInbox = Api GET '/notifications'
    $replyAlert = @($authorInbox.items | Where-Object commentId -eq $reply.id)
    Assert ($replyAlert.Count -eq 1 -and $replyAlert[0].kind -eq 'reply' -and
        $replyAlert[0].postId -eq $discussionId -and $replyAlert[0].actorId -eq $ids[1]) 'Reply notification deduplicates the post author and comment author'
    $nestedReply = (Api POST '/comments' @{ postId = $discussionId; parentCommentId = $root.id; replyToCommentId = $reply.id; content = 'Direct response' }).comment
    $directInbox = Api GET '/notifications' -bearer $tokenB
    Assert ($nestedReply.parentCommentId -eq $root.id -and
        @($directInbox.items | Where-Object { $_.commentId -eq $nestedReply.id -and $_.kind -eq 'reply' }).Count -eq 1) 'Replying to a reply notifies its author and stays one level deep'
    Api DELETE "/comments/$($nestedReply.id)" | Out-Null
    Api PUT '/notifications/read-all' | Out-Null
    Assert ((Api GET '/notifications').unread -eq 0) 'Read-all clears the viewer unread count'
    ExpectStatus 400 { Api POST '/comments' @{ postId = $discussionId; parentCommentId = $reply.id; content = 'Too deep' } }
    ExpectStatus 403 { Api PUT "/comments/$($root.id)" @{ content = 'Not the author' } $tokenB }
    ExpectStatus 403 { Api DELETE "/comments/$($root.id)" $null $tokenB }
    ExpectStatus 401 { Api DELETE "/comments/$($root.id)" $null '' }
    $another = Api POST '/posts' @{ content = "$marker another discussion" }
    ExpectStatus 400 { Api POST '/comments' @{ postId = $another.id; parentCommentId = $root.id; content = 'Wrong post' } }
    ExpectStatus 404 { Api GET "/comments/post/$($another.id)/target/$($reply.id)" }
    $edited = Api PUT "/comments/$($root.id)" @{ content = 'Edited comment' }
    Assert ($edited.comment.editedAt -and $edited.comment.replyCount -eq 1) 'Only the author can edit a comment and reply depth and post scope are enforced'
    $tombstone = Api DELETE "/comments/$($root.id)"
    $target = Api GET "/comments/post/$discussionId/target/$($reply.id)"
    Assert ($tombstone.total -eq 1 -and $target.root.isDeleted -and !$target.root.content -and
        $target.root.userId -eq 0 -and $target.target.content -eq 'Reply') 'Deleting a root removes its content and identity while preserving the reply and direct link'
    ExpectStatus 400 { Api POST '/comments' @{ postId = $discussionId; parentCommentId = $root.id; content = 'Closed thread' } }
    $removed = Api DELETE "/comments/$($reply.id)" $null $tokenB
    ExpectStatus 404 { Api GET "/comments/post/$discussionId/target/$($root.id)" }
    $details = Api GET "/social/posts/$discussionId"
    Assert ($removed.total -eq 0 -and !$removed.root -and $details.commentCount -eq 0) 'Deleting the last reply hides the deleted root and updates the post count'
    Api POST "/likes/$discussionId" $null $tokenB | Out-Null
    Api DELETE "/posts/$discussionId" | Out-Null
    $remaining = Sql "SELECT (SELECT COUNT(*) FROM Comments WHERE PostId = $discussionId) + (SELECT COUNT(*) FROM PostLikes WHERE PostId = $discussionId) + (SELECT COUNT(*) FROM PostMedia WHERE PostId = $discussionId);"
    Assert ($remaining -eq 0) 'Removing a post also removes its comment tree, likes and media'

    foreach ($number in 1..21) {
        Api POST '/posts' @{ content = "$marker page $number" } $tokenB | Out-Null
    }
    $query = '/odata/Posts?$filter=UserId%20eq%20{0}&$select=Content&$orderby=CreatedAt%20desc&$top=21' -f $ids[1]
    $firstPage = Api GET $query -prefix ''
    Assert (@($firstPage.value).Count -eq 20 -and $firstPage.'@odata.nextLink') 'OData provides a continuation after 20 posts'
    $nextPath = ([uri]$firstPage.'@odata.nextLink').PathAndQuery
    $secondPage = Api GET $nextPath -prefix ''
    Assert (@($secondPage.value).Count -eq 1 -and
        $secondPage.value[0].Content -eq "$marker page 1" -and
        !$secondPage.'@odata.nextLink') 'OData continuation returns the remaining post'
    $member = Api GET "/social/members/$($ids[1])/posts"
    $nextMember = Api GET "/social/members/$($ids[1])/posts?beforeId=$($member.nextBeforeId)"
    Assert ($member.items.Count -eq 10 -and $nextMember.items.Count -eq 10 -and
        @($member.items + $nextMember.items | Where-Object userId -ne $ids[1]).Count -eq 0 -and
        $nextMember.items[0].id -lt $member.items[-1].id) 'Member posts are filtered and paginated by author'

    ExpectStatus 400 { Api POST '/posts' @{ content = 'Unknown topic'; questionTopic = 'unknown' } }
    ExpectStatus 400 { Api GET '/social/feed?tab=questions&status=unknown' }
    $question = Api POST '/posts' @{ content = "$marker SQL question"; questionTopic = 'sql-server' }
    $questionId = $question.id
    $answerPath = "/questions/$questionId/accepted-answer"
    $answer = (Api POST '/comments' @{ postId = $questionId; content = 'Run the EF migration.' } $tokenB).comment
    $nested = (Api POST '/comments' @{ postId = $questionId; parentCommentId = $answer.id; content = 'From the repository root.' }).comment
    ExpectStatus 401 { Api PUT $answerPath @{ commentId = $answer.id } '' }
    ExpectStatus 403 { Api PUT $answerPath @{ commentId = $answer.id } $tokenB }
    ExpectStatus 400 { Api PUT $answerPath @{ commentId = $nested.id } }
    ExpectStatus 400 { Api PUT $answerPath @{ commentId = $reply.id } }
    $openQuestions = Api GET "/social/feed?tab=questions&status=open&topic=sql-server&q=$marker"
    Assert (@($openQuestions.items).Count -eq 1 -and $openQuestions.items[0].id -eq $questionId) 'Question topic and unsolved filter exclude ordinary posts'
    foreach ($number in 1..10) {
        Api POST '/comments' @{ postId = $questionId; content = "Later answer $number" } | Out-Null
    }
    Api PUT $answerPath @{ commentId = $answer.id } | Out-Null
    Api PUT $answerPath @{ commentId = $answer.id } | Out-Null
    $solved = Api GET "/social/feed?tab=questions&status=solved&topic=sql-server&q=$marker"
    $pinned = Api GET "/comments/post/$questionId"
    $answerInbox = Api GET '/notifications' -bearer $tokenB
    Assert ($solved.items[0].acceptedAnswerId -eq $answer.id -and $pinned.acceptedAnswer.id -eq $answer.id -and
        @($pinned.items | Where-Object id -eq $answer.id).Count -eq 0 -and
        @($answerInbox.items | Where-Object { $_.kind -eq 'answer-accepted' -and $_.commentId -eq $answer.id }).Count -eq 1) 'Acceptance pins older answers and sends one private notification'
    Api PUT $answerPath @{ commentId = $null } | Out-Null
    Assert ($null -eq (Api GET "/social/posts/$questionId").acceptedAnswerId) 'Author can reopen a solved question'
    Api PUT $answerPath @{ commentId = $answer.id } | Out-Null
    $deletedAnswer = Api DELETE "/comments/$($answer.id)" $null $tokenB
    ExpectStatus 400 { Api PUT $answerPath @{ commentId = $answer.id } }
    Assert ($null -eq $deletedAnswer.acceptedAnswerId -and $null -eq (Api GET "/social/posts/$questionId").acceptedAnswerId) 'Deleting the accepted answer reopens the question'

    $reactionPost = Api POST '/posts' @{ content = "$marker reaction rules" }
    $reactionId = $reactionPost.id
    $reactionPath = "/likes/$reactionId"
    ExpectStatus 401 { Api PUT $reactionPath @{ kind = 'helpful' } '' }
    ExpectStatus 400 { Api PUT $reactionPath @{ kind = 'unknown' } }
    ExpectStatus 400 { Api PUT $reactionPath @{} }
    $liked = Api POST $reactionPath
    $helpful = Api PUT $reactionPath @{ kind = 'helpful' }
    $same = Api PUT $reactionPath @{ kind = 'helpful' }
    Assert ($liked.isLiked -and $liked.likeCount -eq 1 -and !$helpful.isLiked -and
        $same.likeCount -eq 0 -and $same.reactions.helpful -eq 1 -and $same.reactions.myReaction -eq 'helpful') 'Legacy like and reaction switching update counts without duplicates'
    $other = Api PUT $reactionPath @{ kind = 'celebrate' } $tokenB
    $viewer = Api GET "/social/posts/$reactionId"
    Assert ($other.reactions.helpful -eq 1 -and $viewer.reactions.celebrate -eq 1 -and
        $viewer.reactions.myReaction -eq 'helpful') 'Reaction counts are shared and the selected reaction is viewer-specific'
    $removed = Api PUT $reactionPath @{ kind = $null }
    $last = Api PUT $reactionPath @{ kind = $null }
    Assert ($null -eq $removed.reactions.myReaction -and $last.reactions.helpful -eq 0 -and
        $last.reactions.celebrate -eq 1) 'Removing a reaction stays idempotent and preserves another user’s reaction'
} finally {
    if ($ids.Count) {
        $list = $ids -join ','
        Sql "DELETE FROM Notifications WHERE RecipientId IN ($list) OR ActorId IN ($list); DELETE FROM PostBookmarks WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM UserFollows WHERE FollowerId IN ($list) OR FollowingId IN ($list); DELETE FROM Comments WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM PostLikes WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM Posts WHERE UserId IN ($list); DELETE FROM UserProfiles WHERE UserId IN ($list); DELETE FROM Users WHERE Id IN ($list);" | Out-Null
    }
    $connection.Dispose()
}
