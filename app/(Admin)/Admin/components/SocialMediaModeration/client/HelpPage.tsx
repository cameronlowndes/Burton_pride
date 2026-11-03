import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ClipboardList,
  HeartHandshake,
  LockKeyhole,
  MessageSquare,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Social Media Moderation | Burton Pride",
  description: "A guide to using Burton Pride’s social media moderation tools fairly, consistently and responsibly.",
};

const sections = [
  {
    id: "review-comments",
    title: "Review comments in context",
    icon: MessageSquare,
    paragraphs: [
      "Before taking action, read the comment alongside the original post and the surrounding conversation. A comment viewed on its own can be misunderstood, particularly when someone is quoting another person, describing discrimination or responding to an earlier message.",
      "Look at what has been said, who or what it is directed towards, and whether it breaks Burton Pride’s social media policy. Where the meaning is unclear, ask another committee member to review it.",
    ],
  },
  {
    id: "harmful-content",
    title: "Respond to harmful content",
    icon: ShieldCheck,
    paragraphs: [
      "Use the moderation tools to deal with content that harms people or disrupts our online spaces. This may include:",
    ],
    bullets: [
      "Hate speech or discrimination directed at someone’s identity.",
      "Harassment, bullying, threats or targeted abuse.",
      "Sharing someone’s private information without permission.",
      "Spam, scams, suspicious links or repeated promotional messages.",
      "Repeated behaviour intended to intimidate people or disrupt discussion.",
    ],
    after: [
      "Choose an action that fits the situation and follows our policy. Where the connected platform allows it, this may involve hiding or deleting a comment, reporting content or restricting further interaction.",
      "Consider each case carefully. A serious threat may need an immediate response, while an unclear comment may need discussion before a decision is made.",
    ],
  },
  {
    id: "fair-discussion",
    title: "Respect questions and constructive criticism",
    icon: Scale,
    paragraphs: [
      "People do not have to agree with Burton Pride to take part in a discussion. Negative feedback, complaints, difficult questions and criticism should be considered fairly.",
      "A comment should not be removed simply because it is uncomfortable, challenges a decision or reflects a different opinion. Focus on how someone behaves and whether they break our community rules.",
      "Where a concern deserves a response, keep it respectful, factual and relevant. If you do not know the answer, check with the appropriate committee member before replying.",
    ],
  },
  {
    id: "decision-records",
    title: "Keep a clear record",
    icon: ClipboardList,
    paragraphs: [
      "When recording a moderation decision, explain what happened and why you took action. A useful note identifies the behaviour that caused concern and the relevant part of our social media policy.",
      "Write notes clearly and professionally. Avoid personal remarks, assumptions about someone’s motives or unnecessary sensitive information.",
      "Accurate records help other moderators understand what has already been handled, reduce duplicated work and support a consistent approach when similar issues arise.",
    ],
  },
  {
    id: "teamwork",
    title: "Work together as a team",
    icon: Users,
    paragraphs: [
      "Check whether another moderator has already reviewed a comment before taking further action. Read any existing notes and avoid sending conflicting responses.",
      "Ask for a second opinion when a situation is unclear, sensitive or likely to affect the wider organisation. Complaints about Burton Pride, safeguarding concerns and serious threats may need to be passed to the appropriate committee lead.",
      "If a conversation becomes upsetting, step away and ask someone else to take over. Supporting the community also means looking after the people doing the moderation.",
    ],
  },
  {
    id: "privacy",
    title: "Protect people’s privacy",
    icon: LockKeyhole,
    paragraphs: [
      "Only access information needed for your moderation work. Keep internal notes, personal details and sensitive conversations within the authorised team.",
      "Do not copy or share screenshots outside the moderation process without a clear reason and the appropriate authorisation. Take particular care with information about someone’s identity, health, personal circumstances or experiences of abuse.",
    ],
  },
  {
    id: "responsible-access",
    title: "Use your access responsibly",
    icon: ShieldCheck,
    paragraphs: [
      "Your account permissions determine which tools and actions you can use. Use your own account so decisions can be attributed to the person who made them, and never share login details.",
      "Check the selected comment, account and action before confirming a change. If you make a mistake, tell the appropriate committee member and record what happened so it can be addressed.",
    ],
  },
];

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export default async function SocialMediaModerationHomePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/Admin/Login");

  return (
    <article id="moderation-welcome" className="min-h-full w-full min-w-0 bg-slate-950 text-white">
      <div className="w-full px-4 py-6 sm:px-7 sm:py-9 xl:px-10">
        <header className="overflow-hidden rounded-3xl border border-purple-300/20 bg-gradient-to-br from-purple-950/80 via-slate-900 to-slate-950 p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-200">Burton Pride · Committee tools</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Authorised team access
            </span>
          </div>
          <div className="mt-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-400/10 text-purple-200">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl xl:text-5xl">
            Welcome to Burton Pride<br className="hidden sm:block" /> Social Media Moderation
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-purple-100">Help keep Burton Pride’s online community safe, welcoming and inclusive.</p>
          <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
            <p>This app brings together the tools used to manage comments on Burton Pride’s Facebook and Instagram pages. It gives authorised committee members a central place to review content, deal with concerns and keep track of moderation decisions.</p>
            <p>Our aim is to protect the community while allowing people to ask questions, share experiences, raise concerns and express different opinions.</p>
          </div>
          <a href="#using-the-app" className={`mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-200 px-5 py-3 text-sm font-bold text-purple-950 transition hover:bg-purple-100 active:bg-purple-300 ${focus}`}>
            How to use the app <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </a>
        </header>

        <div id="using-the-app" className="mt-8 grid scroll-mt-6 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-5">
            {sections.map(({ id, title, icon: Icon, paragraphs, bullets, after }) => (
              <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-3xl border border-white/10 bg-slate-900/65 p-5 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-400/10 text-purple-200"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h2 id={`${id}-title`} className="pt-1.5 text-lg font-bold leading-7 sm:text-xl">{title}</h2>
                </div>
                <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                  {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {bullets ? <ul className="list-disc space-y-2 pl-5 marker:text-purple-300">{bullets.map((bullet) => <li key={bullet} className="pl-1">{bullet}</li>)}</ul> : null}
                  {after?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>

          <aside aria-label="Page contents" className="order-first space-y-5 xl:order-none xl:sticky xl:top-6">
            <nav aria-label="On this page" className="rounded-3xl border border-white/10 p-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">On this page</h2>
              <ul className="mt-4 grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
                {sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className={`block rounded-lg px-2 py-2.5 text-sm leading-6 text-slate-300 transition hover:bg-white/5 hover:text-white ${focus}`}>{section.title}</a></li>)}
                <li><a href="#get-started" className={`block rounded-lg px-2 py-2.5 text-sm font-semibold leading-6 text-purple-200 transition hover:bg-white/5 ${focus}`}>Get started</a></li>
              </ul>
            </nav>
            <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5">
              <HeartHandshake className="h-6 w-6 text-purple-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold leading-6 text-white">Not sure what to do?</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">Ask another committee member before taking action. A second opinion can help you make a fair decision.</p>
            </div>
          </aside>
        </div>

        <section id="get-started" aria-labelledby="get-started-title" className="mt-7 scroll-mt-6 rounded-3xl border border-purple-300/20 bg-purple-500/10 p-6 sm:p-8">
          <h2 id="get-started-title" className="text-2xl font-black">Get started</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">Choose a tool from the sidebar to open the area you need. Review outstanding content, check previous decisions and take action in line with Burton Pride’s social media policy.</p>
          <p className="mt-5 max-w-3xl text-lg font-bold leading-8 text-purple-100">Be fair. Be consistent. Keep the community at the centre of every decision.</p>
          <Link href="/Admin/Dashboard" className={`mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 ${focus}`}>
            Back to Admin Portal <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </article>
  );
}
