using Microsoft.EntityFrameworkCore;
using FORA.Models;

namespace FORA.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
        public DbSet<Post> Posts => Set<Post>();
        public DbSet<PostLike> PostLikes => Set<PostLike>();
        public DbSet<Comment> Comments => Set<Comment>();
        public DbSet<PostMedia> PostMedia => Set<PostMedia>();
        public DbSet<UserFollow> UserFollows => Set<UserFollow>();
        public DbSet<PostBookmark> PostBookmarks => Set<PostBookmark>();
        public DbSet<PostPoll> PostPolls => Set<PostPoll>();
        public DbSet<PostPollVote> PostPollVotes => Set<PostPollVote>();
        public DbSet<Notification> Notifications => Set<Notification>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Notification>().Property(n => n.Kind).HasMaxLength(16);
            modelBuilder.Entity<Notification>().HasIndex(n => new { n.RecipientId, n.Id });
            modelBuilder.Entity<Notification>().HasIndex(n => new { n.RecipientId, n.ReadAt });
            modelBuilder.Entity<Notification>().HasOne(n => n.Actor).WithMany()
                .HasForeignKey(n => n.ActorId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<Notification>().HasOne<User>().WithMany()
                .HasForeignKey(n => n.RecipientId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<PostPoll>().HasKey(p => p.PostId);
            modelBuilder.Entity<Post>().HasOne(p => p.Poll).WithOne()
                .HasForeignKey<PostPoll>(p => p.PostId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PostPoll>().HasMany(p => p.Options).WithOne()
                .HasForeignKey(o => o.PostId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PostPollOption>().ToTable("PostPollOptions");
            modelBuilder.Entity<PostPollOption>().HasKey(o => new { o.PostId, o.Number });
            modelBuilder.Entity<PostPollOption>().Property(o => o.Text).HasMaxLength(80);
            modelBuilder.Entity<PostPollOption>().HasMany(o => o.Votes).WithOne()
                .HasForeignKey(v => new { v.PostId, v.OptionNumber }).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PostPollVote>().HasKey(v => new { v.PostId, v.UserId });
            modelBuilder.Entity<PostPollVote>().HasOne<User>().WithMany()
                .HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<UserFollow>().HasKey(x => new { x.FollowerId, x.FollowingId });
            modelBuilder.Entity<UserFollow>().HasOne<User>().WithMany().HasForeignKey(x => x.FollowerId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<UserFollow>().HasOne<User>().WithMany().HasForeignKey(x => x.FollowingId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<PostBookmark>().HasKey(x => new { x.UserId, x.PostId });
            modelBuilder.Entity<PostBookmark>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<PostBookmark>().HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);

            // PostLike composite key
            modelBuilder.Entity<PostLike>()
                .HasKey(pl => new { pl.UserId, pl.PostId });

            modelBuilder.Entity<PostLike>()
                .HasOne<Post>()
                .WithMany()
                .HasForeignKey(pl => pl.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PostLike>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(pl => pl.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            // User - Profile (1-1)
            modelBuilder.Entity<UserProfile>()
                .HasKey(p => p.UserId);

            modelBuilder.Entity<UserProfile>()
                .HasOne(p => p.User)
                .WithOne(u => u.Profile)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Comment - User (RESTRICT)
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Comment - Post (CASCADE)
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Post)
                .WithMany(p => p.Comments)
                .HasForeignKey(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>().HasMany(c => c.Replies).WithOne()
                .HasForeignKey(c => c.ParentCommentId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<Comment>().HasIndex(c => new { c.PostId, c.ParentCommentId, c.Id });

            // PostMedia - Post (CASCADE)
            modelBuilder.Entity<PostMedia>()
                .HasOne(pm => pm.Post)
                .WithMany(p => p.Media)
                .HasForeignKey(pm => pm.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
