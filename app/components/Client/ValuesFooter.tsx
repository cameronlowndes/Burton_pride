'use client';

import { motion } from 'framer-motion';

export default function ValuesFooter() {
  return (
    <motion.section
      className="mt-16 text-center max-w-4xl pb-15"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
    >
      <p className="text-lg font-medium text-white">
        By joining Burton Pride, you become part of a movement committed to respect, equality, and belonging. Together, we
        build a brighter, more inclusive Burton for all.
      </p>
    </motion.section>
  );
}
