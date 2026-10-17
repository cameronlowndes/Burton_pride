'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

type SupportService = {
  name: string;
  area: string;
  summary: string;
  forWho: string;
  website?: string;
  phone?: { label: string; href: string };
  email?: string;
  note?: string;
};

// Review these details regularly against each organisation's own website.
const LAST_CHECKED = '17 October 2026';

const localServices: SupportService[] = [
  {
    name: 'Burton Pride',
    area: 'Burton upon Trent',
    summary:
      'Connect with your local LGBTQIA+ community through Burton Pride events and community gatherings.',
    forWho: 'LGBTQIA+ people and allies in Burton and the surrounding area.',
    email: 'info@burtonpride.co.uk',
    note: 'For community enquiries. This inbox is not an emergency or crisis service.',
  },
  {
    name: 'Burton & District Mind',
    area: 'Burton upon Trent · mental health support',
    summary:
      'Local mental health support, including counselling, coaching, peer support and activity groups.',
    forWho: 'People seeking mental health support in East Staffordshire, Lichfield District and Tamworth Borough.',
    website: 'https://burtonmind.co.uk/find-help/',
    phone: { label: '01283 566696', href: 'tel:01283566696' },
    email: 'info@burtonmind.co.uk',
    note: 'A general mental health service. Ask about eligibility, referral options and any counselling costs. The office number is not an emergency line.',
  },
  {
    name: 'SARAC',
    area: 'Burton upon Trent and surrounding areas',
    summary:
      'Free emotional support and counselling for people affected by sexual abuse or rape, with support also available for people affected by domestic abuse.',
    forWho: 'People aged 11 and over. Contact SARAC to check the right support pathway for you.',
    website: 'https://www.sarac.org.uk/referrals/',
    phone: { label: '01283 517185', href: 'tel:01283517185' },
    email: 'staff@sarac.org.uk',
    note: 'Confidential helpline: leave a message for referral support. SARAC is not a crisis service. Services are open to people of all backgrounds.',
  },
  {
    name: 'YMCA Burton',
    area: 'Burton upon Trent · housing and practical support',
    summary:
      'Supported accommodation and practical help for people experiencing homelessness, alongside a food bank and other local support services.',
    forWho: 'People in need locally. Supported housing is for single people aged 18–64 experiencing homelessness in East Staffordshire.',
    website: 'https://www.burtonymca.org/housing/',
    phone: { label: '01283 547211', href: 'tel:01283547211' },
    email: 'office@burtonymca.org',
    note: 'The phone number is for Reconnect housing enquiries. Ask the team about eligibility, availability and access to other services.',
  },
  {
    name: 'Burton HOPE',
    area: 'Burton upon Trent · community and practical support',
    summary:
      'A local charity supporting people affected by homelessness and poverty, with food, clothing and help finding further support.',
    forWho: 'Individuals and families in need in Burton and the surrounding community.',
    website: 'https://burtonhope.co.uk/contact/',
    phone: { label: '07472 678343', href: 'tel:07472678343' },
    email: 'enquiries@burtonhope.co.uk',
    note: 'Based at Hope House, off Anglesey Road. Contact the team for current services and opening times; Facebook Messenger is their preferred contact method.',
  },
  {
    name: 'Project 93',
    area: 'Staffordshire · based in Stoke-on-Trent',
    summary:
      'LGBTQ+ support in Staffordshire, including counselling, community groups and transgender support.',
    forWho: 'LGBTQ+ people looking for support in Staffordshire.',
    website: 'https://p93.org/lgbt/',
    note: 'Contact the team to check which services cover your area and how to access them.',
  },
  {
    name: 'Derbyshire LGBT+',
    area: 'Nearby · Derby and Derbyshire',
    summary:
      'Supportive listening, advice and social groups, with services for young people and LGBTQ+ people seeking asylum or living as refugees.',
    forWho: 'People seeking LGBTQ+ support in Derby and Derbyshire.',
    website: 'https://www.derbyshirelgbt.org.uk/',
    phone: { label: '01332 207 704', href: 'tel:01332207704' },
    email: 'info@derbyshirelgbt.org.uk',
    note: 'Based outside Burton. Ask about eligibility and availability before travelling.',
  },
];

const nationalServices: SupportService[] = [
  {
    name: 'Switchboard',
    area: 'UK · listening and support',
    summary:
      'A free LGBTQIA+ support line, with phone, email and instant messaging options answered by LGBTQIA+ volunteers.',
    forWho: 'LGBTQIA+ people, people questioning their identity, and those supporting them.',
    website: 'https://switchboard.lgbt/contact-us',
    phone: { label: '0800 0119 100', href: 'tel:08000119100' },
    note: 'Visit the website for current opening times and online contact options.',
  },
  {
    name: 'Galop',
    area: 'UK · abuse and violence support',
    summary:
      'Specialist support for LGBTQ+ people affected by domestic abuse, hate crime, sexual violence, conversion practices and other forms of abuse.',
    forWho: 'LGBTQ+ people experiencing abuse, and people concerned about someone else.',
    website: 'https://www.galop.org.uk/',
    phone: { label: '0800 999 5428', href: 'tel:08009995428' },
    email: 'help@galop.org.uk',
    note: 'The helpline has set opening hours. Check the website before calling.',
  },
  {
    name: 'Mermaids',
    area: 'UK · trans young people and families',
    summary:
      'Support and information for trans, non-binary and gender-diverse children, young people and their families.',
    forWho: 'Gender-diverse young people, parents and carers.',
    website: 'https://mermaidsuk.org.uk/',
    phone: { label: '0808 801 0400', href: 'tel:08088010400' },
    note: 'Phone and webchat opening times are listed on the Mermaids website.',
  },
  {
    name: 'akt',
    area: 'UK · youth homelessness support',
    summary:
      'Help for LGBTQ+ young people who are homeless, at risk of homelessness or living in an unsafe home. Online support is available across the UK.',
    forWho: 'LGBTQ+ young people aged 16–25.',
    website: 'https://www.akt.org.uk/',
    note: 'Visit the website to request support or find out about live chat.',
  },
];

const nationalGroups: { id: string; title: string; services: SupportService[] }[] = [
  { id: 'listening-specialist', title: 'Listening and specialist support', services: nationalServices },
  {
    id: 'wellbeing', title: 'Mental health and wellbeing', services: [
      {
        name: 'LGBT Foundation', area: 'National support · some services are regional',
        summary: 'Advice, emotional support and signposting through its helpline and email service, alongside LGBTQ+ wellbeing resources.',
        forWho: 'LGBTQ+ people seeking information or support.', website: 'https://lgbt.foundation/',
        phone: { label: '0345 330 3030', href: 'tel:03453303030' }, email: 'helpline@lgbt.foundation',
        note: 'Check current hours and eligibility. Some services are limited to Greater Manchester or other funded areas.',
      },
      {
        name: 'MindOut', area: 'UK online support · based in Brighton and Hove',
        summary: 'LGBTQ+ mental health information and online support from trained LGBTQ+ volunteers.',
        forWho: 'LGBTQ+ people looking for mental health support online.', website: 'https://mindout.org.uk/get-support/mindout-online/',
        note: 'Online support runs at advertised times. Counselling and other services have their own eligibility and location requirements.',
      },
      {
        name: 'LGBT HERO', area: 'UK · health and wellbeing resources',
        summary: 'Health and wellbeing information, peer support forums, online groups and directories of further help.',
        forWho: 'LGBTQ+ people looking for information and community support.', website: 'https://www.lgbthero.org.uk/',
        note: 'Check age requirements for individual forums and groups. This is not an emergency service.',
      },
    ],
  },
  {
    id: 'trans-support', title: 'Trans and non-binary support', services: [
      {
        name: 'Gendered Intelligence', area: 'UK · trans-led charity; service coverage varies',
        summary: 'Information, youth work and support for trans, non-binary and gender-questioning people and those around them.',
        forWho: 'Trans and gender-questioning people, families, carers and professionals.', website: 'https://genderedintelligence.co.uk/services',
        note: 'Each programme has its own age and location criteria. The healthcare waiting-list support line is for adults and has specific eligibility.',
      },
    ],
  },
  {
    id: 'identity-community', title: 'Bi+, ace, aro and intersex communities', services: [
      {
        name: 'Biscuit', area: 'UK · bi+ resources and group directory',
        summary: 'Bi+ information, community guides and a directory of local groups to help people find connections.',
        forWho: 'Bi+ people, including bisexual and pansexual people, and those questioning.', website: 'https://thisisbiscuit.org.uk/local-bi-groups',
        note: 'A community resource and directory. Individual groups set their own access arrangements.',
      },
      {
        name: 'Stonewall Ace Hub', area: 'UK · ace and aro information',
        summary: 'Resources, personal stories and information about asexual and aromantic experiences and inclusion.',
        forWho: 'Ace and aro people, people questioning, and allies.', website: 'https://www.stonewall.org.uk/resources/lgbtq-hubs/ace-hub',
        note: 'An information resource rather than a counselling or emergency service.',
      },
      {
        name: 'Interconnected UK (ICON UK)', area: 'UK · intersex peer support',
        summary: 'Peer connection, shared experiences and information for people with intersex traits or variations of sex characteristics.',
        forWho: 'People with intersex traits or variations of sex characteristics and their loved ones.', website: 'https://www.interconnecteduk.net/',
        note: 'Visit the website to ask about peer support and current community activities.',
      },
    ],
  },
  {
    id: 'housing-support', title: 'Housing and homelessness', services: [
      {
        name: 'Stonewall Housing', area: 'England · LGBTQ+ housing support',
        summary: 'Specialist housing advice, advocacy and support for LGBTQ+ people facing homelessness or unsafe housing.',
        forWho: 'LGBTQ+ people with housing problems in England.', website: 'https://stonewallhousing.org/',
        note: 'Advice and supported accommodation have different eligibility and availability. This is a separate charity from Stonewall.',
      },
    ],
  },
  {
    id: 'asylum-support', title: 'Asylum, migration and refugee support', services: [
      {
        name: 'Rainbow Migration', area: 'UK · LGBTQI+ asylum and immigration',
        summary: 'Specialist legal information and advice, practical help and emotional support for LGBTQI+ people navigating the asylum system.',
        forWho: 'LGBTQI+ people seeking asylum, and people seeking information about living in the UK with their partner.', website: 'https://www.rainbowmigration.org.uk/',
        note: 'Use the relevant support route on the website. Check which advice the team can provide for your situation.',
      },
      {
        name: 'Micro Rainbow', area: 'UK · LGBTQI asylum seekers and refugees',
        summary: 'Safe housing, social inclusion and help moving into education and work for LGBTQI people seeking safety in the UK.',
        forWho: 'LGBTQI people seeking asylum and refugees.', website: 'https://microrainbow.org/',
        note: 'Housing places and programmes depend on eligibility, location and availability.',
      },
    ],
  },
  {
    id: 'sexual-health', title: 'HIV and sexual health', services: [
      {
        name: 'Terrence Higgins Trust', area: 'UK · HIV and sexual health information',
        summary: 'Information and support about living with HIV and sexual health, with online resources and routes to further help.',
        forWho: 'People living with HIV and anyone seeking HIV or sexual health information, including LGBTQIA+ people.', website: 'https://www.tht.org.uk/',
        note: 'Services have their own location and access criteria. Check the website for current support options.',
      },
    ],
  },
  {
    id: 'young-people', title: 'Young people and those supporting them', services: [
      {
        name: 'The Proud Trust — Proud Connections', area: 'UK · online youth support',
        summary: 'Online live chat with youth workers for LGBTQ+ young people and adults who support them, alongside youth resources.',
        forWho: 'LGBTQ+ young people, people questioning and adults in their lives.', website: 'https://www.theproudtrust.org/proud-connections/',
        note: 'Live chat runs at advertised times. Other programmes may have specific age and location requirements.',
      },
    ],
  },
  {
    id: 'uk-nations', title: 'Scotland, Wales and Northern Ireland', services: [
      {
        name: 'LGBT Health and Wellbeing', area: 'Scotland · listening and wellbeing',
        summary: 'A confidential LGBTQ+ helpline and wellbeing support, with information about community, trans and non-binary, older people and carers services.',
        forWho: 'LGBTQ+ people in Scotland and people exploring their identity.', website: 'https://lgbthealth.org.uk/service/helpline/',
        phone: { label: '0800 464 7000', href: 'tel:08004647000' }, email: 'helpline@lgbthealth.org.uk',
        note: 'Check current helpline hours and access criteria for individual services.',
      },
      {
        name: 'LGBT Youth Scotland', area: 'Scotland · young people aged 13–25',
        summary: 'Youth groups, youth work and information supporting LGBTQ+ young people across Scotland.',
        forWho: 'LGBTQ+ young people aged 13–25 living in Scotland.', website: 'https://lgbtyouth.org.uk/',
        note: 'Find current groups and support options on the website.',
      },
      {
        name: 'Umbrella Cymru', area: 'Wales · gender and sexual diversity support',
        summary: 'Support for LGBTQ+ people and their families with identity, everyday life and accessing other services.',
        forWho: 'LGBTQ+ people and their families in Wales.', website: 'https://www.umbrellacymru.co.uk/',
        phone: { label: '0300 302 3670', href: 'tel:03003023670' }, email: 'info@umbrellacymru.co.uk',
        note: 'Use the online support request form. Check current availability and waiting times.',
      },
      {
        name: 'The Rainbow Project', area: 'Northern Ireland · LGBTQIA+ wellbeing',
        summary: 'Health and wellbeing support, counselling, sexual health services and support around crime and violence.',
        forWho: 'LGBTQIA+ people in Northern Ireland.', website: 'https://www.rainbow-project.org/',
        phone: { label: '028 9031 9030', href: 'tel:02890319030' }, email: 'info@rainbow-project.org',
        note: 'The number is for the Belfast office. Check individual services for referrals, location and availability.',
      },
    ],
  },
  {
    id: 'family-support', title: 'Parents, families and friends', services: [
      {
        name: 'FFLAG', area: 'UK · family support',
        summary: 'Support, information and reassurance for families and friends of LGBTQ+ people, including a helpline, email support and parent groups.',
        forWho: 'Parents, families and friends of LGBTQ+ people.', website: 'https://fflag.org.uk/',
        phone: { label: '0300 688 0368', href: 'tel:03006880368' }, email: 'support@fflag.org.uk',
        note: 'Check current helpline hours and group arrangements on the website.',
      },
    ],
  },
  {
    id: 'disability-support', title: 'Disabled LGBTQIA+ people', services: [
      {
        name: 'Regard', area: 'UK · disabled LGBTQI+ community',
        summary: 'A national organisation providing information, advice, support and a community voice for disabled LGBTQI+ people.',
        forWho: 'LGBTQI+ people who self-identify as disabled.', website: 'https://regard.org.uk/aims-and-values/',
        note: 'Contact Regard about current membership, activities and support. This is not an emergency service.',
      },
    ],
  },
  {
    id: 'faith-community', title: 'Faith, culture and community', services: [
      {
        name: 'Hidayah LGBT', area: 'UK · LGBTQI+ Muslim community',
        summary: 'Community, events and support for LGBTQI+ Muslims, creating space to explore sexuality, gender and faith.',
        forWho: 'LGBTQI+ Muslims aged 18 and over in the UK.', website: 'https://hidayahlgbt.com/',
        note: 'Check current support options. Hidayah states that it cannot provide direct support to asylum seekers or under-18s; Rainbow Migration and Micro Rainbow are listed above for asylum-related support.',
      },
      {
        name: 'House of Rainbow', area: 'UK-based · faith and community support',
        summary: 'Affirming faith and community support, including one-to-one support and gatherings for people facing religious homophobia and exclusion.',
        forWho: 'LGBTIQ+ people, particularly people of colour, and their families and allies.', website: 'https://www.houseofrainbow.org/',
        note: 'Check online and in-person options with the organisation. In-person gatherings may be outside your area.',
      },
      {
        name: 'UK Black Pride', area: 'UK · Black LGBTQIA+ community and culture',
        summary: 'Community events, cultural celebration, education and advocacy centring Black LGBTQIA+ people and LGBTQIA+ people of colour.',
        forWho: 'Black LGBTQIA+ people, LGBTQIA+ people of colour and allies.', website: 'https://www.ukblackpride.org.uk/',
        note: 'A community, cultural and advocacy organisation rather than a counselling or emergency service. Check event locations before travelling.',
      },
    ],
  },
  {
    id: 'older-people', title: 'Older LGBTQIA+ people', services: [
      {
        name: 'Re-engage — Rainbow Call Companions', area: 'UK · telephone befriending for people aged 75+',
        summary: 'Free telephone befriending to help older LGBTQ+ people build social connections through friendly conversations with an LGBTQ+ volunteer.',
        forWho: 'LGBTQ+ people aged 75 and over who would welcome regular conversation.', website: 'https://w.reengage.org.uk/join-a-group/get-a-rainbow-call-companion/',
        note: 'Check current joining criteria and matching availability. Befriending is not counselling or emergency support.',
      },
    ],
  },
  {
    id: 'education-resources', title: 'Education and further information', services: [
      {
        name: 'GIRES / TranzWiki', area: 'UK · trans information and support directory',
        summary: 'Trans-led information and resources from the Gender Identity Research & Education Society, including TranzWiki listings of support groups across the UK.',
        forWho: 'Trans, non-binary and gender-diverse people, their families and professionals.', website: 'https://www.gires.org.uk/resources/',
        note: 'An information and directory resource. Contact individual listed groups about their services and eligibility.',
      },
      {
        name: 'Diversity Role Models', area: 'UK · schools and LGBTQ+ inclusion',
        summary: 'School workshops, staff training and educational resources to challenge prejudice and tackle homophobic, biphobic and transphobic bullying.',
        forWho: 'Schools, educators, pupils, parents and carers seeking inclusive education resources.', website: 'https://www.diversityrolemodels.org/',
        note: 'An education charity rather than an individual counselling or crisis service. Check programme availability and costs directly.',
      },
    ],
  },
  {
    id: 'information-directories', title: 'Information and more organisations', services: [
      {
        name: 'Stonewall', area: 'UK · equality information and resources',
        summary: 'LGBTQ+ information, community resources and links to specialist organisations across a range of support needs.',
        forWho: 'LGBTQ+ people, families, allies and professionals.', website: 'https://www.stonewall.org.uk/resources/support-services-in-the-sector',
        note: 'An information and campaigning charity. Use specialist providers for individual legal advice or urgent support.',
      },
      {
        name: 'LGBT+ Consortium directory', area: 'UK · find more groups and services',
        summary: 'A searchable directory of LGBTQ+ organisations, with filters for location, communities served and areas of work.',
        forWho: 'Anyone looking for additional LGBTQ+ community groups or specialist services.', website: 'https://www.consortium.lgbt/member-directory/',
        note: 'A directory rather than a direct support line. Contact each listed organisation about its services.',
      },
    ],
  },
];

const linkStyle =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700 motion-reduce:transition-none';

function ServiceCard({ service, headingLevel = 3 }: { service: SupportService; headingLevel?: 3 | 4 }) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-7">
      <p className="text-sm font-semibold text-violet-800">{service.area}</p>
      <Heading className="mt-3 text-2xl font-bold tracking-tight">{service.name}</Heading>
      <p className="mt-3 leading-7 text-slate-700">{service.summary}</p>
      <p className="mt-4 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-900">Who it’s for: </span>
        {service.forWho}
      </p>

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-3">
          {service.website && (
            <a
              href={service.website}
              className={`${linkStyle} bg-violet-800 text-white hover:bg-violet-900 active:bg-violet-950`}
              aria-label={`Visit ${service.name} website`}
            >
              Visit website <span aria-hidden="true" className="ml-2">↗</span>
            </a>
          )}
          {service.phone && (
            <a
              href={service.phone.href}
              className={`${linkStyle} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200`}
              aria-label={`Call ${service.name} on ${service.phone.label}`}
            >
              Call {service.phone.label}
            </a>
          )}
        </div>
        {service.email && (
          <a
            href={`mailto:${service.email}`}
            className="mt-3 inline-flex min-h-11 max-w-full cursor-pointer items-center break-all py-2 text-sm font-semibold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700"
            aria-label={`Email ${service.name}: ${service.email}`}
          >
            {service.email}
          </a>
        )}
        {service.note && (
          <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
            {service.note}
          </p>
        )}
      </div>
    </article>
  );
}

export default function LGBTQIASupportPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen bg-transparent text-white">
      <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-24">
        <motion.header
          initial={false}
          animate={{ y: reduceMotion ? 0 : [8, 0] }}
          transition={{ duration: 0.4 }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-4">
            <Image
              src="/image/Logo.png"
              alt="Burton Pride"
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full border-2 border-white/70 bg-white object-cover"
            />
            <p className="text-sm font-semibold tracking-wide text-pink-200">
              Burton Pride · Community support
            </p>
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            LGBTQIA+ help<br className="hidden sm:block" /> and support
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
           Find community and support in Burton upon Trent and across the UK.
            Whether you're looking for someone to talk to, advice, or simply a safe space where you can be 
            yourself, these organisations are here to help.
            All organisations listed have been reviewed and checked by the Burton Pride Committee Team 
            to help you find trusted support.
          </p>
          <p className="mt-4 leading-7 text-slate-300">
            Lesbian, gay, bi, trans, queer, intersex, ace, questioning or another
            identity — you are welcome here.
          </p>
          <nav aria-label="Support sections" className="mt-8 flex flex-wrap gap-3">
            <a href="#local-support" className={`${linkStyle} bg-white text-slate-950 hover:bg-pink-100 active:bg-pink-200 focus-visible:outline-white`}>
              Burton and nearby
            </a>
            <a href="#national-support" className={`${linkStyle} border border-slate-500 text-white hover:bg-white/10 active:bg-white/20 focus-visible:outline-white`}>
              Support across the UK
            </a>
          </nav>
        </motion.header>

        <aside aria-labelledby="urgent-help-heading" className="mt-12 rounded-2xl border border-amber-300/50 bg-amber-50 p-6 text-slate-950">
          <h2 id="urgent-help-heading" className="text-lg font-bold">In immediate danger?</h2>
          <p className="mt-2 leading-7">
            Call{' '}
            <a href="tel:999" className="inline-flex min-h-11 cursor-pointer items-center font-bold underline underline-offset-4 hover:text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950">999</a>
            {' '}if there is a life-threatening emergency or immediate danger.
            The contacts below have different opening hours.
          </p>
        </aside>

        <section id="local-support" aria-labelledby="local-heading" className="scroll-mt-28 pt-16">
          <h2 id="local-heading" className="text-3xl font-bold tracking-tight">Burton and nearby</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">
            Local community connections, mental health, abuse, housing and practical support, plus services in Staffordshire and nearby Derbyshire.
            Check locations and eligibility with each organisation.
          </p>
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {localServices.map((service) => <ServiceCard key={service.name} service={service} />)}
          </div>
        </section>

        <section id="national-support" aria-labelledby="national-heading" className="scroll-mt-28 pt-16">
          <h2 id="national-heading" className="text-3xl font-bold tracking-tight">National support and services across the UK</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">
            Explore listening services, specialist help and community resources.
            Some services cover the whole UK; others are limited to a particular nation,
            age group or area. Check each listing and the organisation’s website.
            This directory is a starting point and does not include every UK service.
          </p>
          <nav aria-label="National support topics" className="mt-7 flex flex-wrap gap-3">
            {nationalGroups.map((group) => (
              <a key={group.id} href={`#${group.id}`} className={`${linkStyle} border border-white/70 text-white hover:bg-white/15 active:bg-white/25 focus-visible:outline-white`}>
                {group.title}
              </a>
            ))}
          </nav>
          <div className="mt-10 space-y-12">
            {nationalGroups.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-28">
                <h3 id={`${group.id}-heading`} className="text-2xl font-bold">{group.title}</h3>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {group.services.map((service) => <ServiceCard key={service.name} service={service} headingLevel={4} />)}
                </div>
              </section>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-slate-700 pt-7 text-sm leading-6 text-slate-300">
          <p>
            This page is a directory of community and support services. Each organisation
            manages its own services, eligibility and confidentiality policies.
            Check its website for the latest details.
          </p>
          <p className="mt-3">Details last checked: {LAST_CHECKED}.</p>
          <p className="mt-3">
            Spotted a change or know a local service we should include?{' '}
            <a href="mailto:info@burtonpride.co.uk" className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-pink-200 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Email Burton Pride
            </a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
