'use client';
import { motion } from 'framer-motion';
import { useForm, ValidationError } from '@formspree/react';
import Image from 'next/image';

export default function FeedBack() {
  const [state, handleSubmit] = useForm('xjkaqgyr');

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.3 } },
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24 relative overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Floating Particles */}
      <div className="absolute inset-0 -z-20">
        {/* Pink Pulse */}
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full bg-pink-400/30 blur-3xl"
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{ duration: 6, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '10%', left: '15%' }}
        />
        {/* Purple Pulse */}
        <motion.div
          className="absolute w-[200px] h-[200px] rounded-full bg-purple-400/30 blur-3xl"
          animate={{ y: [0, 15, 0], x: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '50%', left: '70%' }}
        />
        {/* Blue Pulse */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full bg-blue-400/30 blur-3xl"
          animate={{ y: [0, -25, 0], x: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '70%', left: '25%' }}
        />
      </div>

      {/* Hero Section */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16 relative z-10"
        variants={fadeUpVariant}
      >
        <motion.div
          className="rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white"
          style={{ width: 160, height: 160 }}
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={160}
            height={160}
            className="rounded-full object-cover"
          />
        </motion.div>

        <h1 className="text-4xl sm:text-6xl font-bold drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Burton Pride Feedback
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          We’d love to hear your thoughts about this year’s Pride!  
          Your feedback helps us make next year’s celebration even brighter 🌈
        </p>
      </motion.header>

      {/* Info + Form Section */}
      <motion.section
        className="mt-12 w-full max-w-6xl flex flex-col md:flex-row gap-10 relative z-10"
        variants={fadeUpVariant}
      >
        {/* Info Card */}
        <div className="md:w-1/2 bg-white/20 p-6 rounded-2xl shadow-2xl text-white text-lg space-y-4">
          <h2 className="text-2xl font-bold mb-2 text-yellow-300">Why Your Feedback Matters 🌟</h2>
          <p>
            Every year, Burton Pride grows thanks to your voice. Your feedback helps us improve accessibility, inclusivity, and the overall experience for everyone attending.
          </p>
          <p>
            Whether it’s your first Pride or your tenth, we value your honest thoughts. Tell us what you loved, what could be better, or any new ideas you’d like to see next year.
          </p>
          <p>
            Your feedback shapes the future of Burton Pride — it helps us celebrate diversity, create safe spaces, and keep spreading love in our community.
          </p>
          <p>
            Got more to say? Email us anytime at{" "}
            <a href="mailto:prideburton@gmail.com" className="underline text-yellow-300">
              prideburton@gmail.com
            </a>{" "}
            — we’d love to hear from you!
          </p>
        </div>

        {/* Feedback Form Card */}
        <motion.div
          className="md:w-1/2 bg-white/90 border-4 border-white/50 rounded-2xl shadow-2xl p-8 sm:p-10 text-black relative overflow-hidden hover:shadow-pink-400/70 transition-all duration-300"
          variants={fadeUpVariant}
        >
          {state.succeeded ? (
            <p className="text-xl font-semibold text-green-700 text-center">
              🌈 Thank you for your feedback! Your support helps make Burton Pride shine brighter every year.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
              <label htmlFor="email" className="font-semibold">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                className="w-full p-4 rounded-xl border-2 border-pink-400 bg-white text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="you@example.com"
              />
              <ValidationError prefix="Email" field="email" errors={state.errors} />

              <label htmlFor="message" className="font-semibold">
                Your Feedback
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                required
                className="w-full p-4 rounded-xl border-2 border-purple-400 bg-white text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Share your thoughts about Burton Pride..."
              ></textarea>
              <ValidationError prefix="Message" field="message" errors={state.errors} />

              <motion.button
                type="submit"
                disabled={state.submitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300"
              >
                {state.submitting ? 'Sending...' : 'Submit Feedback'}
              </motion.button>
            </form>
          )}
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
