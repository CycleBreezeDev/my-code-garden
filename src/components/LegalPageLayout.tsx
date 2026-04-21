import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  children: ReactNode;
}

const LegalPageLayout = ({ title, subtitle, updatedAt, children }: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28">
        <section className="border-b border-border/60 bg-card/30">
          <div className="mx-auto max-w-4xl px-6 py-12">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-2xl text-base text-muted-foreground">{subtitle}</p>
            )}
            {updatedAt && (
              <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                Last updated {updatedAt}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-12">
          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
            {children}
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPageLayout;
