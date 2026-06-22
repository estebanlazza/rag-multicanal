"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect("/panel/set-password?error=" + encodeURIComponent("Mínimo 8 caracteres"));
  }

  const supabase = await createClient();
  // Requiere sesión activa (la dejó verifyOtp del link de invitación).
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/panel/set-password?error=" + encodeURIComponent("No se pudo guardar. ¿El link venció?"));
  }
  redirect("/panel");
}
