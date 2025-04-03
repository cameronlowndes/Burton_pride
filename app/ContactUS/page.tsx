import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Head from "next/head"; // Import Head for SEO

export default function Contact() {
  return (
    <>
      <Head>
        <title>Burton Pride - Contact Us</title>
        <meta
          name="description"
          content="Have any questions or want to get in touch with Burton Pride? Reach out to us through our contact form or email."
        />
        <meta
          name="keywords"
          content="Burton Pride, contact us, LGBTQ+ community, Pride organization, email us, inquiry"
        />
        <meta name="author" content="Burton Pride" />
      </Head>

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
        <Navbar />

        {/* Hero Section */}
        <header className="text-center flex flex-col items-center gap-6 mt-16">
          <h1 className="text-4xl sm:text-6xl font-bold">Contact Us</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            Have any questions or want to get in touch? We’d love to hear from you!
          </p>
        </header>

        {/* Google Form Embed Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Get in Touch</h2>
          <iframe
            src="https://docs.google.com/forms/d/e/your-form-id/viewform?embedded=true"
            width="640"
            height="480"
            className="w-full max-w-3xl mx-auto"
          >
            Loading…
          </iframe>
        </section>

        {/* Email Button Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Prefer to Email Us?</h2>
          <p className="text-lg mb-6">
            If you’d like to reach us directly via email, click the button below.
            <a href="mailto:prideburton@gmail.com" className="text-black hover:underline"> prideburton@gmail.com</a>.
          </p>

          <a
            href="mailto:burtonpride@gmail.com?subject=Inquiry&body=Hello, I would like to inquire about..."
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Send Us an Email
          </a>
        </section>

        <Footer />
      </div>
    </>
  );
}
