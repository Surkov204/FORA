using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FORA.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailVerificationToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationExpiresAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationTokenHash",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsEmailVerified",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailVerificationExpiresAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerificationTokenHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsEmailVerified",
                table: "Users");
        }
    }
}
