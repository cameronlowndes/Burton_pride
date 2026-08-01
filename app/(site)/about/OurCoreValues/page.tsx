import Head from 'next/head';
import ValuesHero from '../../components/Client/CoreValuesClient';



export const metadata = {
  title: 'Burton Pride - Our Core Values',
  description:
    'Learn about the core values that guide Burton Pride in fostering diversity, inclusion, and community support.',
};

export default function Values() {
  return (
    <>
      <Head>
        <title>Burton Pride - Our Core Values</title>
        <meta
          name="description"
          content="Learn about the core values that guide Burton Pride in fostering diversity, inclusion, and community support."
        />
        <meta
          name="keywords"
          content="Burton Pride, core values, diversity, inclusion, neurodiversity, community, respect, equality"
        />
      </Head>

      <div className="min-h-screen  text-gray-900 flex flex-col items-center p-8 sm:p-16">
        <ValuesHero />
      
      </div>
    </>
  );
}
