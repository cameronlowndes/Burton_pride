import MetaHead from '../components/MetaHead';
import MeetUsContent from '../components/Client/MeetUsContent'; 

export const metadata = {
  title: 'Burton Pride - Meet Us',
  description: 'Learn more about Burton Pride, our mission, and how to get involved.',
};

export default function MeetUs() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Meet Us"
        description="Meet the passionate people behind Burton Pride. Get to know our team members and learn how we work together to create an inclusive and vibrant community!"
        keywords="Burton Pride, Meet the team, LGBTQ+ community, Pride team, volunteers, event planners, social media team, website admin"
      />
      <MeetUsContent />
    </>
  );
}
