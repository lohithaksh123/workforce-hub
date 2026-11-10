import { NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required" }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password in Convex
    await fetchMutation(api.users.updatePasswordWithToken, {
      token,
      password: hashedPassword,
    });

    return NextResponse.json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
