import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (session.startsWith("demo:")) {
    const demoUser = session.replace("demo:", "");
    return NextResponse.json({ authenticated: true, demoUser }, { status: 200 });
  }

  return NextResponse.json({ authenticated: true }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, demoUser } = body;

    // Handle Local Demo User Sessions
    if (demoUser) {
      const expiresIn = 60 * 60 * 24 * 5 * 1000;
      const response = NextResponse.json({ status: "success", demoUser }, { status: 200 });

      response.cookies.set("session", `demo:${demoUser}`, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
      });

      return response;
    }

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
    }

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ status: "success" }, { status: 200 });

    response.cookies.set("session", sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Error creating session cookie:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "success" }, { status: 200 });
  
  response.cookies.delete("session");
  
  return response;
}
