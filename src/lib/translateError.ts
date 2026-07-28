/**
 * Traduz mensagens de erro (Supabase Auth e genéricas) para português,
 * para exibição em toasts. Convenção do projeto: usuário nunca vê erro em inglês.
 */
const MAP: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha inválidos.",
  "Email not confirmed": "E-mail ainda não confirmado.",
  "User already registered": "Este e-mail já está cadastrado.",
  "Password should be at least 6 characters":
    "A senha deve ter pelo menos 6 caracteres.",
  "Unable to validate email address: invalid format":
    "Formato de e-mail inválido.",
  "For security purposes, you can only request this after 60 seconds":
    "Por segurança, aguarde 60 segundos antes de tentar novamente.",
  "signup_disabled": "Cadastro temporariamente desativado.",
  "network_error": "Falha de conexão. Verifique sua internet.",
  // Google Gemini
  "API key not valid": "Chave do Gemini inválida. Confira a chave copiada do Google AI Studio.",
  "API_KEY_INVALID": "Chave do Gemini inválida. Confira a chave copiada do Google AI Studio.",
  "PERMISSION_DENIED": "Permissão negada. Ative a Generative Language API para essa chave.",
  "RESOURCE_EXHAUSTED": "Cota da API do Gemini excedida. Tente novamente mais tarde.",
  "quota": "Cota da API do Gemini excedida. Tente novamente mais tarde.",
  "is not found": "Modelo de IA indisponível. Escolha outro modelo na lista.",
  "not supported": "Modelo de IA indisponível. Escolha outro modelo na lista.",
  "Failed to fetch": "Falha de conexão com a IA (rede ou CORS). Tente novamente.",
  "possível CORS": "Falha de conexão (possível CORS). Use o backend para o envio real.",
};

export function translateError(err: unknown): string {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? "";

  if (!raw) return "Ocorreu um erro inesperado. Tente novamente.";
  for (const key of Object.keys(MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return MAP[key];
  }
  return raw;
}
