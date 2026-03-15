import { saasMeta } from "./constants";

const baseLayout = ({ title, content, buttonText, buttonUrl, footer }: {
  title: string;
  content: string;
  buttonText: string;
  buttonUrl: string;
  footer: string;
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --primary: #000000;
      --primary-foreground: #ffffff;
      --background: #fcfcfc;
      --card: #ffffff;
      --text: #1a1a1a;
      --text-muted: #666666;
      --border: #e2e2e2;
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: var(--text); 
      margin: 0; 
      padding: 0; 
      background-color: var(--background); 
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: var(--background);
      padding: 48px 0;
    }
    .container { 
      max-width: 560px; 
      margin: 0 auto; 
      padding: 40px; 
      background: var(--card); 
      border: 1px solid var(--border); 
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .brand {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--primary);
      margin-bottom: 32px;
      text-transform: uppercase;
    }
    .header { 
      font-size: 28px; 
      font-weight: 700; 
      letter-spacing: -0.03em;
      color: #000000; 
      margin-bottom: 16px; 
      line-height: 1.2;
    }
    .content { 
      font-size: 16px; 
      color: var(--text-muted); 
      margin-bottom: 32px; 
    }
    .button-container {
      margin-bottom: 32px;
    }
    .button { 
      display: inline-block; 
      padding: 14px 28px; 
      background-color: var(--primary); 
      color: var(--primary-foreground) !important; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 15px;
      text-align: center; 
      transition: opacity 0.2s ease;
    }
    .footer { 
      margin-top: 40px; 
      font-size: 13px; 
      color: #999999; 
      border-top: 1px solid var(--border); 
      padding-top: 24px; 
      text-align: left;
    }
    @media (max-width: 600px) {
      .container { padding: 24px; margin: 20px; }
      .header { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">${saasMeta.name}</div>
      <div class="header">${title}</div>
      <div class="content">
        ${content}
      </div>
      <div class="button-container">
        <a href="${buttonUrl}" class="button">${buttonText}</a>
      </div>
      <div class="footer">
        ${footer}<br>
        &copy; ${new Date().getFullYear()} ${saasMeta.name}. ${saasMeta.description}
      </div>
    </div>
  </div>
</body>
</html>
`

export const emailVerificationTemplate = ({ verificationUrl }: { verificationUrl: string }) =>
  baseLayout({
    title: "Verify your email address",
    content: `Welcome to ${saasMeta.name}! We're excited to have you on board. To get started, please confirm your email address by clicking the button below.`,
    buttonText: "Verify Email",
    buttonUrl: verificationUrl,
    footer: "If you didn't create an account with us, you can safely ignore this email."
  })

export const resetPasswordTemplate = ({ resetUrl }: { resetUrl: string }) =>
  baseLayout({
    title: "Reset your password",
    content: `We received a request to reset the password for your ${saasMeta.name} account. No problem! Just click the link below to set a new one.`,
    buttonText: "Reset Password",
    buttonUrl: resetUrl,
    footer: "If you didn't request a password reset, you can safely ignore this email. This link will remain active for 1 hour."
  })

export const magicLinkTemplate = ({ loginUrl }: { loginUrl: string }) =>
  baseLayout({
    title: "Your magic link is here",
    content: `Use the secure link below to sign in to your ${saasMeta.name} account. This link will expire after one use.`,
    buttonText: "Sign In to Dashboard",
    buttonUrl: loginUrl,
    footer: "If you didn't request a magic link, you can safely ignore this email."
  })
