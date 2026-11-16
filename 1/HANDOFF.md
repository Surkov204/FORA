# FORA handoff

The active application is the ASP.NET Core API in `1/BE` and the React client
in `1/FE`. Use these projects for development and database updates.

## Delivered features

| Feature | Where to verify |
| --- | --- |
| JWT and OData | Sign in and send the issued Bearer token to `GET /odata/Posts?$top=5`. |
| Live polls | Create a poll in the feed. A vote in a second session updates the first. SQL Server enforces one vote per account. |
| Discussions | Reply one level deep, edit or delete your own comments, and load roots and replies in pages of ten. A reply link opens `/posts/{postId}?comment={commentId}`. |
| Notifications | The bell shows unread replies, comments on your own posts, and new followers. Opening one marks it as read and navigates to the comment or follower. **Mark all as read** clears the inbox badge. |
| Member profiles | Click a name in Discover people, on a post, or on a comment. The member page shows their profile, counts, and paged posts. Follow or unfollow on that page. Profile editing stays at `/profile`. |
| Q&A | Open Q&A from the feed. Post a question with a topic, answer from another account, and accept that answer as the question author. Filter by topic and whether the question has an accepted answer. |
| Post reactions | Choose Like, Helpful, Funny, or Celebrate on a post. Selecting the same reaction removes it. Another selection replaces it. Existing likes remain heart reactions. |

Notifications are stored with the action that produced them and signaled after
commit through the shared SignalR hub at `/api/hubs/polls`. Each user can list or mark read only
their own notifications. A disconnected browser reloads the inbox after
reconnecting. If a linked post or comment was deleted, the destination shows
that it is unavailable.

## Update SQL Server

These migrations apply in order. Existing databases apply only pending entries.

| Migration | Schema change |
| --- | --- |
| `20261115143854_AddSocialFeed` | Follow and bookmark relationships. |
| `20261116132518_AddPostPolls` | Polls, choices, and votes. |
| `20261116142858_AddCommentThreads` | Parent comment, edit/delete timestamps, and pagination indexes. Existing comments remain root comments. |
| `20261116145155_AddNotifications` | Recipient-scoped inbox, read timestamps, and inbox indexes. Notifications begin with actions after the upgrade. |
| `20261116151424_AddQuestionAnswers` | Question topic and accepted answer on a post, and an index for the Q&A board. Existing posts remain ordinary posts. |
| `20261116154546_AddPostReactionKinds` | Adds `PostLikes.Kind` and preserves every existing like as `like`. Each account still has one reaction per post. |

Run the following in PowerShell from the repository root. The example targets
the local SQL Server default instance and the `FORA` database. For LocalDB,
substitute `(localdb)\MSSQLLocalDB` for the server. For another environment, use
its approved connection string and take a database backup before the change.

```powershell
$env:ConnectionStrings__DefaultConnection = 'Server=.;Database=FORA;Integrated Security=true;TrustServerCertificate=true'
# Set Jwt__Key from the environment secret store. For a fresh local-only session
# running PowerShell 7, you can generate it as follows.
if (-not $env:Jwt__Key) {
    $env:Jwt__Key = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}
dotnet restore ./1/BE/FORA.csproj
dotnet ef database update --project ./1/BE/FORA.csproj --startup-project ./1/BE/FORA.csproj
dotnet run --project ./1/BE/FORA.csproj --launch-profile http
```

The API targets .NET 8 and uses EF Core 8. Use `dotnet ef` with a compatible
CLI, such as version 8.0.7. Keep the same JWT key across restarts in an
environment where users need to keep their sessions. The migration command
uses the same configuration as the API, including the JWT startup setting.

To review a SQL script before applying migrations, run
`dotnet ef migrations script --idempotent --project ./1/BE/FORA.csproj --startup-project ./1/BE/FORA.csproj --output .qa/fora-migrations.sql`
after creating the ignored `.qa` directory. Verify the target database with
`SELECT DB_NAME();` and check the result of
`SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;`.
The latest row should end in `_AddPostReactionKinds`.

In a second shell run the frontend.

```powershell
Set-Location 1/FE
npm.cmd ci
npm.cmd run dev -- --host localhost
```

Open `http://localhost:5173/auth`. If the backend uses a port other than
5106, set `FORA_API_URL` in the frontend shell before starting Vite.
For local demos use two verified test accounts. Set up SMTP for ordinary
email verification and account recovery. The pre-existing recovery flow
exposes reset and verification links in API responses and logs. Address
this before exposing the app publicly.

## Verification

Point the test API and the test shell at the same disposable SQL Server
database. Apply the migrations and supply the same `Jwt__Key` in both shells.
Run the frontend, then run the following from the repository root.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./1/BE/scripts/Test-Social.ps1 -CheckUI
```

The suite covers JWT/OData, polls, comment ownership and deep links, member
pagination, notification isolation and read state, Q&A filters and answer
acceptance, reactions, and live events across Chrome sessions. It creates and removes
fixture accounts and posts.
Use `FORA_UI_ORIGIN` and `-BaseUrl` for non-default test ports. Chrome images
are written beneath the ignored `.qa` directory. The accepted answer and
filtered Q&A board are captured in `.qa/question-ui/`. The post reaction
evidence is captured in `.qa/reaction-ui/`.
