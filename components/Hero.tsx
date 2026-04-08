'use client';

import { Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative bg-tech overflow-hidden py-[60px]">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-blue-50 mb-6 animate-fade-in">
              <Globe className="w-4 h-4 text-primary animate-electric-pulse" />
              <span className="text-sm font-medium text-primary">Affordable Technology Solutions</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-gray-900 leading-[0.95] mb-6 animate-fade-in">
              <span className="block">CUSTOM TECHNOLOGY</span>
              <span className="block text-primary">AT FAIR PRICES</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-8 animate-fade-in">
              Flat-fee builds. Fast delivery. Clean, scalable systems. Websites, automation, and integrations, built for growth.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
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

          <div className="flex justify-center md:justify-end">
            <div className="w-[480px] max-w-full rounded-[2rem] border border-primary/15 bg-white/90 shadow-sm px-10 py-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="font-display text-6xl leading-none text-gray-900">CLEARSITE</p>
              <p className="font-display text-4xl leading-none text-primary">CONSULTANTS</p>
              <div className="mt-8 grid grid-cols-2 gap-3 text-left text-sm text-gray-600">
                <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200">Web Builds</div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200">AI Systems</div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200">Integrations</div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200">Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
