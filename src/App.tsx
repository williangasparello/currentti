import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PublicOnly, RequireAdmin, RequireApproved } from "@/components/RouteGuards";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Paywall from "@/pages/Paywall";
import Dashboard from "@/pages/Dashboard";
import Configuracao from "@/pages/Configuracao";
import Perfil from "@/pages/Perfil";
import Admin from "@/pages/Admin";

import Contatos from "@/pages/crm/Contatos";
import Negociacoes from "@/pages/crm/Negociacoes";
import Tarefas from "@/pages/crm/Tarefas";
import Calendario from "@/pages/Calendario";
import WhatsAppInbox from "@/pages/inbox/WhatsAppInbox";
import InstagramInbox from "@/pages/inbox/InstagramInbox";
import Cnpj from "@/pages/Cnpj";
import Prospeccao from "@/pages/Prospeccao";
import FollowUp from "@/pages/agents/FollowUp";
import Sdr from "@/pages/agents/Sdr";
import Colecoes from "@/pages/agents/Colecoes";
import PromptLab from "@/pages/agents/PromptLab";
import WhatsAppInstances from "@/pages/conexoes/WhatsAppInstances";
import InstagramConexao from "@/pages/conexoes/Instagram";
import Manager from "@/pages/Manager";
import Configuracoes from "@/pages/Configuracoes";

export default function App() {
  return (
    <Routes>
      {/* públicas */}
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/aguardando" element={<Paywall />} />

      {/* app (aprovado) */}
      <Route
        element={
          <RequireApproved>
            <AppLayout />
          </RequireApproved>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/calendar" element={<Calendario />} />

        {/* CRM */}
        <Route path="/contacts" element={<Contatos />} />
        <Route path="/deals" element={<Negociacoes />} />
        <Route path="/tasks" element={<Tarefas />} />

        {/* Inbox */}
        <Route path="/chat" element={<WhatsAppInbox />} />
        <Route path="/chat/instagram" element={<InstagramInbox />} />

        {/* Aquisição */}
        <Route path="/cnpj" element={<Cnpj />} />
        <Route path="/prospeccao-ativa" element={<Prospeccao />} />

        {/* Agentes de IA */}
        <Route path="/agents/followup" element={<FollowUp />} />
        <Route path="/agents/sdr" element={<Sdr />} />
        <Route path="/agents/collections" element={<Colecoes />} />
        <Route path="/agents/prompt-lab" element={<PromptLab />} />

        {/* Conexões */}
        <Route path="/instances" element={<WhatsAppInstances />} />
        <Route path="/connections/instagram" element={<InstagramConexao />} />

        {/* Plataforma */}
        <Route path="/manager" element={<Manager />} />
        <Route path="/settings" element={<Configuracoes />} />

        {/* onboarding + conta */}
        <Route path="/configuracao" element={<Configuracao />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
