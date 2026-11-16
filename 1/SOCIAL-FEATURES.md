# Social feed

The active application is `BE/` + `FE/`. Sign-in now opens `/feed`.

## Features

- Latest posts with pagination (10 posts per page), refresh, and text/author search.
- Discover people by display name; follow/unfollow and follower/following counts.
- Following feed and private saved-post collection.
- Create posts, like, comment, edit your own post content, and confirm deletion.
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

## Database

Migration `AddSocialFeed` adds `UserFollows` and `PostBookmarks` with composite
keys and foreign keys. It also brings the existing `PostLikes` foreign keys
into sync with the model, using `NoAction` on the user relation to avoid SQL
Server multiple cascade paths. Deleting a post also deletes its bookmarks.

## Verification

Run the API against a disposable database. Set
`ConnectionStrings__DefaultConnection` and `Jwt__Key` to the same values in the
API and test shells, then run the script from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1
```

The integration check creates two temporary accounts, uses short-lived test
JWTs, verifies OData authentication and queries, search, following, bookmarks,
ownership, pagination validation, and deletion, then removes its test records.
It requires Windows SQL access.

Optional Windows Chrome UI check (frontend must also be running):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1 -CheckUI
```

This verifies desktop/mobile rendering and writes ignored screenshots under
`.qa/`. Set `CHROME_PATH` if Chrome is installed in another location.

Chat, notifications, file uploads, and SMTP repairs are outside this feature set.
