import MetaHead from "../../components/MetaHead";
import PrideEventClient from "../../components/Client/BurtonPrideMainEvent";

export const metadata = {
  title: "Burton Pride 2026",
  description:
    "Burton Pride 2026 is a grassroots, community-led Pride event taking place on Saturday 27th June 2026. Find out what to expect, how to get involved, and how to support Burton Pride.",
};

export default function Pride2026Page() {
  return (
    <>
      <MetaHead
        title="Burton Pride 2026"
        description="Burton Pride 2026 is back on Saturday 27th June 2026. A grassroots, community-led Pride created by the community, for the community. Find out what to expect, how to get involved, and how to support Burton Pride."
        keywords="Burton Pride 2026, Pride Burton on Trent, Burton Pride event, LGBTQ+ Burton, Burton Pride C.I.C, grassroots Pride, community Pride, Burton Pride after party, Pride 2026"
      />

      <PrideEventClient />
    </>
  );
}