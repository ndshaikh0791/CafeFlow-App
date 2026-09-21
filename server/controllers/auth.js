import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/index.js";
import { assert } from "../utils/errors.js";
const cookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
});
export async function login(req, res) {
  const { email, password } = z
    .object({ email: z.email(), password: z.string().max(100) })
    .parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );
  assert(
    user?.active && (await bcrypt.compare(password, user.password)),
    "Invalid email or password",
    401,
  );
  res.cookie(
    "cf_session",
    jwt.sign(
      { sub: user.id, version: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    ),
    cookie(),
  );
  res.json({
    data: { _id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
export async function logout(req, res) {
  res.clearCookie("cf_session", { ...cookie(), maxAge: undefined });
  res.json({ data: true });
}
export async function forgot(req, res) {
  const { email } = z.object({ email: z.email() }).parse(req.body);
  assert(
    process.env.RESET_EMAIL_WEBHOOK,
    "Password reset email is not configured. Ask the cafe owner to reset your password in Staff.",
    503,
  );
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user?.active) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const response = await fetch(process.env.RESET_EMAIL_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESET_EMAIL_TOKEN || ""}`,
      },
      body: JSON.stringify({
        email: user.email,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    assert(
      response.ok,
      "Reset email delivery failed. Please try again later.",
      502,
    );
  }
  res.json({
    data: { message: "If that account exists, a reset link has been sent." },
  });
}
export async function reset(req, res) {
  const { token, password } = z
    .object({
      token: z.string().length(64),
      password: z.string().min(10).max(100),
    })
    .parse(req.body);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOneAndUpdate(
    { resetHash: hash, resetExpires: { $gt: new Date() } },
    {
      $set: { password: await bcrypt.hash(password, 12) },
      $unset: { resetHash: 1, resetExpires: 1 },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  );
  assert(user, "Reset link is invalid or expired");
  res.json({ data: true });
}
