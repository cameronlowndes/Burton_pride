import MetaHead from '../components/MetaHead';
import LGBTQIA_HELP from '../components/Client/LGBTQIA_HELP';

export const metadata = {
title: "LGBTQIA+ Supports and Resources",
  description: "Find community and support in Burton upon Trent and across the UK.",
};

export default function JoinUs() {
  return (
    <>
      <MetaHead
        title="LGBTQIA+ Supports and Resources"
        description="Find community and support in Burton upon Trent and across the UK."
        keywords="LGBTQIA+, supports, resources, Burton, community, support"
      />

      {/* Page Container */}
      <div className="min-h-screen bg-gradient-to-r  text-white flex flex-col items-center p-8 sm:p-16 pb-24">

        {/* Client Component */}
        <LGBTQIA_HELP />
      </div>
    </>
  );
}
