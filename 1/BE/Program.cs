using FORA.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using FORA.Services;
using FORA.Repositories;
var builder = WebApplication.CreateBuilder(args);

// 🔹 ADD SERVICES
builder.Services.AddControllers();
builder.Services.AddScoped<ICommentService, CommentService>();
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddScoped<ICommentRepository, CommentRepository>();
builder.Services.AddScoped<ILikeRepository, LikeRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IProfileRepository, ProfileRepository>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILikeService, LikeService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IProfileService, ProfileService>();

// 🔹 ADD SWAGGER (THIẾU CÁI NÀY)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 🔹 ADD DB CONTEXT
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"))
);

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])
            )
        };
    });

var frontendBaseUrl = builder.Configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
builder.Services.AddCors(options =>
{
    options.AddPolicy("ForaClient", policy =>
    {
        if (!string.IsNullOrWhiteSpace(frontendBaseUrl))
        {
            policy.WithOrigins(frontendBaseUrl)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
            return;
        }

        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();


// app.UseDefaultFiles(new DefaultFilesOptions
// {
//     DefaultFileNames = new List<string> { "login.html" }
// });

app.UseStaticFiles();
// 🔹 ENABLE SWAGGER (CHỈ CẦN DEV)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("ForaClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
// app.MapFallbackToFile("login.html");
app.Run();
