using System.Net;
using System.Net.Mail;

namespace FORA.Services
{

  public class EmailSender : IEmailSender
  {
    private readonly IConfiguration _config;

    public EmailSender(IConfiguration config)
    {
      _config = config;
    }

    public async Task SendResetPasswordEmailAsync(string toEmail, string resetUrl)
    {
      var fromName = _config["Email:FromName"];
      var fromEmail = _config["Email:FromEmail"];
      var host = _config["Email:SmtpHost"];
      var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
      var user = _config["Email:SmtpUser"];
      var pass = _config["Email:SmtpPass"];
      var useSsl = bool.Parse(_config["Email:UseSsl"] ?? "true");

      Console.WriteLine("------ EmailSender Debug (RESET) ------");
      Console.WriteLine($"Host: {host}:{port} SSL:{useSsl}");
      Console.WriteLine($"From: {fromEmail} ({fromName})");
      Console.WriteLine($"User: {user}");
      Console.WriteLine($"To: {toEmail}");
      Console.WriteLine($"ResetUrl: {resetUrl}");
      Console.WriteLine($"PassLen: {pass?.Length}");
      Console.WriteLine("--------------------------------------");

      var subject = "Reset your Fora password";
      var logoUrl = "https://res.cloudinary.com/do48qpmut/image/upload/v1769335183/fora/img_1769335177250.jpg";

      var body = $@"
<div style='margin:0;padding:0;background:#000000;color:#e7e9ea;font-family:Inter,Arial,sans-serif;line-height:1.6'>
  <div style='max-width:560px;margin:0 auto;padding:28px 16px'>

    <!-- Header -->
    <div style='display:flex;align-items:center;gap:12px;margin-bottom:16px'>
      <!-- Logo badge -->
      <div style='display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:999px;
                  border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25)'>
        <div style='width:34px;height:34px;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.06);
                    border:1px solid rgba(255,255,255,.12)'>
          <img src='{logoUrl}'
               width='34' height='34'
               alt='Fora'
               style='display:block;width:34px;height:34px;object-fit:cover;border:0;outline:none;text-decoration:none' />
        </div>

        <div style='display:flex;flex-direction:column;line-height:1.1'>
          <div style='font-size:14px;font-weight:900;letter-spacing:.2px'>Fora</div>
          <div style='font-size:12px;color:#71767b'>Password reset</div>
        </div>
      </div>

      <!-- Accent dot -->
      <div style='margin-left:auto;width:10px;height:10px;border-radius:999px;background:#f91880;
                  box-shadow:0 0 0 6px rgba(249,24,128,0.16)'></div>
    </div>

    <!-- Card -->
    <div style='background:#16181c;border:1px solid #2f3336;border-radius:16px;overflow:hidden'>
      <div style='padding:20px 20px 10px'>
        <div style='font-size:20px;font-weight:800;line-height:1.2;margin:0 0 6px'>Reset your password</div>
        <div style='font-size:14px;color:#71767b;margin:0'>
          We received a request to reset your password. Click the button below to set a new one.
        </div>
      </div>

      <div style='padding:14px 20px 20px'>
        <!-- Button -->
        <a href='{resetUrl}'
           style='display:inline-block;background:#f91880;color:#ffffff;text-decoration:none;
                  padding:12px 18px;border-radius:999px;font-weight:800;font-size:14px'>
          Reset Password
        </a>

        <!-- Divider -->
        <div style='height:1px;background:#2f3336;margin:18px 0'></div>

        <!-- Fallback link -->
        <div style='font-size:13px;color:#71767b;margin-bottom:8px'>
          If the button doesn’t work, copy and paste this link into your browser:
        </div>
        <div style='word-break:break-all;font-size:13px'>
          <a href='{resetUrl}' style='color:#f91880;text-decoration:none'>{resetUrl}</a>
        </div>

        <!-- Expire note -->
        <div style='margin-top:16px;font-size:12px;color:#71767b'>
          This link expires in <b style='color:#e7e9ea'>30 minutes</b>.
          If you didn’t request this, you can ignore this email.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style='margin-top:14px;font-size:12px;color:#71767b;text-align:center'>
      © {DateTime.UtcNow.Year} Fora • Sent from a no-reply address
    </div>

  </div>
</div>";

      using var msg = new MailMessage();
      msg.From = new MailAddress(fromEmail!, fromName);
      msg.To.Add(toEmail);
      msg.Subject = subject;
      msg.Body = body;
      msg.IsBodyHtml = true;

      using var client = new SmtpClient(host, port);
      client.EnableSsl = useSsl;
      client.Credentials = new NetworkCredential(user, pass);

      await client.SendMailAsync(msg);
    }


    public async Task SendVerifyEmailAsync(string toEmail, string verifyUrl)
    {
      var fromName = _config["Email:FromName"];
      var fromEmail = _config["Email:FromEmail"];
      var host = _config["Email:SmtpHost"];
      var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
      var user = _config["Email:SmtpUser"];
      var pass = _config["Email:SmtpPass"];
      var useSsl = bool.Parse(_config["Email:UseSsl"] ?? "true");

      Console.WriteLine("------ EmailSender Debug ------");
      Console.WriteLine($"Host: {host}:{port} SSL:{useSsl}");
      Console.WriteLine($"From: {fromEmail} ({fromName})");
      Console.WriteLine($"User: {user}");
      Console.WriteLine($"To: {toEmail}");
      Console.WriteLine($"VerifyUrl: {verifyUrl}");
      Console.WriteLine($"PassLen: {pass?.Length}"); // ✅ không in pass, chỉ in length

      Console.WriteLine("------------------------------");

      var subject = "Verify your Fora account";
      var logoUrl = "https://res.cloudinary.com/do48qpmut/image/upload/v1769335183/fora/img_1769335177250.jpg";

      var body = $@"
<div style='margin:0;padding:0;background:#000000;color:#e7e9ea;font-family:Inter,Arial,sans-serif;line-height:1.6'>
  <div style='max-width:560px;margin:0 auto;padding:28px 16px'>

    <!-- Header -->
    <div style='display:flex;align-items:center;gap:12px;margin-bottom:16px'>
      <!-- Logo badge -->
      <div style='display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:999px;
                  border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25)'>
        <div style='width:34px;height:34px;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.06);
                    border:1px solid rgba(255,255,255,.12)'>
          <img src='{logoUrl}'
               width='34' height='34'
               alt='Fora'
               style='display:block;width:34px;height:34px;object-fit:cover;border:0;outline:none;text-decoration:none' />
        </div>

        <div style='display:flex;flex-direction:column;line-height:1.1'>
          <div style='font-size:14px;font-weight:900;letter-spacing:.2px'>Fora</div>
          <div style='font-size:12px;color:#71767b'>Verify your account</div>
        </div>
      </div>

      <!-- Accent dot (optional) -->
      <div style='margin-left:auto;width:10px;height:10px;border-radius:999px;background:#1d9bf0;
                  box-shadow:0 0 0 6px rgba(29,155,240,0.18)'></div>
    </div>

    <!-- Card -->
    <div style='background:#16181c;border:1px solid #2f3336;border-radius:16px;overflow:hidden'>
      <div style='padding:20px 20px 10px'>
        <div style='font-size:20px;font-weight:800;line-height:1.2;margin:0 0 6px'>Verify your email</div>
        <div style='font-size:14px;color:#71767b;margin:0'>
          Welcome to Fora 👋 Please confirm your email address to activate your account.
        </div>
      </div>

      <div style='padding:14px 20px 20px'>
        <!-- Button -->
        <a href='{verifyUrl}'
           style='display:inline-block;background:#1d9bf0;color:#ffffff;text-decoration:none;
                  padding:12px 18px;border-radius:999px;font-weight:800;font-size:14px'>
          Verify Email
        </a>

        <!-- Divider -->
        <div style='height:1px;background:#2f3336;margin:18px 0'></div>

        <!-- Fallback link -->
        <div style='font-size:13px;color:#71767b;margin-bottom:8px'>
          If the button doesn’t work, copy and paste this link into your browser:
        </div>
        <div style='word-break:break-all;font-size:13px'>
          <a href='{verifyUrl}' style='color:#1d9bf0;text-decoration:none'>{verifyUrl}</a>
        </div>

        <!-- Expire note -->
        <div style='margin-top:16px;font-size:12px;color:#71767b'>
          This link expires in <b style='color:#e7e9ea'>24 hours</b>. If you didn’t request this, you can ignore this email.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style='margin-top:14px;font-size:12px;color:#71767b;text-align:center'>
      © {DateTime.UtcNow.Year} Fora • Sent from a no-reply address
    </div>

  </div>
</div>";



      using var msg = new MailMessage();
      msg.From = new MailAddress(fromEmail!, fromName);
      msg.To.Add(toEmail);
      msg.Subject = subject;
      msg.Body = body;
      msg.IsBodyHtml = true;

      using var client = new SmtpClient(host, port);
      client.EnableSsl = useSsl;
      client.Credentials = new NetworkCredential(user, pass);

      // SmtpClient không có async thực sự ổn định, nhưng SendMailAsync vẫn dùng được
      await client.SendMailAsync(msg);
    }
  }
}
