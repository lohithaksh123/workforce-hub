import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { to, subject, message, pdfBase64, fileName } = await req.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ message: "Recipient, subject, and message are required" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const attachments: any[] = [];
    if (pdfBase64 && fileName) {
      attachments.push({
        filename: fileName,
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from: '"Acme Interiors HR" <noreply@example.com>',
      to,
      subject,
      text: message,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em; font-style: italic;">Acme Interiors</h2>
            <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.1em;">Interior Solutions</span>
          </div>
          <p style="color: #334155; font-size: 14px; white-space: pre-wrap;">${message}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">This is an automated HR transmission. Please do not reply directly to this mail.</p>
        </div>
      `,
      attachments,
    });

    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ message: "Email service is not configured yet." }, { status: 500 });
  }
}
