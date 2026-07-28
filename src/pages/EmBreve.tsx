import { Construction } from "lucide-react";
import { Card } from "@/components/ui";

/** Placeholder para seções ainda não implementadas (serão entregues nas próximas fases). */
export default function EmBreve({ title, fase }: { title: string; fase: number }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Construction className="h-7 w-7" />
        </div>
        <div className="text-lg font-medium">Em construção</div>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta seção faz parte da <strong>Fase {fase}</strong> do roadmap do Currentti e será
          entregue em breve. A estrutura de navegação já está pronta.
        </p>
      </Card>
    </div>
  );
}
