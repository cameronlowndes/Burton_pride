'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import FeedBackForm from '../Forms/FeedBackForm';

export default function FeedBack() {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.3 } },
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' as const },
    },
  };

  return (
    <motion.div
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-gradient-to-r  p-8 pb-24 text-white sm:p-16"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="absolute inset-0 -z-20">
        <motion.div
          className="absolute h-[250px] w-[250px] rounded-full bg-pink-400/30 blur-3xl"
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{ duration: 6, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '10%', left: '15%' }}
        />
        <motion.div
          className="absolute h-[200px] w-[200px] rounded-full bg-purple-400/30 blur-3xl"
          animate={{ y: [0, 15, 0], x: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '50%', left: '70%' }}
        />
        <motion.div
          className="absolute h-[300px] w-[300px] rounded-full bg-blue-400/30 blur-3xl"
          animate={{ y: [0, -25, 0], x: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, repeatType: 'mirror' }}
          style={{ top: '70%', left: '25%' }}
        />
      </div>

      <motion.header
        className="relative z-10 mt-16 flex flex-col items-center gap-6 text-center"
        variants={fadeUpVariant}
      >
        <motion.div
          className="overflow-hidden rounded-full border-4 border-white shadow-2xl shadow-pink-400/50"
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

        <h1 className="text-4xl font-bold drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] sm:text-6xl">
          Burton Pride Feedback
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl">
          We’d love to hear your thoughts about this year’s Pride!
          Your feedback helps us make next year’s celebration even brighter 🌈
        </p>
      </motion.header>

      <motion.section
        className="relative z-10 mt-12 flex w-full max-w-6xl flex-col gap-10 md:flex-row"
        variants={fadeUpVariant}
      >
        <div className="space-y-4 rounded-2xl bg-white/20 p-6 text-lg text-white shadow-2xl md:w-1/2">
          <h2 className="mb-2 text-2xl font-bold text-yellow-300">
            Why Your Feedback Matters 🌟
          </h2>

          <p>
            Every year, Burton Pride grows thanks to your voice. Your feedback helps us
            improve accessibility, inclusivity, and the overall experience for everyone attending.
          </p>

          <p>
            Whether it’s your first Pride or your tenth, we value your honest thoughts.
            Tell us what you loved, what could be better, or any new ideas you’d like to see next year.
          </p>

          <p>
            Your feedback shapes the future of Burton Pride — it helps us celebrate diversity,
            create safe spaces, and keep spreading love in our community.
          </p>

          <p>
            Got more to say? Email us anytime at{" "}
            <a
              href="mailto:info@burtonpride.co.uk"
              className="text-yellow-300 underline"
            >
              info@burtonpride.co.uk
            </a>{" "}
            — we’d love to hear from you!
          </p>
        </div>

        <motion.div
          className="relative overflow-hidden rounded-2xl border-4 border-white/50 bg-white/90 p-8 text-black shadow-2xl transition-all duration-300 hover:shadow-pink-400/70 sm:p-10 md:w-1/2"
          variants={fadeUpVariant}
        >
          <FeedBackForm />
        </motion.div>
      </motion.section>
    </motion.div>
  );
}