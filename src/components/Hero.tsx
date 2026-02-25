import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import logo from "@/assets/logo_transparent.png";

interface HeroProps {
  heroImage?: string;
}

const Hero = ({ heroImage }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-start md:items-center bg-white overflow-hidden pt-20">
      {/* Background Logo */}
      <div className="hidden xl:absolute xl:block right-0 top-1/2 -translate-y-1/2 -translate-x-1/4 pointer-events-none z-0">
        <img src={logo} alt="" className="w-96 h-auto object-contain" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-blue-50 mb-6 animate-fade-in">
            <Globe className="w-4 h-4 text-primary animate-electric-pulse" />
            <span className="text-sm font-medium text-primary">Affordable Technology Solutions</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-gray-900 leading-none mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            CUSTOM TECHNOLOGY{' '}
            <span className="text-primary">AT FAIR PRICES</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Low-cost, flat-fee custom solutions for small businesses. Websites, AI automation, apps, and more—built by real people who genuinely want to help you grow.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <a href="#services">
              <Button variant="heroOutline">
                Our Services
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-gray-300 flex justify-center pt-2">
          <div className="w-1.5 h-3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
