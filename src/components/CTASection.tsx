import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card p-12 text-center lg:p-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/8" />
          <div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

          <div className="relative z-10">
            <h2 className="mb-4 font-heading text-3xl font-bold lg:text-4xl">
              Ready to Play for <span className="text-gradient-gold">Millions</span>?
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-base text-muted-foreground">
              Sign up today and get access to the world's biggest lotteries with multi-draw discounts and syndicate play.
            </p>
            <Link to="/register">
              <Button size="lg" className="group bg-primary px-10 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl">
                Get Started Now
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
