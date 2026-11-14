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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

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
                .OnDelete(DeleteBehavior.Cascade);

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

            // PostMedia - Post (CASCADE)
            modelBuilder.Entity<PostMedia>()
                .HasOne(pm => pm.Post)
                .WithMany(p => p.Media)
                .HasForeignKey(pm => pm.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
