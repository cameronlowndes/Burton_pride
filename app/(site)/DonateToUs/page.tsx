import MetaHead from '../components/MetaHead';
import DonationsContent from '../components/Client/DonateClient';

export const metadata = {
  title: 'Burton Pride - Donate',
  description:
    'Support Burton Pride with a donation and help us create inclusive events, safe spaces, and community support for Burton on Trent.',
};

export default function DonationsPage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Donate"
        description="Make a donation to Burton Pride and help fund community events, LGBTQ+ support, accessibility, and Pride celebrations in Burton on Trent."
        keywords="Burton Pride donate, Burton Pride donations, support Burton Pride, LGBTQ+ charity donation, Pride Burton on Trent, donate to Pride"
      />
      <DonationsContent />
    </>
  );
}