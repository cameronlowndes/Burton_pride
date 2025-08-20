'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function CollaborateUpdate() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to the /update page after a short delay
    const timer = setTimeout(() => {
      router.push('/UpdatePage'); // Replace with your actual update page route
    }, 2000); // 2 seconds for users to see message

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-40 h-40 rounded-full overflow-hidden shadow-2xl mb-8"
      >
        <Image
          src="/image/logo.jpg"
          alt="Burton Pride Logo"
          width={160}
          height={160}
          className="rounded-full object-cover w-full h-full"
        />
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-4xl sm:text-5xl font-bold mb-4 text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Page Under Maintenance
      </motion.h1>

      {/* Description */}
      <motion.p
        className="text-lg sm:text-xl text-center max-w-xl mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        We’re updating this page to bring you a better experience. You will be redirected automatically shortly.
      </motion.p>

      {/* Redirect Message */}
      <motion.p
        className="text-md sm:text-lg font-medium text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Redirecting...
      </motion.p>
    </motion.div>
  );
}
