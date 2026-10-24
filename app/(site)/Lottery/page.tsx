import MetaHead from "../components/MetaHead";
import LotteryHomeContent from "../components/Client/LotteryManagement/homeLottery";

export const metadata = {
  title: "Burton Pride Lottery Home",
  description:
    "Take part in Burton Pride lotteries and raffles, support our community work, view prizes and find upcoming draw information.",
};

export default function LotteryPage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Lottery Home"
        description="Take part in Burton Pride lotteries and raffles while supporting our community work, events and future projects. View current lotteries, prizes, ticket information and draw dates."
        keywords="Burton Pride, lottery, raffle, Burton Pride lottery, fundraising, LGBTQ+ community, prizes, charity raffle, Burton on Trent"
      />

      {/* Lottery Page Container */}
      <div className="min-h-screen text-white flex flex-col items-center pb-24">
        {/* Lottery Home Client Component */}
        <LotteryHomeContent />
      </div>
    </>
  );
}