'use client';

import { motion } from 'framer-motion';
import ContactForm from "../Forms/MessageForm"

export default function ContactContent() {
  return (
    <main className="min-h-screen bg-gradient-to-r  text-white flex flex-col items-center p-8 sm:p-16 pb-40">

      {/* Hero Section */}
      <motion.header
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center flex flex-col items-center gap-6 mt-16"
      >
        <h1 className="text-4xl sm:text-6xl font-bold drop-shadow-md">Contact Us</h1>
        <p className="text-lg sm:text-xl max-w-2xl drop-shadow-sm">
          Have any questions or want to get in touch? We’d love to hear from you!
        </p>
      </motion.header>

      {/* Contact Form */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-16 w-full flex justify-center"
      >
        <div className="w-full max-w-xl">
          <ContactForm />
        </div>
      </motion.section>

      {/* Optional Email Option */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-16 text-center w-full max-w-3xl"
      >
        <h2 className="text-3xl font-semibold mb-6">Prefer to Email Us?</h2>
        <p className="text-lg mb-6">
          Or message us directly at{' '}
          <a 
            href="mailto:Info@burtonpride.co.uk" 
            className="underline font-semibold hover:text-yellow-300 cursor-pointer"
          >
           Info@burtonpride.co.uk
          </a>.
        </p>
        <a
          href="mailto:Info@burtonpride.co.uk?subject=Inquiry&body=Hello, I would like to inquire about..."
          className="bg-white text-pink-600 px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:bg-gray-100 transition duration-300 ease-in-out mb-10 inline-block cursor-pointer"
          aria-label="Send an email to Burton Pride"
        >
          📧 Send Us an Email
        </a>
      </motion.section>
    </main>
  );
}
