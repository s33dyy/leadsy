import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, FolderOpen, PlugZap, Settings } from "lucide-react";
import { GhostLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Leadsy extension download",
  description: "Download and install the private Leadsy browser extension."
};

const steps = [
  {
    icon: Download,
    title: "Download the zip",
    detail: "Save the Leadsy extension package, then unzip it on your computer."
  },
  {
    icon: Settings,
    title: "Open Chrome extensions",
    detail: "Go to chrome://extensions and switch on Developer mode."
  },
  {
    icon: FolderOpen,
    title: "Load unpacked",
    detail: "Click Load unpacked and select the unzipped Leadsy extension folder."
  },
  {
    icon: PlugZap,
    title: "Connect Leadsy",
    detail: "Open the extension side panel, paste your Leadsy URL and extension token, then start monitoring WhatsApp Web."
  }
];

export default function ExtensionDownloadPage() {
  return (
    <main className="page-shell min-h-screen">
      <div className="noise" />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--muted-2)] hover:text-white">
          <ArrowLeft size={16} />
          Leadsy
        </Link>
        <GhostLink href="/login?next=/app/worker">Workspace</GhostLink>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="mono text-xs uppercase text-[var(--teal)]">Private browser worker</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-6xl">Leadsy extension</h1>
            <p className="mt-5 text-base leading-7 text-[var(--muted-2)]">
              Install the private extension manually. It monitors WhatsApp Web, Instagram, Facebook, or other chat pages from the browser while Leadsy receives official inbound WhatsApp webhook identity.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/downloads/leadsy-extension.zip"
                download
                className="inline-flex h-10 items-center justify-center rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:border-teal-200 hover:bg-teal-300/[0.18]"
              >
                <Download className="mr-2" size={16} />
                Download extension
              </a>
              <GhostLink href="/login?next=/app/connect">Get worker token</GhostLink>
            </div>
            <div className="panel-quiet mt-6 p-4">
              <p className="text-sm leading-6 text-[var(--muted-2)]">
                Download URL: <span className="mono text-white">/downloads/leadsy-extension.zip</span>
              </p>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-xl font-semibold text-white">Install without Chrome Web Store</h2>
            <div className="mt-5 grid gap-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="panel-quiet grid grid-cols-[40px_1fr] gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-[var(--teal)]">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="mono text-[11px] uppercase text-[var(--muted)]">Step {index + 1}</p>
                      <h3 className="mt-1 font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{step.detail}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
