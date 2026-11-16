using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FORA.Migrations
{
    /// <inheritdoc />
    public partial class AddPostReactionKinds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "PostLikes",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "like");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Kind",
                table: "PostLikes");
        }
    }
}
