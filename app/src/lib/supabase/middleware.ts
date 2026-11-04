import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes anyone can open. Signed-in users are sent on to the app. */
const PUBLIC_ROUTES = ["/", "/registro", "/entrar"];
const PROFILE_ROUTE = "/completa-perfil";
const HOME_ROUTE = "/explorar";

/**
 * Refreshes the Supabase session cookie and routes by auth state:
 * signed out → welcome, signed in without phone → complete profile,
 * signed in with phone → never back to the public or profile screens.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Must run right after creating the client: it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Auth callbacks and API routes (they check their own authorization).
  if (path.startsWith("/auth/") || path.startsWith("/api/")) return response;

  const isPublic = PUBLIC_ROUTES.includes(path);

  if (!user) {
    return isPublic ? response : redirectKeepingCookies(request, response, "/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.phone) {
    return path === PROFILE_ROUTE
      ? response
      : redirectKeepingCookies(request, response, PROFILE_ROUTE);
  }

  if (isPublic || path === PROFILE_ROUTE) {
    return redirectKeepingCookies(request, response, HOME_ROUTE);
  }

  return response;
}

/** A redirect that carries over any refreshed session cookies. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
