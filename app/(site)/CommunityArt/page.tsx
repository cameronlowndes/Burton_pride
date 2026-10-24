
import CommuintyArtClient from '../components/Client/CommunityArtClient';
import MetaHead from '../components/MetaHead';

export const metadata = {
  title: 'Burton Pride - Community Art',
  description: 'Explore the vibrant community art scene in Burton Pride. Discover local artists, exhibitions, and creative initiatives that celebrate diversity and inclusivity!',
};

export default function Home() {
  return (
    <>
      <MetaHead
        title={metadata.title}
        description={metadata.description}
        keywords="Burton Pride, Pride events, LGBTQ+ events, community events, Pride Parade, inclusivity, diversity"
      />
      <CommuintyArtClient />
    </>
  );
}
