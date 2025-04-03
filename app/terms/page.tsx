import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";
import Head from "next/head";

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
      <Navbar />

      <Head>
        <title>Terms and Conditions | Burton Pride</title>
        <meta name="description" content="Terms and conditions for Burton Pride. Learn more about our website use, privacy practices, and limitations." />
        <meta
          name="keywords"
          content="terms and conditions, Burton Pride, privacy policy, website usage, volunteer, donations, collaborations"
        />
        <meta name="author" content="Burton Pride" />
      </Head>

      {/* Terms and Conditions Section */}
      <main className="container mx-auto p-6 bg-white text-black rounded-lg shadow-lg mt-16 max-w-3xl">
        <h1 className="text-4xl sm:text-6xl font-bold text-center mb-6">Terms and Conditions</h1>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">1. Introduction</h2>
          <p className="text-gray-700">
            Welcome to Burton Pride. These terms and conditions outline the rules and regulations for the use of Burton Pride's website and services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">2. Use of Website</h2>
          <p className="text-gray-700">
            By accessing this website, you agree to comply with the following terms and conditions. If you do not agree, please refrain from using this website.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">3. Privacy Policy</h2>
          <p className="text-gray-700">
            Burton Pride is committed to protecting your privacy. This privacy policy outlines how we collect, use, and safeguard your personal data when you use our website or services.
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">3.1 Data We Collect</h3>
          <p className="text-gray-700">
            We may collect the following types of data when you visit our website or interact with us:
            <ul className="list-disc pl-6">
              <li>Personal identification information (such as your name, email address,)</li>
              <li>Browsing data (such as your IP address, browser type, pages visited, and time spent on the site)</li>
              <li>Any information you provide through forms or interactions on our website</li>
            </ul>
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">3.2 How We Use Your Data</h3>
          <p className="text-gray-700">
            The data we collect is used to improve your experience and provide the following services:
            <ul className="list-disc pl-6">
              <li>To personalize your experience and respond to your inquiries</li>
              <li>To process donations or event registrations</li>
              <li>To improve the content and functionality of our website</li>
              <li>To send you updates regarding events, news, and activities related to Burton Pride (you may opt-out at any time)</li>
            </ul>
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">3.3 How We Protect Your Data</h3>
          <p className="text-gray-700">
            We use a variety of security measures to ensure the safety of your personal data:
            <ul className="list-disc pl-6">
              <li>Data encryption to protect sensitive information</li>
              <li>Regular security audits and updates</li>
              <li>Secure servers and secure data transmission protocols</li>
            </ul>
            Despite our efforts, no online service can be 100% secure, so we cannot guarantee the absolute security of your data. However, we are committed to maintaining your privacy and minimizing risks.
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">3.4 Third-Party Services</h3>
          <p className="text-gray-700">
            We do not sell or rent your personal data to third parties. However, we may share your data with third-party service providers for specific purposes such as:
            <ul className="list-disc pl-6">
              <li>Processing payments (e.g., via PayPal or Stripe)</li>
              <li>Sending newsletters or promotional emails</li>
              <li>Analytics and website performance tracking</li>
            </ul>
            These third-party providers are bound by confidentiality agreements and are only allowed to use your data for these specific purposes.
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">3.5 Your Rights</h3>
          <p className="text-gray-700">
            You have the right to:
            <ul className="list-disc pl-6">
              <li>Access, update, or delete your personal data</li>
              <li>Request a copy of your personal data</li>
              <li>Opt-out of receiving marketing emails or communications</li>
            </ul>
            If you would like to exercise these rights, please contact us at{' '}
            <a href="mailto:prideburton@gmail.com" className="text-blue-500 hover:underline">prideburton@gmail.com</a>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">4. Limitation of Liability</h2>
          <p className="text-gray-700">
            Burton Pride is not liable for any direct, indirect, incidental, or consequential damages that arise from using this website.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">5. Changes to Terms</h2>
          <p className="text-gray-700">
            Burton Pride reserves the right to modify these terms at any time. Any changes will be posted on this page, and your continued use of the website signifies acceptance of the updated terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">6. Contact</h2>
          <p className="text-gray-700">
            If you have any questions about these terms or our privacy policy, please contact us at{' '}
            <a href="mailto:prideburton@gmail.com" className="text-blue-500 hover:underline">prideburton@gmail.com</a>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TermsPage;
