  public interface IEmailSender
    {
        Task SendVerifyEmailAsync(string toEmail, string verifyUrl);
        Task SendResetPasswordEmailAsync(string toEmail, string resetUrl);

    }