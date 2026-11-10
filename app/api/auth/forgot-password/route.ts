import { NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import nodemailer from "nodemailer";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000; // 1 hour from now

    // Save token to Convex
    const userId = await fetchMutation(api.users.setPasswordResetToken, {
      email,
      token,
      expires,
    });

    if (!userId) {
      // For security reasons, don't reveal if user exists or not
      return NextResponse.json({ message: "If an account with that email exists, we sent a password reset link." });
    }

    // Configure Nodemailer with Google App Password
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: '"Acme Interiors Support" <noreply@example.com>',
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your Acme Interiors account.</p>
          <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          <p style="margin-top: 24px; font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "If an account with that email exists, we sent a password reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
