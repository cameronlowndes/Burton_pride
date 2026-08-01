import MetaHead from "../components/MetaHead";

export const metadata = {
  title: "Burton Pride C.I.C. Website Policy - Terms and Conditions",
  description:
    "Official Burton Pride C.I.C. Website Policy Terms and Conditions, matching the downloadable PDF version.",
};

const PDF_URL = "/Document/BurtonPrideCICWebsitePolicies.pdf";
const PDF_FILENAME = "BurtonPrideCICWebsitePolicies.pdf";

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r px-4 pb-24 pt-8 text-white sm:px-8 sm:pt-16">
      <MetaHead
        title="Website Policy Terms and Conditions | Burton Pride C.I.C."
        description="Read the official Burton Pride C.I.C. Website Policy Terms and Conditions and download the verified PDF."
      />

      <main className="mx-auto mt-16 w-full max-w-4xl rounded-2xl bg-white p-6 text-black shadow-2xl sm:p-10">
        <header className="border-b border-gray-200 pb-7 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-purple-700">
            Burton Pride C.I.C. Website Policy
          </p>
          <h1 className="mt-3 text-4xl font-black text-gray-950 sm:text-6xl">
            Terms and Conditions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-gray-600">
            The terms shown below match the Terms and Conditions section of the
            official downloadable Burton Pride C.I.C. Website Policy PDF.
          </p>
        </header>

        {/* 1. Introduction */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            1. Introduction
          </h2>

          <p className="mb-3 leading-7 text-gray-700">
            Welcome to Burton Pride C.I.C.
          </p>

          <p className="mb-3 leading-7 text-gray-700">
            These Terms and Conditions govern your use of our website, services,
            and any interaction with Burton Pride C.I.C.
          </p>

          <p className="mb-3 leading-7 text-gray-700">
            Burton Pride C.I.C is a grassroots, community-led organisation,
            created by the community, for the community. Our purpose is to
            support, represent, and celebrate the LGBTQIA+ community. We are
            committed to operating in a way that is ethical, transparent,
            inclusive, and accountable.
          </p>

          <p className="leading-7 text-gray-700">
            By using this website, you agree to these Terms and to act in a way
            that respects our values and the community we serve.
          </p>
        </section>

        {/* 2. Use of Website */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            2. Use of Website
          </h2>

          <p className="mb-3 leading-7 text-gray-700">
            By accessing this website, you agree to use it lawfully,
            respectfully, and responsibly.
          </p>

          <p className="mb-2 leading-7 text-gray-700">You must not:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Use the website for unlawful, harmful, or abusive purposes</li>
            <li>
              Attempt to gain unauthorised access to any systems, servers, or
              admin areas
            </li>
            <li>
              Disrupt or interfere with the website&apos;s functionality or
              security
            </li>
            <li>Submit false or misleading information through any forms</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            We reserve the right to restrict or remove access where these terms
            are breached.
          </p>
        </section>

        {/* 3. Ethical Data Use and Protection */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            3. Ethical Data Use and Protection
          </h2>

          <p className="mb-3 leading-7 text-gray-700">
            We collect and process personal data in accordance with UK GDPR.
          </p>

          <p className="mb-2 leading-7 text-gray-700">
            We may collect data when you:
          </p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Visit our website</li>
            <li>
              Submit forms (contact, volunteer, sponsor, competition entry)
            </li>
            <li>Upload content (such as images)</li>
            <li>Make payments or interact with our services</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            Your data may include your name, contact details, and information
            you provide.
          </p>

          <p className="mb-2 mt-3 leading-7 text-gray-700">We commit to:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Collecting only necessary and relevant data</li>
            <li>Using data only for its intended purpose</li>
            <li>
              Storing data securely using trusted systems, including Supabase
              and the Burton Pride Admin Portal
            </li>
            <li>Restricting access to authorised personnel only</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            We will never sell, trade, or exploit your personal data for
            financial gain.
          </p>
        </section>

        {/* 4. Third-Party Service Providers */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            4. Third-Party Service Providers
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            We use trusted third-party providers to operate our services,
            including:
          </p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Supabase (database and hosting)</li>
            <li>Stripe and PayPal (payments)</li>
            <li>Shopify (e-commerce)</li>
            <li>Email and communication services</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            These providers may process data on our behalf. We aim to work only
            with ethical providers that meet strong data protection and security
            standards.
          </p>
        </section>

        {/* 5. Payments, Donations, and Financial Ethics */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            5. Payments, Donations, and Financial Ethics
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            Payments made through our website are processed securely via
            third-party providers.
          </p>

          <p className="mb-2 leading-7 text-gray-700">We commit to:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Not storing full payment card details</li>
            <li>Ensuring secure and reliable payment processing</li>
            <li>Using all funds to support Burton Pride&apos;s community mission</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            As a grassroots organisation, all income is reinvested into
            delivering events and services.
          </p>
        </section>

        {/* 6. Your Rights */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            6. Your Rights
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            Under UK GDPR, you have the right to:
          </p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent at any time</li>
            <li>Restrict or object to data processing</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            We aim to respond to valid requests within 30 days.
          </p>
        </section>

        {/* 7. Data Retention */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            7. Data Retention
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            We retain personal data only for as long as necessary.
          </p>

          <p className="mb-2 leading-7 text-gray-700">Data may be kept:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>While you are actively engaging with Burton Pride</li>
            <li>For legal, safeguarding, or administrative purposes</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            When no longer required, data will be securely deleted or
            anonymised.
          </p>
        </section>

        {/* 8. Intellectual Property */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            8. Intellectual Property
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            All website content (text, images, branding, design) belongs to
            Burton Pride C.I.C unless stated otherwise.
          </p>

          <p className="mb-2 leading-7 text-gray-700">You may:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Share content for non-commercial, community purposes</li>
          </ul>

          <p className="mb-2 mt-3 leading-7 text-gray-700">You must not:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Use content for commercial gain without permission</li>
            <li>Misrepresent or alter content in a harmful way.</li>
          </ul>
        </section>

        {/* 9. Liability and Disclaimer */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            9. Liability and Disclaimer
          </h2>

          <p className="mb-2 leading-7 text-gray-700">
            We aim to ensure all information is accurate and up to date, but we
            do not guarantee completeness.
          </p>

          <p className="mb-2 leading-7 text-gray-700">We are not liable for:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Loss or damage from use of the website</li>
            <li>Temporary downtime or technical issues</li>
            <li>Issues caused by third-party services</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            Use of the website is at your own risk.
          </p>
        </section>

        {/* 10. Transparency, Accountability, and Community Commitment */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            10. Transparency, Accountability, and Community Commitment
          </h2>

          <p className="mb-3 leading-7 text-gray-700">
            Transparency and accountability are fundamental to Burton Pride
            C.I.C.
          </p>

          <p className="mb-4 leading-7 text-gray-700">
            We are committed to operating in a way that is open, ethical, and
            always in the best interests of the community.
          </p>

          <h3 className="mb-2 mt-5 text-xl font-bold text-gray-900">
            Our Commitment to the Community
          </h3>

          <p className="mb-2 leading-7 text-gray-700">We commit to:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>
              Being open about how Burton Pride operates, including decisions,
              funding, and technology used
            </li>
            <li>
              Making ethical decisions that prioritise inclusivity, fairness,
              and community wellbeing
            </li>
            <li>Using funds responsibly to support our mission</li>
            <li>Working only with ethical partners and sponsors</li>
            <li>Remaining fully independent from external control or influence</li>
            <li>Ensuring the community remains at the centre of all decisions</li>
          </ul>

          <h3 className="mb-2 mt-6 text-xl font-bold text-gray-900">
            Sponsorship Conduct and Termination Rights
          </h3>

          <p className="mb-3 leading-7 text-gray-700">
            All sponsors and partners must respect the values and independence
            of Burton Pride C.I.C.
          </p>

          <p className="mb-2 leading-7 text-gray-700">
            We reserve the right to immediately terminate any sponsorship or
            partnership without compensation if a sponsor or partner:
          </p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Attempts to control or override Burton Pride decisions</li>
            <li>Acts in a way that harms or misrepresents the community</li>
            <li>Uses Burton Pride for purposes that conflict with our values</li>
            <li>Attempts to place commercial interests above the community</li>
          </ul>

          <p className="mb-2 mt-3 leading-7 text-gray-700">In such cases:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>All association and branding rights may be removed</li>
            <li>The partnership will be ended immediately</li>
            <li>No financial compensation or refund will be provided</li>
          </ul>

          <h3 className="mb-2 mt-6 text-xl font-bold text-gray-900">
            Community-First Principle
          </h3>

          <p className="mb-3 leading-7 text-gray-700">
            Burton Pride C.I.C will always remain a community-led organisation,
            built on the principle of &ldquo;by the community, for the
            community.&rdquo;
          </p>

          <p className="mb-2 leading-7 text-gray-700">This means:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>
              The needs, safety, and wellbeing of the community will always come
              before financial or commercial interests
            </li>
            <li>
              No external organisation will be allowed to influence or control
              Burton Pride in a way that conflicts with our purpose
            </li>
            <li>
              We will actively protect the integrity, inclusivity, and
              representation of the community
            </li>
            <li>
              All decisions will be made with long-term community benefit in
              mind
            </li>
          </ul>

          <p className="mt-3 leading-7 text-gray-700">
            We will safeguard the organisation from any influence that could
            compromise its values, mission, or independence.
          </p>

          <h3 className="mb-2 mt-6 text-xl font-bold text-gray-900">
            Accountability and Raising Concerns
          </h3>

          <p className="mb-3 leading-7 text-gray-700">
            We welcome feedback and accountability from the community.
          </p>

          <p className="mb-3 leading-7 text-gray-700">
            If you believe Burton Pride C.I.C is not meeting these standards,
            you have the right to raise concerns.
          </p>

          <p className="mb-2 leading-7 text-gray-700">We commit to:</p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-gray-700">
            <li>Reviewing all concerns fairly and without bias</li>
            <li>Responding in a respectful and timely manner</li>
            <li>Taking appropriate action where necessary</li>
            <li>Being transparent about outcomes where appropriate</li>
          </ul>
        </section>

        {/* Contact - part of the official PDF terms */}
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">Contact</h2>

          <p className="leading-7 text-gray-700">
            For any concerns, data requests, or general enquiries, please
            contact:
          </p>

          <p className="mt-3 leading-7 text-gray-700">
            <a
              href="mailto:Info@burtonpride.co.uk"
              className="font-semibold text-blue-700 underline-offset-4 hover:underline"
            >
              Info@burtonpride.co.uk
            </a>
          </p>

          <p className="mt-4 font-semibold leading-7 text-gray-700">
            Simon Whale
          </p>
          <p className="leading-7 text-gray-700">
            Chair of Burton Pride C.I.C.
          </p>
          <p className="leading-7 text-gray-700">April 2026</p>
        </section>

        {/* Separate website notice - not part of the official terms wording */}
        <aside className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-xl font-bold text-amber-950">
            Official document notice
          </h2>
          <p className="mt-3 leading-7 text-amber-950/85">
            The Terms and Conditions above reproduce the Terms and Conditions
            section of the official PDF. The PDF remains the downloadable
            reference copy and must not be edited or presented as an amended
            Burton Pride C.I.C. policy.
          </p>
        </aside>

        {/* Download controls */}
        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-2xl font-bold text-blue-950">
            Official Burton Pride C.I.C. Website Policy PDF
          </h2>

          <p className="mt-3 leading-7 text-gray-700">
            The download contains the Website Terms and Conditions, Website
            Privacy Policy and Website Cookies Policy. It is provided for
            reading and reference and must not be changed.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              href={PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 font-bold text-white shadow transition hover:bg-blue-800"
            >
              View official PDF
            </a>

            <a
              href={PDF_URL}
              download={PDF_FILENAME}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-3 font-bold text-white shadow transition hover:bg-black"
            >
              Download official PDF
            </a>
          </div>

       
        </section>
      </main>
    </div>
  );
};

export default TermsPage;
