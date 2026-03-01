import CompetitionVoteClient from "../../components/Client/CompetitionVoteClient";
import MetaHead from "../../components/MetaHead";

export const metadata = {
  title: "Burton Pride - Vote",
  description:
    "Vote for your favourite Windows of Hope display in the Burton Pride competition.",
};

export default function VotePage() {
  return (
    <>
      <MetaHead
        title={metadata.title}
        description={metadata.description}
        keywords="Burton Pride, vote, Windows of Hope, Pride competition, LGBTQ+ community"
      />
      <CompetitionVoteClient />
    </>
  );
}