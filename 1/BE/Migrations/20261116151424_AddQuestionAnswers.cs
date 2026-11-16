using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FORA.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AcceptedAnswerId",
                table: "Posts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuestionTopic",
                table: "Posts",
                type: "nvarchar(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Posts_QuestionTopic_Id",
                table: "Posts",
                columns: new[] { "QuestionTopic", "Id" },
                filter: "[QuestionTopic] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Posts_QuestionTopic_Id",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "AcceptedAnswerId",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "QuestionTopic",
                table: "Posts");
        }
    }
}
