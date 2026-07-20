import type { Metadata } from "next";
import Link from "next/link";
import { Playground } from "@/components/Playground";
import { ScalarDocs } from "@/components/ScalarDocs";
import { FlipMark } from "@/components/FlipMark";

const API = "https://api.onflip.xyz";

export const metadata: Metadata = {
  title: "Playground — Flip API",
  description: "Try the Flip API live: natural-language parlays via 0G Compute, raw requests, and the full API reference.",
};

export default function PlaygroundPage() {
  return (
    <div>
      <nav className="sticky top-0 z-50 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <FlipMark height={22} />
          </Link>
          <div className="flex items-center gap-8 text-[15px] font-semibold text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <a href="#reference" className="hover:text-ink">API reference</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <header className="py-12 text-center">
          <h1 className="serif text-5xl tracking-tight sm:text-6xl">Playground</h1>
          <p className="mx-auto mt-4 max-w-md text-[18px] tracking-tight text-muted">
            Everything below hits the live API — real order books, real quotes. Describe a view in
            plain English or send raw JSON.
          </p>
        </header>

        <Playground api={API} />

        <section id="reference" className="pt-20">
          <div className="mb-8 text-center">
            <h2 className="serif text-4xl tracking-tight sm:text-5xl">API reference</h2>
            <p className="mx-auto mt-3 max-w-md text-[17px] tracking-tight text-muted">
              Full schemas, examples, and a request client — generated from the{" "}
              <a className="font-semibold text-ink underline" href={`${API}/openapi.json`}>
                OpenAPI spec
              </a>
              .
            </p>
          </div>
          <ScalarDocs specUrl={`${API}/openapi.json`} />
        </section>
      </main>
    </div>
  );
}
