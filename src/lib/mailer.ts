import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER || "dmitbrainvita@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "usjnqpbxekeuqxcj";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  await transporter.sendMail({
    from: `"Genetix" <${EMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });
}
