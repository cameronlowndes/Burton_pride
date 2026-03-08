const TermsPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">

            <main className="container mx-auto p-6 bg-white text-black rounded-lg shadow-lg mt-16 max-w-4xl space-y-8">

                <h1 className="text-2xl sm:text-4xl font-bold text-center mb-6">
                    Terms & Conditions For Windows Of Hope Competition 2026
                </h1>

                {/* 1 */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">1. Introduction</h2>
                    <p>
                        Welcome to the official Terms and Conditions for the Windows of Hope Competition 2026.
                        This document outlines how the competition will be run, how entries are accepted, how payments
                        are processed, and how personal data will be stored and used.
                    </p>
                    <p className="mt-2">
                        By entering this competition, you agree to follow all rules and guidelines set out within these terms.
                        Burton Pride C.I.C aims to ensure the competition is fair, transparent, and enjoyable for everyone taking part.
                    </p>
                </section>

                {/* 2 */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">2. About the Competition</h2>
                    <p>
                        The Windows of Hope Competition has been created by Burton Pride C.I.C to celebrate community spirit
                        across Burton-on-Trent and surrounding areas. The competition encourages local businesses and community
                        members to decorate their windows in a creative and positive way that celebrates pride, inclusion,
                        diversity, and community strength.
                    </p>
                    <p className="mt-2">
                        Participants will decorate their windows and be judged for a chance of winning first place, second place,
                        or third place. Winners will be selected based on creativity, effort, presentation, and overall impact.
                    </p>
                </section>

                {/* 3. Competition Rules */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">3. Competition Rules</h2>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.1 One Entry Per Person or Business</h3>
                    <p>
                        Only one entry per business or individual is permitted. Multiple entries are strictly not allowed.
                        If more than one entry is submitted by the same person or business, Burton Pride C.I.C reserves the right
                        to make all entries invalid.
                    </p>
                    <p className="mt-2">
                        If multiple entries are made, this may also result in removal from the competition and may not be eligible
                        for a refund. Please ensure that only one entry is submitted per business or individual.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.2 Location Requirement</h3>
                    <p>
                        All entries must be located within Burton on Trent or within a 5 mile radius of Burton On Trent.
                        Entries outside of this area may not be accepted into the competition.
                    </p>
                    <p className="mt-2">
                        Burton Pride C.I.C reserves the right to verify the location of any entry and remove any entry
                        that does not meet the location requirement.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.3 Display Requirements</h3>
                    <p>
                        All displays must be suitable for public viewing and must promote positivity, community spirit,
                        diversity, and inclusion. Displays must not contain offensive, discriminatory, political, or
                        inappropriate content.
                    </p>
                    <p className="mt-2">
                        Burton Pride C.I.C reserves the right to request changes or remove any display that is considered
                        inappropriate or not in keeping with the values of the competition.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.4 Judging Process</h3>
                    <p>
                        Entries will be judged by a selected judging panel chosen by Burton Pride C.I.C. Judging will be based
                        on creativity, effort, visual impact, originality, and overall presentation.
                    </p>
                    <p className="mt-2">
                        The decision of the judging panel is final. No correspondence or disputes regarding results will be entered into.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.5 Entry Confirmation and Payment</h3>
                    <p>
                        Entry into the competition will only be confirmed once full payment has been successfully received.
                        If payment fails, is cancelled, or is not completed, the entry will not be valid.
                    </p>
                    <p className="mt-2">
                        All payments made are considered final. Refunds will not be issued unless the competition is cancelled
                        by Burton Pride C.I.C.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.6 Photography and Promotion</h3>
                    <p>
                        By entering the competition, you give permission for Burton Pride C.I.C to take photographs and videos
                        of your window display. These images may be used for promotional purposes including social media,
                        website content, press releases, and future marketing materials.
                    </p>
                </section>


                {/* 4 */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">4. Data Protection & Storage</h2>
                    <p>
                        All personal data submitted as part of the Windows of Hope Competition will be stored securely using
                        Supabase on behalf of Burton Pride C.I.C.
                    </p>
                    <p className="mt-2">
                        Burton Pride C.I.C is committed to protecting and respecting your privacy. Any information you provide,
                        including business details, contact information, and uploaded content, will only be used for the purpose
                        of managing and running this competition, contacting entrants, and announcing results where appropriate.
                    </p>
                    <p className="mt-2">
                        Your data will not be shared, sold, or passed on to any third party without your clear permission first.
                        If Burton Pride C.I.C ever wishes to use your information for anything outside of this competition, we will
                        contact you directly by email to request your consent before doing so.
                    </p>
                    <p className="mt-2">
                        All data will be stored securely and only accessible to authorised members of the Burton Pride C.I.C team
                        who require access to manage the competition. We take reasonable steps to ensure your information is
                        protected against loss, misuse, or unauthorised access.
                    </p>
                    <p className="mt-2">
                        Burton Pride C.I.C respects your data and your privacy at all times and will handle all information in line
                        with UK data protection and GDPR regulations.
                    </p>
                </section>

                {/* 5 IMAGE STORAGE */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">5. Image Storage</h2>
                    <p>
                       All images submitted as part of the Windows of Hope Competition, including window 
                       display photos and any supporting images provided during entry, will be securely
                        stored using Supabase cloud storage on the official Burton Pride C.I.C competition system.
                    </p>
                    <p className="mt-2">
                        These images are collected solely for the purpose of managing the competition,
                         reviewing entries, judging displays, and promoting the Windows of Hope Competition 
                         and Burton Pride C.I.C. Images may also be used on the Burton Pride website, 
                         social media platforms, press releases, and future promotional materials 
                         connected to the competition or Burton Pride events.
                    </p>
                    <p className="mt-2">
                       Burton Pride C.I.C will take reasonable steps to ensure that all images are stored 
                       securely and are only accessible to authorised members of the Burton Pride C.I.C 
                       team who require access to manage the competition and related promotional activities.
                    </p>
                    <p className="mt-2">
                        Images will not be shared with third parties outside of Burton Pride C.I.C without
                         permission unless required for promotional purposes directly related to Burton Pride C.I.C. 
                         If images are to be used outside normal promotion of Burton Pride activities, permission 
                         will be requested from the entrant where appropriate.
                    </p>
                    <p className="mt-2">
                       By entering the competition and submitting images, you confirm that you give Burton Pride C.I.C 
                       permission to store, use, and display these images using secure cloud storage systems for
                       competition management and promotional use.
                    </p>
                </section>

                {/* 6. Payments & Security */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">6. Payments & Security</h2>
                    <p>
                        All payments for the Windows of Hope Competition are processed securely through Stripe.
                        Payments are handled directly by Stripe’s secure payment servers and are not processed,
                        stored, or managed on any Burton Pride C.I.C servers or systems.
                    </p>

                    <p className="mt-2">
                        Stripe is a trusted global payment provider that uses industry-standard encryption and
                        security measures to ensure all transactions are processed safely and securely. This means
                        that all card details and payment information are handled directly by Stripe and are protected
                        by their secure systems.
                    </p>

                    <p className="mt-2">
                        Burton Pride C.I.C does not have access to, store, or retain any full payment card details at
                        any time. We only receive confirmation that a payment has been successfully completed in order
                        to confirm competition entry.
                    </p>

                    <p className="mt-2">
                        Burton Pride C.I.C will never share any payment details with any third party. We will also never
                        ask you to send card details, bank details, or payment information by email, message, or social
                        media.
                    </p>

                    <p className="mt-2">
                        If you ever receive an email, message, or communication claiming to be from Burton Pride C.I.C
                        asking you to provide payment details, card information, or bank details, please treat this as
                        suspicious. Always check where the email has come from and contact Burton Pride C.I.C directly
                        using our official contact details to confirm its authenticity before responding.
                    </p>

                    <p className="mt-2">
                        By entering the competition and making payment, you acknowledge and agree that all payments are
                        handled securely through Stripe and that Burton Pride C.I.C is not responsible for any issues
                        arising outside of our control within Stripe’s secure payment system.
                    </p>
                </section>

                {/* 7. Agreement & Contact */}
<section>
  <h2 className="text-2xl font-semibold mb-2">7. Agreement to Terms & Contact</h2>

  <p>
    By reading and accepting these Terms and Conditions, you confirm that you fully understand
    the rules of the Windows of Hope Competition, how the competition is managed, and how your
    data and images are stored and used by Burton Pride C.I.C.
  </p>

  <p className="mt-2">
    By entering the competition, you agree to follow all rules set out within these terms and
    acknowledge that your entry is subject to these conditions. These terms are in place to
    ensure the competition is run fairly, safely, and transparently for all participants.
  </p>

  <p className="mt-2">
    If you have any questions, concerns, or issues regarding the competition, your entry,
    payments, or how your data is stored, please contact Burton Pride C.I.C directly.
  </p>

  

  <p className="mt-2">
    Burton Pride C.I.C is committed to handling all enquiries fairly, respectfully, and in a
    timely manner to ensure all participants feel supported throughout the competition.
  </p>
</section>
{/* Terms Imprint Notice */}
<div className="border-t pt-6 mt-6 text-center">
  <p className="text-sm text-black/70">
    Official Burton Pride C.I.C Terms & Conditions Notice
  </p>

  <p className="text-sm text-black/80 mt-2">
    These Terms & Conditions are the official and verified version issued by Burton Pride C.I.C.
    Any changes, edits, copies, or versions not directly provided or published by Burton Pride C.I.C
    will be considered invalid and not recognised.
  </p>

  <p className="text-sm text-black/80 mt-2">
    The downloadable version of these Terms & Conditions is provided for reading and reference only.
    It must not be edited, altered, or reproduced as an official document without permission from
    Burton Pride C.I.C.
  </p>

  <p className="text-sm text-black/80 mt-2">
    Burton Pride C.I.C reserves the right to update or amend these terms at any time. The latest
    official version will always be available through Burton Pride C.I.C official channels.
  </p>
</div>



                {/* download */}
                <div className="mt-8 text-center">
                    <a
                        href="/Document/Windows_of_Hope_Terms_2026_PDF_Verison.pdf"
                        download
                        className="inline-block bg-yellow-400 text-black font-bold px-6 py-3 rounded-full hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg"
                    >
                        Download Terms & Conditions
                    </a>
                </div>

            </main>
        </div>
    );
};

export default TermsPage;
