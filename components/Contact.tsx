'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const contactInfo = [
  {
    icon: MapPin,
    label: "Location",
    value: "Eagle Mountain, UT (Remote Available)"
  },
  {
    icon: Phone,
    label: "Phone",
    value: "801-709-1872",
    href: "tel:+18017091872"
  },
  {
    icon: Mail,
    label: "Email",
    value: "hello@clearsiteconsultants.com",
    href: "mailto:hello@clearsiteconsultants.com"
  },
  {
    icon: Clock,
    label: "Response Time",
    value: "24 hours or less"
  }
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      businessName: formData.get('business_name'),
      message: formData.get('message'),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      toast({
        title: "Message sent!",
        description: "We'll get back to you within 24 hours.",
      });

      form.reset();
      setIsSubmitted(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again or call us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-blue-600 font-medium mb-2 tracking-wider uppercase">Get In Touch</p>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            START YOUR PROJECT
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Let's discuss your business goals and how we can build a website that drives real results. We'll get back to you within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Send Us a Message</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <Input name="name" placeholder="Your name" className="bg-white border-gray-300" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <Input name="email" type="email" placeholder="your@email.com" className="bg-white border-gray-300" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                <Input name="business_name" placeholder="Your company name" className="bg-white border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <Textarea
                  name="message"
                  placeholder="Tell us about your business and website goals..."
                  rows={4}
                  className="bg-white border-gray-300"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || isSubmitted}>
                {isSubmitting ? 'Sending...' : isSubmitted ? 'Message Sent' : 'Send Message'}
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col justify-center">
            <div className="space-y-6">
              {contactInfo.map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-lg text-gray-900 font-medium hover:text-blue-600 transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-lg text-gray-900 font-medium">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
