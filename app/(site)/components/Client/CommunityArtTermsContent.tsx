"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copyright,
  Eye,
  FileCheck2,
  Heart,
  ImageIcon,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

const sections = [
  {
    title: "1. A human-created art space",
    icon: Sparkles,
    content: [
      "The Burton Pride Community Art Gallery is an LGBTQIA+ creative space, created by the community, for the community.",
      "It exists to celebrate artwork created by real people and to give artists a respectful place to share their creativity, experiences and stories.",
      "Fully or mainly AI-generated artwork is not accepted. Digital artwork, photography, graphic design and artwork created using software are welcome when the main creative work has been completed by the artist.",
    ],
  },
  {
    title: "2. The artist keeps ownership",
    icon: Copyright,
    content: [
      "The artist keeps full ownership and copyright of their original artwork at all times.",
      "Submitting artwork does not transfer ownership to Burton Pride C.I.C.",
      "Burton Pride will not sell, license or commercially exploit an artist’s work without separate, clear permission from the artist.",
    ],
  },
  {
    title: "3. Permission given to Burton Pride",
    icon: FileCheck2,
    content: [
      "By submitting artwork, the artist gives Burton Pride a limited, non-exclusive and revocable permission to display the artwork on the Community Art Gallery and, where the artist has agreed, on official Burton Pride community channels.",
      "The artist may continue to use, display, sell, publish or license their artwork elsewhere.",
      "This permission can be withdrawn by contacting Burton Pride and asking for the artwork to be removed.",
    ],
  },
  {
    title: "4. The artist chooses what is public",
    icon: Eye,
    content: [
      "The artist controls which personal details are shown publicly.",
      "The artist may choose whether visitors can see their artist name, pronouns, story and visible image-description section.",
      "Private contact details, including the artist’s email address and private contact name, are never shown publicly.",
      "When an artist chooses not to show their artist name, the gallery may display “Anonymous artist”.",
    ],
  },
  {
    title: "5. Image descriptions and accessibility",
    icon: ImageIcon,
    content: [
      "An image description is required for every uploaded artwork image so the gallery can remain accessible.",
      "Image descriptions may still be used as accessibility text even when the artist chooses not to show the separate visible description box.",
      "Descriptions should explain what can be seen in the artwork using clear and respectful language.",
    ],
  },
  {
    title: "6. Human-created and no-AI declaration",
    icon: UserRound,
    content: [
      "The artist must confirm that the submitted artwork was created by a person and is not fully or mainly generated using artificial intelligence.",
      "If Burton Pride has reasonable concerns that artwork may be AI-generated, the submission may be placed under review.",
      "The artist may be asked for reasonable evidence such as sketches, progress photographs, digital layers, project files or a short explanation of their creative process.",
      "Evidence supplied for a review will not be published without permission.",
    ],
  },
  {
    title: "7. Right to challenge a decision",
    icon: Scale,
    content: [
      "An artist may challenge a decision if they believe their artwork has been incorrectly identified as AI-generated or unfairly declined.",
      "The artist may provide more information or evidence and request another review.",
      "Burton Pride will review the information fairly and explain the final decision clearly and respectfully.",
    ],
  },
  {
    title: "8. Copyright and permission",
    icon: ShieldCheck,
    content: [
      "The artist must confirm that the artwork is their own original creation or that they have clear permission from the copyright owner to submit and publish it.",
      "The artist must have permission to use any photographs, logos, characters or other protected material included in the artwork.",
      "Burton Pride may temporarily hide or remove artwork where a genuine copyright, ownership, privacy or safety concern is raised.",
    ],
  },
  {
    title: "9. Images of other people",
    icon: UserRound,
    content: [
      "Where artwork contains an identifiable person, the artist must have appropriate permission to submit and publish that image.",
      "Extra care must be taken where the artwork includes children, vulnerable adults, private situations or sensitive personal information.",
      "Where a child or young person is clearly identifiable, permission must be provided by a parent or legal guardian.",
    ],
  },
  {
    title: "10. Respectful and inclusive content",
    icon: Heart,
    content: [
      "The Community Art Gallery is intended to be welcoming, inclusive and respectful.",
      "Artwork must not promote racism, homophobia, biphobia, transphobia, ableism, sexism, hate speech, harassment, targeted abuse or violence against a person or community.",
      "Artwork may explore difficult, emotional, political or sensitive subjects, including identity, discrimination, mental health and lived experience.",
      "Sensitive artwork should not be declined simply because it discusses serious issues. Burton Pride may use a content notice where appropriate.",
    ],
  },
  {
    title: "11. No changes without permission",
    icon: FileCheck2,
    content: [
      "Burton Pride will not make major changes to an artist’s artwork without permission.",
      "Minor technical adjustments may be made where needed to display an image correctly.",
      "Burton Pride may correct spelling or formatting in a submitted description, but should not change the meaning of the artist’s words without permission.",
    ],
  },
  {
    title: "12. Artist credit",
    icon: Copyright,
    content: [
      "Where the artist chooses to be named, Burton Pride will credit the artist using the name or artist name they supplied.",
      "An artist may use a chosen name, artist name, pseudonym or remain anonymous.",
      "Burton Pride will make reasonable efforts to keep artist credit attached to artwork shared through official channels.",
    ],
  },
  {
    title: "13. Removal and withdrawal",
    icon: LockKeyhole,
    content: [
      "The artist may ask Burton Pride to remove their artwork at any time.",
      "Burton Pride will make reasonable efforts to remove it from the Community Art Gallery, future promotional material and official social media posts under Burton Pride’s control.",
      "Burton Pride may not be able to remove copies already downloaded, archived, printed, shared or reposted by other people.",
    ],
  },
  {
    title: "14. Privacy and personal information",
    icon: LockKeyhole,
    content: [
      "Personal information is used only to manage the submission, contact the artist and publish information the artist has agreed to share.",
      "Personal information will not be sold to advertisers.",
      "Artists may ask for their personal information to be corrected, updated or removed, subject to any legal duties that apply.",
    ],
  },
  {
    title: "15. Review and publication",
    icon: CheckCircle2,
    content: [
      "Submitting artwork does not guarantee publication.",
      "Every submission is reviewed before appearing publicly.",
      "Artwork may be declined where it breaks these terms, creates a serious privacy or safety concern, infringes another person’s rights or falls outside the purpose of the Community Art Gallery.",
      "Artwork should not be declined because of the artist’s identity, disability, background, artistic skill, chosen medium or level of professional experience.",
    ],
  },
  {
    title: "16. Changes to these terms",
    icon: FileCheck2,
    content: [
      "Burton Pride may update these terms to improve artist protection, respond to changes in technology or improve the Community Art Gallery.",
      "Updated terms will not remove ownership from artists or give Burton Pride wider rights over artwork already submitted without further permission.",
      "The latest version will always be published on this page.",
    ],
  },
];

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
              <ArrowLeft className="h-4 w-4" />
              Back to Community Art
            </Link>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-purple-950">
              <ShieldCheck className="h-4 w-4" />
              Artist protection
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
              Community Art Terms and Conditions
            </h1>

            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-white/90">
              An LGBTQIA+ creative space, created by the community, for the
              community. These terms explain how Burton Pride protects artists,
              respects ownership and manages artwork submitted to the Community
              Art Gallery.
            </p>
          </div>
        </motion.header>

        <section className="mt-7 rounded-3xl border border-yellow-300/40 bg-yellow-300/10 p-5 shadow-lg backdrop-blur-md sm:p-6">
          <h2 className="text-2xl font-black">Before submitting artwork</h2>
          <p className="mt-3 leading-7 text-white/90">
            Artists must read these terms and confirm that they understand and
            accept them before a submission can be approved.
          </p>
        </section>

        <div className="mt-7 space-y-5">
          {sections.map(({ title, icon: Icon, content }, index) => (
            <motion.section
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.02, 0.16) }}
              className="rounded-3xl border border-white/20 bg-black/20 p-5 shadow-lg backdrop-blur-md sm:p-7"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-yellow-300 text-purple-950 shadow-md">
                  <Icon className="h-6 w-6" />
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

        <section className="mt-7 rounded-3xl border border-emerald-300/40 bg-emerald-500/15 p-6 text-center shadow-lg backdrop-blur-md sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 text-3xl font-black">Agreement</h2>
          <p className="mx-auto mt-3 max-w-3xl leading-7 text-white/90">
            By submitting artwork, the artist confirms that they have read,
            understood and accepted these terms. The artist keeps ownership of
            their artwork and only gives Burton Pride the limited permissions
            clearly described above.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/CommunityArt?submit=1"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
            >
              <ImageIcon className="h-5 w-5" />
              Submit artwork
            </Link>

            <Link
              href="/CommunityArt"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 font-black text-white transition hover:bg-white hover:text-purple-800"
            >
              <Heart className="h-5 w-5" />
              View the gallery
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
