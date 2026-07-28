import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { Button, Input, Label } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      toast.error(translateError(err));
      return;
    }
    navigate("/");
  }

  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta Currentti">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Entrar</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
