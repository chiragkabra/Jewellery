"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useLens } from "@/context/LensContext";
import { submitForm } from "@/lib/submit";
import { cn } from "@/lib/utils";

const interests = [
  { value: "wholesale", label: "Wholesale" },
  { value: "private-label", label: "Private label" },
  { value: "export", label: "Export" },
  { value: "import", label: "Import / sourcing" },
];

const volumes = ["Under [XX] pcs / month", "[XX]–[XX] pcs / month", "[XX]+ pcs / month", "Not sure yet"];

export function TradeEnquiryForm({ dark }: { dark?: boolean }) {
  const { lens } = useLens();
  const [material, setMaterial] = useState(lens === "all" ? "" : lens);
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [ref, setRef] = useState("");

  useEffect(() => {
    if (lens !== "all") setMaterial(lens);
  }, [lens]);

  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState("sending");
    try {
      setRef(await submitForm("trade-enquiry", { ...data, interests: picked }));
      setState("done");
    } catch {
      setState("error");
    }
  };

  const field = cn("field", dark && "border-ivory/25 bg-transparent text-ivory placeholder:text-ivory/40 focus:border-ivory");
  const label = cn("field-label", dark && "text-ivory/60");

  if (state === "done")
    return (
      <div className="py-12">
        <Check size={32} strokeWidth={1.5} className={dark ? "text-accent-light" : "text-accent"} />
        <p className="mt-4 font-display text-[32px]">Thank you — enquiry received.</p>
        <p className={cn("mt-3", dark ? "text-ivory/70" : "text-muted")}>
          Reference {ref}. Our trade desk will be in touch within [XX] working hours.
        </p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="te-name" className={label}>Name</label>
        <input id="te-name" name="name" required className={field} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="te-company" className={label}>Company</label>
        <input id="te-company" name="company" required className={field} autoComplete="organization" />
      </div>
      <div>
        <label htmlFor="te-email" className={label}>Email</label>
        <input id="te-email" name="email" type="email" required className={field} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="te-country" className={label}>Country</label>
        <input id="te-country" name="country" required className={field} autoComplete="country-name" />
      </div>
      <div>
        <label htmlFor="te-material" className={label}>Material</label>
        <select
          id="te-material"
          name="material"
          required
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className={cn(field, "appearance-none", dark && "[&>option]:text-ink")}
        >
          <option value="" disabled>Choose a material</option>
          <option value="gold">Gold</option>
          <option value="silver">Sterling silver</option>
          <option value="diamond">Diamonds</option>
          <option value="mixed">More than one</option>
        </select>
      </div>
      <div>
        <label htmlFor="te-volume" className={label}>Monthly volume</label>
        <select id="te-volume" name="volume" defaultValue="" required className={cn(field, "appearance-none", dark && "[&>option]:text-ink")}>
          <option value="" disabled>Choose a range</option>
          {volumes.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={label}>Interested in</legend>
        <div className="flex flex-wrap gap-2">
          {interests.map((it) => {
            const on = picked.includes(it.value);
            return (
              <button
                key={it.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(it.value)}
                className={cn(
                  "min-h-[44px] border px-4 text-[13px] transition-colors",
                  dark
                    ? on ? "border-ivory bg-ivory text-ink" : "border-ivory/25 text-ivory hover:border-ivory"
                    : on ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink"
                )}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="te-message" className={label}>Anything else</label>
        <textarea id="te-message" name="message" rows={3} className={cn(field, "py-3")} />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn("text-[13px]", dark ? "text-ivory/50" : "text-muted")}>
          We reply to trade enquiries within [XX] working hours.
        </p>
        <button type="submit" disabled={state === "sending"} className={dark ? "btn-light" : "btn-primary"}>
          {state === "sending" ? "Sending…" : "Send enquiry"}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-[13px] text-[#C26A5C] sm:col-span-2">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
