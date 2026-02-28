// components/MetaHead.tsx
import Head from "next/head";
import React from "react";

interface MetaHeadProps {
  title?: string;
  description?: string;
  keywords?: string; // Optional, for dynamic use of keywords
}

const MetaHead: React.FC<MetaHeadProps> = ({
  title = "Burton Pride | Home",
  description = "Join Burton Pride and celebrate diversity, inclusion, and love in the heart of Burton.",
  keywords = "Burton Pride, LGBTQ+, diversity, events, inclusivity", // Default keywords if not provided
}) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Burton Pride" />
      <meta name="google-site-verification" content="LI3n61JOpv5xVsLpjjteAlTkEjNGprTSQ2aajD_XU5o" />
    </Head>
  );
};

export default MetaHead;
