import type { Metadata } from 'next';

import ValuesContent from '../../components/Client/ValuesContent';

export const metadata: Metadata = {
  title: 'Our Core Values | Burton Pride',
  description:
    'Learn about the values that guide Burton Pride, including inclusion, diversity, respect, equality and community support.',
  keywords: [
    'Burton Pride',
    'core values',
    'LGBTQ+',
    'diversity',
    'inclusion',
    'neurodiversity',
    'community',
    'respect',
    'equality',
  ],
};

export default function ValuesPage() {
  return (
    <main className="w-full">
      <div
        className="
          mx-auto
          flex
          w-full
          max-w-7xl
          flex-col
          items-center
          px-4
          pb-20
          pt-8
          sm:px-6
          lg:px-8
        "
      >
        <ValuesContent />
      </div>
    </main>
  );
}