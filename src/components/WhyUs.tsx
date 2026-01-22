import { CheckCircle, Clock, Award, Users, DollarSign, Sparkles } from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Simple, Affordable Pricing",
    description: "Low-cost flat-fee models with no surprise charges. Simple pricing for support and maintenance so you know exactly what you're paying."
  },
  {
    icon: Users,
    title: "Real People to Work With",
    description: "Work directly with our team—no middlemen. We genuinely care about helping small businesses succeed, not just closing deals."
  },
  {
    icon: Sparkles,
    title: "Customization for Everyone",
    description: "Whether you're tech-savvy or not, we help with the basics. Our quick and easy consulting makes complex technology simple."
  },
  {
    icon: Award,
    title: "Built for Small Business Growth",
    description: "We understand your challenges. Our solutions are designed specifically to help small businesses establish, grow, and scale online affordably."
  }
];

const benefits = [
  "Transparent, straightforward pricing—no hidden fees",
  "Quick & easy consulting for non-technical people",
  "Work directly with our team (real people, not bots!)",
  "Flexible packages from websites to AI automation",
  "Ongoing support and maintenance at affordable rates",
  "Solutions that help your business grow"
];

const WhyUs = () => {
  return (
    <section id="why-us" className="py-24 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left Column */}
          <div>
            <p className="text-primary font-medium mb-2 tracking-wider uppercase">Why Choose Us</p>
            <h2 className="font-display text-4xl md:text-6xl text-gray-900 mb-6">
              AFFORDABILITY MEETS{' '}
              <span className="text-primary">EXPERTISE</span>
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              We're different. This isn't about fancy portfolios or high markups—it's about real people helping small businesses get affordable, custom technology solutions. We believe in simple pricing, genuine relationships, and technology that actually helps you grow.
            </p>

            {/* Benefits List */}
            <div className="space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span className="text-gray-800">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Feature Cards */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="flex gap-6 p-6 rounded-xl bg-white border border-gray-200 hover:border-primary/30 transition-all duration-300 shadow-sm"
              >
                <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
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
