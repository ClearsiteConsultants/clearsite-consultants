import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Use | Clearsite Consultants",
  description: "Terms of Use for the Clearsite Consultants client portal.",
};

export default function TermsOfUse() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Use</h1>
          <p className="text-sm text-gray-500 mb-10">Effective Date: May 6, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the Clearsite Consultants client portal located at{" "}
              <span className="font-medium">clearsiteconsultants.com</span>{" "}(the &ldquo;Portal&rdquo;), you agree to be bound by these Terms of Use
              (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not access or use the Portal. These Terms constitute a legally binding
              agreement between you (&ldquo;Client&rdquo;) and Clearsite Consultants (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Services</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              The Portal provides the following features exclusively to authorized clients of Clearsite Consultants:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>Viewing invoices issued to you by Clearsite Consultants</li>
              <li>Accessing QuickBooks Online payment links to pay outstanding invoices</li>
              <li>Viewing invoice history and payment status</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Access to the Portal is granted solely in connection with an existing business relationship with Clearsite Consultants. The Portal is not a public service and is not available to the general public.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Access and Security</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Your account credentials are personal to you. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>Keeping your password confidential</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately at{" "}
                <a href="mailto:hello@clearsiteconsultants.com" className="text-primary underline hover:opacity-80">hello@clearsiteconsultants.com</a>{" "}
                if you suspect unauthorized access to your account</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              We reserve the right to suspend or terminate accounts that we reasonably believe have been compromised or are being misused.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Permitted Use</h2>
            <p className="text-gray-700 leading-relaxed mb-3">You agree to use the Portal only for its intended purposes. You may not:</p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>Attempt to gain unauthorized access to any part of the Portal or its underlying systems</li>
              <li>Use the Portal to transmit malicious code or interfere with its operation</li>
              <li>Share your account credentials with any other person</li>
              <li>Use the Portal for any unlawful purpose</li>
              <li>Attempt to access another client&rsquo;s account or data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Payment Processing</h2>
            <p className="text-gray-700 leading-relaxed">
              Invoices displayed in the Portal are linked to QuickBooks Online (operated by Intuit Inc.) for payment processing. When you click a payment link, you are redirected to Intuit&rsquo;s platform and subject to{" "}
              <a href="https://www.intuit.com/legal/terms/en-us/quickbooks/online/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">
                Intuit&rsquo;s Terms of Service
              </a>{" "}
              and{" "}
              <a href="https://www.intuit.com/privacy/statement/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">
                Privacy Statement
              </a>. Clearsite Consultants does not process, store, or have access to your payment card or bank account information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              All content, design, and software comprising the Portal are the property of Clearsite Consultants or its licensors and are protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works from any portion of the Portal without our prior written consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disclaimer of Warranties</h2>
            <p className="text-gray-700 leading-relaxed">
              THE PORTAL IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PORTAL WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, CLEARSITE CONSULTANTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PORTAL. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE PORTAL SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO CLEARSITE CONSULTANTS IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed">
              The Portal integrates with QuickBooks Online (Intuit Inc.) for invoicing and payment functionality. Clearsite Consultants is not responsible for the availability, accuracy, or practices of any third-party services. Your use of third-party services is governed by their respective terms and policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may suspend or terminate your access to the Portal at any time, with or without notice, if we reasonably believe you have violated these Terms or if your business relationship with Clearsite Consultants has ended. Upon termination, your right to access the Portal ceases immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to These Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these Terms from time to time. When we do, we will update the effective date at the top of this page. Continued use of the Portal after changes are posted constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Governing Law and Dispute Resolution</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the State of Utah, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Portal shall be resolved exclusively in the state or federal courts located in Utah, and you consent to personal jurisdiction in those courts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mt-3 text-gray-700">
              <p className="font-medium">Clearsite Consultants</p>
              <p>
                <a href="mailto:hello@clearsiteconsultants.com" className="text-primary underline hover:opacity-80">
                  hello@clearsiteconsultants.com
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
