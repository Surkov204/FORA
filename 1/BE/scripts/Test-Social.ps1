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
} finally {
    if ($ids.Count) {
        $list = $ids -join ','
        Sql "DELETE FROM PostBookmarks WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM UserFollows WHERE FollowerId IN ($list) OR FollowingId IN ($list); DELETE FROM Comments WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM PostLikes WHERE UserId IN ($list) OR PostId IN (SELECT Id FROM Posts WHERE UserId IN ($list)); DELETE FROM Posts WHERE UserId IN ($list); DELETE FROM UserProfiles WHERE UserId IN ($list); DELETE FROM Users WHERE Id IN ($list);" | Out-Null
    }
    $connection.Dispose()
}
