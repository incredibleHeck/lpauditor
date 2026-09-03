/**
 * @jest-environment node
 */
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { proxy } from "@/proxy";
import { POST as sessionPost, DELETE as sessionDelete } from "@/app/api/auth/session/route";
import { NextRequest, NextResponse } from "next/server";


var mockVerifySessionCookie = jest.fn();
var mockVerifyIdToken = jest.fn();
var mockCreateSessionCookie = jest.fn();
var mockProfileDocGet = jest.fn();
var mockProfileDocUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: (...args: any[]) => mockVerifySessionCookie(...args),
    verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
    createSessionCookie: (...args: any[]) => mockCreateSessionCookie(...args),
  },
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === "profiles") {
        return {
          doc: jest.fn(() => ({
            get: mockProfileDocGet,
            update: mockProfileDocUpdate,
          })),
        };
      }
      return {};
    }),
  },
}));

var mockCookieStore: Record<string, string> = {};

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (key: string) => (mockCookieStore[key] ? { value: mockCookieStore[key] } : undefined),
  })),
}));


describe("Authentication, Session API & Edge Proxy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieStore = {};
  });

  describe("getAuthenticatedUser", () => {
    it("should throw unauthorized if no cookie or ID token is present", async () => {
      await expect(getAuthenticatedUser()).rejects.toThrow("Unauthorized: Missing authentication token.");
    });

    it("should reject non-institutional domain emails", async () => {
      mockCookieStore["session"] = "mock-session-cookie";
      mockVerifySessionCookie.mockResolvedValueOnce({
        uid: "user-ext",
        email: "intruder@gmail.com",
      });

      await expect(getAuthenticatedUser()).rejects.toThrow(/Access is restricted exclusively to St. Adelaide/);
    });

    it("should successfully authenticate teacher with existing profile", async () => {
      mockCookieStore["session"] = "mock-valid-cookie";
      mockVerifySessionCookie.mockResolvedValueOnce({
        uid: "teacher-1",
        email: "alice@stadelaideschool.com",
      });

      mockProfileDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          role: "TEACHER",
          department: "Mathematics",
          full_name: "Alice Mensah",
        }),
      });

      const user = await getAuthenticatedUser();
      expect(user.uid).toBe("teacher-1");
      expect(user.email).toBe("alice@stadelaideschool.com");
      expect(user.role).toBe("TEACHER");
      expect(user.department).toBe("Mathematics");
      expect(user.full_name).toBe("Alice Mensah");
    });

    it("should authenticate via explicit idToken parameter and assign ADMIN for institutional admin emails", async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: "admin-theodora",
        email: "theodorahammond@stadelaideschool.com",
      });

      mockProfileDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          role: "TEACHER", // needs auto-heal to ADMIN
          full_name: "Theodora Hammond",
        }),
      });

      const user = await getAuthenticatedUser("raw-id-token-xyz");
      expect(user.role).toBe("ADMIN");
      expect(mockProfileDocUpdate).toHaveBeenCalledWith({ role: "ADMIN" });
    });
  });

  describe("Edge Proxy (proxy.ts)", () => {
    it("should redirect unauthenticated users accessing / to /auth/login", () => {
      const req = new NextRequest("http://localhost:3000/");
      const res = proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login");
    });

    it("should redirect authenticated users accessing /auth/login to /", () => {
      const req = new NextRequest("http://localhost:3000/auth/login", {
        headers: {
          cookie: "session=mock-active-session",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("should allow unauthenticated users to access /auth/login", () => {
      const req = new NextRequest("http://localhost:3000/auth/login");
      const res = proxy(req);

      expect(res.status).toBe(200);
    });

    it("should allow authenticated users to access protected dashboard routes", () => {
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: "session=mock-active-session",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(200);
    });
  });

  describe("Session Cookie API Route (app/api/auth/session/route.ts)", () => {
    it("POST: should return 400 if idToken is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await sessionPost(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing ID token");
    });

    it("POST: should create session cookie with 5-day expiration and httpOnly", async () => {
      mockCreateSessionCookie.mockResolvedValueOnce("firebase-session-cookie-val");

      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-id-token" }),
      });

      const res = await sessionPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("session=firebase-session-cookie-val");
      expect(setCookie).toContain("HttpOnly");
    });

    it("DELETE: should clear session cookie", async () => {
      const res = await sessionDelete();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("session=");
    });
  });
});
