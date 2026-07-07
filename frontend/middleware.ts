import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  const protectedRoutes = [
    "/dashboard",
    "/chat",
    "/writing",
    "/reading",
    "/listening",
    "/speaking",
    "/complete-profile",
  ];

  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("sb-auth-token");
  let isAuthenticated = false;

  console.log(`[Middleware] Checking path: ${pathname}, Cookie present: ${!!cookie}`);

  if (cookie?.value) {
    try {
      let session;
      try {
        session = JSON.parse(cookie.value);
      } catch (err) {
        try {
          session = JSON.parse(decodeURIComponent(cookie.value));
        } catch (innerErr) {
          console.error("[Middleware] Cookie parsing failed:", innerErr);
        }
      }
      const accessToken = session?.access_token;
      console.log(`[Middleware] Access token parsed: ${!!accessToken}`);

      if (accessToken) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // Instantiate a quick, transient client to verify the token with Supabase GoTrue
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });

        const { data: { user }, error } = await tempClient.auth.getUser(accessToken);
        if (error) {
          console.error("[Middleware] Supabase getUser error:", error.message);
        }
        if (user && !error) {
          isAuthenticated = true;
          console.log(`[Middleware] Auth verification succeeded for user: ${user.id}`);
        }
      }
    } catch (e: any) {
      console.error("[Middleware] Auth verification failed with exception:", e.message);
    }
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    // Add original redirect location
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chat/:path*",
    "/writing/:path*",
    "/reading/:path*",
    "/listening/:path*",
    "/speaking/:path*",
    "/complete-profile/:path*",
  ],
};
