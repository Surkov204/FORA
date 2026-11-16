using FORA.Data;
using FORA.DTOs;
using FORA.Hubs;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.OData;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OData.ModelBuilder;
using System.Security.Claims;
using System.Text;
using FORA.Services;
using FORA.Repositories;
var builder = WebApplication.CreateBuilder(args);

// 🔹 ADD SERVICES
const int maxPostPageSize = 50;
var odataModel = new ODataConventionModelBuilder();
odataModel.EntitySet<PostQueryDto>("Posts");
builder.Services.AddControllers().AddOData(options => options
    .Select()
    .Filter()
    .OrderBy()
    .Count()
    .SkipToken()
    .SetMaxTop(maxPostPageSize)
    .AddRouteComponents("odata", odataModel.GetEdmModel()));
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
builder.Services.AddSignalR();
builder.Services.AddSingleton<NotificationPublisher>();

// 🔹 ADD DB CONTEXT
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"))
);

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Set Jwt__Key to a secret of at least 32 bytes.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                if (!int.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                    || userId <= 0)
                {
                    context.Fail("The token must identify a user.");
                }

                return Task.CompletedTask;
            }
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
app.MapHub<CommunityHub>("/api/hubs/polls", options =>
{
    options.Transports = HttpTransportType.LongPolling;
    options.CloseOnAuthenticationExpiration = true;
});
// app.MapFallbackToFile("login.html");
app.Run();
