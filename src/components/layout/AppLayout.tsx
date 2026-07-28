import { Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { DemoBanner } from "./DemoBanner";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { initials } from "@/lib/utils";

export function AppLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6 shrink-0">
          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
            <DemoBanner />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground">{profile?.email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">
              {initials(profile?.full_name)}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto thin-scroll bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
