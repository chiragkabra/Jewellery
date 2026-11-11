import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

/** Numbered horizontal (desktop) / vertical (mobile) process steps. */
export function StepTimeline({ steps, dark }: { steps: { title: string; body: string }[]; dark?: boolean }) {
  return (
    <ol
      className={cn("grid gap-10 md:gap-6", steps.length === 5 ? "md:grid-cols-5" : "md:grid-cols-4")}
    >
      {steps.map((s, i) => (
        <Reveal as="li" key={s.title} delay={i * 0.08} className="relative">
            <div className="mb-6 flex items-center gap-4">
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-full border font-display text-[18px]",
                  dark ? "border-accent-light text-accent-light" : "border-accent text-accent"
                )}
              >
                {i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("hidden h-px flex-1 md:block", dark ? "bg-ivory/20" : "bg-line")} aria-hidden />
              )}
            </div>
            <h3 className="font-display text-[24px] leading-tight">{s.title}</h3>
            <p className={cn("mt-3 text-[15px] leading-relaxed", dark ? "text-ivory/70" : "text-muted")}>{s.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}
