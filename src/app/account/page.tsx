import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Trade login" };

export default function AccountPage() {
  return (
    <section className="section">
      <div className="container-site grid gap-16 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-6">Trade login</p>
          <h1 className="display-2">Welcome back.</h1>
          <p className="lede mt-6 max-w-md">Sign in to see trade pricing, line sheets, order history and sample requests.</p>
          <form className="mt-10 grid max-w-md gap-5" aria-describedby="login-note">
            <div>
              <label htmlFor="l-email" className="field-label">Email</label>
              <input id="l-email" type="email" className="field" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="l-pass" className="field-label">Password</label>
              <input id="l-pass" type="password" className="field" autoComplete="current-password" />
            </div>
            <button type="button" disabled className="btn-primary">
              <Lock size={16} strokeWidth={1.5} /> Sign in [connect auth]
            </button>
            <p id="login-note" className="text-[13px] text-muted">
              Login isn’t connected yet — wire up your authentication provider here.
            </p>
          </form>
        </div>
        <div className="self-start border border-line bg-sand p-8 sm:p-10">
          <p className="eyebrow mb-4">New to trade?</p>
          <h2 className="display-3">Open a trade account.</h2>
          <p className="mt-4 text-muted">For retailers, distributors, corporate gifting, private-label brands and importers.</p>
          <Link href="/wholesale#apply" className="btn-secondary mt-8">Apply now</Link>
        </div>
      </div>
    </section>
  );
}
