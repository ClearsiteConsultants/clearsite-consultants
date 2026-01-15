import { Code, ShoppingCart, Smartphone, Search, PenTool, LineChart } from "lucide-react";

const services = [
  {
    icon: Code,
    title: "Custom Website Development",
    description: "Build fully custom websites tailored to your business needs, using modern technologies and best practices."
  },
  {
    icon: ShoppingCart,
    title: "E-Commerce Solutions",
    description: "Set up and optimize online stores that convert visitors into customers with secure payment processing."
  },
  {
    icon: Smartphone,
    title: "Responsive Design",
    description: "Beautiful, mobile-first designs that work seamlessly across all devices and screen sizes."
  },
  {
    icon: Search,
    title: "SEO Optimization",
    description: "Improve your online visibility with technical SEO, content optimization, and strategic keyword research."
  },
  {
    icon: PenTool,
    title: "UI/UX Design",
    description: "Stunning user interfaces and intuitive experiences that keep visitors engaged and coming back."
  },
  {
    icon: LineChart,
    title: "Performance & Maintenance",
    description: "Keep your site fast, secure, and up-to-date with ongoing support and optimization."
  }
];

const Services = () => {
  return (
    <section id="services" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-2 tracking-wider uppercase">What We Do</p>
          <h2 className="font-display text-4xl md:text-6xl text-foreground mb-4">
            OUR SERVICES
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive web solutions designed to help small businesses establish and grow their online presence.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div 
              key={service.title}
              className="group p-8 rounded-xl gradient-card border border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:box-glow transition-all duration-300">
                <service.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
