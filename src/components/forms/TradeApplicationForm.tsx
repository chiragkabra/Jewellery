"use client";
import { WhatsAppConsent } from "@/components/forms/WhatsAppConsent";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, FileUp, X } from "lucide-react";
import { categories } from "@/data/categories";
import { submitForm } from "@/lib/submit";
import { cn } from "@/lib/utils";

const steps = ["Business details", "Material & volume", "Documents", "Review"];

const businessTypes = ["Retailer", "Distributor", "Corporate gifting", "Private-label brand", "Importer", "Other"];
const materialsList = ["Gold", "Sterling silver", "Diamonds"];
const docSlots = [
  { key: "gst", label: "GST certificate / VAT registration" },
  { key: "registration", label: "Business registration / incorporation" },
  { key: "iec", label: "IEC (for import / export)" },
  { key: "id", label: "Authorised signatory ID" },
];

type Data = Record<string, string | string[]>;

export function TradeApplicationForm() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [data, setData] = useState<Data>({ materials: [], categories: [] });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMessage,setErrorMessage] = useState("");
  const [ref, setRef] = useState("");
  const [stepError, setStepError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: string, v: string | string[]) => setData((d) => ({ ...d, [k]: v }));
  const toggle = (k: string, v: string) => {
    const arr = (data[k] as string[]) ?? [];
    set(k, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };
  const val = (k: string) => (data[k] as string) ?? "";

  const go = (to: number) => {
    if (to > step && !formRef.current?.reportValidity()) return;
    if (to > step && step === 1 && !(data.materials as string[]).length) {
      setStepError("Please choose at least one material.");
      return;
    }
    setStepError("");
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < steps.length - 1) return go(step + 1);
    setState("sending");
    try {
      const form = new FormData();
      form.set("payload", JSON.stringify({ form: "trade-application", ...data }));
      for (const [key, file] of Object.entries(files)) if (file) form.append(key, file);
      const response = await fetch("/api/enquiry", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Submission failed");
      setRef(result.reference);
      setState("done");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setState("error");
    }
  };

  if (state === "done")
    return (
      <div className="border border-line bg-ivory p-10 text-center">
        <Check size={36} strokeWidth={1.5} className="mx-auto text-accent" />
        <p className="mt-4 font-display text-[32px]">Application received.</p>
        <p className="mt-3 text-muted">
          Reference {ref}. Our trade desk will review your application and contact you about account access.
        </p>
      </div>
    );

  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`ta-${name}`} className="field-label">{label}{props.required && " *"}</label>
      <input id={`ta-${name}`} name={name} value={val(name)} onChange={(e) => set(name, e.target.value)} className="field" {...props} />
    </div>
  );

  const chips = (k: string, options: string[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = ((data[k] as string[]) ?? []).includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(k, o)}
            className={cn("min-h-[44px] border px-4 text-[13px] transition-colors", on ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink")}
          >
            {o}
          </button>
        );
      })}
    </div>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="border border-line bg-ivory p-6 sm:p-10" noValidate={false}>
      {/* Progress */}
      <div className="mb-10">
        <div className="flex justify-between text-[12px] font-semibold uppercase tracking-[0.14em]">
          <span>Step {step + 1} of {steps.length}</span>
          <span className="text-accent">{steps[step]}</span>
        </div>
        <div className="mt-3 h-px w-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          <motion.div
            className="h-px origin-left bg-ink"
            animate={{ scaleX: (step + 1) / steps.length }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <ol className="mt-4 hidden grid-cols-4 gap-2 sm:grid">
          {steps.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => i < step && go(i)}
                disabled={i > step}
                className={cn("text-left text-[12px]", i === step ? "text-ink" : i < step ? "text-muted underline underline-offset-4" : "text-muted/50")}
              >
                0{i + 1} {s}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-5 sm:grid-cols-2"
          >
            {step === 0 && (
              <>
                {input("company", "Company name", { required: true, autoComplete: "organization" })}
                {input("contact", "Contact person", { required: true, autoComplete: "name" })}
                {input("email", "Email", { required: true, type: "email", autoComplete: "email" })}
                {input("phone", "Phone / WhatsApp", { required: true, type: "tel", autoComplete: "tel" })}
                <div>
                  <label htmlFor="ta-type" className="field-label">Business type *</label>
                  <select id="ta-type" required value={val("type")} onChange={(e) => set("type", e.target.value)} className="field appearance-none">
                    <option value="" disabled>Choose one</option>
                    {businessTypes.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                {input("country", "Country", { required: true, autoComplete: "country-name" })}
                {input("taxId", "GSTIN / VAT / Tax ID")}
                {input("website", "Website or Instagram", { type: "text" })}
              </>
            )}

            {step === 1 && (
              <>
                <fieldset className="sm:col-span-2">
                  <legend className="field-label">Materials *</legend>
                  {chips("materials", materialsList)}
                </fieldset>
                <fieldset className="sm:col-span-2">
                  <legend className="field-label">Categories</legend>
                  {chips("categories", categories.map((c) => c.name))}
                </fieldset>
                <div>
                  <label htmlFor="ta-volume" className="field-label">Expected monthly volume *</label>
                  <select id="ta-volume" required value={val("volume")} onChange={(e) => set("volume", e.target.value)} className="field appearance-none">
                    <option value="" disabled>Choose a range</option>
                    <option>Under [XX] pcs</option>
                    <option>[XX]–[XX] pcs</option>
                    <option>[XX]+ pcs</option>
                    <option>By weight — [XX] kg+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ta-pl" className="field-label">Private label?</label>
                  <select id="ta-pl" value={val("privateLabel")} onChange={(e) => set("privateLabel", e.target.value)} className="field appearance-none">
                    <option value="">Not sure</option>
                    <option>Yes — our designs & branding</option>
                    <option>No — from your catalogue</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ta-notes" className="field-label">Purities, price points, deadlines</label>
                  <textarea id="ta-notes" rows={3} value={val("notes")} onChange={(e) => set("notes", e.target.value)} className="field py-3" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-[14px] text-muted sm:col-span-2">
                  PDF, JPG or PNG up to 5 MB each. You can also email documents to our trade desk later.
                </p>
                {docSlots.map((d) => {
                  const f = files[d.key];
                  return (
                    <div key={d.key}>
                      <span className="field-label">{d.label}</span>
                      {f ? (
                        <div className="flex min-h-[48px] items-center justify-between border border-ink bg-sand px-4 text-[14px]">
                          <span className="truncate">{f.name}</span>
                          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => ({ ...x, [d.key]: null }))} className="grid h-11 w-11 place-items-center">
                            <X size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 border border-dashed border-ink/30 px-4 text-[14px] text-muted transition-colors hover:border-ink hover:text-ink">
                          <FileUp size={18} strokeWidth={1.5} /> Choose file
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="sr-only"
                            onChange={(e) => setFiles((x) => ({ ...x, [d.key]: e.target.files?.[0] ?? null }))}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {step === 3 && (
              <div className="sm:col-span-2">
                <dl className="divide-y divide-line border-y border-line text-[14px]">
                  {[
                    ["Company", val("company")],
                    ["Contact", `${val("contact")} · ${val("email")} · ${val("phone")}`],
                    ["Business type", val("type")],
                    ["Country", val("country")],
                    ["Tax ID", val("taxId") || "—"],
                    ["Materials", (data.materials as string[]).join(", ")],
                    ["Categories", (data.categories as string[]).join(", ") || "—"],
                    ["Monthly volume", val("volume")],
                    ["Private label", val("privateLabel") || "Not sure"],
                    ["Documents", Object.values(files).filter(Boolean).map((f) => f!.name).join(", ") || "None attached"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-4 py-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="col-span-2">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6"><WhatsAppConsent checked={val("whatsappConsent") === "yes"} onChange={checked=>set("whatsappConsent",checked?"yes":"no")} /></div>
                <label className="mt-6 flex items-start gap-3 text-[14px]">
                  <input type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--ink)]" />
                  I confirm these details are correct and agree to the trade terms [link to terms].
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
        {step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} className="btn-secondary">
            <ArrowLeft size={16} strokeWidth={1.5} /> Back
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary" disabled={state === "sending"}>
          {step < steps.length - 1 ? (
            <>Continue <ArrowRight size={16} strokeWidth={1.5} /></>
          ) : state === "sending" ? (
            "Submitting…"
          ) : (
            "Submit application"
          )}
        </button>
      </div>
      {stepError && <p role="alert" className="mt-4 text-[13px] text-[#9A3B2E]">{stepError}</p>}
      {state === "error" && <p role="alert" className="mt-4 text-[13px] text-[#9A3B2E]">{errorMessage || "Something went wrong. Please try again."}</p>}
    </form>
  );
}



