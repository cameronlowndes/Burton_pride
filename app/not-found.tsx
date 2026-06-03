'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

type QuickLink = {
  label: string;
  href: string;
  description: string;
  adminOnly?: boolean;
  icon: string;
};

type HelpItem = {
  title: string;
  desc: string;
  icon: string;
};

type FloatingOrb = {
  id: number;
  size: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  opacity: number;
};

type SearchItem = {
  title: string;
  href: string;
  category: 'public' | 'admin';
};

type AdminMeResponse = {
  ok?: boolean;
  admin?: unknown;
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function buildSupportMailto(currentUrl: string) {
  const subject = 'Missing page or feature request';
  const body = [
    'Hi Cameron,',
    '',
    'I found a missing page or feature on the website/admin portal.',
    '',
    `Page URL: ${currentUrl || 'Unknown'}`,
    'What I expected:',
    'What happened instead:',
    'Feature request:',
    '',
    'Thanks.',
  ].join('\n');

  return `mailto:cameronlowndes@burtonpride.co.uk?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function useClientLocation() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [pathname, setPathname] = useState('');
  const [referrer, setReferrer] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setCurrentUrl(window.location.href);
    setPathname(window.location.pathname || '');
    setReferrer(document.referrer || '');
  }, []);

  return { currentUrl, pathname, referrer };
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();

      if (hour < 12) {
        setGreeting('Good morning');
        return;
      }

      if (hour < 18) {
        setGreeting('Good afternoon');
        return;
      }

      setGreeting('Good evening');
    };

    updateGreeting();
  }, []);

  return greeting;
}

function useAdminSession() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminSession() {
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
        console.error('NotFound admin session check failed:', error);

        if (!cancelled) {
          setIsSignedIn(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    loadAdminSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoaded, isSignedIn };
}

function generateOrbs(): FloatingOrb[] {
  return [
    { id: 1, size: 280, top: '-4%', left: '-2%', duration: 12, delay: 0, opacity: 0.2 },
    { id: 2, size: 220, top: '12%', left: '72%', duration: 11, delay: 0.6, opacity: 0.16 },
    { id: 3, size: 180, top: '72%', left: '10%', duration: 10, delay: 1.2, opacity: 0.14 },
    { id: 4, size: 360, top: '65%', left: '60%', duration: 14, delay: 0.4, opacity: 0.18 },
    { id: 5, size: 130, top: '45%', left: '40%', duration: 9, delay: 1, opacity: 0.1 },
  ];
}

function getPublicQuickLinks(): QuickLink[] {
  return [
    { label: 'Return to Home', href: '/', description: 'Go back to the main website homepage.', icon: '🏠' },
    { label: 'Contact Us', href: '/ContactUS', description: 'Open the public contact page for help.', icon: '📞' },
    { label: 'Events', href: '/Events', description: 'Check current or upcoming event pages.', icon: '🎉' },
    { label: 'Meet Us', href: '/MeetUs', description: 'View the committee and team profiles.', icon: '👥' },
  ];
}

function getAdminQuickLinks(): QuickLink[] {
  return [
    { label: 'Dashboard', href: '/Admin/Dashboard', description: 'Open the admin dashboard.', adminOnly: true, icon: '📊' },
    { label: 'Email Centre', href: '/Admin/Email', description: 'Manage admin inboxes and outgoing email.', adminOnly: true, icon: '📧' },
    { label: 'Countdowns', href: '/Admin/Countdown', description: 'Create and manage website countdowns.', adminOnly: true, icon: '⏳' },
    { label: 'Website Pages', href: '/Admin/Pages', description: 'Enable, disable, and manage website pages.', adminOnly: true, icon: '🌐' },
    { label: 'Committee Profiles', href: '/Admin/Committee', description: 'Edit Meet Us committee stories and details.', adminOnly: true, icon: '🧑‍💼' },
    { label: 'Settings', href: '/Admin/Settings', description: 'Update account and portal settings.', adminOnly: true, icon: '⚙️' },
  ];
}

function getHelpItems(isSignedIn: boolean): HelpItem[] {
  const common: HelpItem[] = [
    {
      title: 'Go back to the previous page',
      desc: 'Try returning to the last page you were on. This often fixes broken navigation journeys.',
      icon: '↩️',
    },
    {
      title: 'Use a trusted page link',
      desc: 'Open a known page like the homepage, contact page, or dashboard and continue from there.',
      icon: '🔗',
    },
    {
      title: 'Report missing pages',
      desc: 'If this page should exist, send the broken URL and details to Cameron for review.',
      icon: '📨',
    },
  ];

  if (isSignedIn) {
    return [
      {
        title: 'Return to the admin dashboard',
        desc: 'Signed-in admins can jump back into the admin portal and continue working from a stable page.',
        icon: '🛡️',
      },
      ...common,
      {
        title: 'Check page controls',
        desc: 'The page may have been disabled, moved, or unpublished from the website or admin portal.',
        icon: '🧭',
      },
    ];
  }

  return common;
}

function getSearchItems(isSignedIn: boolean): SearchItem[] {
  const items: SearchItem[] = [
    { title: 'Home', href: '/', category: 'public' },
    { title: 'Contact Us', href: '/ContactUS', category: 'public' },
    { title: 'Events', href: '/Events', category: 'public' },
    { title: 'Meet Us', href: '/MeetUs', category: 'public' },
    { title: 'Sponsors', href: '/Sponsors', category: 'public' },
  ];

  if (isSignedIn) {
    items.push(
      { title: 'Admin Dashboard', href: '/Admin/Dashboard', category: 'admin' },
      { title: 'Admin Email', href: '/Admin/Email', category: 'admin' },
      { title: 'Admin Countdowns', href: '/Admin/Countdown', category: 'admin' },
      { title: 'Admin Pages', href: '/Admin/Pages', category: 'admin' },
      { title: 'Admin Committee', href: '/Admin/Committee', category: 'admin' },
      { title: 'Admin Settings', href: '/Admin/Settings', category: 'admin' }
    );
  }

  return items;
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
      <span className="h-2 w-2 rounded-full bg-pink-300" />
      {children}
    </span>
  );
}

function ActionButton({
  href,
  onClick,
  children,
  variant = 'primary',
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'warning';
}) {
  const baseClass =
    'inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-bold shadow-lg transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/40';

  const variantClass =
    variant === 'primary'
      ? 'bg-white text-[#5b21b6] hover:bg-white/95'
      : variant === 'secondary'
      ? 'bg-yellow-400 text-black hover:bg-yellow-300'
      : variant === 'warning'
      ? 'bg-rose-500 text-white hover:bg-rose-400'
      : 'border border-white/20 bg-white/10 text-white hover:bg-white/15';

  const className = clsx(baseClass, variantClass);

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function FloatingBackground() {
  const orbs = useMemo(() => generateOrbs(), []);

  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.35),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.32),transparent_28%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.28),transparent_30%)]" />
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            opacity: orb.opacity,
            background:
              orb.id % 3 === 0
                ? 'rgba(59,130,246,0.9)'
                : orb.id % 2 === 0
                ? 'rgba(168,85,247,0.9)'
                : 'rgba(236,72,153,0.9)',
          }}
          animate={{
            x: [0, 18, -12, 0],
            y: [0, -20, 14, 0],
            scale: [1, 1.06, 0.96, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/15" />
    </>
  );
}

function BrokenUrlCard({
  currentUrl,
  pathname,
  referrer,
}: {
  currentUrl: string;
  pathname: string;
  referrer: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/15 p-5 shadow-inner">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
        Current page
      </p>
      <p className="mt-2 text-lg font-semibold text-white">404 error details</p>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Pathname
          </p>
          <p className="mt-2 break-all text-sm text-white/90">{pathname || 'Not available'}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Full URL
          </p>
          <p className="mt-2 break-all text-sm text-white/90">{currentUrl || 'Not available'}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Referred from
          </p>
          <p className="mt-2 break-all text-sm text-white/90">{referrer || 'No referrer found'}</p>
        </div>
      </div>
    </div>
  );
}

function HelpCards({ items }: { items: HelpItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.div
          key={`${item.title}-${index}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * index }}
          className="rounded-3xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-white/72">{item.desc}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function QuickLinksPanel({ isSignedIn }: { isSignedIn: boolean }) {
  const publicLinks = getPublicQuickLinks();
  const adminLinks = getAdminQuickLinks();

  return (
    <div className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
        Quick navigation
      </p>
      <h3 className="mt-2 text-xl font-bold text-white">Useful links</h3>

      <div className="mt-5 grid gap-3">
        {publicLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group rounded-2xl border border-white/10 bg-black/10 p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
          >
            <p className="font-semibold text-white">
              {item.icon} {item.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-white/70">{item.description}</p>
          </Link>
        ))}

        {isSignedIn && (
          <>
            <div className="my-2 h-px bg-white/10" />
            {adminLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group rounded-2xl border border-white/10 bg-black/10 p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <p className="font-semibold text-white">
                  {item.icon} {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-white/70">{item.description}</p>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SearchPanel({ isSignedIn }: { isSignedIn: boolean }) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => getSearchItems(isSignedIn), [isSignedIn]);

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();

    if (!normalised) return items;

    return items.filter((item) => item.title.toLowerCase().includes(normalised));
  }, [items, query]);

  return (
    <div className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
        Quick search
      </p>
      <h3 className="mt-2 text-xl font-bold text-white">Find a useful page</h3>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          isSignedIn
            ? 'Search home, dashboard, countdowns, settings...'
            : 'Search home, contact, events...'
        }
        className="mt-5 w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/30"
      />

      <div className="mt-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <motion.div
                key={`${item.category}-${item.href}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">
                      {item.category === 'admin' ? 'Admin page' : 'Public page'}
                    </p>
                  </div>
                  <span className="text-white/60">→</span>
                </Link>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-4 text-sm text-white/70"
            >
              No matching page found.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SupportPanel({
  supportMailto,
  dashboardHref,
  isSignedIn,
}: {
  supportMailto: string;
  dashboardHref: string;
  isSignedIn: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md sm:p-8">
      <p className="text-2xl font-bold text-white">Still stuck?</p>
      <p className="mt-1 text-sm text-white/75">
        Report a missing page or suggest a feature.
      </p>

      <div className="mt-6 space-y-3">
        <a
          href={supportMailto}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-[#5b21b6] shadow-lg hover:bg-white/95"
        >
          📧 Email Cameron
        </a>

        <Link
          href="/ContactUS"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-purple-900/70 px-5 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-purple-900"
        >
          📞 Visit Contact Us Page
        </Link>

        {isSignedIn && (
          <Link
            href={dashboardHref}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-yellow-400 px-5 py-3.5 text-sm font-bold text-black shadow-lg hover:bg-yellow-300"
          >
            Open Admin Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusStrip({
  isLoaded,
  isSignedIn,
  greeting,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  greeting: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/55">Session</p>
        <p className="mt-2 text-sm font-semibold text-white">
          {!isLoaded ? 'Checking login status...' : isSignedIn ? 'Signed in' : 'Guest visitor'}
        </p>
      </div>

      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/55">Message</p>
        <p className="mt-2 text-sm font-semibold text-white">{greeting}</p>
      </div>

      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/55">Page status</p>
        <p className="mt-2 text-sm font-semibold text-white">Not found / unavailable</p>
      </div>
    </div>
  );
}

function AdminInsightPanel({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  const isAdminView = isLoaded && isSignedIn;

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.32, duration: 0.55 }}
      className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
        {isAdminView ? 'Admin note' : 'Helpful note'}
      </p>
      <h3 className="mt-2 text-xl font-bold text-white">Why this page may be missing</h3>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
        <p className="text-sm font-semibold text-white">Possible reasons</p>
        <div className="mt-3 space-y-2 text-sm leading-6 text-white/72">
          <p>• The page URL was typed incorrectly</p>
          <p>• The page was moved to a new route</p>
          <p>• The page is disabled from website controls</p>
          <p>• The page is still in draft mode</p>
          <p>• The page was deleted or renamed</p>
          <p>• The admin portal route has changed</p>
        </div>
      </div>

      {isAdminView && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm font-semibold text-white">Suggested admin next steps</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link href="/Admin/Dashboard" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
              📊 Back to Dashboard
            </Link>
            <Link href="/Admin/Pages" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
              🌐 Check Page Controls
            </Link>
            <Link href="/Admin/Settings" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
              ⚙️ Review Settings
            </Link>
            <Link href="/Admin/Countdown" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
              ⏳ Manage Countdowns
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function NotFound() {
  const { isLoaded, isSignedIn } = useAdminSession();
  const greeting = useTimeGreeting();
  const { currentUrl, pathname, referrer } = useClientLocation();

  const dashboardHref = '/Admin/Dashboard';
  const homeHref = '/';

  const supportMailto = useMemo(() => {
    return buildSupportMailto(currentUrl);
  }, [currentUrl]);

  const helpItems = useMemo(() => getHelpItems(isSignedIn), [isSignedIn]);

  const handleGoBack = () => {
    if (typeof window === 'undefined') return;

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = isSignedIn ? dashboardHref : homeHref;
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#140a2d] px-4 py-10 text-white">
      <FloatingBackground />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-7xl"
      >
        <div className="overflow-hidden rounded-[34px] border border-white/15 bg-white/8 shadow-[0_25px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid min-h-[820px] grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
              <SectionBadge>Burton Pride • Page Not Found</SectionBadge>

              <motion.h1
                className="mt-6 text-7xl font-black leading-none tracking-tight sm:text-8xl xl:text-9xl"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                404
              </motion.h1>

              <h2 className="mt-4 text-3xl font-bold sm:text-4xl xl:text-5xl">
                Lost in the Rainbow?
              </h2>

              <p className="mt-5 max-w-3xl text-base leading-7 text-white/84 sm:text-lg">
                The page you are looking for does not exist, may have been moved, disabled,
                unpublished, or is currently unavailable.
                {isLoaded && isSignedIn
                  ? ' You are signed in, so you can return to the admin dashboard, go back to your previous page, or review likely admin causes below.'
                  : ' You can return to the homepage, go back to your previous page, or contact the team for help.'}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ActionButton onClick={handleGoBack} variant="primary">
                  ← Go Back
                </ActionButton>

                {isLoaded && isSignedIn ? (
                  <ActionButton href={dashboardHref} variant="secondary">
                    Go to Dashboard
                  </ActionButton>
                ) : (
                  <ActionButton href={homeHref} variant="secondary">
                    🌈 Return to Home
                  </ActionButton>
                )}

                <ActionButton href={supportMailto} variant="ghost">
                  📧 Email Cameron
                </ActionButton>
              </div>

              <div className="mt-8">
                <StatusStrip isLoaded={isLoaded} isSignedIn={isSignedIn} greeting={greeting} />
              </div>

              <div className="mt-8">
                <HelpCards items={helpItems} />
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <QuickLinksPanel isSignedIn={isSignedIn} />
                <SearchPanel isSignedIn={isSignedIn} />
              </div>
            </div>

            <div className="relative border-t border-white/10 bg-black/10 px-6 py-10 lg:border-l lg:border-t-0 lg:px-10">
              <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-5">
                <SupportPanel
                  supportMailto={supportMailto}
                  dashboardHref={dashboardHref}
                  isSignedIn={isSignedIn}
                />

                <BrokenUrlCard currentUrl={currentUrl} pathname={pathname} referrer={referrer} />

                <AdminInsightPanel isLoaded={isLoaded} isSignedIn={isSignedIn} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}