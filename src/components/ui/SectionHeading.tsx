import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface Props {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({ eyebrow, title, lede, align = "left", dark, action, className }: Props) {
  return (
    <Reveal
      className={cn(
        "mb-10 flex flex-col gap-6 md:mb-14",
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        <p className={cn("eyebrow mb-4", dark && "text-accent-light")}>{eyebrow}</p>
        <h2 className="display-2">{title}</h2>
        {lede && <p className={cn("lede mt-5", dark && "text-ivory/70")}>{lede}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}
