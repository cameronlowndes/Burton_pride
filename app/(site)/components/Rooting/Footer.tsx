"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FaBluesky,
  FaFacebookF,
  FaInstagram,
} from "react-icons/fa6";

const IS_DEV = process.env.NODE_ENV === "development";

type FooterLink = {
  id?: string;
  label: string;
  url: string;
  sortOrder?: number;
  isEnabled?: boolean;
};

type SocialSetting = {
  enabled?: boolean;
  url?: string | null;
};

type FooterSettings = {
  tagline?: string | null;
  organisationName?: string | null;
  description?: string | null;
  companyText?: string | null;

  socials?: {
    facebook?: SocialSetting;
    instagram?: SocialSetting;
    bluesky?: SocialSetting;
  };

  supportButton?: {
    enabled?: boolean;
    text?: string | null;
    url?: string | null;
  };

  adminLogin?: {
    enabled?: boolean;
    text?: string | null;
    url?: string | null;
  };

  developerCredit?: {
    enabled?: boolean;
    prefix?: string | null;
    text?: string | null;
    url?: string | null;
  };

  copyrightText?: string | null;
};

type FooterApiResponse = {
  settings?: FooterSettings;
  sections?: {
    explore?: FooterLink[];
    getInvolved?: FooterLink[];
  };
};

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function prepareLinks(links?: FooterLink[]) {
  return (links ?? [])
    .filter(
      (link) =>
        link.isEnabled !== false &&
        Boolean(link.label?.trim()) &&
        Boolean(link.url?.trim()),
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function FooterNavLink({
  link,
  hoverClass,
}: {
  link: FooterLink;
  hoverClass: string;
}) {
  const className = `
    text-base
    font-semibold
    text-white/85
    transition
    hover:translate-x-1
    ${hoverClass}
    dark:text-white/65
  `;

  if (isExternalUrl(link.url)) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.url} className={className}>
      {link.label}
    </Link>
  );
}

export default function Footer() {
  const [data, setData] = useState<FooterApiResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFooter() {
      try {
        const response = await fetch("/api/footer", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          const apiMessage =
            responseBody?.details ||
            responseBody?.error ||
            `Footer request failed with status ${response.status}`;

          throw new Error(apiMessage);
        }

        const footerData = responseBody as FooterApiResponse;

        if (active) {
          setData(footerData);
          setErrorMessage(null);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown footer loading error";

        console.error("Unable to load footer:", error);

        if (active && IS_DEV) {
          setErrorMessage(message);
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void loadFooter();

    return () => {
      active = false;
    };
  }, []);

  const settings = data?.settings;
  const exploreLinks = useMemo(
    () => prepareLinks(data?.sections?.explore),
    [data?.sections?.explore],
  );
  const getInvolvedLinks = useMemo(
    () => prepareLinks(data?.sections?.getInvolved),
    [data?.sections?.getInvolved],
  );

  if (!loaded) {
    return null;
  }

  if (IS_DEV && errorMessage) {
    return (
      <div
        className="
          m-4
          rounded-xl
          border
          border-red-500/40
          bg-red-950
          p-5
          text-red-100
          shadow-lg
        "
        role="alert"
      >
        <p className="font-black">Footer development error</p>

        <p className="mt-2 text-sm text-red-200">
          This detailed error is only shown because NODE_ENV is development.
        </p>

        <pre
          className="
            mt-4
            max-h-80
            overflow-auto
            whitespace-pre-wrap
            break-words
            rounded-lg
            bg-black/40
            p-4
            text-xs
            text-red-100
          "
        >
          {errorMessage}
        </pre>
      </div>
    );
  }

  const facebook = settings?.socials?.facebook;
  const instagram = settings?.socials?.instagram;
  const bluesky = settings?.socials?.bluesky;

  const supportButton = settings?.supportButton;
  const adminLogin = settings?.adminLogin;
  const developerCredit = settings?.developerCredit;

  const showFacebook =
    facebook?.enabled !== false && Boolean(facebook?.url?.trim());
  const showInstagram =
    instagram?.enabled !== false && Boolean(instagram?.url?.trim());
  const showBluesky =
    bluesky?.enabled !== false && Boolean(bluesky?.url?.trim());

  const showSupport =
    supportButton?.enabled !== false &&
    Boolean(supportButton?.text?.trim()) &&
    Boolean(supportButton?.url?.trim());

  const showAdminLogin =
    adminLogin?.enabled !== false &&
    Boolean(adminLogin?.text?.trim()) &&
    Boolean(adminLogin?.url?.trim());

  const showDeveloperCredit =
    developerCredit?.enabled !== false &&
    Boolean(developerCredit?.text?.trim()) &&
    Boolean(developerCredit?.url?.trim());

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
          bg-purple-300/20
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

      <div
        aria-hidden="true"
        className="
          h-2
          w-full
          bg-[linear-gradient(90deg,#ef4444_0%,#f97316_16%,#facc15_32%,#22c55e_48%,#06b6d4_64%,#3b82f6_80%,#a855f7_100%)]
        "
      />

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
        <div>
          {settings?.tagline?.trim() && (
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
              {settings.tagline}
            </p>
          )}

          {settings?.organisationName?.trim() && (
            <h2
              className="
                mt-3
                text-4xl
                font-black
                tracking-tight
                text-white
                sm:text-5xl
              "
            >
              {settings.organisationName}
            </h2>
          )}

          {settings?.description?.trim() && (
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
              {settings.description}
            </p>
          )}

          {settings?.companyText?.trim() && (
            <p
              className="
                mt-5
                text-sm
                font-bold
                text-white/75
                dark:text-white/45
              "
            >
              {settings.companyText}
            </p>
          )}

          {(showFacebook || showInstagram || showBluesky) && (
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {showFacebook && (
                <a
                  href={facebook!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
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
              )}

              {showInstagram && (
                <a
                  href={instagram!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
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
              )}

              {showBluesky && (
                <a
                  href={bluesky!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Bluesky"
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
              )}
            </div>
          )}
        </div>

        {exploreLinks.length > 0 && (
          <div>
            <h3
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.2em]
                text-white
              "
            >
              Explore
            </h3>

            <nav
              aria-label="Footer navigation"
              className="mt-5 flex flex-col items-start gap-3"
            >
              {exploreLinks.map((link, index) => (
                <FooterNavLink
                  key={link.id ?? `${link.url}-${index}`}
                  link={link}
                  hoverClass="hover:text-yellow-200 dark:hover:text-purple-300"
                />
              ))}
            </nav>
          </div>
        )}

        {(getInvolvedLinks.length > 0 || showSupport) && (
          <div>
            {getInvolvedLinks.length > 0 && (
              <>
                <h3
                  className="
                    text-sm
                    font-black
                    uppercase
                    tracking-[0.2em]
                    text-white
                  "
                >
                  Get Involved
                </h3>

                <div className="mt-5 flex flex-col items-start gap-3">
                  {getInvolvedLinks.map((link, index) => (
                    <FooterNavLink
                      key={link.id ?? `${link.url}-${index}`}
                      link={link}
                      hoverClass="hover:text-yellow-200 dark:hover:text-pink-300"
                    />
                  ))}
                </div>
              </>
            )}

            {showSupport &&
              (isExternalUrl(supportButton!.url!) ? (
                <a
                  href={supportButton!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
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
                  {supportButton!.text}
                </a>
              ) : (
                <Link
                  href={supportButton!.url!}
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
                  {supportButton!.text}
                </Link>
              ))}
          </div>
        )}
      </div>

      {(settings?.copyrightText?.trim() ||
        showAdminLogin ||
        showDeveloperCredit) && (
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
            {settings?.copyrightText?.trim() && (
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
                {settings.copyrightText}
              </p>
            )}

            {(showAdminLogin || showDeveloperCredit) && (
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
                {showAdminLogin &&
                  (isExternalUrl(adminLogin!.url!) ? (
                    <a
                      href={adminLogin!.url!}
                      target="_blank"
                      rel="noopener noreferrer"
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
                      {adminLogin!.text}
                    </a>
                  ) : (
                    <Link
                      href={adminLogin!.url!}
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
                      {adminLogin!.text}
                    </Link>
                  ))}

                {showAdminLogin && showDeveloperCredit && (
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
                )}

                {showDeveloperCredit && (
                  <a
                    href={developerCredit!.url!}
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
                    {developerCredit?.prefix?.trim() && (
                      <>
                        {developerCredit.prefix}{" "}
                      </>
                    )}

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
                      {developerCredit!.text}
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
