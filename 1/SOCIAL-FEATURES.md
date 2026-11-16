# Social feed

The active application is `BE/` + `FE/`. Sign-in now opens `/feed`.

## Features

- Latest posts with pagination (10 posts per page), refresh, and text/author search.
- Discover people by display name; follow/unfollow and follower/following counts.
- Following feed and private saved-post collection.
- Create posts, like, comment, edit your own post content, and confirm deletion.
- Create a poll with two to four choices and see votes update live.
- Existing profile styling, buttons, cards, avatar components, and mobile layout.

## Start

From `1/BE`, apply migrations and run the API:

```powershell
$jwtKeyBytes = New-Object byte[] 32
$jwtRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $jwtRandom.GetBytes($jwtKeyBytes) } finally { $jwtRandom.Dispose() }
$env:Jwt__Key = [Convert]::ToBase64String($jwtKeyBytes)
dotnet ef database update --project FORA.csproj --startup-project FORA.csproj
dotnet run --launch-profile http
```

Generate a fresh signing key for local use. In a deployed environment, supply
`Jwt__Key` from the environment's secret store. After rotating the previous key,
sign in again to get a token signed with the new key.

The migration command requires `dotnet-ef`.
Connection configuration is in `BE/appsettings.json`.

From `1/FE`:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/feed` and sign in with an existing account.

## Query posts with OData

Send `Authorization: Bearer <token>` using the access token from sign-in.
`GET /odata/Posts` supports `$filter`, `$select`, `$orderby`, `$count`, `$top`
up to 50, and `$skip` up to 10,000. Sort by `Id`, `UserId`, or `CreatedAt`.
Text filters can use `contains`, `startswith`, and `endswith`.
Responses contain up to 20 posts per page. Follow `@odata.nextLink` with the same
authorization header when it is present.

```http
GET http://localhost:5106/odata/Posts?$filter=UserId%20eq%201&$select=Id,Content,CreatedAt&$orderby=CreatedAt%20desc&$top=10&$count=true
Authorization: Bearer <token>
```

The schema at `/odata/$metadata` exposes the fields available for post queries.
Use `/api/social/feed` for the personalized following and saved feeds.

## Live polls

Select **Create poll** in the feed composer, enter a question and two to four
distinct choices, then pick a duration of one hour or one, three, or seven days.
The question and choices are fixed after publishing. Each signed-in account
can cast one vote. Everyone viewing a poll sees its aggregate results, and only
the voter sees which option they selected.

To demo, open the feed in two browser sessions with different accounts. Create
a poll in the first session, refresh the second to discover the new post, then
vote. Each session receives later vote totals without refreshing.

## Post discussions

Open a discussion inline with the comment button, or click the post timestamp
to visit its page. Replies stay one level deep. Replying to an existing reply
prefills the author's name and adds the new reply to the same thread. Authors
can edit or delete their own comments. A deleted root with active replies
displays **Comment deleted** and retains the replies.

Root comments and each thread's replies load in pages of 10. The comments API
returns `items`, `nextBeforeId`, and the post's `total` for
`GET /api/comments/post/{postId}`. Pass `parentCommentId` to page a thread.
Use **Link** on a comment to open it directly, including older replies outside
the first page.

## Database

Migration `AddSocialFeed` adds `UserFollows` and `PostBookmarks` with composite
keys and foreign keys. It also brings the existing `PostLikes` foreign keys
into sync with the model, using `NoAction` on the user relation to avoid SQL
Server multiple cascade paths. Deleting a post also deletes its bookmarks.
Migration `AddPostPolls` adds polls, choices, and votes. The vote key enforces
one vote per account per poll. Deleting the post also removes its poll and
votes.
Migration `AddCommentThreads` adds reply relationships and edit/delete
timestamps. Existing comments become root comments.

## Verification

Run the API against a disposable database. Set
`ConnectionStrings__DefaultConnection` and `Jwt__Key` to the same values in the
API and test shells, then run the script from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1
```

The integration check creates two temporary accounts, uses short-lived test
JWTs, verifies OData authentication and queries, search, following, bookmarks,
ownership, pagination validation, deletion, comment rules, and poll rules, then removes its test records.
It requires Windows SQL access.

Optional Windows Chrome UI check (frontend must also be running):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1 -CheckUI
```

This verifies desktop/mobile rendering, synchronized vote results between two
browser sessions, vote persistence across reload, concurrent-vote handling, and
discussion replies, pagination, direct links, edits, and deletion.
It writes ignored screenshots under `.qa/`. Set `CHROME_PATH` if Chrome is
installed elsewhere. For alternate local ports, set `FORA_API_URL` before
launching Vite, set `FORA_UI_ORIGIN` before running the test, and pass the API
URL as `-BaseUrl` to the test script.

Chat, notifications, file uploads, and SMTP repairs are outside this feature set.
