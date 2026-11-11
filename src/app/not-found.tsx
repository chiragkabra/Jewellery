import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container-site py-16 text-center">
        <p className="eyebrow mb-6">404</p>
        <h1 className="display-1">This piece isn’t here.</h1>
        <p className="lede mx-auto mt-6 max-w-md">The page may have moved, or the link may be mistyped.</p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/" className="btn-primary">Back home</Link>
          <Link href="/gold" className="btn-secondary">Browse jewellery</Link>
        </div>
      </div>
    </section>
  );
}
