'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { uploadFiles } from '@/lib/uploadthing'; // ✅ UploadThing client helper

export default function CompetitionPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePreview = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ✅ Upload image via UploadThing (NEW backend)
  const uploadImageToUploadThing = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file.');
    }

    const maxSizeMb = 8;
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new Error(`Image too large. Max ${maxSizeMb}MB.`);
    }

    const uploaded = await uploadFiles('imageUploader', {
      files: [file],
    });

    const url = uploaded?.[0]?.url;
    if (!url) throw new Error('Image upload failed');

    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consent) return alert('You must agree to the terms before submitting!');

    const { businessName, contactName, email, phone, address } = formData;
    if (!businessName || !contactName || !email || !phone || !address) {
      return alert('Please fill out all required fields!');
    }

    try {
      setLoading(true);

      // 1) upload image (optional) via UploadThing
      let imageUrl: string | null = null;
      if (selectedFile) {
        imageUrl = await uploadImageToUploadThing(selectedFile);
      }

      // 2) save entry via your server
      const entryRes = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, imageUrl }),
      });

      const entryData = await entryRes.json();
      if (!entryRes.ok) {
        throw new Error(entryData?.error || 'Failed to save entry');
      }

      const entryId = entryData.entryId as string;

      // 3) create Stripe checkout session
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, entryId, imageUrl }),
      });

      const data = await res.json();

      if (data.url) {
        window.open(
          data.url,
          'stripeCheckout',
          'width=500,height=800,resizable,scrollbars=yes'
        );
      } else {
        alert('Entry saved, but Stripe session failed. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const autoFillForm = () => {
    setFormData({
      businessName: 'Test Business Ltd',
      contactName: 'John Doe',
      email: 'test@example.com',
      phone: '0123456789',
      address: '123 Test Street, Burton',
      website: 'https://example.com',
    });
    setConsent(true);
    setPreview('/image/Logo.png');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-24 pt-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="animate-scaleUp rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white mb-8"
        style={{ width: 180, height: 180 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
      >
        <Image
          src="/image/Logo.png"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="rounded-full object-cover"
        />
      </motion.div>

      <motion.h1
        className="text-5xl sm:text-6xl font-extrabold mb-12 text-center drop-shadow-lg"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        🌈 Windows Of Hope Competition 2026
      </motion.h1>

      <div className="flex flex-col lg:flex-row items-start gap-12 w-full max-w-6xl">
        <motion.form
          onSubmit={handleSubmit}
          className="flex-1 bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex flex-col gap-4 shadow-2xl border border-white/20"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <input
            type="text"
            placeholder="Business Name"
            value={formData.businessName}
            onChange={(e) =>
              setFormData({ ...formData, businessName: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Contact Name"
            value={formData.contactName}
            onChange={(e) =>
              setFormData({ ...formData, contactName: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Business Address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Website / Social Media (optional)"
            value={formData.website}
            onChange={(e) =>
              setFormData({ ...formData, website: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
          />

          <label className="font-semibold mt-2">Upload Photo / Design</label>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer w-full max-w-sm mx-auto aspect-square flex items-center justify-center border-2 border-dashed border-white/50 rounded-xl bg-white/10 hover:bg-white/20 transition relative overflow-hidden"
          >
            {!preview ? (
              <span className="text-white/80 font-medium text-center px-4">
                Click to Upload Image
              </span>
            ) : (
              <>
                <img
                  src={preview}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover rounded-xl transition transform hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white font-semibold transition">
                  Change Image
                </div>
              </>
            )}

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) =>
                e.target.files && handleImagePreview(e.target.files[0])
              }
              className="hidden"
            />
          </div>

          {preview && (
            <button
              type="button"
              onClick={removeImage}
              className="w-full max-w-sm mx-auto mt-2 bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-lg transition cursor-pointer"
            >
              Remove Photo
            </button>
          )}

          <label className="flex items-center gap-3 mt-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5 rounded border-white/50 text-yellow-400 focus:ring-yellow-400"
            />
            <span className="text-white/90 font-medium">
              I agree to the terms and conditions
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg shadow-pink-500/50 hover:scale-105 transition transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Processing...' : 'Submit & Pay'}
          </button>

          <button
            type="button"
            onClick={autoFillForm}
            className="mt-2 bg-yellow-400 text-black font-bold py-2 rounded-lg hover:bg-yellow-300 transition"
          >
            Auto-Fill Form (Test Only)
          </button>
        </motion.form>

        <motion.div
          className="flex-1 flex flex-col justify-center gap-6"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
            Show your creativity and Pride spirit! Enter our competition for a
            chance to win amazing prizes. Upload your design, photo, or artwork
            and take part in the celebration.
          </p>
          <p className="text-lg sm:text-xl font-bold text-white/90">Entry Fee: £2</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
