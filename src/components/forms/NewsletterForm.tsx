"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { submitForm } from "@/lib/submit";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await submitForm("newsletter", { email });
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done")
    return (
      <p className="inline-flex items-center gap-2 text-[15px] text-ivory/80">
        <Check size={16} strokeWidth={1.5} className="text-accent-light" /> Thank you — you're on the list.
      </p>
    );

  return (
    <form onSubmit={onSubmit} className="flex border-b border-ivory/40 focus-within:border-ivory">
      <label htmlFor="newsletter" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        className="min-h-[48px] w-full bg-transparent text-[15px] text-ivory placeholder:text-ivory/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        aria-label="Subscribe"
        className="grid h-12 w-12 shrink-0 place-items-center text-ivory hover:text-accent-light"
      >
        <ArrowRight size={18} strokeWidth={1.5} />
      </button>
      {state === "error" && <p className="sr-only" role="alert">Could not subscribe. Please try again.</p>}
    </form>
  );
}
