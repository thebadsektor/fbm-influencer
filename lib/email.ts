import sgMail from "@sendgrid/mail"

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export const sendEmail = async ({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error("SENDGRID_API_KEY is not set")
    return
  }

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
    subject,
    html: body,
  }

  try {
    await sgMail.send(msg)
    console.log(`Email sent to ${to}`)
  } catch (error) {
    console.error("Error sending email:", error)
    if ((error as any).response) {
      console.error((error as any).response.body)
    }
  }
}
