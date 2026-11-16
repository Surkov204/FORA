using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FORA.Migrations
{
    /// <inheritdoc />
    public partial class AddPostPolls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PostPolls",
                columns: table => new
                {
                    PostId = table.Column<int>(type: "int", nullable: false),
                    ClosesAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostPolls", x => x.PostId);
                    table.ForeignKey(
                        name: "FK_PostPolls_Posts_PostId",
                        column: x => x.PostId,
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostPollOptions",
                columns: table => new
                {
                    PostId = table.Column<int>(type: "int", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostPollOptions", x => new { x.PostId, x.Number });
                    table.ForeignKey(
                        name: "FK_PostPollOptions_PostPolls_PostId",
                        column: x => x.PostId,
                        principalTable: "PostPolls",
                        principalColumn: "PostId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostPollVotes",
                columns: table => new
                {
                    PostId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    OptionNumber = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostPollVotes", x => new { x.PostId, x.UserId });
                    table.ForeignKey(
                        name: "FK_PostPollVotes_PostPollOptions_PostId_OptionNumber",
                        columns: x => new { x.PostId, x.OptionNumber },
                        principalTable: "PostPollOptions",
                        principalColumns: new[] { "PostId", "Number" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostPollVotes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_PostPollVotes_PostId_OptionNumber",
                table: "PostPollVotes",
                columns: new[] { "PostId", "OptionNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_PostPollVotes_UserId",
                table: "PostPollVotes",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PostPollVotes");

            migrationBuilder.DropTable(
                name: "PostPollOptions");

            migrationBuilder.DropTable(
                name: "PostPolls");
        }
    }
}
