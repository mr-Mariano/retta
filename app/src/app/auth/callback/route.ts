import { RECOVERY_COOKIE, RECOVERY_RESET_PATH } from "@/lib/password-recovery";
import { authReturn } from "@/lib/auth-return";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation return URL: trades the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    redirect("/entrar?error=link");
  }

  const supabase = await createClient();
  const flowId = searchParams.get("sb_flow_id");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

  if (error || !data.user) {
    redirect("/entrar?error=link");
  }

  if ("redirectType" in data && data.redirectType === "recovery") {
    (await cookies()).set(RECOVERY_COOKIE, data.user.id, {
      path: "/",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 15 * 60,
    });
    redirect(RECOVERY_RESET_PATH);
  }

  const { data: phone } = await supabase.rpc("my_profile_phone");

  redirect(phone ? authReturn(searchParams.get("next")) || "/explorar" : "/completa-perfil");
}
