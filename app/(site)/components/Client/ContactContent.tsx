"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mail, MessageCircleMore } from "lucide-react";

import ContactForm from "../Forms/MessageForm";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function ContactContent() {
  const prefersReducedMotion = useReducedMotion();

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : {
        duration: 0.55,
        ease: "easeOut" as const,
      };

  return (
    <motion.main
      className="
        min-h-screen
        px-4
        pb-24
        pt-28
        text-slate-950

        sm:px-6
        sm:pt-32

        lg:px-8

        dark:text-white
      "
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: prefersReducedMotion
            ? {}
            : {
                staggerChildren: 0.08,
              },
        },
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* =====================================================
            HERO
            ===================================================== */}
        <motion.header
          variants={fadeUp}
          transition={transition}
          className="
            mx-auto
            max-w-3xl
            text-center
          "
        >
          <p
            className="
              text-sm
              font-black
              uppercase
              tracking-[0.18em]
              text-purple-700

              dark:text-purple-300
            "
          >
            We&apos;re here to help
          </p>

          <h1
            className="
              mt-3
              text-4xl
              font-black
              leading-tight
              text-slate-950

              sm:text-5xl
              lg:text-6xl

              dark:text-white
            "
          >
            Contact Burton Pride
          </h1>

          <p
            className="
              mx-auto
              mt-5
              max-w-2xl
              text-base
              leading-7
              text-slate-800

              sm:text-lg
              sm:leading-8

              dark:text-white/80
            "
          >
            Have a question, want to get involved, or just need to speak to
            someone from Burton Pride? Send us a message and we&apos;ll get back
            to you as soon as we can.
          </p>
        </motion.header>

        {/* =====================================================
            CONTACT AREA
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            mt-12
            grid
            gap-6

            lg:grid-cols-[1.2fr_0.8fr]
            lg:items-start
          "
        >
          {/* FORM */}
          <div
            className="
              rounded-3xl
              border
              border-white/50
              bg-white/85
              p-5
              shadow-xl
              backdrop-blur-md

              sm:p-7

              dark:border-white/10
              dark:bg-[#111827]/90
              dark:shadow-black/30
            "
          >
            <div className="mb-6">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-2xl
                  bg-purple-100
                  text-purple-700

                  dark:bg-purple-500/15
                  dark:text-purple-300
                "
              >
                <MessageCircleMore className="h-5 w-5" />
              </div>

              <h2
                className="
                  mt-4
                  text-2xl
                  font-black
                  text-slate-950

                  sm:text-3xl

                  dark:text-white
                "
              >
                Send us a message
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-slate-700

                  sm:text-base

                  dark:text-white/70
                "
              >
                Fill in the form below and tell us what you&apos;d like to talk
                about.
              </p>
            </div>

            <ContactForm />
          </div>

          {/* EMAIL PANEL */}
          <aside
            className="
              rounded-3xl
              border
              border-white/50
              bg-white/75
              p-6
              shadow-lg
              backdrop-blur-md

              sm:p-7

              dark:border-white/10
              dark:bg-[#111827]/80
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-2xl
                bg-pink-100
                text-pink-700

                dark:bg-pink-500/15
                dark:text-pink-300
              "
            >
              <Mail className="h-5 w-5" />
            </div>

            <h2
              className="
                mt-4
                text-2xl
                font-black
                text-slate-950

                dark:text-white
              "
            >
              Prefer email?
            </h2>

            <p
              className="
                mt-3
                text-base
                leading-7
                text-slate-700

                dark:text-white/75
              "
            >
              You can email Burton Pride directly if that&apos;s easier for you.
            </p>

            <a
              href="mailto:Info@burtonpride.co.uk"
              className="
                mt-5
                block
                break-all
                text-lg
                font-black
                text-purple-700
                underline
                decoration-2
                underline-offset-4
                transition

                hover:text-pink-600

                dark:text-purple-300
                dark:hover:text-pink-300
              "
            >
              Info@burtonpride.co.uk
            </a>

            <a
              href="mailto:Info@burtonpride.co.uk?subject=Inquiry&body=Hello, I would like to inquire about..."
              className="
                mt-6
                inline-flex
                min-h-12
                w-full
                items-center
                justify-center
                gap-2
                rounded-full
                bg-yellow-300
                px-6
                py-3
                text-sm
                font-black
                text-purple-950
                shadow-lg
                transition

                hover:scale-[1.02]
                hover:bg-white
              "
              aria-label="Send an email to Burton Pride"
            >
              <Mail className="h-4 w-4" />
              Send us an email
            </a>

            <div
              className="
                mt-7
                border-t
                border-slate-200
                pt-5

                dark:border-white/10
              "
            >
              <p
                className="
                  text-sm
                  leading-6
                  text-slate-600

                  dark:text-white/60
                "
              >
                For general questions, event enquiries, volunteering,
                collaboration or community support, you can use either the form
                or email us directly.
              </p>
            </div>
          </aside>
        </motion.section>

        {/* =====================================================
            SMALL COMMUNITY NOTE
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            mt-10
            border-l-4
            border-yellow-500
            px-5
            py-3

            sm:px-7

            dark:border-yellow-300
          "
        >
          <p
            className="
              max-w-4xl
              text-base
              leading-7
              text-slate-800

              sm:text-lg

              dark:text-white/80
            "
          >
            We&apos;re a grassroots organisation, so replies may not always be
            immediate, but we do our best to respond as quickly as we can.
          </p>
        </motion.section>
      </div>
    </motion.main>
  );
}