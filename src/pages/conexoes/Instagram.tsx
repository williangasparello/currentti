import { useEffect, useState, type FormEvent } from "react";
import {
  Instagram,
  Plus,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  AtSign,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { useWorkspace } from "@/lib/workspace";
import { listInstagram, createInstagram } from "@/lib/api/inbox";
import type { InstagramConnection } from "@/types/domain";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "muted" }> = {
  connected: { label: "Conectado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  disconnected: { label: "Desconectado", tone: "muted" },
};

function statusOf(status: string) {
  return STATUS[status] ?? { label: status || "Pendente", tone: "muted" as const };
}

export default function InstagramConexao() {
  const toast = useToast();
  const { active } = useWorkspace();

  const [items, setItems] = useState<InstagramConnection[] | null>(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setItems(await listInstagram());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const handle = username.trim().replace(/^@/, "");
    if (!handle) return;
    setSaving(true);
    const r = await createInstagram(handle);
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Conta adicionada.");
    setItems((cur) => (cur ? [r.data, ...cur] : [r.data]));
    setUsername("");
  }

  function connect(conn: InstagramConnection) {
    toast.error(
      `Conexão de @${conn.username} requer um App Meta aprovado e um token de longa duração (Instagram Business/Graph API). Integração ainda em beta.`,
    );
  }

  if (!items) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Instagram className="h-6 w-6 text-primary" /> Instagram
          <Badge tone="warning">Beta</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          Contas Instagram Business{active?.name ? ` · ${active.name}` : ""}.
        </p>
      </div>

      {/* Requisitos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Requisitos da integração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A conexão com o Instagram usa a Graph API oficial da Meta. Antes de conectar uma
            conta, você precisa de:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Uma conta <b>Instagram Business</b> ou <b>Creator</b> vinculada a uma Página
                do Facebook.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Um <b>App Meta</b> aprovado com as permissões de mensagens do Instagram
                (<code className="rounded bg-secondary px-1">instagram_manage_messages</code>).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Um <b>token de acesso de longa duração</b> gerado para o App, com o número da
                conta autorizado.
              </span>
            </li>
          </ul>
          <div className="flex items-start gap-2 rounded-md border border-input bg-secondary/40 p-3 text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs">
              Enquanto a integração está em beta, você pode cadastrar as contas aqui, mas a
              ativação do token ainda é feita manualmente pelo suporte.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Adicionar conta */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ig-username">Usuário do Instagram</Label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ig-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="sua_conta"
                  className="pl-9"
                />
              </div>
            </div>
            <Button type="submit" loading={saving} disabled={!username.trim()}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Contas conectadas */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada ainda. Adicione um usuário acima para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((conn) => {
            const st = statusOf(conn.status);
            const connected = conn.status === "connected";
            return (
              <Card key={conn.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                        <Instagram className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">@{conn.username}</div>
                        <div className="text-xs text-muted-foreground">Instagram Business</div>
                      </div>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>

                  {!connected && (
                    <div className="rounded-md border border-dashed p-4 text-center">
                      <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Requer App Meta aprovado e token de longa duração.
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        onClick={() => connect(conn)}
                      >
                        Conectar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
