"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SignUpResult {
  error?: string;
}

// Messages for the exceptions raised by public.sign_up_for_match.
const ERRORS: Record<string, string> = {
  match_full: "Se llenó mientras confirmabas. Busca otra reta.",
  match_cancelled: "Esta reta se canceló.",
  match_started: "Esta reta ya empezó.",
  deadline_passed: "Ya cerraron las inscripciones de esta reta.",
};

export async function signUpForMatch(matchId: string): Promise<SignUpResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sign_up_for_match", { p_match_id: matchId });

  if (error) {
    const code = Object.keys(ERRORS).find((key) => error.message.includes(key));
    if (error.message.includes("already_registered")) redirect(`/retas/${matchId}`);
    return { error: code ? ERRORS[code] : "No pudimos inscribirte. Inténtalo de nuevo." };
  }

  const { just_confirmed } = data as { just_confirmed: boolean };
  redirect(`/retas/${matchId}/inscrito${just_confirmed ? "?armada=1" : ""}`);
}
