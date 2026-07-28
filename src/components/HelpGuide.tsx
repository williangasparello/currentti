import { useState, type ReactNode } from "react";
import { ChevronDown, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Guia passo a passo expansível (tutorial in-app). */
export function HelpGuide({
  title,
  steps,
  cta,
  defaultOpen = false,
}: {
  title: string;
  steps: ReactNode[];
  cta?: { href: string; label: string };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border bg-secondary/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <ol className="ml-1 space-y-2 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          {cta && (
            <a
              href={cta.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {cta.label} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Link externo estilizado, com ícone. */
export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}
