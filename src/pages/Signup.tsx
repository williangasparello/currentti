import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { Button, Input, Label } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";

export default function Signup() {
  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const err = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (err) {
      toast.error(translateError(err));
      return;
    }
    // novo usuário começa bloqueado -> paywall até aprovação do admin
    navigate("/aguardando");
  }

  return (
    <AuthShell title="Criar conta" subtitle="Comece a usar o Currentti">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={fullName}
            onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Criar conta</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
