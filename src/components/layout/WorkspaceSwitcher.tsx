import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

export function WorkspaceSwitcher() {
  const { workspaces, active, setActive, createWorkspace } = useWorkspace();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const ws = await createWorkspace(name.trim());
    setBusy(false);
    if (!ws) return toast.error("Falha ao criar workspace.");
    toast.success(`Workspace "${ws.name}" criado.`);
    setName("");
    setCreating(false);
    setOpen(false);
    setActive(ws.id); // recarrega no novo workspace
  }

  if (!active) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="max-w-[160px] truncate font-medium">{active.name}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-md border bg-card p-1 shadow-lg">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Workspaces</div>
          <div className="max-h-60 overflow-y-auto thin-scroll">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => (w.id === active.id ? setOpen(false) : setActive(w.id))}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-secondary",
                  w.id === active.id && "bg-accent",
                )}
              >
                <span className="truncate">{w.name}</span>
                {w.id === active.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>

          <div className="mt-1 border-t pt-1">
            {creating ? (
              <div className="flex flex-col gap-2 p-2">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do workspace"
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
                <div className="flex gap-2">
                  <Button size="sm" loading={busy} disabled={!name.trim()} onClick={create}>
                    Criar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-primary hover:bg-secondary"
              >
                <Plus className="h-4 w-4" /> Novo workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
