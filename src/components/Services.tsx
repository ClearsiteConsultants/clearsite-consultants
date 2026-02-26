import { Code, Bot, Smartphone, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Code,
    title: "Web Development",
    description: "High-performance marketing sites and web apps with clean UX and solid SEO foundations.",
  },
  {
    icon: Bot,
    title: "AI Automation",
    description: "Automate operations, support, and lead workflows with smart AI tooling and integrations.",
  },
  {
    icon: Smartphone,
    title: "App Development",
    description: "Custom mobile and desktop apps that streamline your workflows and scale with your business.",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-24 bg-tech">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-2 tracking-wider uppercase">What We Do</p>
          <h2 className="font-display text-4xl md:text-6xl text-gray-900 mb-4">
            OUR SERVICES
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Custom technology solutions at affordable flat rates. From simple websites to AI automation, we help your business grow.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="group h-full p-8 rounded-xl bg-white border border-gray-200 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-all duration-300">
                <service.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-gray-900 mb-3">{service.title}</h3>
              <p className="text-gray-600 leading-relaxed mb-6">{service.description}</p>
              <a href="#contact" className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 transition-colors">
                Learn More <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
