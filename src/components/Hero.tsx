import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";

interface HeroProps {
  heroImage: string;
}

const Hero = ({ heroImage }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center gradient-hero overflow-hidden pt-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 flex items-end justify-end pr-12 pb-20">
        <img
          src={heroImage}
          alt="Web Development"
          className="w-full max-w-4xl h-auto object-contain opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/20" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6 animate-fade-in">
            <Globe className="w-4 h-4 text-primary animate-electric-pulse" />
            <span className="text-sm font-medium text-primary">Web Experts</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-foreground leading-none mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            FROM IDEA TO{' '}
            <span className="text-primary text-glow">ONLINE</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Professional web design and development for small businesses. We turn your vision into a powerful online presence that drives growth.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <a href="#services">
              <Button variant="heroOutline">
                Our Services
              </Button>
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border/50 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary text-glow">150+</p>
              <p className="text-sm text-muted-foreground mt-1">Sites Built</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary text-glow">95%</p>
              <p className="text-sm text-muted-foreground mt-1">Client Retention</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary text-glow">4.9</p>
              <p className="text-sm text-muted-foreground mt-1">★ Average Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <div className="w-1.5 h-3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
