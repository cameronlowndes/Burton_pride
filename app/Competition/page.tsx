import CompetitionClient from '../components/Client/Competitionclient';
import MetaHead from '../components/MetaHead';

export const metadata = {
  title: 'Burton Pride - Competition',
  description: 'Enter the Burton Pride 2026 competition! Showcase your creativity and Pride spirit for a chance to win amazing prizes and be part of our celebration of inclusivity and diversity.',
};

export default function Home() {
  return (
    <>
      <MetaHead
        title={metadata.title}
        description={metadata.description}
        keywords="Burton Pride, Pride competition, LGBTQ+ events, community, Pride Parade, inclusivity, diversity, artwork competition"
      />
      <CompetitionClient />
    </>
  );
}
