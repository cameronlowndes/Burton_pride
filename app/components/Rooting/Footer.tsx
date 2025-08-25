import Link from 'next/link';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full bg-gradient-to-r from-teal-400 via-cyan-500 to-purple-600 text-white shadow-2xl py-10 px-6 overflow-hidden">
      {/* Neon Glow Circles */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-cyan-400/50 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-purple-400/50 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/30 rounded-full blur-3xl animate-pulse"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Copyright & Links */}
        <div className="text-center md:text-left space-y-2">
          <p className="font-bold text-lg md:text-xl drop-shadow-lg">
            &copy; {currentYear} Burton Pride | CIC No: 15490242
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-1">
            <Link
              href="/terms"
              className="hover:text-yellow-300 transition-colors duration-300 font-semibold"
            >
              Terms
            </Link>
            <a
              href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold hover:text-cyan-100 transition-colors duration-300"
            >
              Donate
            </a>
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <a
            href="https://www.facebook.com/profile.php?id=61556621159422"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-blue-600 p-4 rounded-full shadow-xl hover:scale-125 transform transition duration-300 hover:shadow-cyan-400/60"
          >
            <FaFacebookF size={20} />
          </a>
          <a
            href="https://www.instagram.com/prideburton/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-pink-500 p-4 rounded-full shadow-xl hover:scale-125 transform transition duration-300 hover:shadow-purple-400/60"
          >
            <FaInstagram size={20} />
          </a>
        </div>
      </div>

      {/* Powered By */}
      <div className="mt-6 text-center text-sm md:text-base text-white/80 relative z-10">
        <a
          href="https://camerondigitalworks.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-yellow-300 font-semibold transition-colors duration-300"
        >
          Built and powered by Cameron Digital Works
        </a>
      </div>
    </footer>
  );
}
