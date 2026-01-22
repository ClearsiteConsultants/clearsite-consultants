import { Code, ShoppingCart, Smartphone, Search, PenTool, LineChart, Zap, BarChart3, Lock, Briefcase, Bot, Calendar } from "lucide-react";

const coreServices = [
  {
    icon: Code,
    title: "Small Business Websites",
    description: "Get your business on Google fast and easy. Professional, mobile-friendly websites optimized for search and built to help you grow."
  },
  {
    icon: ShoppingCart,
    title: "E-Commerce & Payment",
    description: "Sell online with secure payment systems. Premium add-on for websites with checkout, inventory management, and transaction security."
  },
  {
    icon: Calendar,
    title: "Online Scheduling",
    description: "Let customers book appointments and services directly from your website. Perfect for service-based businesses."
  },
  {
    icon: Smartphone,
    title: "Custom Mobile Apps",
    description: "Stand out with custom iOS and Android apps built specifically for your business needs and budget."
  },
  {
    icon: Briefcase,
    title: "Windows & Mac Desktop Apps",
    description: "Custom software applications for Windows or Mac to streamline your business operations and workflows."
  },
  {
    icon: Zap,
    title: "Quick & Easy Consulting",
    description: "Need guidance on a technology challenge? Get expert consulting from real people who genuinely care about your success."
  }
];

const aiAndAutomation = [
  {
    icon: Bot,
    title: "Custom AI Agents & Bots",
    description: "Intelligent assistants tailored to your business. Automate customer service, support, and internal processes."
  },
  {
    icon: BarChart3,
    title: "AI Automation & Lead Generation",
    description: "Automate tedious business flows like email newsletters and marketing. Find and convert customers with smart lead generation tools."
  },
  {
    icon: Lock,
    title: "Self-Hosted Secure Services",
    description: "Secure, self-hosted alternatives to popular tools (like Google Docs). Keep your data in your control."
  },
  {
    icon: LineChart,
    title: "3rd Party Integrations & Marketing",
    description: "Connect your website and tools with powerful integrations to enhance marketing, advertising, and customer reach."
  }
];

const Services = () => {
  return (
    <section id="services" className="py-24 gradient-hero">
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

        {/* Core Services */}
        <div className="mb-20">
          <div className="mb-12">
            <h3 className="font-display text-3xl md:text-4xl text-gray-900 mb-2">Core Solutions</h3>
            <p className="text-gray-600">Essential services for small businesses looking to establish and grow online</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreServices.map((service, index) => (
              <div
                key={service.title}
                className="group p-8 rounded-xl bg-white border border-gray-200 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-all duration-300">
                  <service.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-2xl text-gray-900 mb-3">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI & Advanced Services */}
        <div>
          <div className="mb-12">
            <h3 className="font-display text-3xl md:text-4xl text-gray-900 mb-2">AI & Advanced Solutions</h3>
            <p className="text-gray-600">Cutting-edge technology to automate processes and enhance your marketing reach</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiAndAutomation.map((service, index) => (
              <div
                key={service.title}
                className="group p-8 rounded-xl bg-white border border-gray-200 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-all duration-300">
                  <service.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-2xl text-gray-900 mb-3">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
