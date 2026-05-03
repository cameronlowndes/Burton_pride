import MetaHead from "../components/MetaHead";
import RaffleContent from "../components/Client/RaffleClient";

export const metadata = {
  title: "Burton Pride - Raffle",
  description:
    "Take part in the Burton Pride raffle and help support grassroots Pride, local LGBTQIA+ community work, inclusive events, and safer spaces in Burton on Trent.",
};

export default function RafflePage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Raffle"
        description="Support Burton Pride C.I.C by taking part in our raffle. Every ticket helps us keep Pride grassroots, community-led, ethical, and focused on creating inclusive events, safer spaces, and support for the LGBTQIA+ community in Burton on Trent."
        keywords="Burton Pride raffle, Burton Pride C.I.C, LGBTQIA+ raffle, Burton on Trent Pride, grassroots Pride, community fundraising, Pride fundraiser, local raffle, support Burton Pride"
      />
      <RaffleContent />
    </>
  );
}