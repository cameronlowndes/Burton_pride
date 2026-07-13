"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copyright,
  Download,
  Eye,
  FileCheck2,
  Heart,
  ImageIcon,
  LockKeyhole,
  Mail,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

type TermsSection = {
  title: string;
  icon: typeof ShieldCheck;
  content: string[];
};

const sections: TermsSection[] = [
  {
    title: "1. Artists Keep Full Ownership",
    icon: Copyright,
    content: [
      "Artists keep full ownership and copyright of their original artwork at all times.",
      "Submitting artwork to Burton Pride does not transfer ownership or copyright to Burton Pride.",
      "Burton Pride will not sell, license, alter, claim ownership of or commercially exploit an artist’s work without separate, clear and informed permission from the artist.",
    ],
  },
  {
    title: "2. Limited Permission to Display Artwork",
    icon: FileCheck2,
    content: [
      "By submitting artwork, the artist gives Burton Pride a limited, non-exclusive and revocable permission to display the artwork on the Burton Pride Community Art page, share it through official Burton Pride social media channels and use it to promote the Community Art project.",
      "This permission is limited to Burton Pride’s community, charitable, educational and promotional activities.",
      "The artist remains free to publish, display, sell, license or share their artwork elsewhere.",
    ],
  },
  {
    title: "3. Artist Choice, Approval and Consent",
    icon: Eye,
    content: [
      "Artists may choose whether their real name, artist name or no name is displayed.",
      "Artists may choose whether a website, portfolio or social media account is linked.",
      "Artists may approve the wording of their biography, story or artwork description before publication.",
      "Burton Pride will not publish private contact information or other personal details without clear permission.",
      "Where practical, artists may also choose whether their artwork can be shared beyond the Community Art page on Burton Pride’s social media channels.",
    ],
  },
  {
    title: "4. Human-Created Artwork Only",
    icon: Sparkles,
    content: [
      "The Community Art page exists to showcase artwork created by people. Fully or mainly AI-generated images, artwork or designs are not accepted.",
      "Digital art, photography, graphic design and artwork made using creative software are welcome when the artist has made the main creative decisions and the final work is substantially their own.",
      "Artwork will not be rejected only because it is digital, polished or created using professional software.",
    ],
  },
  {
    title: "5. Fair Review of Suspected AI-Generated Work",
    icon: UserRound,
    content: [
      "If Burton Pride has reasonable concerns that a submission may be AI-generated, the artwork may be placed under review before publication or temporarily hidden while the concern is considered.",
      "The artist must be given a fair opportunity to explain their creative process before a final decision is made.",
      "Burton Pride may request reasonable evidence such as sketches, drafts, progress photographs, screenshots showing layers, original project files, time-lapse recordings or a written explanation of the creative process.",
      "Artists will not be required to provide more personal information than is reasonably necessary. Evidence supplied for review will not be published or shared without permission.",
    ],
  },
  {
    title: "6. Right to Challenge a Decision",
    icon: Scale,
    content: [
      "An artist may challenge a decision where they believe their artwork has been incorrectly identified as AI-generated, unfairly declined or removed without proper consideration.",
      "The artist may provide further evidence or information and ask for the submission to be reviewed again.",
      "Where reasonably possible, a second review should be completed by another member of the Burton Pride team.",
      "Burton Pride will communicate the final decision clearly and respectfully.",
    ],
  },
  {
    title: "7. No Significant Alterations Without Permission",
    icon: ImageIcon,
    content: [
      "Burton Pride will not crop, recolour, edit, add text to, remove a watermark from or otherwise significantly alter artwork without the artist’s permission.",
      "Minor technical changes may be made only where needed to display the artwork correctly, such as resizing or converting the file format without changing the creative content.",
      "Burton Pride may correct spelling or formatting in an accompanying description, but should not change the meaning of the artist’s words without consent.",
    ],
  },
  {
    title: "8. Artist Credit and Anonymity",
    icon: UserRound,
    content: [
      "Burton Pride will credit the artist using the name or artist name chosen by the artist.",
      "Artists may remain anonymous or use a pseudonym.",
      "Burton Pride will make reasonable efforts to keep the artist’s credit attached whenever the artwork is shared through official Burton Pride channels.",
    ],
  },
  {
    title: "9. Protection From Unauthorised Use",
    icon: ShieldCheck,
    content: [
      "Artwork displayed on the Community Art page remains protected by the artist’s copyright.",
      "Visitors and third parties must not copy, sell, reproduce, edit, remove watermarks from or use artwork without the artist’s permission.",
      "Where requested and reasonably possible, Burton Pride may add an artist credit, copyright notice or watermark.",
      "Where Burton Pride becomes aware of unauthorised use, it may remove links, report misuse or support the artist in raising the issue with the relevant platform.",
      "Burton Pride cannot guarantee that a member of the public will not take a screenshot, download or repost publicly displayed artwork, but reasonable steps will be taken to discourage misuse.",
    ],
  },
  {
    title: "10. Removal and Withdrawal Rights",
    icon: RefreshCw,
    content: [
      "Artists may withdraw permission and ask Burton Pride to remove their artwork at any time.",
      "Burton Pride will make reasonable efforts to remove the artwork from the Community Art page, future promotional materials and official social media posts that remain under Burton Pride’s control.",
      "Burton Pride may not be able to remove copies already downloaded, printed, archived, shared or reposted by third parties.",
      "Requesting removal does not affect the artist’s ownership or copyright.",
    ],
  },
  {
    title: "11. Artist Safety and Privacy",
    icon: LockKeyhole,
    content: [
      "Burton Pride will not publish an artist’s home address, personal telephone number, private email address, legal name where another name has been chosen, precise location or sensitive personal information without explicit permission.",
      "Artists should avoid placing private information directly inside artwork unless they are comfortable with that information being publicly visible.",
      "Artists may ask Burton Pride to correct, update or remove personal information connected to their submission.",
    ],
  },
  {
    title: "12. Children and Young Artists",
    icon: Users,
    content: [
      "Artwork submitted by a person under the age of 18 must have permission from a parent or legal guardian.",
      "Burton Pride will take extra care when publishing the name, image, story or personal information of a child or young person.",
      "A young artist may be credited by first name, artist name or anonymously, depending on the permission provided.",
    ],
  },
  {
    title: "13. Photographs and Images of Other People",
    icon: Users,
    content: [
      "Where artwork includes an identifiable person, the artist must confirm that they have appropriate permission to submit and publish the image.",
      "Extra care is required where artwork includes children, vulnerable adults, private or sensitive situations, personal medical information or identity information.",
      "Burton Pride may ask for confirmation of consent before publication.",
    ],
  },
  {
    title: "14. Originality, Copyright and Third-Party Material",
    icon: Copyright,
    content: [
      "The artist must confirm that the artwork is their own original creation or that they have permission to use any third-party material included within it.",
      "Artists must not knowingly submit work that unlawfully copies another person’s artwork, photography, writing, logo, design, character or other protected material.",
      "Where a genuine copyright or ownership complaint is received, Burton Pride may temporarily hide the artwork while the concern is reviewed.",
      "Where appropriate, the artist will be told about the concern and given a reasonable opportunity to respond before a final decision is made.",
    ],
  },
  {
    title: "15. Respectful and Inclusive Content",
    icon: Heart,
    content: [
      "The Community Art page is an LGBTQIA+ creative space created by the community, for the community.",
      "Artwork must not promote racism, homophobia, biphobia, transphobia, ableism, sexism, harassment, hate speech, targeted abuse or violence against a person or community.",
      "Artwork may explore difficult, emotional, political or sensitive subjects, including identity, discrimination, mental health and lived experience.",
      "Sensitive artwork should not be rejected simply because it addresses serious issues. Burton Pride may use a clear content notice where appropriate.",
    ],
  },
  {
    title: "16. Submission and Publication Decisions",
    icon: CheckCircle2,
    content: [
      "Submitting artwork does not guarantee publication.",
      "A submission may be declined where it breaks these terms, creates a serious privacy or safety concern, infringes another person’s rights, contains unlawful or harmful content or falls outside the purpose of the Community Art page.",
      "Decisions should be made fairly, consistently and respectfully.",
      "Burton Pride will not decline artwork because of the artist’s LGBTQIA+ identity, disability, ethnicity, faith, background, artistic skill, chosen medium or level of professional experience.",
    ],
  },
  {
    title: "17. Complaints About Artwork",
    icon: AlertTriangle,
    content: [
      "If a complaint is made about an artist or their work, Burton Pride will not automatically remove the submission without review unless urgent action is needed for safety or legal reasons.",
      "Where appropriate, the artist will be informed of the concern and given an opportunity to respond.",
      "Artwork may be temporarily hidden where there is an urgent safety, privacy or legal concern.",
      "Complaints will be handled as confidentially as reasonably possible.",
    ],
  },
  {
    title: "18. Data Protection",
    icon: LockKeyhole,
    content: [
      "Personal information provided with a submission will be used only to manage the Community Art page, contact the artist and publish information the artist has approved.",
      "Personal information will not be sold or provided to advertisers.",
      "Burton Pride will keep personal information only for as long as it is reasonably needed for the purpose it was collected, subject to any legal obligations.",
      "Artists may request access to, correction of or deletion of their personal information, subject to applicable data-protection law and Burton Pride’s privacy procedures.",
    ],
  },
  {
    title: "19. Changes to These Terms",
    icon: RefreshCw,
    content: [
      "Burton Pride may update these terms to improve artist protection, respond to legal or technological changes or improve the Community Art page.",
      "Changes will not transfer ownership from artists or give Burton Pride wider rights over artwork already submitted without further permission.",
      "The latest version of these terms will be published on the Burton Pride website.",
    ],
  },
  {
    title: "20. Agreement",
    icon: FileCheck2,
    content: [
      "By submitting artwork, the artist confirms that they have read and understood these terms and that they have the right to submit the work.",
      "The artist keeps full ownership of their artwork and gives Burton Pride only the limited permissions clearly described in this document.",
      "Burton Pride is committed to treating every artist with dignity, fairness and respect.",
    ],
  },
];

const checklist = [
  { area: "Ownership", confirmation: "I created this artwork, or I have permission to use every part of it." },
  { area: "AI use", confirmation: "The artwork is not fully or mainly generated by artificial intelligence." },
  { area: "Consent", confirmation: "I have permission from identifiable people shown in the artwork." },
  { area: "Credit", confirmation: "I have chosen how I would like to be credited, including the option to remain anonymous." },
  { area: "Sharing", confirmation: "I understand where Burton Pride may display and share the artwork." },
  { area: "Privacy", confirmation: "I have not included private information that I do not want to be made public." },
  { area: "Removal", confirmation: "I understand that I can ask Burton Pride to remove my artwork from channels under its control." },
  { area: "Terms", confirmation: "I have read and agree to these Artist Protection Terms and Conditions." },
];

const TERMS_DOWNLOAD_URL =
  "/Document/Burton_Pride_Community_Art_Terms_and_Conditions.pdf";

export default function CommunityArtTermsContent() {
  return (
    <main className="min-h-screen bg-transparent px-4 pb-16 pt-24 text-white sm:px-7 sm:pt-28 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-black/20 p-6 shadow-2xl backdrop-blur-md sm:p-10"
        >
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-pink-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />

          <div className="relative">
            <Link
              href="/CommunityArt"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-purple-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Community Art
            </Link>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-purple-950">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Artist protection
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
              Burton Pride Community Art
            </h1>
            <h2 className="mt-2 text-2xl font-black text-yellow-300 sm:text-4xl">
              Artist Protection Terms and Conditions
            </h2>

            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-white/90">
              An LGBTQIA+ creative space created by the community, for the community.
            </p>
          </div>
        </motion.header>

        <section className="mt-7 rounded-3xl border border-emerald-300/40 bg-emerald-500/15 p-6 shadow-lg backdrop-blur-md sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-9 w-9 shrink-0 text-emerald-300" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Our commitment to artists</h2>
              <p className="mt-3 leading-7 text-white/90">
                Artists keep ownership and copyright of their work. Burton Pride only receives the limited permission needed to display and promote approved submissions. Artists may request removal, choose how they are credited and challenge decisions fairly.
              </p>
            </div>
          </div>
        </section>

        <section
          className="mt-7 overflow-hidden rounded-3xl border border-yellow-300/50 bg-yellow-300/10 shadow-lg backdrop-blur-md"
          aria-labelledby="download-terms-heading"
        >
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-purple-950">
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Official document
              </div>

              <h2
                id="download-terms-heading"
                className="mt-4 text-3xl font-black sm:text-4xl"
              >
                Download these terms
              </h2>

              <p className="mt-3 max-w-3xl leading-7 text-white/90">
                These Artist Protection Terms and Conditions are available to
                download as an official PDF copy. The downloaded document is
                provided for reading, reference and record keeping.
              </p>

              <div className="mt-4 rounded-2xl border border-amber-300/45 bg-amber-300/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-6 w-6 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-bold leading-6 text-white/90">
                    This is an official read-only copy. It must not be edited,
                    changed, shortened, rewritten or presented as an amended
                    Burton Pride policy. The official version is the version
                    published by Burton Pride C.I.C.
                  </p>
                </div>
              </div>
            </div>

            <a
              href={TERMS_DOWNLOAD_URL}
              download="Burton_Pride_Community_Art_Terms_and_Conditions.pdf"
              className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-yellow-300 px-7 py-4 text-lg font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white lg:w-auto"
              aria-label="Download the official Burton Pride Community Art Artist Protection Terms and Conditions PDF"
            >
              <Download className="h-6 w-6" aria-hidden="true" />
              Download official PDF
            </a>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-white/20 bg-black/20 p-6 shadow-lg backdrop-blur-md sm:p-8">
          <p className="leading-8 text-white/90">
            Welcome to the Burton Pride Community Art page. This page celebrates original artwork made by real people and provides a respectful, inclusive and safer place for LGBTQIA+ artists, community members and allies to share creativity, experiences and stories. Burton Pride is committed to protecting artists, respecting their ownership and using artwork only within the permissions clearly given by the artist.
          </p>
        </section>

        <div className="mt-7 space-y-5">
          {sections.map(({ title, icon: Icon, content }, index) => (
            <motion.section
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.015, 0.15) }}
              className="rounded-3xl border border-white/20 bg-black/20 p-5 shadow-lg backdrop-blur-md sm:p-7"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-yellow-300 text-purple-950 shadow-md">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-2xl font-black">{title}</h2>
                  <div className="mt-4 space-y-3">
                    {content.map((paragraph) => (
                      <p key={paragraph} className="leading-7 text-white/85">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/20 bg-black/20 shadow-lg backdrop-blur-md">
          <div className="border-b border-white/15 bg-white/10 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <ClipboardCheck className="mt-1 h-9 w-9 shrink-0 text-yellow-300" aria-hidden="true" />
              <div>
                <h2 className="text-3xl font-black">Artist Submission Checklist</h2>
                <p className="mt-2 text-white/80">
                  Before submitting artwork, the artist should confirm each of the following points.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {checklist.map((item) => (
              <div key={item.area} className="grid gap-3 p-5 sm:grid-cols-[42px_150px_1fr] sm:items-start sm:p-6">
                <div className="grid h-8 w-8 place-items-center rounded-lg border-2 border-white/50 text-sm font-black" aria-hidden="true">
                  ✓
                </div>
                <p className="font-black text-yellow-300">{item.area}</p>
                <p className="leading-7 text-white/85">{item.confirmation}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-blue-300/35 bg-blue-500/10 p-6 shadow-lg backdrop-blur-md sm:p-8">
          <div className="flex items-start gap-4">
            <Mail className="mt-1 h-9 w-9 shrink-0 text-blue-200" aria-hidden="true" />
            <div>
              <h2 className="text-3xl font-black">Contact and Removal Requests</h2>
              <p className="mt-3 leading-7 text-white/90">
                Artists may contact Burton Pride to ask a question, challenge a decision, update their details or request removal of their artwork. Contact details should be published alongside this document on the Burton Pride website or submission form.
              </p>
              <a
                href="mailto:Info@burtonpride.co.uk?subject=Community%20Art%20Enquiry"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-black text-blue-800 transition hover:bg-blue-50"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
                Email Burton Pride
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/20 bg-black/20 p-6 shadow-lg backdrop-blur-md sm:p-8">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <dt className="text-xs font-black uppercase tracking-wider text-white/60">Document owner</dt>
              <dd className="mt-2 font-black">Burton Pride C.I.C.</dd>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <dt className="text-xs font-black uppercase tracking-wider text-white/60">Version</dt>
              <dd className="mt-2 font-black">1.0</dd>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <dt className="text-xs font-black uppercase tracking-wider text-white/60">Last reviewed</dt>
              <dd className="mt-2 font-black">July 2026</dd>
            </div>
          </dl>
        </section>

        <section className="mt-7 rounded-3xl border border-amber-300/40 bg-amber-300/10 p-5 shadow-lg backdrop-blur-md sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="leading-7 text-white/90">
              <strong>Important:</strong> This document is a practical community policy and is not a substitute for independent legal advice. Burton Pride should ensure its privacy notice, consent process and submission form remain consistent with these terms.
            </p>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-emerald-300/40 bg-emerald-500/15 p-6 text-center shadow-lg backdrop-blur-md sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-black">Agreement</h2>
          <p className="mx-auto mt-3 max-w-3xl leading-7 text-white/90">
            By submitting artwork, the artist confirms that they have read and understood these terms and that they have the right to submit the work. The artist keeps full ownership of their artwork and gives Burton Pride only the limited permissions clearly described in this document.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/CommunityArt?submit=1"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
            >
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
              Submit artwork
            </Link>

            <Link
              href="/CommunityArt"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 font-black text-white transition hover:bg-white hover:text-purple-800"
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              View the gallery
            </Link>

            <a
              href={TERMS_DOWNLOAD_URL}
              download="Burton_Pride_Community_Art_Terms_and_Conditions.pdf"
              className="inline-flex items-center gap-2 rounded-full border border-yellow-300/60 bg-yellow-300/10 px-6 py-3 font-black text-yellow-200 transition hover:bg-yellow-300 hover:text-purple-950"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              Download terms
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
