import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import logo from "@/assets/logo_transparent.png";

const Hero = () => {
  return (
    <section className="relative bg-tech overflow-hidden py-[60px]">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          {/* Text Content */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-blue-50 mb-6 animate-fade-in">
            <Globe className="w-4 h-4 text-primary animate-electric-pulse" />
            <span className="text-sm font-medium text-primary">Affordable Technology Solutions</span>
          </div>
          {/* Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-gray-900 leading-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="block">CUSTOM TECHNOLOGY</span>
            <span className="block text-primary">AT FAIR PRICES</span>
          </h1>
          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Flat-fee builds. Fast delivery. Clean, scalable systems. Websites, automation, and integrations—built for growth.
          </p>
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <a href="#contact">
              <Button variant="hero">Book a Free Consult</Button>
            </a>
            <a href="#pricing">
              <Button variant="heroOutline">View Pricing</Button>
            </a>
          </div>
          <p className="mt-4 text-sm uppercase tracking-wider text-gray-500">
            Web • Automations • Integrations • Support
          </p>
          </div>
          {/* Logo Column */}
          <div className="flex justify-center md:justify-end">
            <img src={logo} alt="" className="w-[480px] max-w-full h-auto object-contain" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
