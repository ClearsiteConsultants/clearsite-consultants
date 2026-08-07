'use client';

import { CheckCircle, Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { handleAnchorClick } from "@/lib/utils";

const prices = {
  basicWebsite: {
    setup: 500,
    monthly: 10,
    annual: 100,
  },
  featureRichWebsite: {
    setup: 2000,
    monthly: 20,
    annual: 200,
  },
  consulting: {
    hourly: 100,
  },
  websiteRefresher: {
    base: 200,
  },
} as const;

const mainTiers = [
  {
    name: "Starter Website",
    tagline: "Get online fast",
    setupFee: prices.basicWebsite.setup,
    monthly: prices.basicWebsite.monthly,
    annual: prices.basicWebsite.annual,
    features: [
      "Professional, mobile-friendly website",
      "Up to 5 pages",
      "Contact form included",
      "Hosting & domain guidance",
      "Ongoing maintenance & updates",
    ],
    highlighted: true,
  },
  {
    name: "Feature-Rich Website / App",
    tagline: "Grow your business online",
    setupFee: prices.featureRichWebsite.setup,
    monthly: prices.featureRichWebsite.monthly,
    annual: prices.featureRichWebsite.annual,
    features: [
      "Everything in Starter Website, scoped to your needs during a free consultation",
      "Up to 100 pages",
      "Priority maintenance & support",
    ],
    addons: [
      "Blog posting & live content updates",
      "E-commerce & secure checkout",
      "Online scheduling / booking",
      "Customer tracking & accounts",
      "Payment processing integration",
      "Custom functionality & integrations",
    ],
    addonsLabel: "Common add-ons include:",
    highlighted: false,
  },
];

const additionalServices = [
  {
    name: "Custom & Advanced Consulting",
    price: `$${prices.consulting.hourly} / hour`,
    note: "Initial consultation is free",
    description:
      "Expert guidance on AI, automation, integrations, and complex technology challenges. Scope and hours quoted during your free initial consult.",
  },
  {
    name: "Website Content Refresher",
    price: `$${prices.websiteRefresher.base} base fee`,
    note: "Additional work quoted upon review",
    description:
      "Already a client? We'll add new content, update copy, swap images, and keep your site fresh. Additional scope is reviewed and quoted transparently.",
  },
];

export default function Pricing() {
  const pathname = usePathname();
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-2 tracking-wider uppercase">Simple &amp; Transparent</p>
          <h2 className="font-display text-4xl md:text-6xl text-gray-900 mb-4">PRICING</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            No hidden fees, no surprises. Flat-rate pricing so you know exactly what you&apos;re paying.
            All projects start with a <strong className="text-gray-800">free initial consultation</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          {mainTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border transition-all duration-300 shadow-sm ${
                tier.highlighted
                  ? "border-primary bg-white shadow-lg ring-2 ring-primary/20"
                  : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-md"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-8 pb-6 border-b border-gray-100">
                <h3 className="font-display text-2xl text-gray-900 mb-1">{tier.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{tier.tagline}</p>

                <div className="mb-3">
                  <span className="font-display text-5xl text-gray-900">${tier.setupFee.toLocaleString()}</span>
                  <span className="text-gray-500 ml-2 text-sm">one-time setup</span>
                </div>

                <div className="inline-flex items-baseline gap-1 bg-blue-50 text-primary px-3 py-1.5 rounded-lg text-sm font-medium">
                  <span>${tier.monthly}/mo</span>
                  <span className="text-gray-400 font-normal">or</span>
                  <span>${tier.annual}/yr maintenance</span>
                </div>
              </div>

              <div className="p-8 flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-gray-700">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.addons && (
                  <div className="mt-5">
                    {tier.addonsLabel && (
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {tier.addonsLabel}
                      </p>
                    )}
                    <ul className="space-y-1.5 list-disc list-inside">
                      {tier.addons.map((addon) => (
                        <li key={addon} className="text-gray-600 text-sm">
                          {addon}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="px-8 pb-8">
                <Link
                  href="/#contact"
                  onClick={(e) => handleAnchorClick(e, "contact", pathname)}
                  className={`block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                    tier.highlighted
                      ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  Get a Free Quote
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="font-display text-3xl md:text-4xl text-gray-900 mb-2">Additional Services</h3>
            <p className="text-gray-600">One-time or a la carte options for specific needs</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {additionalServices.map((service) => (
              <div
                key={service.name}
                className="p-8 rounded-xl bg-white border border-gray-200 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <h4 className="font-display text-xl text-gray-900 mb-1">{service.name}</h4>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-primary">{service.price}</span>
                </div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">{service.note}</p>
                <p className="text-gray-600 leading-relaxed">{service.description}</p>
                <Link
                  href="/#contact"
                  onClick={(e) => handleAnchorClick(e, "contact", pathname)}
                  className="inline-block mt-6 text-primary font-semibold text-sm hover:underline"
                >
                  Book a free consult →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
