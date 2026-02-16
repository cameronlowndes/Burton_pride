'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SponsorsContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/update"); // change to your actual update page route
  }, [router]);

  return null;
}
