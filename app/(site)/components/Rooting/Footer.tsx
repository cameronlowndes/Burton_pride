import Link from "next/link";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="
        relative
        w-full
        overflow-hidden
        bg-gradient-to-r
        from-teal-400
        via-cyan-500
        to-purple-600
        px-6
        py-10
        text-white
        shadow-2xl
        transition-colors
        duration-300

        dark:border-t
        dark:border-white/10
        dark:bg-black
        dark:bg-none
        dark:shadow-[0_-12px_45px_rgba(0,0,0,0.75)]
      "
    >
      {/* Decorative glow circles */}
      <div
        aria-hidden="true"
        className="
          absolute
          -left-20
          -top-20
          h-72
          w-72
          animate-pulse
          rounded-full
          bg-cyan-400/50
          blur-3xl
          transition-opacity
          duration-300

          dark:bg-cyan-500/10
        "
      />

      <div
        aria-hidden="true"
        className="
          absolute
          -bottom-20
          -right-20
          h-72
          w-72
          animate-pulse
          rounded-full
          bg-purple-400/50
          blur-3xl
          transition-opacity
          duration-300

          dark:bg-purple-500/10
        "
      />

      <div
        aria-hidden="true"
        className="
          absolute
          left-1/2
          top-1/2
          h-96
          w-96
          -translate-x-1/2
          -translate-y-1/2
          animate-pulse
          rounded-full
          bg-teal-400/30
          blur-3xl
          transition-opacity
          duration-300

          dark:bg-teal-500/5
        "
      />

      {/* Main content */}
      <div
        className="
          relative
          z-10
          mx-auto
          flex
          max-w-6xl
          flex-col
          items-center
          justify-between
          gap-6

          md:flex-row
        "
      >
        {/* Copyright and links */}
        <div className="space-y-2 text-center md:text-left">
          <p className="text-lg font-bold drop-shadow-lg md:text-xl">
            &copy; {currentYear} Burton Pride | CIC No: 15490242
          </p>

          <div
            className="
              mt-1
              flex
              flex-wrap
              items-center
              justify-center
              gap-4

              md:justify-start
            "
          >
            <Link
              href="/terms"
              className="
                font-semibold
                transition-colors
                duration-300
                hover:text-yellow-300

                dark:hover:text-yellow-300
              "
            >
              Terms
            </Link>

            <Link
              href="/DonateToUs"
              className="
                font-bold
                transition-colors
                duration-300
                hover:text-cyan-100

                dark:hover:text-cyan-300
              "
            >
              Donate
            </Link>

            <Link
              href="/Admin/Login"
              className="
                rounded-full
                border
                border-white/30
                bg-white/20
                px-4
                py-1.5
                text-sm
                font-semibold
                shadow-md
                backdrop-blur-md
                transition-all
                duration-300

                hover:bg-white
                hover:text-purple-700
                hover:shadow-xl

                dark:border-white/15
                dark:bg-white/10
                dark:text-white
                dark:hover:bg-white
                dark:hover:text-black
              "
            >
              🔐 Admin Login
            </Link>
          </div>
        </div>

        {/* Social icons */}
        <div className="mt-4 flex items-center gap-4 md:mt-0">
          <a
            href="https://www.facebook.com/profile.php?id=61556621159422"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Burton Pride on Facebook"
            className="
              transform
              rounded-full
              bg-white
              p-4
              text-blue-600
              shadow-xl
              transition
              duration-300

              hover:scale-125
              hover:shadow-cyan-400/60

              dark:border
              dark:border-white/10
              dark:bg-zinc-950
              dark:text-blue-400
              dark:hover:bg-zinc-900
              dark:hover:shadow-blue-500/30
            "
          >
            <FaFacebookF size={20} />
          </a>

          <a
            href="https://www.instagram.com/prideburton/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Burton Pride on Instagram"
            className="
              transform
              rounded-full
              bg-white
              p-4
              text-pink-500
              shadow-xl
              transition
              duration-300

              hover:scale-125
              hover:shadow-purple-400/60

              dark:border
              dark:border-white/10
              dark:bg-zinc-950
              dark:text-pink-400
              dark:hover:bg-zinc-900
              dark:hover:shadow-pink-500/30
            "
          >
            <FaInstagram size={20} />
          </a>
        </div>
      </div>

      {/* Powered by */}
      <div className="relative z-30 mt-14 flex justify-center">
        <div
          aria-hidden="true"
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
          "
        >
          <div
            className="
              h-64
              w-64
              animate-spin-slow
              rounded-full
              bg-gradient-to-r
              from-fuchsia-500
              via-yellow-400
              to-cyan-500
              opacity-40
              blur-3xl

              sm:h-80
              sm:w-80

              dark:opacity-20
            "
          />
        </div>

        <a
          href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
          target="_blank"
          rel="noopener noreferrer"
          className="
            relative
            bg-gradient-to-r
            from-pink-500
            via-yellow-400
            to-cyan-500
            bg-[length:200%_auto]
            bg-clip-text
            text-center
            text-4xl
            font-extrabold
            uppercase
            tracking-widest
            text-transparent
            drop-shadow-[0_0_25px_rgba(255,255,255,0.95)]
            transition-transform
            duration-500

            animate-gradient-x

            hover:scale-110
            hover:drop-shadow-[0_0_35px_rgba(255,255,255,1)]

            sm:text-5xl
            md:text-6xl

            dark:drop-shadow-[0_0_25px_rgba(236,72,153,0.45)]
            dark:hover:drop-shadow-[0_0_35px_rgba(34,211,238,0.55)]
          "
        >
          🚀 Built &amp; Powered by Cameron Digital Works 🚀
        </a>
      </div>
    </footer>
  );
}