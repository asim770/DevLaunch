import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface SendResetOtpOptions {
  to: string;
  name: string;
  otp: string;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  otp: string;
  timestamp: Date;
}

// In-memory test inspection record
export const sentEmailsLog: SentEmailRecord[] = [];

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (env.EMAIL_PROVIDER === 'smtp') {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
    return transporter;
  }
  return null;
}

/**
 * Sends a password reset email containing a 6-digit verification code.
 *
 * Security Controls:
 * - Production strictly requires real SMTP transport; never falls back to console.
 * - OTP is never logged in production mode.
 * - Plaintext and HTML templates explain 10-minute expiry and that unsolicited requests
 *   may be safely ignored.
 */
export async function sendPasswordResetOtp({ to, name, otp }: SendResetOtpOptions): Promise<void> {
  const subject = 'Your DevLaunch Password Reset Code';
  const textBody = `Hello ${name},

You requested to reset your password for your DevLaunch account.
Your 6-digit password reset verification code is:

${otp}

This verification code is valid for 10 minutes.
If you did not request this password reset, please ignore this email. Your account remains secure.

Best regards,
The DevLaunch Team`;

  const htmlBody = `
<div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #0f172a;">DevLaunch Password Reset</h2>
  <p>Hello ${name},</p>
  <p>You requested to reset your password. Use the verification code below to authorize your password update:</p>
  <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
    <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0284c7; font-family: monospace;">${otp}</span>
  </div>
  <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong>.</p>
  <p style="color: #64748b; font-size: 13px;">If you did not request a password reset, you can safely ignore this email. No changes will be made to your account.</p>
</div>`;

  // Test inspection capture
  if (env.NODE_ENV === 'test') {
    sentEmailsLog.push({ to, subject, otp, timestamp: new Date() });
  }

  // Handle live SMTP delivery
  if (env.EMAIL_PROVIDER === 'smtp') {
    const smtp = getTransporter();
    if (!smtp) {
      throw new Error('SMTP transporter is not configured.');
    }
    await smtp.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return;
  }

  // Development console logger (Never runs in production)
  if (env.NODE_ENV === 'development') {
    console.info(`[Email Service] Delivered password reset OTP to ${to} (Subject: ${subject})`);
  }
}
