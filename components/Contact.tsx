'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
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
    } catch {
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
          <p className="text-primary font-medium mb-2 tracking-wider uppercase">Get In Touch</p>
          <h2 className="font-display text-4xl md:text-6xl text-gray-900 mb-4">
            START YOUR PROJECT
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Let&apos;s discuss your business goals and how we can build a website that drives real results. We&apos;ll get back to you within 24 hours.
          </p>
        </div>

        <div className="grid min-w-0 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="contact-form-card min-w-0 max-w-full overflow-hidden p-8 rounded-2xl bg-gray-50 border border-gray-200">
            <h3 className="contact-form-title font-display text-2xl text-gray-900 mb-6">Send Us a Message</h3>
            <form onSubmit={handleSubmit} className="space-y-6 min-w-0">
              <div className="grid min-w-0 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <Input name="name" placeholder="Your name" className="bg-white border-gray-300" required />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <Input name="email" type="email" placeholder="your@email.com" className="bg-white border-gray-300" required />
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                <Input name="business_name" placeholder="Your company name" className="bg-white border-gray-300" />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <Textarea
                  name="message"
                  placeholder="Tell us about your business and website goals..."
                  rows={4}
                  className="bg-white border-gray-300"
                  required
                />
              </div>
              <Button type="submit" variant="hero" className="contact-submit-button h-auto w-full whitespace-normal px-4 py-4 text-sm tracking-[0.08em]" disabled={isSubmitting || isSubmitted}>
                {isSubmitting ? 'Sending...' : isSubmitted ? 'Message Sent' : 'Send Message'}
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="flex min-w-0 flex-col justify-center">
            <div className="space-y-6">
              {contactInfo.map((item) => (
                <div key={item.label} className="flex min-w-0 items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="contact-info-value block break-words text-lg text-gray-900 font-medium hover:text-primary transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="contact-info-value break-words text-lg text-gray-900 font-medium">{item.value}</p>
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
