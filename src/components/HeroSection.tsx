import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import heroSlide1 from "@/assets/hero-slide-1.jpg";
import heroSlide2 from "@/assets/hero-slide-2.jpg";
import heroSlide3 from "@/assets/hero-slide-3.jpg";

const slides = [
  {
    image: heroSlide1,
    badge: { icon: Sparkles, text: "Next Powerball Draw: $850M — 2d 14h" },
    heading: ["Play the World's", "Biggest Lotteries"],
    description: "Real tickets for Powerball, Mega Millions, EuroMillions & more. Save up to 20% with multi-draw packages.",
    cta: { label: "Browse Lotteries", href: "/lotteries" },
    ctaSecondary: { label: "Join a Syndicate", href: "/syndicates" },
  },
  {
    image: heroSlide2,
    badge: { icon: Trophy, text: "Over $2 Billion in Jackpots Available" },
    heading: ["Win Life-Changing", "Jackpots Today"],
    description: "From $1 million to $1 billion — play for the world's largest prizes from anywhere. 100% real tickets, scanned & verified.",
    cta: { label: "Play Now", href: "/lotteries" },
    ctaSecondary: { label: "View Results", href: "/results" },
  },
  {
    image: heroSlide3,
    badge: { icon: Users, text: "50/50 Syndicate — Pool & Win Together" },
    heading: ["Better Odds with", "Group Tickets"],
    description: "Join a syndicate, pool your tickets, and multiply your chances. 50% of winnings go to you, 50% shared among the group.",
    cta: { label: "Join a Group", href: "/syndicates" },
    ctaSecondary: { label: "How It Works", href: "/#how-it-works" },
  },
];

const HeroSection = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index === current || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 400);
  }, [current, isTransitioning]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 400);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];

  return (
    <section className="relative min-h-[92vh] overflow-hidden pt-16">
      {/* Background images — all preloaded, opacity-controlled */}
      {slides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 z-0 transition-opacity duration-700 ease-in-out"
          style={{ opacity: i === current && !isTransitioning ? 1 : 0 }}
        >
          <img
            src={s.image}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
            {...(i === 0 ? {} : { loading: "lazy" as const })}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        </div>
      ))}

      {/* Decorative */}
      <div className="absolute right-[12%] top-[18%] h-80 w-80 rounded-full bg-primary/8 blur-[120px] z-[1]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start justify-center px-6 py-28 lg:py-36">
        <div
          className={`max-w-2xl transition-all duration-500 ease-out ${
            isTransitioning ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <slide.badge.icon className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">{slide.badge.text}</span>
          </div>

          <h1 className="mb-6 font-heading text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-7xl">
            {slide.heading[0]}
            <span className="text-gradient-gold block mt-1">{slide.heading[1]}</span>
          </h1>

          <p className="mb-10 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {slide.description}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to={slide.cta.href}>
              <Button size="lg" className="group bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30">
                {slide.cta.label}
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to={slide.ctaSecondary.href}>
              <Button size="lg" variant="outline" className="border-border px-8 text-base font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5">
                {slide.ctaSecondary.label}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats + slide indicators */}
        <div className="mt-14 flex w-full items-end justify-between">
          <div className="grid grid-cols-3 gap-8 border-t border-border/50 pt-8">
            <div>
              <div className="font-heading text-2xl font-bold text-primary">6+</div>
              <div className="text-xs text-muted-foreground mt-0.5">Global Lotteries</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-bold text-primary">50/50</div>
              <div className="text-xs text-muted-foreground mt-0.5">Syndicate Split</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-bold text-primary">100%</div>
              <div className="text-xs text-muted-foreground mt-0.5">Transparent</div>
            </div>
          </div>

          {/* Slide indicators */}
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
