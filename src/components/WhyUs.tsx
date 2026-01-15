import { CheckCircle, Clock, Award, Users, DollarSign } from "lucide-react";

const features = [
  {
    icon: Clock,
    title: "Fast Delivery",
    description: "Most projects completed on schedule. We respect your timeline and keep you updated every step of the way."
  },
  {
    icon: DollarSign,
    title: "Fair Pricing",
    description: "Transparent costs with no surprise fees. We offer flexible packages to fit your business budget."
  },
  {
    icon: Users,
    title: "Industry Experts",
    description: "Our team brings years of web development experience and stays current with latest technologies."
  }
];

const benefits = [
  "Transparent pricing with detailed proposals",
  "Front-end design review before development",
  "Mobile-optimized for all devices",
  "SEO-friendly structure and markup",
  "Ongoing support and maintenance included"
];

const WhyUs = () => {
  return (
    <section id="why-us" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <div>
            <p className="text-primary font-medium mb-2 tracking-wider uppercase">Why Choose Us</p>
            <h2 className="font-display text-4xl md:text-6xl text-foreground mb-6">
              PARTNERS IN YOUR{' '}
              <span className="text-primary">GROWTH</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              We don't just build websites – we partner with small businesses to create digital solutions that drive real results. Our team understands the challenges facing growing companies and builds scalable, efficient websites that deliver measurable impact.
            </p>

            {/* Benefits List */}
            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Feature Cards */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="flex gap-6 p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
