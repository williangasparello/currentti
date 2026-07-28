import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  KanbanSquare,
  CheckSquare,
  MessageCircle,
  Instagram,
  Search,
  Send,
  Workflow,
  Bot,
  FolderOpen,
  FlaskConical,
  Sparkles,
  Plug,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Item = { to: string; label: string; icon: LucideIcon; end?: boolean };
type Group = { label?: string; items: Item[] };

// Navegação por grupos (mapa de navegação do §3 do documento).
const GROUPS: Group[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/calendar", label: "Calendário", icon: Calendar },
    ],
  },
  {
    label: "CRM",
    items: [
      { to: "/contacts", label: "Contatos", icon: Users },
      { to: "/deals", label: "Negociações", icon: KanbanSquare },
      { to: "/tasks", label: "Tarefas", icon: CheckSquare },
    ],
  },
  {
    label: "Inbox",
    items: [
      { to: "/chat", label: "WhatsApp", icon: MessageCircle },
      { to: "/chat/instagram", label: "Instagram", icon: Instagram },
    ],
  },
  {
    label: "Aquisição",
    items: [
      { to: "/cnpj", label: "Consulta CNPJ", icon: Search },
      { to: "/prospeccao-ativa", label: "Prospecção Ativa", icon: Send },
    ],
  },
  {
    label: "Agentes de IA",
    items: [
      { to: "/agents/followup", label: "Follow-Up", icon: Workflow },
      { to: "/agents/sdr", label: "SDR", icon: Bot },
      { to: "/agents/collections", label: "Coleções", icon: FolderOpen },
      { to: "/agents/prompt-lab", label: "Prompt Lab", icon: FlaskConical },
    ],
  },
  {
    label: "Conexões",
    items: [
      { to: "/instances", label: "WhatsApp", icon: Plug },
      { to: "/connections/instagram", label: "Instagram", icon: Instagram },
    ],
  },
  {
    items: [
      { to: "/manager", label: "O3 / Manager", icon: Sparkles },
      { to: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

function itemClass(isActive: boolean) {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
  );
}

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          C
        </div>
        <div className="leading-tight">
          <div className="font-semibold">Currentti</div>
          <div className="text-xs text-sidebar-foreground/60">CRM + IA · Omnichannel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll px-3 py-4 space-y-4">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.label && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </div>
            )}
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => itemClass(isActive)}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div className="space-y-1 border-t border-white/10 pt-4">
            <NavLink to="/admin" className={({ isActive }) => itemClass(isActive)}>
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Admin
            </NavLink>
          </div>
        )}
      </nav>

      <div className="px-5 py-4 text-xs text-sidebar-foreground/50 border-t border-white/10 shrink-0">
        Currentti · v0.2 (local)
      </div>
    </aside>
  );
}
