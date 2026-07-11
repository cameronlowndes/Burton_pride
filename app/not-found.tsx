'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Home,
  LayoutDashboard,
  Mail,
  SearchX,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type AdminMeResponse = {
  ok?: boolean;
  admin?: unknown;
};

type UsefulLink = {
  title: string;
  description: string;
  href: string;
  icon: typeof Home;
};

const usefulLinks: UsefulLink[] = [
  {
    title: 'Home',
    description: 'Return to the Burton Pride website.',
    href: '/',
    icon: Home,
  },
  {
    title: 'Events',
    description: 'See upcoming events and activities.',
    href: '/events',
    icon: CalendarDays,
  },
  {
    title: 'Meet Us',
    description: 'Learn more about the Burton Pride team.',
    href: '/MeetUS',
    icon: Users,
  },
  {
    title: 'Contact Us',
    description: 'Get help from the Burton Pride team.',
    href: '/ContactUS',
    icon: Mail,
  },
];

function useAdminSession() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch('/api/admin/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        if (cancelled) return;

        if (!response.ok) {
          setIsSignedIn(false);
          return;
        }

        const data = (await response.json()) as AdminMeResponse;
        setIsSignedIn(Boolean(data?.ok && data?.admin));
      } catch (error) {
        console.error('404 admin session check failed:', error);

        if (!cancelled) {
          setIsSignedIn(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoaded, isSignedIn };
}

function useCurrentPage() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setCurrentUrl(window.location.href);
    setPathname(window.location.pathname || '/');
  }, []);

  return { currentUrl, pathname };
}

function buildSupportMailto(currentUrl: string) {
  const subject = 'Broken or missing Burton Pride page';
  const body = [
    'Hello Cameron,',
    '',
    'I found a page that is missing or not working.',
    '',
    `Page URL: ${currentUrl || 'Not available'}`,
    '',
    'What I was trying to find:',
    '',
    'What happened:',
    '',
    'Thank you.',
  ].join('\n');

  return `mailto:cameronlowndes@burtonpride.co.uk?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function PrimaryAction({
  href,
  onClick,
  icon,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-violet-950 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/35';

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      {children}
    </button>
  );
}

function SecondaryAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
    >
      {icon}
      {children}
    </Link>
  );
}

function UsefulLinkCard({ item, index }: { item: UsefulLink; index: number }) {
  const Icon = item.icon;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.32 + index * 0.07 }}
    >
      <Link
        href={item.href}
        className="group flex h-full items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner transition group-hover:bg-white/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-bold text-white">{item.title}</span>
          <span className="mt-1 block text-sm leading-5 text-white/65">
            {item.description}
          </span>
        </span>

        <ChevronRight
          className="h-5 w-5 shrink-0 text-white/45 transition group-hover:translate-x-1 group-hover:text-white"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}

export default function NotFound() {
  const reduceMotion = useReducedMotion();
  const { isLoaded, isSignedIn } = useAdminSession();
  const { currentUrl, pathname } = useCurrentPage();

  const supportMailto = useMemo(
    () => buildSupportMailto(currentUrl),
    [currentUrl]
  );

  const handleGoBack = () => {
    if (typeof window === 'undefined') return;

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign(isSignedIn ? '/Admin/Dashboard' : '/');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#110820] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(236,72,153,0.25),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(139,92,246,0.24),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(37,99,235,0.2),transparent_34%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:44px_44px]"
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 28, 0],
                y: [0, -18, 0],
                scale: [1, 1.08, 1],
              }
        }
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 bottom-16 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -24, 0],
                y: [0, 20, 0],
                scale: [1, 0.94, 1],
              }
        }
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
            aria-label="Return to Burton Pride home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-black text-violet-950 shadow-lg">
              BP
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-wide text-white">
                Burton Pride
              </span>
              <span className="block text-xs text-white/55">
                Created by the community
              </span>
            </span>
          </Link>

          {isLoaded && isSignedIn && (
            <Link
              href="/Admin/Dashboard"
              className="hidden items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20 sm:inline-flex"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Admin Dashboard
            </Link>
          )}
        </header>

        <section className="flex flex-1 items-center py-12 sm:py-16 lg:py-20">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-pink-400" />
                Page not found
              </div>

              <p
                className="mt-7 bg-gradient-to-r from-pink-400 via-fuchsia-300 to-violet-300 bg-clip-text text-[clamp(6.5rem,22vw,12rem)] font-black leading-[0.78] tracking-[-0.08em] text-transparent"
                aria-hidden="true"
              >
                404
              </p>

              <h1 className="mt-7 text-center text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Lost in the Rainbow
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                The link may be out of date, the page may have moved, or the address may
                have been entered incorrectly. Use one of the options below to get back
                on track.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <PrimaryAction
                  onClick={handleGoBack}
                  icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                >
                  Go back
                </PrimaryAction>

                <SecondaryAction
                  href="/"
                  icon={<Home className="h-4 w-4" aria-hidden="true" />}
                >
                  Return home
                </SecondaryAction>

                {isLoaded && isSignedIn && (
                  <SecondaryAction
                    href="/Admin/Dashboard"
                    icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}
                  >
                    Dashboard
                  </SecondaryAction>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-white/60">
                <a
                  href={supportMailto}
                  className="inline-flex items-center gap-2 font-semibold text-white/75 transition hover:text-white"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Report this broken page
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>

                {pathname && (
                  <span className="max-w-full truncate rounded-full border border-white/10 bg-black/15 px-3 py-1.5 font-mono text-xs text-white/45">
                    {pathname}
                  </span>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.12, ease: 'easeOut' }}
              className="relative mx-auto w-full max-w-xl"
            >
              <div className="absolute -inset-4 rounded-[2.25rem] bg-gradient-to-br from-pink-500/25 via-violet-500/15 to-blue-500/20 blur-2xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#f87171_0%,#facc15_20%,#4ade80_40%,#38bdf8_60%,#818cf8_80%,#c084fc_100%)]" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                      Try somewhere useful
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Where would you like to go?
                    </h2>
                  </div>

                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-pink-200 shadow-inner">
                    <SearchX className="h-7 w-7" aria-hidden="true" />
                  </span>
                </div>

                <div className="mt-7 grid gap-3">
                  {usefulLinks.map((item, index) => (
                    <UsefulLinkCard key={item.href} item={item} index={index} />
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-white/55">
                  Still cannot find what you need? Visit the contact page and the Burton
                  Pride team will help point you in the right direction.
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Burton Pride C.I.C. • United as One</p>
          <p aria-live="polite">
            {isLoaded
              ? isSignedIn
                ? 'Admin session recognised'
                : 'Public website'
              : 'Checking session…'}
          </p>
        </footer>
      </div>
    </main>
  );
}