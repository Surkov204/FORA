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
../../.local-tools/dotnet-ef.exe database update --project FORA.csproj --startup-project FORA.csproj
dotnet run --launch-profile http
```

Alternatively install `dotnet-ef` 8.0.7 and use `dotnet ef database update`.
Connection configuration is in `BE/appsettings.json`.

From `1/FE`:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/feed` and sign in with an existing account.

## Database

Migration `AddSocialFeed` adds `UserFollows` and `PostBookmarks` with composite
keys and foreign keys. It also brings the existing `PostLikes` foreign keys
into sync with the model, using `NoAction` on the user relation to avoid SQL
Server multiple cascade paths. Deleting a post also deletes its bookmarks.

## Verification

With the API running, from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1
```

The integration check creates two temporary accounts, uses short-lived test
JWTs, verifies search, following, bookmarks, ownership, pagination validation,
and deletion, then removes its test records. It requires Windows SQL access.

Optional Windows Chrome UI check (frontend must also be running):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1 -CheckUI
```

This verifies desktop/mobile rendering and writes ignored screenshots under
`.qa/`. Set `CHROME_PATH` if Chrome is installed in another location.

Chat, notifications, file uploads, and SMTP repairs are outside this feature set.
