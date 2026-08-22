import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  getCurrentAdminPermissions,
} from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin Portal Terms & Security Policy",
  description:
    "Restricted Burton Pride Admin Portal Terms of Access, Security and Acceptable Use.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nositelinkssearchbox: true,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
  referrer: "no-referrer",
};



const sectionClass = "mt-8";
const headingClass = "mb-3 text-2xl font-black text-white";
const paragraphClass = "mb-3 leading-7 text-white/70";
const listClass =
  "list-disc space-y-2 pl-6 leading-7 text-white/70";

export default async function AdminPortalTermsPage() {
  const admin = await getCurrentAdminPermissions();

  if (!admin) {
    redirect(
      "/Admin/Login?next=%2FAdmin%2FDashboard%2FSettings%2FAdminTerms&reason=session_required",
    );
  }

  return (
    <main className="min-h-screen w-full max-w-none text-white">
      <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative p-6 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(236,72,153,0.20),transparent_30%),radial-gradient(circle_at_86%_8%,rgba(59,130,246,0.18),transparent_30%)]" />

          <div className="relative">
            

            <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-purple-50">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Portal · Authorised access only
                </div>

                <h1 className="mt-4 text-3xl font-black lg:text-4xl">
                  Admin Portal Terms of Access, Security and Acceptable Use
                </h1>

                <p className="mt-3 max-w-4xl text-sm leading-6 text-white/60">
                  Burton Pride C.I.C. · Updated August 2026
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-50">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Admin security policy</p>
            <p className="mt-1 text-sm leading-6 text-amber-50/80">
              By signing in to or using the Burton Pride Admin Portal, authorised
              users agree to these terms, Burton Pride&apos;s wider Terms and
              Conditions, applicable data-protection requirements and security
              policies introduced by Burton Pride C.I.C.
            </p>
          </div>
        </div>
      </section>

      <article className="w-full rounded-[2rem] border border-white/10 bg-[#101126]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10">
        <header className="border-b border-white/10 pb-7">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-purple-200" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-purple-200">
                Burton Pride C.I.C.
              </p>
              <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                Admin Portal Terms and Security Policy
              </h2>
            </div>
          </div>
        </header>

        <section className={sectionClass}>
          <h2 className={headingClass}>1. Introduction</h2>
          <p className={paragraphClass}>
            Welcome to the Burton Pride C.I.C. Admin Portal.
          </p>
          <p className={paragraphClass}>
            The Burton Pride Admin Portal is a private and restricted system used
            to support the management and operation of Burton Pride C.I.C.
          </p>
          <p className={paragraphClass}>
            The Admin Portal may contain confidential, financial, operational,
            event, volunteer, supplier, sponsor, application, stock, audit and
            other organisational information.
          </p>
          <p className={paragraphClass}>
            Access to the Admin Portal is a privilege and is not automatically
            provided to every person connected with Burton Pride.
          </p>
          <p className={paragraphClass}>
            By signing in to or using the Burton Pride Admin Portal, you agree to
            these Admin Portal Terms and Conditions, Burton Pride&apos;s wider
            Terms and Conditions, applicable data protection requirements, and
            any security policies introduced by Burton Pride C.I.C.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>2. Authorised Users Only</h2>
          <p className={paragraphClass}>
            The Burton Pride Admin Portal is only available to authorised Burton
            Pride committee members, directors, administrators and other
            specifically approved individuals.
          </p>
          <p className={paragraphClass}>
            Access must be approved by Cameron Lowndes or by an authorised
            Director of Burton Pride C.I.C.
          </p>
          <p className={paragraphClass}>
            Having a Burton Pride email address, being a volunteer, being a
            committee member or having previously had access does not
            automatically give someone an ongoing right to access the Admin
            Portal.
          </p>
          <p className={paragraphClass}>
            Access may be restricted, suspended or removed at any time where
            necessary to protect Burton Pride, its systems, finances, data or
            community.
          </p>
          <p className={paragraphClass}>
            Users must never attempt to access areas of the Admin Portal that
            they have not been given permission to use.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>3. Individual Accounts</h2>
          <p className={paragraphClass}>
            Every authorised user must use their own Admin Portal account.
          </p>
          <ul className={listClass}>
            <li>Do not share your login details with another person</li>
            <li>Do not allow someone else to use your account</li>
            <li>Do not sign in using another administrator&apos;s account</li>
            <li>Do not share passwords or two-step verification codes</li>
            <li>Do not share authenticator codes</li>
            <li>Do not attempt to bypass account permissions</li>
            <li>Do not attempt to bypass security controls</li>
            <li>Do not create unauthorised accounts</li>
            <li>
              Do not allow an unauthorised person to view restricted information
            </li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>4. Two-Step Verification</h2>
          <p className={paragraphClass}>
            Two-step verification is required for Burton Pride Admin Portal
            accounts.
          </p>
          <p className={paragraphClass}>
            Users may be required to verify their identity using an approved
            security method.
          </p>
          <ul className={listClass}>
            <li>An authenticator application</li>
            <li>A security code sent to an approved email address</li>
            <li>An approved SMS verification method</li>
            <li>An approved WhatsApp verification method</li>
            <li>A passkey or security key where supported</li>
            <li>Another security method approved by Burton Pride C.I.C.</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>5. Device Security</h2>
          <p className={paragraphClass}>
            Admin Portal accounts may be restricted to a limited number of
            approved or trusted devices. Burton Pride may set a maximum number of
            trusted devices for each administrator account.
          </p>
          <p className={paragraphClass}>
            Burton Pride may record information about devices used to access the
            Admin Portal for security purposes.
          </p>
          <ul className={listClass}>
            <li>Device identifier</li>
            <li>Device type</li>
            <li>Operating system</li>
            <li>Browser</li>
            <li>IP address</li>
            <li>Approximate location based on IP address</li>
            <li>Date and time of access</li>
            <li>First and most recent use</li>
            <li>Whether the device is recognised or trusted</li>
            <li>Active login sessions</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>6. New and Unrecognised Devices</h2>
          <p className={paragraphClass}>
            A login from a new or unrecognised device may require additional
            security checks.
          </p>
          <p className={paragraphClass}>
            Burton Pride may require additional two-step verification, send a
            security notification, record the new device and IP information,
            temporarily block access or require approval from a Main
            Administrator or Director.
          </p>
          <p className={paragraphClass}>
            A login attempt from an unusual device, IP address, approximate
            location or country may be treated as a higher-risk security event.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>7. Login and Security Monitoring</h2>
          <p className={paragraphClass}>
            Use of the Admin Portal is monitored for security, accountability
            and system administration purposes.
          </p>
          <p className={paragraphClass}>
            The Admin Portal may record successful and unsuccessful login
            attempts.
          </p>
          <ul className={listClass}>
            <li>Administrator account involved where identifiable</li>
            <li>Date and time</li>
            <li>IP address</li>
            <li>Approximate town, region or country</li>
            <li>Device information</li>
            <li>Browser information</li>
            <li>Whether the login succeeded or failed</li>
            <li>Whether two-step verification succeeded or failed</li>
            <li>Number of failed attempts</li>
            <li>Security risk level</li>
            <li>Session information</li>
            <li>Relevant security actions taken by the system</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>8. Failed Login Attempts</h2>
          <p className={paragraphClass}>
            Every failed Admin Portal login attempt may be recorded.
          </p>
          <p className={paragraphClass}>
            Repeated failed login attempts may result in temporary login
            restrictions, rate limiting, temporary account lockout, additional
            two-step verification, security notifications, session termination,
            security review or temporary suspension of the account.
          </p>
          <p className={paragraphClass}>
            Where the system cannot identify an authenticated administrator, the
            event may be recorded as an Unauthenticated Login Attempt rather than
            being incorrectly attributed to an administrator.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>9. Audit Logging</h2>
          <p className={paragraphClass}>
            The Admin Portal uses audit logs to help provide accountability and
            protect Burton Pride&apos;s systems and information. Actions carried
            out within the Admin Portal may be recorded.
          </p>
          <ul className={listClass}>
            <li>Administrator name</li>
            <li>Administrator ID</li>
            <li>Administrator email</li>
            <li>Role</li>
            <li>Action performed</li>
            <li>Area of the Admin Portal accessed</li>
            <li>Date and time</li>
            <li>IP address</li>
            <li>Approximate location</li>
            <li>Device and browser</li>
            <li>Relevant record or item</li>
            <li>Whether the action succeeded or failed</li>
            <li>Security risk level</li>
            <li>Changes made to records</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>10. Administrative Accountability</h2>
          <p className={paragraphClass}>
            Administrators are responsible for actions performed through their
            account.
          </p>
          <p className={paragraphClass}>
            Users must take reasonable steps to protect their account and
            immediately report anything suspicious, including unknown devices,
            unexpected verification codes, password reset messages they did not
            request, changes they did not make or suspicious audit activity.
          </p>
          <p className={paragraphClass}>
            Where there is evidence that an account may have been compromised,
            Burton Pride may immediately terminate active sessions and
            temporarily disable the account while the matter is investigated.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>11. Access Permissions</h2>
          <p className={paragraphClass}>
            Access to different parts of the Admin Portal may be controlled by
            roles and permissions.
          </p>
          <p className={paragraphClass}>
            An administrator should only have access to information and functions
            that are necessary for their responsibilities.
          </p>
          <p className={paragraphClass}>
            Some high-risk actions may only be available to Main Administrators
            or authorised Directors. Users must not attempt to increase or alter
            their own permissions without authorisation.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>12. High-Risk Actions</h2>
          <p className={paragraphClass}>
            Certain Admin Portal actions may require additional security checks.
          </p>
          <ul className={listClass}>
            <li>Deleting financial records</li>
            <li>Deleting administrative records</li>
            <li>Changing administrator permissions</li>
            <li>Creating or removing administrator accounts</li>
            <li>Resetting two-step verification</li>
            <li>Removing trusted devices</li>
            <li>Viewing highly sensitive information</li>
            <li>Changing security settings</li>
            <li>Exporting sensitive datasets</li>
            <li>Making significant financial changes</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>13. Confidentiality</h2>
          <p className={paragraphClass}>
            Information contained within the Admin Portal may be confidential.
            Administrators must not disclose confidential information outside
            Burton Pride unless authorised or legally required.
          </p>
          <p className={paragraphClass}>
            Information should only be accessed where there is a legitimate
            Burton Pride reason to do so.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>14. Data Protection</h2>
          <p className={paragraphClass}>
            Administrators must handle personal information responsibly and in
            accordance with Burton Pride&apos;s data protection responsibilities.
          </p>
          <p className={paragraphClass}>
            Personal information must only be accessed where needed for
            legitimate Burton Pride activities.
          </p>
          <ul className={listClass}>
            <li>Do not search personal information without a legitimate reason</li>
            <li>Do not download information unnecessarily</li>
            <li>Do not copy information onto unauthorised personal systems</li>
            <li>Do not share personal information with unauthorised people</li>
            <li>Do not use Burton Pride information for personal purposes</li>
            <li>Do not sell or commercially exploit Burton Pride data</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>15. Financial Information</h2>
          <p className={paragraphClass}>
            The Money Management areas of the Admin Portal may contain sensitive
            financial information.
          </p>
          <p className={paragraphClass}>
            Administrators with financial access must ensure information is
            entered accurately and responsibly. Financial information must not be
            intentionally altered, deleted or misrepresented.
          </p>
          <p className={paragraphClass}>
            Where a mistake is made, the appropriate correction process should
            be used so there remains an accurate record of what happened.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>16. Security Information</h2>
          <p className={paragraphClass}>
            Security information available through the Admin Portal must be
            treated as confidential.
          </p>
          <p className={paragraphClass}>
            This can include IP addresses, login locations, device information,
            audit logs, failed-login information, security alerts, account
            recovery information, two-step verification settings and session
            information.
          </p>
          <p className={paragraphClass}>
            Access to detailed security information should be restricted to
            administrators who genuinely require it.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>17. Prohibited Activities</h2>
          <p className={paragraphClass}>
            Administrators must not misuse or deliberately weaken the Admin
            Portal or its security.
          </p>
          <ul className={listClass}>
            <li>Attempt to bypass security controls</li>
            <li>Disable audit logging</li>
            <li>Delete audit records without authorisation</li>
            <li>Tamper with security records</li>
            <li>Attempt to discover another administrator&apos;s password</li>
            <li>Intercept another administrator&apos;s verification code</li>
            <li>Deliberately enter false information</li>
            <li>Access information for personal curiosity</li>
            <li>Use Burton Pride data for personal gain</li>
            <li>Attempt to exploit vulnerabilities</li>
            <li>Introduce malicious software</li>
            <li>Run unauthorised scripts against Burton Pride systems</li>
            <li>Share confidential information</li>
            <li>Circumvent account restrictions</li>
            <li>Access an account after permission has been removed</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>
            18. Security Testing and Vulnerabilities
          </h2>
          <p className={paragraphClass}>
            Security vulnerabilities, bugs or weaknesses discovered within the
            Admin Portal must be reported responsibly.
          </p>
          <p className={paragraphClass}>
            Administrators should not deliberately exploit a vulnerability beyond
            what is reasonably necessary to identify and report the problem.
          </p>
          <p className={paragraphClass}>
            High-risk vulnerabilities should be treated as urgent.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>
            19. Leaving the Committee or Organisation
          </h2>
          <p className={paragraphClass}>
            Admin Portal access is linked to an individual&apos;s authorised
            responsibilities within Burton Pride.
          </p>
          <p className={paragraphClass}>
            When a person leaves the committee, leaves Burton Pride, changes role,
            no longer requires access or has their access revoked, their
            permissions may be reduced or their account disabled.
          </p>
          <p className={paragraphClass}>
            Burton Pride may terminate active sessions, remove trusted devices,
            revoke authentication methods and remove access to confidential
            information.
          </p>
          <p className={paragraphClass}>
            Historic audit logs relating to actions taken while the account was
            active may be retained where required for security, accountability or
            legitimate administrative purposes.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>20. Suspension and Removal of Access</h2>
          <p className={paragraphClass}>
            Burton Pride C.I.C. reserves the right to immediately restrict,
            suspend or remove Admin Portal access where necessary.
          </p>
          <p className={paragraphClass}>
            This may happen where an account appears compromised, security rules
            have been breached, login details have been shared, an administrator
            attempts to bypass controls, confidential information has been
            misused, suspicious login attempts occur, access is no longer
            required, or continued access could create a security or
            data-protection risk.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>21. Privacy and Security Logging</h2>
          <p className={paragraphClass}>
            Security monitoring exists to protect Burton Pride C.I.C., its
            administrators, its finances and the people whose information Burton
            Pride processes.
          </p>
          <p className={paragraphClass}>
            Security information will only be used for legitimate purposes such
            as preventing unauthorised access, investigating security incidents,
            identifying compromised accounts, maintaining system security,
            providing accountability and investigating inappropriate use.
          </p>
          <p className={paragraphClass}>
            Security monitoring must not be used to unfairly monitor individuals
            for purposes unrelated to Burton Pride&apos;s legitimate security and
            administrative needs.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>22. Responsible Use</h2>
          <p className={paragraphClass}>
            Administrators must use the Admin Portal professionally, responsibly
            and in the interests of Burton Pride C.I.C.
          </p>
          <p className={paragraphClass}>
            Access should only be used for legitimate Burton Pride activities.
          </p>
          <p className={paragraphClass}>
            No administrator may use their position, permissions or access for
            personal benefit, retaliation, harassment or any purpose that
            conflicts with Burton Pride&apos;s values.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>23. Changes to These Terms</h2>
          <p className={paragraphClass}>
            Burton Pride C.I.C. may update these Admin Portal Terms where required
            because of changes in legislation, changes to the Admin Portal,
            security improvements, new administrative systems, new
            authentication methods or changes to Burton Pride&apos;s internal
            policies.
          </p>
          <p className={paragraphClass}>
            Administrators may be required to accept updated Terms before
            continuing to access the Admin Portal.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>24. Acceptance of Admin Portal Terms</h2>
          <p className={paragraphClass}>
            By accessing or continuing to use the Burton Pride Admin Portal, you
            confirm that you are an authorised user, understand that activity may
            be audited, understand that failed login attempts may be recorded,
            understand that IP address and approximate location information may
            be recorded for security, will protect your password and verification
            methods, will not share your account, and will comply with Burton
            Pride&apos;s security and data protection requirements.
          </p>
          <p className={paragraphClass}>
            You must not continue using the Admin Portal if your permission to
            access it has been withdrawn.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>25. Contact and Security Concerns</h2>
          <p className={paragraphClass}>
            For questions regarding Admin Portal access, security concerns or
            suspected unauthorised activity, contact Burton Pride C.I.C.
          </p>
          <p className={paragraphClass}>
            Email:{" "}
            <a
              href="mailto:cameronlowndes@burtonpride.co.uk"
              className="font-black text-sky-200 underline underline-offset-4 hover:text-sky-100"
            >
             cameronlowndes@burtonpride.co.uk
            </a>
          </p>

          <div className="mt-6 rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5">
            <p className="font-black text-white">
              Burton Pride C.I.C. Admin Portal - Authorised Access Only
            </p>
            <p className="mt-2 text-sm text-white/60">
              By the community, for the community.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-black text-white">
                  Cameron Lowndes
                </p>
                <p className="text-sm text-white/55">
                  Project Manager, Burton Pride C.I.C.
                </p>
              </div>
              <div>
                <p className="font-black text-white">
                  Simon Whale
                </p>
                <p className="text-sm text-white/55">
                  Chair, Burton Pride C.I.C.
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm font-bold text-white/50">
              August 2026
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
