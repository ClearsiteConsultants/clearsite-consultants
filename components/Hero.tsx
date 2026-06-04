'use client';

import { Globe } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative bg-tech overflow-hidden py-[60px] max-[1049px]:py-[30px]">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid w-full min-w-0 md:grid-cols-[1.15fr_0.85fr] gap-2 items-start overflow-hidden">
          <div className="max-w-2xl min-w-0 md:col-span-2">
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-blue-50 mb-6 animate-fade-in">
              <Globe className="w-4 h-4 text-primary animate-electric-pulse" />
              <span className="text-sm font-medium text-primary">Affordable Technology Solutions</span>
            </div>
          </div>

          <div className="max-w-2xl min-w-0">
            <h1 className="hero-main-title font-display text-5xl md:text-6xl lg:text-7xl text-gray-900 leading-[0.95] mb-6 animate-fade-in">
              <span className="block">CUSTOM TECHNOLOGY</span>
              <span className="block text-primary">AT FAIR PRICES</span>
            </h1>
          </div>

          <div className="min-w-0 hidden md:flex justify-end self-center">
            <Image
              src="/clearsite-logo-cropped-transparent.png"
              alt="Clearsite Consultants Logo"
              width={480}
              priority
              className="w-[480px] h-auto max-w-full"
            />
          </div>

          <div className="max-w-2xl min-w-0 md:col-start-1">
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

            <div className="mt-6 flex w-full min-w-0 justify-center md:hidden">
              <Image
                src="/clearsite-logo-only-cropped-transparent.png"
                alt="Clearsite Consultants Logo"
                width={420}
                className="block h-auto w-auto max-w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
