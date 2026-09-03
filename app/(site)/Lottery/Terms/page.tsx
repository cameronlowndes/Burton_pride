import Link from "next/link";
import MetaHead from "../../components/MetaHead";
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  ShieldCheck,
  Ticket,
} from "lucide-react";

export const metadata = {
  title: "General Lottery Terms & Conditions | Burton Pride C.I.C.",
  description:
    "Read the official General Lottery Terms & Conditions that apply to Burton Pride C.I.C. lotteries and raffles.",
};

type TermsItem = {
  type: "paragraph" | "bullet";
  text: string;
};

type TermsSection = {
  title: string;
  items: TermsItem[];
};

const termsSections: TermsSection[] = [
  {
    title: "1. About These Terms",
    items: [
      { type: "paragraph", text: "These Terms & Conditions apply generally to lotteries, raffles and other permitted lottery activities promoted by Burton Pride C.I.C." },
      { type: "paragraph", text: "Each lottery operated by Burton Pride C.I.C. may also have its own Individual Lottery Terms & Conditions. Those individual terms will contain information specific to that lottery, including its ticket price, opening and closing dates, draw date, prizes, eligibility requirements and any special conditions." },
      { type: "paragraph", text: "You must read both these General Lottery Terms & Conditions and the Individual Lottery Terms that apply to the lottery you wish to enter." },
      { type: "paragraph", text: "Where there is a difference between these general terms and the specific terms for an individual lottery, the Individual Lottery Terms will apply to that particular lottery, provided they comply with applicable law and Burton Pride C.I.C.'s regulatory obligations." },
      { type: "paragraph", text: "By purchasing or otherwise obtaining a valid ticket for a Burton Pride lottery, you agree to these General Lottery Terms & Conditions and the Individual Lottery Terms applying to that lottery." },
    ],
  },
  {
    title: "2. What These Terms Cover",
    items: [
      { type: "paragraph", text: "These terms explain the general rules Burton Pride C.I.C. follows when organising and operating lotteries. They cover:" },
      { type: "bullet", text: "who operates Burton Pride lotteries;" },
      { type: "bullet", text: "who may enter;" },
      { type: "bullet", text: "how tickets are sold;" },
      { type: "bullet", text: "how payments are handled;" },
      { type: "bullet", text: "how ticket numbers are issued;" },
      { type: "bullet", text: "how draws are conducted;" },
      { type: "bullet", text: "how winners are selected and contacted;" },
      { type: "bullet", text: "how prizes are managed;" },
      { type: "bullet", text: "how refunds and cancellations may be handled;" },
      { type: "bullet", text: "how personal information is used;" },
      { type: "bullet", text: "how Burton Pride protects the fairness and security of its lotteries; and" },
      { type: "bullet", text: "how the general terms work alongside the terms for each individual lottery." },
    ],
  },
  {
    title: "3. The Promoter",
    items: [
      { type: "paragraph", text: "The promoter of Burton Pride lotteries is:" },
      { type: "paragraph", text: "Burton Pride C.I.C." },
      { type: "paragraph", text: "Burton Pride C.I.C. is a grassroots, community-led Community Interest Company created to support the LGBTQIA+ community and allies in Burton upon Trent and the surrounding area." },
      { type: "paragraph", text: "Where a lottery is operated under Burton Pride C.I.C.'s small society lottery registration, the relevant registration information will be displayed on the individual lottery page or within its Individual Lottery Terms." },
      { type: "paragraph", text: "Where another permission, licence, exemption or lottery category applies, this will also be identified where required." },
    ],
  },
  {
    title: "4. Individual Lottery Terms",
    items: [
      { type: "paragraph", text: "Every Burton Pride lottery may have its own set of Individual Lottery Terms. These may include:" },
      { type: "bullet", text: "the lottery name and unique reference;" },
      { type: "bullet", text: "ticket price;" },
      { type: "bullet", text: "maximum number of tickets;" },
      { type: "bullet", text: "opening date and time;" },
      { type: "bullet", text: "closing date and time;" },
      { type: "bullet", text: "draw date;" },
      { type: "bullet", text: "draw method;" },
      { type: "bullet", text: "prizes and number of winners;" },
      { type: "bullet", text: "eligibility requirements;" },
      { type: "bullet", text: "minimum age;" },
      { type: "bullet", text: "geographic restrictions;" },
      { type: "bullet", text: "methods of purchasing tickets;" },
      { type: "bullet", text: "maximum tickets per person or per transaction;" },
      { type: "bullet", text: "prize collection arrangements;" },
      { type: "bullet", text: "specific refund arrangements;" },
      { type: "bullet", text: "specific fundraising purpose; and" },
      { type: "bullet", text: "any other conditions relevant to that particular lottery." },
      { type: "paragraph", text: "Individual Lottery Terms will be made available before a person completes their entry. Purchasing a ticket means that the entrant also agrees to those Individual Lottery Terms." },
    ],
  },
  {
    title: "5. Community Benefit",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. operates fundraising lotteries for community benefit and not for private personal gain." },
      { type: "paragraph", text: "Money generated through lotteries will be used to support the purposes and activities of Burton Pride C.I.C., subject to the rules applying to the particular type of lottery." },
      { type: "paragraph", text: "This may include supporting:" },
      { type: "bullet", text: "Burton Pride events;" },
      { type: "bullet", text: "community activities;" },
      { type: "bullet", text: "LGBTQIA+ inclusion;" },
      { type: "bullet", text: "safer and inclusive spaces;" },
      { type: "bullet", text: "accessibility;" },
      { type: "bullet", text: "community outreach;" },
      { type: "bullet", text: "visibility;" },
      { type: "bullet", text: "educational activities;" },
      { type: "bullet", text: "community projects;" },
      { type: "bullet", text: "equipment and resources;" },
      { type: "bullet", text: "operational costs directly supporting Burton Pride's work; and" },
      { type: "bullet", text: "other activities that further Burton Pride C.I.C.'s community purpose." },
      { type: "paragraph", text: "Burton Pride C.I.C. aims to operate its lotteries fairly, responsibly and transparently." },
    ],
  },
  {
    title: "6. Regulatory Requirements",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. will operate lotteries only where it considers the appropriate registration, permission, licence or legal exemption to be in place." },
      { type: "paragraph", text: "Different types of lottery may be subject to different legal requirements. Because of this, the regulatory information relating to a particular lottery may be provided on that lottery's individual page and within its Individual Lottery Terms." },
      { type: "paragraph", text: "Burton Pride C.I.C. reserves the right to refuse to launch, pause, amend or cancel a lottery where necessary to comply with legal, licensing, regulatory, security or operational requirements." },
    ],
  },
  {
    title: "7. Eligibility",
    items: [
      { type: "paragraph", text: "Eligibility may vary between lotteries." },
      { type: "paragraph", text: "The minimum age and any geographic restrictions applying to an individual lottery will be clearly stated before entry. A person must meet all eligibility requirements for the lottery they wish to enter." },
      { type: "paragraph", text: "You must not:" },
      { type: "bullet", text: "enter a lottery if you do not meet its minimum age;" },
      { type: "bullet", text: "purchase a ticket on behalf of someone who would not legally be permitted to enter;" },
      { type: "bullet", text: "provide false information about your age or identity;" },
      { type: "bullet", text: "provide false or deliberately misleading contact information;" },
      { type: "bullet", text: "attempt to enter from a location excluded by the Individual Lottery Terms; or" },
      { type: "bullet", text: "otherwise attempt to bypass an eligibility restriction." },
      { type: "paragraph", text: "Burton Pride C.I.C. may invalidate an entry where there are reasonable grounds to believe that the entrant was not eligible or that the entry would otherwise be unlawful." },
    ],
  },
  {
    title: "8. Age Requirements",
    items: [
      { type: "paragraph", text: "The minimum age applying to each lottery will be shown in its Individual Lottery Terms. Different lottery types may be subject to different legal requirements." },
      { type: "paragraph", text: "Burton Pride C.I.C. may also choose to impose a higher minimum age than the statutory minimum where considered appropriate." },
      { type: "paragraph", text: "By purchasing a lottery ticket, you confirm that you satisfy the minimum age requirement stated for that lottery." },
      { type: "paragraph", text: "Burton Pride C.I.C. may request reasonable evidence of age before confirming an entry, confirming a winner or releasing a prize." },
    ],
  },
  {
    title: "9. Identity and Eligibility Checks",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may request reasonable evidence to confirm:" },
      { type: "bullet", text: "age;" },
      { type: "bullet", text: "identity;" },
      { type: "bullet", text: "name;" },
      { type: "bullet", text: "contact details;" },
      { type: "bullet", text: "residency;" },
      { type: "bullet", text: "payment information;" },
      { type: "bullet", text: "eligibility; or" },
      { type: "bullet", text: "ownership of a winning ticket." },
      { type: "paragraph", text: "This would normally only be requested where necessary to protect the security, legality or fairness of the lottery." },
      { type: "paragraph", text: "If suitable evidence cannot be provided when reasonably requested, Burton Pride C.I.C. may be unable to confirm an entry or release a prize." },
      { type: "paragraph", text: "Any identity information collected will be handled in accordance with applicable UK data protection law." },
    ],
  },
  {
    title: "10. Buying Lottery Tickets",
    items: [
      { type: "paragraph", text: "Tickets may be available through one or more approved sales methods, including:" },
      { type: "bullet", text: "the Burton Pride website;" },
      { type: "bullet", text: "authorised Burton Pride events;" },
      { type: "bullet", text: "authorised Burton Pride representatives;" },
      { type: "bullet", text: "approved physical locations; or" },
      { type: "bullet", text: "another permitted method identified in the Individual Lottery Terms." },
      { type: "paragraph", text: "Not every sales method will necessarily be available for every lottery. The individual lottery page will explain how tickets for that particular lottery can be purchased." },
      { type: "paragraph", text: "Tickets must not be purchased through an unauthorised person or unofficial website claiming to represent Burton Pride C.I.C." },
    ],
  },
  {
    title: "11. Ticket Prices",
    items: [
      { type: "paragraph", text: "The ticket price for each lottery will be clearly displayed before entry." },
      { type: "paragraph", text: "Where legislation requires every ticket in a particular lottery to have the same price, Burton Pride C.I.C. will operate that lottery accordingly." },
      { type: "paragraph", text: "Purchasing multiple tickets may therefore simply multiply the standard individual ticket price rather than provide a discounted ticket price." },
      { type: "paragraph", text: "Any quantity options displayed on the website do not change the legal price of each individual ticket unless permitted for that particular activity." },
    ],
  },
  {
    title: "12. Payment",
    items: [
      { type: "paragraph", text: "Payment must be completed successfully before an entry becomes valid where payment is required." },
      { type: "paragraph", text: "If payment:" },
      { type: "bullet", text: "fails;" },
      { type: "bullet", text: "is declined;" },
      { type: "bullet", text: "is cancelled;" },
      { type: "bullet", text: "is reversed;" },
      { type: "bullet", text: "cannot be verified; or" },
      { type: "bullet", text: "is otherwise not successfully received," },
      { type: "paragraph", text: "Burton Pride C.I.C. may treat the entry as incomplete and the associated tickets may not be included in the draw." },
      { type: "paragraph", text: "The website displaying a payment success page by itself does not necessarily constitute final confirmation of an entry. Burton Pride C.I.C. may wait for confirmation from its payment provider before issuing valid lottery tickets." },
    ],
  },
  {
    title: "13. Online Payments",
    items: [
      { type: "paragraph", text: "Where online payments are offered, they may be processed by an authorised third-party payment provider such as Stripe." },
      { type: "paragraph", text: "The payment provider handles card and payment information through its own systems. Burton Pride C.I.C. does not normally receive or store full debit or credit card numbers." },
      { type: "paragraph", text: "Burton Pride C.I.C. receives the payment information necessary to:" },
      { type: "bullet", text: "identify the transaction;" },
      { type: "bullet", text: "confirm payment;" },
      { type: "bullet", text: "associate payment with an order;" },
      { type: "bullet", text: "issue tickets;" },
      { type: "bullet", text: "administer refunds where appropriate;" },
      { type: "bullet", text: "manage disputes; and" },
      { type: "bullet", text: "maintain financial and audit records." },
      { type: "paragraph", text: "Burton Pride C.I.C. will never ask you to send full card details, passwords or security codes by email, social media message or another insecure communication method." },
    ],
  },
  {
    title: "14. Ticket Confirmation",
    items: [
      { type: "paragraph", text: "Once a valid payment has been confirmed, Burton Pride C.I.C. will record the entry and issue the appropriate ticket or ticket numbers." },
      { type: "paragraph", text: "Online entrants may receive their ticket information electronically. Entrants should keep their confirmation email or other ticket record until the lottery has been completed and any prizes have been claimed." },
      { type: "paragraph", text: "Where legally required, electronic ticket information will include the information required for the participant to retain or print their ticket information." },
    ],
  },
  {
    title: "15. Ticket Numbers",
    items: [
      { type: "paragraph", text: "Every ticket issued through the Burton Pride online Lottery System may receive a unique ticket number." },
      { type: "paragraph", text: "A ticket number is associated with a particular lottery and cannot be transferred to another lottery. Where multiple tickets are purchased, each ticket may receive its own individual number." },
      { type: "paragraph", text: "Burton Pride C.I.C. will take reasonable technical and administrative steps to prevent:" },
      { type: "bullet", text: "duplicate ticket numbers;" },
      { type: "bullet", text: "tickets being issued without confirmed payment;" },
      { type: "bullet", text: "invalid tickets entering a draw;" },
      { type: "bullet", text: "refunded or cancelled tickets being treated as valid; and" },
      { type: "bullet", text: "unauthorised changes to ticket records." },
    ],
  },
  {
    title: "16. Valid Entries",
    items: [
      { type: "paragraph", text: "Only valid entries will be included in a lottery draw. An entry may be invalid where:" },
      { type: "bullet", text: "payment was not completed;" },
      { type: "bullet", text: "payment was reversed or cancelled;" },
      { type: "bullet", text: "the entrant was not eligible;" },
      { type: "bullet", text: "false information was supplied;" },
      { type: "bullet", text: "the ticket was issued because of a technical error;" },
      { type: "bullet", text: "the ticket was cancelled or refunded;" },
      { type: "bullet", text: "the entrant breached these terms;" },
      { type: "bullet", text: "fraud or misuse is reasonably suspected; or" },
      { type: "bullet", text: "entry would otherwise breach applicable law." },
      { type: "paragraph", text: "Burton Pride C.I.C. will take reasonable steps to resolve genuine administrative or technical errors fairly." },
    ],
  },
  {
    title: "17. Ticket Limits",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may place limits on:" },
      { type: "bullet", text: "the number of tickets available;" },
      { type: "bullet", text: "the number of tickets one person can purchase;" },
      { type: "bullet", text: "the number of tickets in a single transaction;" },
      { type: "bullet", text: "total lottery proceeds; or" },
      { type: "bullet", text: "other limits required by law or the Individual Lottery Terms." },
      { type: "paragraph", text: "Where a lottery reaches its maximum permitted number of tickets or proceeds, ticket sales may close before the advertised closing date." },
    ],
  },
  {
    title: "18. Lottery Opening and Closing",
    items: [
      { type: "paragraph", text: "Every lottery will have its own opening and closing arrangements. These will be shown on its individual page or in its Individual Lottery Terms." },
      { type: "paragraph", text: "Once ticket sales have closed, new entries will no longer be accepted." },
      { type: "paragraph", text: "Burton Pride C.I.C. may close sales early where:" },
      { type: "bullet", text: "all available tickets have been sold;" },
      { type: "bullet", text: "a regulatory limit has been reached;" },
      { type: "bullet", text: "a security problem is identified;" },
      { type: "bullet", text: "a payment or technical problem affects the integrity of the lottery;" },
      { type: "bullet", text: "circumstances outside Burton Pride C.I.C.'s reasonable control require it; or" },
      { type: "bullet", text: "continuing the lottery would not be lawful or appropriate." },
    ],
  },
  {
    title: "19. The Draw",
    items: [
      { type: "paragraph", text: "The draw date and proposed draw method will be included in the Individual Lottery Terms." },
      { type: "paragraph", text: "Depending on the lottery, a draw may take place using:" },
      { type: "bullet", text: "physical ticket selection;" },
      { type: "bullet", text: "an approved electronic random selection process; or" },
      { type: "bullet", text: "another fair method identified before the draw." },
      { type: "paragraph", text: "Burton Pride C.I.C. will take reasonable steps to ensure every valid ticket included in the draw has an equal opportunity of selection where required by the lottery format." },
      { type: "paragraph", text: "Invalid, refunded, cancelled or otherwise ineligible tickets will not be included." },
    ],
  },
  {
    title: "20. Electronic Draws",
    items: [
      { type: "paragraph", text: "Where an electronic draw is used, the Burton Pride Lottery System may create a fixed list or snapshot of eligible tickets after ticket sales have closed." },
      { type: "paragraph", text: "The winner or winners will then be selected using a secure random selection process. Draw information will be recorded by the Burton Pride Lottery System for audit and verification purposes." },
      { type: "paragraph", text: "A completed draw must not be repeatedly rerun simply to obtain a different winner. If a redraw becomes genuinely necessary, the reason for that redraw must be recorded and the original draw history retained." },
    ],
  },
  {
    title: "21. Draw Changes",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may make reasonable changes to a draw where necessary because of circumstances outside its reasonable control." },
      { type: "paragraph", text: "This could include:" },
      { type: "bullet", text: "severe weather;" },
      { type: "bullet", text: "venue closure;" },
      { type: "bullet", text: "event cancellation;" },
      { type: "bullet", text: "technical failure;" },
      { type: "bullet", text: "safety concerns;" },
      { type: "bullet", text: "payment-system problems;" },
      { type: "bullet", text: "regulatory requirements;" },
      { type: "bullet", text: "security concerns; or" },
      { type: "bullet", text: "another significant unexpected event." },
      { type: "paragraph", text: "Where practical, important changes will be published through official Burton Pride channels or on the individual lottery page." },
    ],
  },
  {
    title: "22. Prizes",
    items: [
      { type: "paragraph", text: "The prizes available for each lottery will be shown on its individual lottery page or within its Individual Lottery Terms." },
      { type: "paragraph", text: "Prize information may include:" },
      { type: "bullet", text: "description;" },
      { type: "bullet", text: "value;" },
      { type: "bullet", text: "quantity;" },
      { type: "bullet", text: "donor or sponsor;" },
      { type: "bullet", text: "restrictions;" },
      { type: "bullet", text: "collection requirements; and" },
      { type: "bullet", text: "any expiry date." },
      { type: "paragraph", text: "Unless otherwise stated, prizes cannot normally be exchanged for cash." },
      { type: "paragraph", text: "Where a non-cash prize becomes unavailable for reasons genuinely outside Burton Pride C.I.C.'s control, Burton Pride C.I.C. may provide a reasonable replacement where permitted." },
    ],
  },
  {
    title: "23. Winners",
    items: [
      { type: "paragraph", text: "Winning tickets will be determined according to the draw method stated for the individual lottery." },
      { type: "paragraph", text: "Burton Pride C.I.C. will contact winners using the contact information supplied when entering." },
      { type: "paragraph", text: "Burton Pride C.I.C. may ask the winner to confirm:" },
      { type: "bullet", text: "identity;" },
      { type: "bullet", text: "age;" },
      { type: "bullet", text: "eligibility;" },
      { type: "bullet", text: "contact information; and" },
      { type: "bullet", text: "ownership of the winning entry" },
      { type: "paragraph", text: "before releasing a prize." },
    ],
  },
  {
    title: "24. Contacting Winners",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. will make reasonable efforts to contact winners." },
      { type: "paragraph", text: "Contact may be made by:" },
      { type: "bullet", text: "email;" },
      { type: "bullet", text: "telephone;" },
      { type: "bullet", text: "another contact method provided by the entrant; or" },
      { type: "bullet", text: "another reasonable method identified in the Individual Lottery Terms." },
      { type: "paragraph", text: "Entrants are responsible for providing accurate contact details. Burton Pride C.I.C. cannot guarantee that it will be able to contact someone who has supplied incorrect, incomplete or outdated information." },
    ],
  },
  {
    title: "25. Unclaimed Prizes",
    items: [
      { type: "paragraph", text: "The period for claiming a prize may be stated within the Individual Lottery Terms." },
      { type: "paragraph", text: "Where no separate period is stated, Burton Pride C.I.C. will make reasonable attempts to contact the winner before deciding what should happen to an unclaimed prize." },
      { type: "paragraph", text: "Any decision concerning an unclaimed prize will be made in accordance with applicable law and the rules governing that particular lottery. This may include holding the prize for a further period, selecting a replacement winner where permitted, or applying another lawful arrangement." },
    ],
  },
  {
    title: "26. Winner Publicity and Privacy",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may publish limited information about winners where appropriate." },
      { type: "paragraph", text: "This might include:" },
      { type: "bullet", text: "first name;" },
      { type: "bullet", text: "ticket number;" },
      { type: "bullet", text: "prize won; or" },
      { type: "bullet", text: "another limited identifier." },
      { type: "paragraph", text: "Burton Pride C.I.C. will not automatically publish unnecessary personal information." },
      { type: "paragraph", text: "Where consent is required for additional publicity, such as photographs or promotional interviews, Burton Pride C.I.C. will seek that consent separately." },
    ],
  },
  {
    title: "27. Refunds",
    items: [
      { type: "paragraph", text: "Lottery tickets will normally be non-refundable once a valid entry has been completed, except where Burton Pride C.I.C. decides or is required to provide a refund." },
      { type: "paragraph", text: "Refunds may be appropriate where:" },
      { type: "bullet", text: "Burton Pride C.I.C. cancels a lottery;" },
      { type: "bullet", text: "a duplicate payment is confirmed;" },
      { type: "bullet", text: "a significant system error has occurred;" },
      { type: "bullet", text: "payment was taken incorrectly;" },
      { type: "bullet", text: "Burton Pride C.I.C. determines that a refund is appropriate; or" },
      { type: "bullet", text: "a refund is required by law." },
      { type: "paragraph", text: "Changing your mind after purchasing a valid lottery ticket does not automatically create a right to a refund." },
      { type: "paragraph", text: "Any refund must be recorded against the relevant order and ticket records." },
    ],
  },
  {
    title: "28. Cancelled Lotteries",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may cancel a lottery where it becomes impossible, unlawful, unsafe or unreasonable to continue." },
      { type: "paragraph", text: "If a lottery is cancelled, Burton Pride C.I.C. will provide information about what will happen to valid purchased entries." },
      { type: "paragraph", text: "Where refunds are required or Burton Pride C.I.C. decides that refunds should be issued, they will normally be returned using the original payment method where possible." },
    ],
  },
  {
    title: "29. Fraud, Abuse and Misuse",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may investigate activity where there are reasonable grounds to suspect:" },
      { type: "bullet", text: "fraud;" },
      { type: "bullet", text: "payment abuse;" },
      { type: "bullet", text: "false identity information;" },
      { type: "bullet", text: "ticket manipulation;" },
      { type: "bullet", text: "multiple fraudulent accounts;" },
      { type: "bullet", text: "exploitation of a website vulnerability;" },
      { type: "bullet", text: "unauthorised system access;" },
      { type: "bullet", text: "interference with a draw;" },
      { type: "bullet", text: "attempted prize fraud; or" },
      { type: "bullet", text: "another action affecting lottery integrity." },
      { type: "paragraph", text: "An entry may be suspended or invalidated where necessary to protect the lottery while an issue is investigated." },
      { type: "paragraph", text: "Serious incidents may be reported to the relevant payment provider, regulator, licensing authority or law-enforcement organisation where appropriate." },
    ],
  },
  {
    title: "30. Website and Technical Problems",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. will take reasonable steps to keep its Lottery System available and secure. However, uninterrupted availability cannot be guaranteed." },
      { type: "paragraph", text: "Burton Pride C.I.C. cannot accept responsibility for problems genuinely outside its reasonable control, including:" },
      { type: "bullet", text: "internet outages;" },
      { type: "bullet", text: "third-party payment-system failures;" },
      { type: "bullet", text: "email-provider problems;" },
      { type: "bullet", text: "device problems;" },
      { type: "bullet", text: "telecommunications failures; or" },
      { type: "bullet", text: "other external technical failures." },
      { type: "paragraph", text: "Where a technical problem affects payments, tickets or the fairness of a lottery, Burton Pride C.I.C. will investigate and take reasonable steps to correct the records before continuing the lottery or draw." },
    ],
  },
  {
    title: "31. System Records",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C.'s Lottery System may maintain records relating to:" },
      { type: "bullet", text: "lotteries;" },
      { type: "bullet", text: "orders;" },
      { type: "bullet", text: "payments;" },
      { type: "bullet", text: "tickets;" },
      { type: "bullet", text: "entries;" },
      { type: "bullet", text: "prizes;" },
      { type: "bullet", text: "draws;" },
      { type: "bullet", text: "winners;" },
      { type: "bullet", text: "refunds;" },
      { type: "bullet", text: "communications;" },
      { type: "bullet", text: "compliance checks; and" },
      { type: "bullet", text: "administrative actions." },
      { type: "paragraph", text: "These records are maintained to operate the lottery, protect its integrity, meet accounting requirements and comply with applicable legal or regulatory obligations." },
    ],
  },
  {
    title: "32. Audit Records",
    items: [
      { type: "paragraph", text: "Important administrative actions within the Lottery System may be recorded in an audit log." },
      { type: "paragraph", text: "This may include:" },
      { type: "bullet", text: "creation or amendment of a lottery;" },
      { type: "bullet", text: "changes to ticket sales;" },
      { type: "bullet", text: "publication;" },
      { type: "bullet", text: "closure of sales;" },
      { type: "bullet", text: "refunds;" },
      { type: "bullet", text: "ticket cancellation;" },
      { type: "bullet", text: "creation of a draw;" },
      { type: "bullet", text: "winner selection;" },
      { type: "bullet", text: "prize fulfilment;" },
      { type: "bullet", text: "exports; and" },
      { type: "bullet", text: "changes to lottery terms." },
      { type: "paragraph", text: "Audit records help Burton Pride C.I.C. demonstrate that lotteries have been operated fairly and responsibly." },
    ],
  },
  {
    title: "33. Data Protection and Privacy",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. is committed to protecting personal information." },
      { type: "paragraph", text: "Information collected may include:" },
      { type: "bullet", text: "name;" },
      { type: "bullet", text: "email address;" },
      { type: "bullet", text: "telephone number;" },
      { type: "bullet", text: "ticket information;" },
      { type: "bullet", text: "order information;" },
      { type: "bullet", text: "payment confirmation information;" },
      { type: "bullet", text: "eligibility information;" },
      { type: "bullet", text: "winner information;" },
      { type: "bullet", text: "communication history; and" },
      { type: "bullet", text: "other information reasonably required to administer the lottery." },
      { type: "paragraph", text: "Personal data will only be collected and used where Burton Pride C.I.C. has an appropriate lawful basis." },
    ],
  },
  {
    title: "34. How Personal Information Is Used",
    items: [
      { type: "paragraph", text: "Information may be used to:" },
      { type: "bullet", text: "process an entry;" },
      { type: "bullet", text: "confirm payment;" },
      { type: "bullet", text: "issue tickets;" },
      { type: "bullet", text: "administer a lottery;" },
      { type: "bullet", text: "carry out the draw;" },
      { type: "bullet", text: "identify and contact winners;" },
      { type: "bullet", text: "deliver prizes;" },
      { type: "bullet", text: "investigate fraud or technical problems;" },
      { type: "bullet", text: "process refunds;" },
      { type: "bullet", text: "answer enquiries;" },
      { type: "bullet", text: "maintain financial and audit records; and" },
      { type: "bullet", text: "comply with legal and regulatory requirements." },
      { type: "paragraph", text: "Lottery participation information will not automatically be treated as permission to send marketing communications. Marketing consent, where offered, will be handled separately." },
    ],
  },
  {
    title: "35. Data Retention",
    items: [
      { type: "paragraph", text: "Personal information will not be kept longer than reasonably necessary." },
      { type: "paragraph", text: "Different types of records may need to be retained for different periods because of:" },
      { type: "bullet", text: "lottery regulation;" },
      { type: "bullet", text: "licensing requirements;" },
      { type: "bullet", text: "accounting requirements;" },
      { type: "bullet", text: "tax requirements;" },
      { type: "bullet", text: "fraud prevention;" },
      { type: "bullet", text: "legal obligations;" },
      { type: "bullet", text: "disputes; or" },
      { type: "bullet", text: "legitimate audit requirements." },
      { type: "paragraph", text: "Burton Pride C.I.C. may therefore retain certain lottery records after an individual lottery has ended. The retention period will be determined according to the type of record and applicable requirements." },
    ],
  },
  {
    title: "36. Your Data Rights",
    items: [
      { type: "paragraph", text: "Under UK data protection law, individuals may have rights relating to their personal information." },
      { type: "paragraph", text: "Depending on the circumstances, these may include the right to:" },
      { type: "bullet", text: "request access to personal information;" },
      { type: "bullet", text: "request correction of inaccurate information;" },
      { type: "bullet", text: "request deletion in certain circumstances;" },
      { type: "bullet", text: "object to certain processing;" },
      { type: "bullet", text: "restrict certain processing; and" },
      { type: "bullet", text: "request further information about how personal data is used." },
      { type: "paragraph", text: "Some information may need to be retained despite a deletion request where Burton Pride C.I.C. has a legal or regulatory reason for retaining it." },
      { type: "paragraph", text: "For data protection enquiries, contact: Info@burtonpride.co.uk" },
    ],
  },
  {
    title: "37. Responsible Participation",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. wants its lotteries to be a positive way for supporters to contribute to community fundraising." },
      { type: "paragraph", text: "Lottery participation should be treated as entertainment and fundraising, not as a way of making money." },
      { type: "paragraph", text: "Only spend what you are comfortable spending. Purchasing more tickets does not guarantee that you will win." },
      { type: "paragraph", text: "Where appropriate, Burton Pride C.I.C. may provide links to information about safer gambling and support services." },
    ],
  },
  {
    title: "38. Changes to an Individual Lottery",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may make reasonable changes to an individual lottery where necessary." },
      { type: "paragraph", text: "Changes could relate to:" },
      { type: "bullet", text: "timing;" },
      { type: "bullet", text: "draw arrangements;" },
      { type: "bullet", text: "prize arrangements;" },
      { type: "bullet", text: "technical administration;" },
      { type: "bullet", text: "venue information;" },
      { type: "bullet", text: "security;" },
      { type: "bullet", text: "legal or regulatory requirements; or" },
      { type: "bullet", text: "circumstances genuinely outside Burton Pride C.I.C.'s control." },
      { type: "paragraph", text: "Burton Pride C.I.C. will not deliberately make retrospective changes intended to unfairly disadvantage entrants. Material changes will be communicated where reasonably possible." },
    ],
  },
  {
    title: "39. Changes to These General Terms",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. may update these General Lottery Terms & Conditions from time to time." },
      { type: "paragraph", text: "The current version will be published on the official Burton Pride website." },
      { type: "paragraph", text: "Where appropriate, the version accepted when an entrant purchases a ticket may also be stored within the Lottery System so there is a record of which terms applied to that entry." },
      { type: "paragraph", text: "Updating these general terms will not automatically replace the Individual Lottery Terms that applied to an already completed lottery." },
    ],
  },
  {
    title: "40. Limitation of Responsibility",
    items: [
      { type: "paragraph", text: "Burton Pride C.I.C. will take reasonable steps to operate lotteries accurately, securely and fairly." },
      { type: "paragraph", text: "Nothing in these Terms is intended to exclude or limit liability where doing so would be unlawful." },
      { type: "paragraph", text: "Subject to applicable law, Burton Pride C.I.C. cannot be responsible for loss resulting solely from circumstances outside its reasonable control. This may include third-party outages, telecommunications failures or incorrect information supplied by an entrant." },
    ],
  },
  {
    title: "41. Complaints and Disputes",
    items: [
      { type: "paragraph", text: "If you believe there has been a problem with:" },
      { type: "bullet", text: "your entry;" },
      { type: "bullet", text: "a ticket;" },
      { type: "bullet", text: "payment;" },
      { type: "bullet", text: "a refund;" },
      { type: "bullet", text: "a draw;" },
      { type: "bullet", text: "a prize;" },
      { type: "bullet", text: "eligibility;" },
      { type: "bullet", text: "use of your information; or" },
      { type: "bullet", text: "another aspect of a Burton Pride lottery," },
      { type: "paragraph", text: "please contact Burton Pride C.I.C. as soon as possible." },
      { type: "paragraph", text: "Burton Pride C.I.C. will review complaints fairly and may review payment records, ticket records, audit information and other relevant evidence when investigating a complaint." },
      { type: "paragraph", text: "Where a matter falls within the responsibilities of a licensing or regulatory authority, Burton Pride C.I.C. will cooperate with that authority where required." },
    ],
  },
  {
    title: "42. Agreement to These Terms",
    items: [
      { type: "paragraph", text: "By completing a lottery ticket purchase or otherwise submitting a valid entry, you confirm that:" },
      { type: "bullet", text: "you have read these General Lottery Terms & Conditions;" },
      { type: "bullet", text: "you have read the Individual Lottery Terms;" },
      { type: "bullet", text: "you satisfy the eligibility requirements;" },
      { type: "bullet", text: "the information you have provided is accurate;" },
      { type: "bullet", text: "you understand that winning is not guaranteed; and" },
      { type: "bullet", text: "you agree to comply with the applicable rules." },
      { type: "paragraph", text: "If you do not agree with these Terms or the Individual Lottery Terms, you should not purchase a ticket." },
    ],
  },
  {
    title: "43. Contact Burton Pride C.I.C.",
    items: [
      { type: "paragraph", text: "For questions about a Burton Pride lottery, including tickets, payments, prizes, winner information, eligibility or personal data, please contact:" },
      { type: "paragraph", text: "Burton Pride C.I.C." },
      { type: "paragraph", text: "Email: Info@burtonpride.co.uk" },
      { type: "paragraph", text: "Please include the name of the lottery and, where appropriate, your order or ticket reference so that Burton Pride C.I.C. can investigate your enquiry." },
    ],
  },
  {
    title: "44. Official Terms Notice",
    items: [
      { type: "paragraph", text: "These are the official General Lottery Terms & Conditions issued by Burton Pride C.I.C." },
      { type: "paragraph", text: "Each lottery may also have official Individual Lottery Terms issued through the Burton Pride Lottery System." },
      { type: "paragraph", text: "The official website version, together with the recorded version applying to each lottery, should be treated as the authoritative Burton Pride version." },
      { type: "paragraph", text: "Copies or altered versions published by third parties are not official Burton Pride C.I.C. terms." },
      { type: "paragraph", text: "Burton Pride C.I.C. reserves the right to update these general terms when necessary." },
    ],
  },
];

export default function LotteryTermsPage() {
  return (
    <>
      <MetaHead
        title="General Lottery Terms & Conditions | Burton Pride C.I.C."
        description="Read the General Lottery Terms & Conditions that apply across Burton Pride C.I.C. lotteries and raffles. Individual lotteries may also have their own specific terms."
        keywords="Burton Pride lottery terms, Burton Pride raffle terms, lottery terms and conditions, Burton Pride C.I.C., raffle rules, lottery rules"
      />

      <div
        className="
          min-h-screen
          px-4
          pb-24
          pt-8
          text-slate-950
          sm:px-8
          sm:pt-16
          dark:text-white
        "
      >
        <main
          className="
            mx-auto
            mt-8
            w-full
            max-w-5xl
            overflow-hidden
            rounded-[2rem]
            border
            border-slate-200
            bg-white
            shadow-[0_24px_80px_rgba(15,23,42,0.18)]
            dark:border-white/10
            dark:bg-[#111827]
            dark:shadow-2xl
          "
        >
          <header
            className="
              border-b
              border-slate-200
              px-6
              py-8
              text-center
              sm:px-10
              sm:py-12
              dark:border-white/10
            "
          >
            <div
              className="
                mx-auto
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                bg-purple-100
                text-purple-700
                dark:bg-purple-500/15
                dark:text-purple-200
              "
            >
              <Ticket className="h-7 w-7" />
            </div>

            <p
              className="
                mt-5
                text-sm
                font-black
                uppercase
                tracking-[0.16em]
                text-purple-700
                dark:text-purple-300
              "
            >
              Burton Pride C.I.C.
            </p>

            <h1
              className="
                mt-3
                text-3xl
                font-black
                leading-tight
                text-slate-950
                sm:text-5xl
                dark:text-white
              "
            >
              General Lottery Terms &amp; Conditions
            </h1>

            <p
              className="
                mx-auto
                mt-4
                max-w-3xl
                text-base
                font-medium
                leading-7
                text-slate-600
                sm:text-lg
                dark:text-white/65
              "
            >
              Website-wide terms applying to Burton Pride lotteries.
            </p>

            <div
              className="
                mt-5
                flex
                flex-wrap
                items-center
                justify-center
                gap-2
                text-sm
                font-bold
                text-slate-600
                dark:text-white/60
              "
            >
              <span
                className="
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50
                  px-3
                  py-1.5
                  dark:border-white/10
                  dark:bg-white/[0.05]
                "
              >
                Version 1.0
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50
                  px-3
                  py-1.5
                  dark:border-white/10
                  dark:bg-white/[0.05]
                "
              >
                Last updated: August 2026
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/Lottery"
                className="
                  inline-flex
                  min-h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50
                  px-5
                  py-2.5
                  text-sm
                  font-black
                  text-slate-800
                  transition
                  hover:border-purple-300
                  hover:bg-purple-50
                  hover:text-purple-800
                  dark:border-white/10
                  dark:bg-white/[0.05]
                  dark:text-white
                  dark:hover:bg-white/10
                "
              >
                <ArrowLeft className="h-4 w-4" />
                Back to lotteries
              </Link>
            </div>
          </header>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <section
              className="
                rounded-2xl
                border
                border-purple-200
                bg-purple-50
                p-5
                dark:border-purple-400/20
                dark:bg-purple-500/10
              "
            >
              <div className="flex items-start gap-3">
                <FileText
                  className="
                    mt-0.5
                    h-5
                    w-5
                    shrink-0
                    text-purple-700
                    dark:text-purple-300
                  "
                />

                <div>
                  <h2
                    className="
                      text-lg
                      font-black
                      text-purple-950
                      dark:text-purple-100
                    "
                  >
                    How these terms work
                  </h2>

                  <p
                    className="
                      mt-2
                      leading-7
                      text-purple-950/80
                      dark:text-white/75
                    "
                  >
                    These are the general terms for the Burton Pride Lottery
                    System. Every individual lottery should also have its own
                    Individual Lottery Terms covering that lottery&apos;s
                    specific ticket price, dates, prizes, draw method,
                    eligibility rules and any special conditions.
                  </p>
                </div>
              </div>
            </section>

        

            {/* LOTTERY REGISTRATION */}
            <section
              className="
                mt-6
                rounded-2xl
                border
                border-amber-300
                bg-amber-50
                p-5
                dark:border-yellow-300/25
                dark:bg-yellow-300/10
              "
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="
                    mt-0.5
                    h-5
                    w-5
                    shrink-0
                    text-amber-700
                    dark:text-yellow-300
                  "
                />

                <div>
                  <h2
                    className="
                      text-lg
                      font-black
                      text-slate-950
                      dark:text-white
                    "
                  >
                    Lottery registration
                  </h2>

                  <p
                    className="
                      mt-2
                      leading-7
                      text-slate-700
                      dark:text-white/75
                    "
                  >
                    Burton Pride lottery number:{" "}
                    <strong>SL0507</strong>. This lottery number was
                    issued by East Staffordshire Borough Council.
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-10 space-y-10">
              {termsSections.map((section) => (
                <TermsSectionBlock
                  key={section.title}
                  section={section}
                />
              ))}
            </div>

            <section
              className="
                mt-12
                rounded-2xl
                border
                border-blue-200
                bg-blue-50
                p-6
                dark:border-blue-300/20
                dark:bg-blue-500/10
              "
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="
                    mt-0.5
                    h-6
                    w-6
                    shrink-0
                    text-blue-700
                    dark:text-blue-300
                  "
                />

                <div>
                  <h2
                    className="
                      text-xl
                      font-black
                      text-blue-950
                      dark:text-blue-100
                    "
                  >
                    Individual Lottery Terms also apply
                  </h2>

                  <p
                    className="
                      mt-2
                      leading-7
                      text-slate-700
                      dark:text-white/70
                    "
                  >
                    Each Burton Pride lottery may also have its own Individual
                    Lottery Terms. You should read both these General Lottery
                    Terms and the specific terms shown for the lottery you wish
                    to enter before purchasing a ticket.
                  </p>

                  <Link
                    href="/Lottery"
                    className="
                      mt-5
                      inline-flex
                      min-h-11
                      items-center
                      justify-center
                      gap-2
                      rounded-full
                      bg-yellow-300
                      px-5
                      py-2.5
                      text-sm
                      font-black
                      text-purple-950
                      shadow
                      transition
                      hover:bg-yellow-200
                    "
                  >
                    <Ticket className="h-4 w-4" />
                    View Burton Pride lotteries
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}

function TermsSectionBlock({
  section,
}: {
  section: TermsSection;
}) {
  const blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "bullets"; items: string[] }
  > = [];

  for (const item of section.items) {
    if (item.type === "bullet") {
      const previous = blocks[blocks.length - 1];

      if (previous?.type === "bullets") {
        previous.items.push(item.text);
      } else {
        blocks.push({
          type: "bullets",
          items: [item.text],
        });
      }
    } else {
      blocks.push({
        type: "paragraph",
        text: item.text,
      });
    }
  }

  return (
    <section>
      <h2
        className="
          border-b
          border-slate-200
          pb-3
          text-2xl
          font-black
          text-slate-950
          dark:border-white/10
          dark:text-white
        "
      >
        {section.title}
      </h2>

      <div className="mt-4 space-y-3">
        {blocks.map((block, index) => {
          if (block.type === "bullets") {
            return (
              <ul
                key={`${section.title}-bullets-${index}`}
                className="
                  list-disc
                  space-y-2
                  pl-6
                  leading-7
                  text-slate-700
                  marker:text-purple-600
                  dark:text-white/70
                  dark:marker:text-purple-300
                "
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>
                    {renderTermsText(item)}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p
              key={`${section.title}-paragraph-${index}`}
              className="
                leading-7
                text-slate-700
                dark:text-white/70
              "
            >
              {renderTermsText(block.text)}
            </p>
          );
        })}
      </div>
    </section>
  );
}

function renderTermsText(text: string) {
  const email = "Info@burtonpride.co.uk";
  const index = text.indexOf(email);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const after = text.slice(index + email.length);

  return (
    <>
      {before}

      <a
        href="mailto:Info@burtonpride.co.uk"
        className="
          font-bold
          text-blue-700
          underline
          decoration-blue-300
          underline-offset-4
          hover:text-blue-900
          dark:text-blue-300
          dark:hover:text-blue-200
        "
      >
        {email}
      </a>

      {after}
    </>
  );
}
