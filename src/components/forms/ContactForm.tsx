"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { submitForm } from "@/lib/submit";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState("sending");
    try {
      await submitForm("contact", data);
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done")
    return (
      <div className="py-10">
        <Check size={32} strokeWidth={1.5} className="text-accent" />
        <p className="mt-4 font-display text-[30px]">Thank you — we’ll be in touch.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="c-name" className="field-label">Name</label>
        <input id="c-name" name="name" required className="field" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="c-email" className="field-label">Email</label>
        <input id="c-email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="c-phone" className="field-label">Phone</label>
        <input id="c-phone" name="phone" type="tel" className="field" autoComplete="tel" />
      </div>
      <div>
        <label htmlFor="c-topic" className="field-label">Topic</label>
        <select id="c-topic" name="topic" className="field appearance-none" defaultValue="Retail purchase">
          <option>Retail purchase</option>
          <option>Custom / bespoke piece</option>
          <option>Wholesale / private label</option>
          <option>Import / export</option>
          <option>Something else</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className="field-label">Message</label>
        <textarea id="c-message" name="message" rows={5} required className="field py-3" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
        {state === "error" && <p role="alert" className="mt-3 text-[13px] text-[#9A3B2E]">Something went wrong. Please try again.</p>}
      </div>
    </form>
  );
}
