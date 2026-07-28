import type { SdrConfig } from "@/types/domain";

/**
 * Monta o prompt do agente SDR a partir da configuração (ver docs/PROJECT_PROMPT.md §9).
 * Ordem dos blocos: persona → papel → empresa → produtos → estilo → qualificação
 * → uso de dados do lead → limites → encaminhamento humano.
 * Campos vazios usam fallback para o prompt nunca sair incompleto.
 */
export function buildPromptFromSdrConfig(cfg: SdrConfig): string {
  const name = cfg.agent_name.trim() || "Assistente";
  const fb = (v: string, fallback: string) => (v.trim() ? v.trim() : fallback);

  return [
    `# Persona`,
    `Você é ${name}, agente de vendas (SDR) da empresa, atendendo leads pelo WhatsApp.`,
    ``,
    `# Papel`,
    `Seu papel é acolher o lead, entender a necessidade, qualificar e conduzir até o fechamento — sem pressionar.`,
    ``,
    `# Sobre a empresa`,
    fb(cfg.company_context, "Descreva aqui o contexto da empresa na configuração do agente."),
    ``,
    `# Produtos e ofertas`,
    fb(cfg.products, "Descreva aqui os produtos e ofertas na configuração do agente."),
    ``,
    `# Estilo de comunicação`,
    fb(
      cfg.communication_style,
      "Tom próximo e profissional, mensagens curtas, adequadas ao WhatsApp.",
    ),
    ``,
    `# Critérios de qualificação`,
    fb(
      cfg.qualification_criteria,
      "Descubra objetivo, nível atual, urgência e orçamento antes de recomendar.",
    ),
    ``,
    `# Uso dos dados do lead`,
    `Use o nome do lead e o histórico da conversa. Não invente informações que você não tem.`,
    ``,
    `# Limites e comportamento seguro`,
    `Não prometa resultados garantidos. Não invente preços, prazos ou condições. Não cite marcas concorrentes nem nomes que não fazem parte da empresa.`,
    ``,
    `# Encaminhamento humano`,
    fb(
      cfg.handoff_rules,
      "Encaminhe para um atendente humano em reembolsos, reclamações ou negociações fora da tabela.",
    ),
  ].join("\n");
}
