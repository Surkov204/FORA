param([string]$BaseUrl = 'http://localhost:5106', [switch]$CheckUI)
$ErrorActionPreference = 'Stop'
$config = Get-Content (Join-Path $PSScriptRoot '../appsettings.json') -Raw | ConvertFrom-Json
$connection = New-Object System.Data.SqlClient.SqlConnection($config.ConnectionStrings.DefaultConnection)
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
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($config.Jwt.Key)
    try { $signature = Encode ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$header.$payload"))) } finally { $hmac.Dispose() }
    "$header.$payload.$signature"
}
function Api([string]$method, [string]$path, $body = $null, [string]$bearer = $script:tokenA) {
    $parameters = @{ Uri = "$BaseUrl/api$path"; Method = $method; Headers = @{ Authorization = "Bearer $bearer" }; ContentType = 'application/json' }
    if ($null -ne $body) { $parameters.Body = $body | ConvertTo-Json -Compress }
    Invoke-RestMethod @parameters
}
function Assert($condition, [string]$message) { if (!$condition) { throw "FAIL: $message" }; Write-Output "PASS: $message" }
function ExpectStatus([int]$expected, [scriptblock]$operation) {
    try { & $operation | Out-Null } catch { if ([int]$_.Exception.Response.StatusCode -eq $expected) { return }; throw }
    throw "Expected HTTP $expected"
}

try {
    foreach ($suffix in @('a','b')) {
        $id = Sql "INSERT INTO Users (Email,PasswordHash,IsEmailVerified,CreatedAt) OUTPUT INSERTED.Id VALUES ('$marker-$suffix@example.invalid','not-a-login-password',1,SYSUTCDATETIME());"
        $ids += [int]$id
        Sql "INSERT INTO UserProfiles (UserId,DisplayName,Bio,CreatedAt) VALUES ($id,'$marker-$suffix','Smoke test',SYSUTCDATETIME());" | Out-Null
    }
    $script:tokenA = Token $ids[0]
    $tokenB = Token $ids[1]
    ExpectStatus 401 { Api GET '/social/feed' $null 'invalid-token' }
    Assert $true 'Unauthenticated feed rejected'
    $post = Api POST '/posts' @{ content = "$marker original" } $tokenB
    $postId = $post.id
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
} finally {
    if ($ids.Count) {
        $list = $ids -join ','
        Sql "DELETE FROM PostBookmarks WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM UserFollows WHERE FollowerId IN ($list) OR FollowingId IN ($list); DELETE FROM Comments WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM PostLikes WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM Posts WHERE UserId IN ($list); DELETE FROM UserProfiles WHERE UserId IN ($list); DELETE FROM Users WHERE Id IN ($list);" | Out-Null
    }
    $connection.Dispose()
}
