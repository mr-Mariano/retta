import { authReturn } from "@/lib/auth-return";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes anyone can open. Signed-in users are sent on to the app. */
const PUBLIC_ROUTES = ["/", "/registro", "/entrar"];
const PROFILE_ROUTE = "/completa-perfil";
const HOME_ROUTE = "/explorar";
const ADMIN_HOME_ROUTE = "/admin";

/**
 * Refreshes the Supabase session cookie and routes by auth state:
 * guests can browse, signed in without phone → complete profile,
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
    const canBrowse = path === HOME_ROUTE || /^\/retas\/[\da-f-]{36}$/i.test(path);
    return isPublic || canBrowse ? response : redirectKeepingCookies(request, response, "/entrar", authReturn(path));
  }

  const [{ data: profile }, { data: phone }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_profile_phone"),
  ]);

  if (!phone) {
    return path === PROFILE_ROUTE
      ? response
      : redirectKeepingCookies(request, response, PROFILE_ROUTE);
  }

  if (isPublic || path === PROFILE_ROUTE) {
    return redirectKeepingCookies(request, response, profile?.role === "admin" ? ADMIN_HOME_ROUTE : HOME_ROUTE);
  }

  return response;
}

/** A redirect that carries over any refreshed session cookies. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string, next = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
