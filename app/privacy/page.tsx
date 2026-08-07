import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Clearsite Consultants",
  description: "Privacy Policy for Clearsite Consultants.",
};

export default function PrivacyPolicy() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-10">Effective Date: May 6, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p className="text-gray-700 leading-relaxed">
              Clearsite Consultants (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates a client portal and invoicing system at{" "}
              <span className="font-medium">clearsiteconsultants.com</span>. This Privacy Policy explains how we collect, use, and protect
              information about our clients (&ldquo;you&rdquo;) when you access the client portal, receive invoices, or make payments through our system.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We collect information that is necessary to manage our business relationship with you and provide invoicing services:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li><span className="font-medium">Contact information</span> — your name, email address, and phone number, which are provided to us directly as part of our engagement.</li>
              <li><span className="font-medium">Account credentials</span> — your email address and a hashed password if you register for portal access.</li>
              <li><span className="font-medium">Invoicing and payment data</span> — invoice amounts, due dates, and payment status. Payment transactions are processed directly through QuickBooks Online (Intuit Inc.); we do not store your credit card or bank account details.</li>
              <li><span className="font-medium">Usage data</span> — basic server logs (IP address, browser type, pages visited) generated when you access the portal, used solely for security and troubleshooting.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>Create and manage your client account in our portal</li>
              <li>Generate, deliver, and track invoices for services rendered</li>
              <li>Sync invoice and customer records with QuickBooks Online</li>
              <li>Communicate with you about invoices, payments, and your account</li>
              <li>Maintain the security and integrity of our systems</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              We do not use your information for marketing to third parties, sell your data, or use it for any purpose unrelated to our business relationship with you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We share limited information with the following third parties solely to operate our services:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>
                <span className="font-medium">Intuit Inc. (QuickBooks Online)</span> — Your name and billing information are shared with QuickBooks Online to generate invoices and process payments. Intuit&rsquo;s privacy practices are governed by the{" "}
                <a href="https://www.intuit.com/privacy/statement/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">Intuit Global Privacy Statement</a>.
              </li>
              <li>
                <span className="font-medium">Neon (database hosting)</span> — Your account and invoice data is stored in a managed PostgreSQL database hosted by Neon. Data is stored within the United States.
              </li>
              <li>
                <span className="font-medium">Vercel (hosting)</span> — Our application is hosted on Vercel. Web requests and server logs may pass through Vercel&rsquo;s infrastructure.
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              We do not share your information with any other third parties without your consent, except as required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your personal information for as long as our business relationship is active and for a reasonable period thereafter to satisfy legal, accounting, or reporting obligations. You may request deletion of your account data at any time by contacting us at the address below, subject to any legal retention requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We use industry-standard measures to protect your information, including encrypted connections (HTTPS/TLS), hashed password storage, and access controls that restrict portal data to authorized users only. No method of transmission or storage is completely secure; however, we take reasonable precautions to protect your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-3">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:developersclearsite@gmail.com" className="text-primary underline hover:opacity-80">developersclearsite@gmail.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              Our portal uses session cookies strictly necessary for authentication (keeping you logged in). We do not use tracking cookies, advertising cookies, or third-party analytics cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this page. Continued use of the portal after changes are posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy is governed by the laws of the State of Utah, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-3 text-gray-700">
              <p className="font-medium">Clearsite Consultants</p>
              <p>
                <a href="mailto:developersclearsite@gmail.com" className="text-primary underline hover:opacity-80">
                  developersclearsite@gmail.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
