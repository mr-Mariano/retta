import { authReturn } from "@/lib/auth-return";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation return URL: trades the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=link`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/entrar?error=link`);
  }

  const { data: phone } = await supabase.rpc("my_profile_phone");

  return NextResponse.redirect(`${origin}${phone ? authReturn(searchParams.get("next")) || "/explorar" : "/completa-perfil"}`);
}
