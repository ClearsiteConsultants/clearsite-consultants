'use client';

import { Suspense } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import WhyUs from "@/components/WhyUs";
import Pricing from "@/components/Pricing";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <Services />
      <WhyUs />
      <Pricing />
      <Suspense fallback={null}>
        <Contact />
      </Suspense>
      <Footer />
    </main>
  );
}
