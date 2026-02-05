'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CompetitionModal({ open, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  if (!open) return null;

  const handleImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Frontend only — entry submitted!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white text-black w-full max-w-lg rounded-2xl p-8 relative shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl font-bold text-gray-500 hover:text-black">✕</button>

        <h2 className="text-2xl font-bold mb-2 text-center">🌈 Pride Competition Entry</h2>
        <p className="text-center mb-4 font-semibold">Entry Fee: £2</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input placeholder="Your Name" className="p-2 border rounded" required />
          <input type="email" placeholder="Your Email" className="p-2 border rounded" required />
          <textarea placeholder="Tell us about your entry..." className="p-2 border rounded" required />

          <label className="font-semibold">Upload Photo / Design</label>
          <input type="file" accept="image/*" onChange={(e) => e.target.files && handleImagePreview(e.target.files[0])} required />

          {preview && <img src={preview} className="rounded-lg max-h-40 object-cover mt-2 border" />}

          <button type="submit" className="bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-500">
            Submit Entry
          </button>
        </form>
      </motion.div>
    </div>
  );
}
