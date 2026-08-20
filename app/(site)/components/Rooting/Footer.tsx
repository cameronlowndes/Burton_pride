import Link from "next/link";
import {
  FaBluesky,
  FaFacebookF,
  FaInstagram,
} from "react-icons/fa6";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="
        relative
        w-full
        overflow-hidden
        border-t
        border-white/20
        bg-[linear-gradient(90deg,#f21f8f_0%,#e92c9d_18%,#b83df2_48%,#6f5cf6_72%,#2f80ed_100%)]
        text-white

        dark:border-white/10
        dark:bg-[linear-gradient(180deg,#0c1119_0%,#0d111a_45%,#13182d_100%)]
        dark:text-white
      "
    >
      {/* =====================================================
          BACKGROUND GLOWS
          ===================================================== */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -left-32
          top-0
          h-96
          w-96
          rounded-full
          bg-pink-300/30
          blur-3xl

          dark:bg-pink-500/5
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-32
          bottom-0
          h-96
          w-96
          rounded-full
          bg-blue-300/30
          blur-3xl

          dark:bg-purple-500/10
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-[18%]
          top-1/2
          h-72
          w-72
          -translate-y-1/2
          rounded-full
          bg-fuchsia-300/20
          blur-3xl

          dark:bg-yellow-500/[0.03]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-[43%]
          top-1/3
          h-72
          w-72
          rounded-full
          bg-purple-300/18
          blur-3xl

          dark:bg-emerald-500/[0.03]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          right-[22%]
          top-1/3
          h-72
          w-72
          rounded-full
          bg-sky-300/25
          blur-3xl

          dark:bg-cyan-500/5
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-white/[0.02]
          backdrop-blur-[1px]

          dark:hidden
        "
      />

      {/* =====================================================
          TOP PRIDE STRIPE
          ===================================================== */}
      <div
        aria-hidden="true"
        className="
          h-2
          w-full
          bg-[linear-gradient(90deg,#ef4444_0%,#f97316_16%,#facc15_32%,#22c55e_48%,#06b6d4_64%,#3b82f6_80%,#a855f7_100%)]
        "
      />

      {/* =====================================================
          MAIN FOOTER CONTENT
          ===================================================== */}
      <div
        className="
          relative
          z-10
          mx-auto
          grid
          w-full
          max-w-7xl
          gap-10
          px-5
          py-12

          sm:px-8
          sm:py-14

          lg:grid-cols-[1.3fr_0.7fr_0.8fr]
          lg:gap-14
          lg:px-10
          lg:py-16
        "
      >
        {/* =====================================================
            BURTON PRIDE
            ===================================================== */}
        <div>
          <p
            className="
              text-sm
              font-black
              uppercase
              tracking-[0.2em]
              text-white/90

              dark:text-purple-300
            "
          >
            Grassroots • Community Led
          </p>

          <h2
            className="
              mt-3
              text-4xl
              font-black
              tracking-tight
              text-white

              sm:text-5xl

              dark:text-white
            "
          >
            Burton Pride
          </h2>

          <p
            className="
              mt-5
              max-w-xl
              text-base
              leading-7
              text-white/90

              sm:text-lg

              dark:text-white/70
            "
          >
            Celebrating LGBTQIA+ people, inclusion, diversity and equality
            across Burton upon Trent and surrounding communities.
          </p>

          <p
            className="
              mt-5
              text-sm
              font-bold
              text-white/75

              dark:text-white/45
            "
          >
            Burton Pride C.I.C. • CIC No: 15490242
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="https://www.facebook.com/profile.php?id=61556621159422"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Burton Pride on Facebook"
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-[#1877F2]
                text-white
                shadow-lg
                transition
                duration-200

                hover:-translate-y-1
                hover:scale-105
                hover:shadow-xl

                focus-visible:outline
                focus-visible:outline-4
                focus-visible:outline-offset-4
                focus-visible:outline-purple-500
              "
            >
              <FaFacebookF size={19} />
            </a>

            <a
              href="https://www.instagram.com/prideburton/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Burton Pride on Instagram"
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-gradient-to-br
                from-[#F58529]
                via-[#DD2A7B]
                to-[#515BD4]
                text-white
                shadow-lg
                transition
                duration-200

                hover:-translate-y-1
                hover:scale-105
                hover:shadow-xl

                focus-visible:outline
                focus-visible:outline-4
                focus-visible:outline-offset-4
                focus-visible:outline-purple-500
              "
            >
              <FaInstagram size={21} />
            </a>

            <a
              href="https://bsky.app/profile/prideinburton.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Burton Pride on Bluesky"
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-[#1185FE]
                text-white
                shadow-lg
                transition
                duration-200

                hover:-translate-y-1
                hover:scale-105
                hover:shadow-xl

                focus-visible:outline
                focus-visible:outline-4
                focus-visible:outline-offset-4
                focus-visible:outline-purple-500
              "
            >
              <FaBluesky size={22} />
            </a>

            <span
              className="
                ml-1
                text-sm
                font-semibold
                text-white/85

                dark:text-white/55
              "
            >
  
            </span>
          </div>
        </div>
        <div>
          <h3
            className="
              text-sm
              font-black
              uppercase
              tracking-[0.2em]
              text-white

              dark:text-white
            "
          >
            Explore
          </h3>

          <nav
            aria-label="Footer navigation"
            className="mt-5 flex flex-col items-start gap-3"
          >
            <Link
              href="/about"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-purple-300
              "
            >
              About Burton Pride
            </Link>

            <Link
              href="/about/OurCoreValues"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-purple-300
              "
            >
              Our Core Values
            </Link>

            <Link
              href="/CommunityArt"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-purple-300
              "
            >
              Community Art
            </Link>

            <Link
              href="/FeedBack"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-purple-300
              "
            >
              Give Feedback
            </Link>

            <Link
              href="/terms"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-purple-300
              "
            >
              Terms & Conditions
            </Link>
          </nav>
        </div>
        <div>
          <h3
            className="
              text-sm
              font-black
              uppercase
              tracking-[0.2em]
              text-white

              dark:text-white
            "
          >
            Get Involved
          </h3>

          <div className="mt-5 flex flex-col items-start gap-3">
            <Link
              href="/DonateToUs"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-pink-300
              "
            >
              Donate
            </Link>

            <Link
              href="/JoinUS/Volunteer"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-green-300
              "
            >
              Volunteer
            </Link>

            <Link
              href="/Sponsor"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-yellow-300
              "
            >
              Sponsor Burton Pride
            </Link>

            <Link
              href="/Collaborate"
              className="
                text-base
                font-semibold
                text-white/85
                transition

                hover:translate-x-1
                hover:text-yellow-200

                dark:text-white/65
                dark:hover:text-cyan-300
              "
            >
              Collaborate With Us
            </Link>
          </div>

          <Link
            href="/DonateToUs"
            className="
              mt-7
              inline-flex
              items-center
              justify-center
              rounded-full
              bg-yellow-300
              px-6
              py-3
              text-sm
              font-black
              text-slate-950
              shadow-lg
              transition
              duration-200

              hover:scale-105
              hover:shadow-xl

              focus-visible:outline
              focus-visible:outline-4
              focus-visible:outline-offset-4
              focus-visible:outline-purple-500
            "
          >
            💖 Support Burton Pride
          </Link>
        </div>
      </div>

      <div
        className="
          relative
          z-10
          border-t
          border-white/20
          bg-black/10
          backdrop-blur-sm

          dark:border-white/10
          dark:bg-black/20
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-7xl
            flex-col
            items-center
            justify-between
            gap-4
            px-5
            py-6

            sm:px-8

            md:flex-row

            lg:px-10
          "
        >
          <p
            className="
              text-center
              text-sm
              font-medium
              text-white/75

              dark:text-white/50

              md:text-left
            "
          >
            © {currentYear} Burton Pride. All rights reserved.
          </p>

          <div
            className="
              flex
              flex-wrap
              items-center
              justify-center
              gap-x-5
              gap-y-3
            "
          >
            <Link
              href="/Admin/Login"
              className="
                text-sm
                font-semibold
                text-white/75
                transition

                hover:text-yellow-200

                dark:text-white/45
                dark:hover:text-purple-300
              "
            >
              🔐 Admin Login
            </Link>

            <span
              aria-hidden="true"
              className="
                hidden
                h-4
                w-px
                bg-white/25

                sm:block

                dark:bg-white/15
              "
            />

            <a
              href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
              target="_blank"
              rel="noopener noreferrer"
              className="
                text-sm
                font-bold
                text-white/85
                transition

                hover:text-yellow-200

                dark:text-white/55
                dark:hover:text-cyan-300
              "
            >
              Built &amp; Powered by{" "}
              <span
                className="
                  bg-gradient-to-r
                  from-yellow-300
                  via-white
                  to-cyan-200
                  bg-clip-text
                  font-black
                  text-transparent
                "
              >
                Cameron Digital Works
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}