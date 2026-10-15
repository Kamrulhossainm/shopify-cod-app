import crypto from "node:crypto";
import prisma from "../db.server";
import { normalizePhone, type OtpSettings } from "./settings";

const secret = () => process.env.SHOPIFY_API_SECRET || "dev-secret";

const hash = (shop: string, phone: string, code: string) =>
  crypto.createHmac("sha256", secret()).update(`${shop}|${phone}|${code}`).digest("hex");

function randomCode(length: number) {
  const len = Math.max(4, Math.min(8, length || 4));
  let code = "";
  for (let i = 0; i < len; i++) code += crypto.randomInt(0, 10).toString();
  return code;
}

export async function sendOtp(shop: string, rawPhone: string, otp: OtpSettings) {
  const phone = normalizePhone(rawPhone);
  if (phone.replace(/\D/g, "").length < 6) throw new Error("Invalid phone number");

  // Resend throttle: max 1 per 30s and 5 per hour per phone.
  const recent = await prisma.otpCode.findMany({
    where: { shop, phone, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30_000)
    throw new Error("Please wait 30 seconds before requesting a new code");
  if (recent.length >= 5) throw new Error("Too many codes requested. Try again later");

  const code = randomCode(otp.codeLength);
  await prisma.otpCode.create({
    data: {
      shop,
      phone,
      codeHash: hash(shop, phone, code),
      expiresAt: new Date(Date.now() + Math.max(1, otp.expiryMinutes) * 60_000),
    },
  });

  const message = otp.message
    .replaceAll("{code}", code)
    .replaceAll("{shop}", shop.replace(".myshopify.com", ""));
  await deliver(otp, phone, code, message);
}

async function deliver(otp: OtpSettings, phone: string, code: string, message: string) {
  if (otp.provider === "twilio") {
    const auth = Buffer.from(`${otp.twilioAccountSid}:${otp.twilioAuthToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${otp.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: otp.twilioFrom, Body: message }),
      },
    );
    if (!res.ok) {
      console.error("Twilio error", res.status, await res.text());
      throw new Error("Could not send SMS. Please check your phone number");
    }
  } else if (otp.provider === "webhook") {
    const res = await fetch(otp.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, message }),
    });
    if (!res.ok) throw new Error("Could not send verification code");
  } else {
    // Development only: print the code to the server log.
    console.log(`[COD OTP] ${phone}: ${code}`);
  }
}

export async function verifyOtp(shop: string, rawPhone: string, code: string, otp: OtpSettings) {
  const phone = normalizePhone(rawPhone);
  const record = await prisma.otpCode.findFirst({
    where: { shop, phone, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new Error("Code expired. Please request a new one");
  if (record.attempts >= otp.maxAttempts) throw new Error("Too many attempts. Request a new code");

  const ok = crypto.timingSafeEqual(
    Buffer.from(record.codeHash),
    Buffer.from(hash(shop, phone, String(code).trim())),
  );
  if (!ok) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Incorrect code");
  }
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.otpCode.update({ where: { id: record.id }, data: { verified: true, token } });
  return token;
}

/** Consumes a verification token. Returns true if it is valid for this phone. */
export async function consumeOtpToken(shop: string, rawPhone: string, token?: string) {
  if (!token) return false;
  const phone = normalizePhone(rawPhone);
  const record = await prisma.otpCode.findUnique({ where: { token } });
  if (!record || record.shop !== shop || record.phone !== phone || !record.verified) return false;
  // Token valid for 30 minutes after the code was issued.
  if (Date.now() - record.createdAt.getTime() > 30 * 60_000) return false;
  await prisma.otpCode.update({ where: { id: record.id }, data: { token: null } });
  return true;
}
