'use client';

import { Code, Bot, Smartphone } from "lucide-react";

const services = [
  {
    icon: Code,
    title: "Web Development",
    description: "Modern, responsive websites built with the latest technologies",
  },
  {
    icon: Bot,
    title: "AI Automation",
    description: "Streamline your business with intelligent automation solutions",
  },
  {
    icon: Smartphone,
    title: "App Development",
    description: "Native and cross-platform mobile applications",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Our Services
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive solutions tailored to your business needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="bg-white p-8 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  Learn More →
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
