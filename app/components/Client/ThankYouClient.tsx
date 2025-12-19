"use client";

import { useRouter } from "next/navigation";
import MetaHead from "../MetaHead";

export default function ClientThankYou() {
  const router = useRouter();

  return (
    <>
      <MetaHead
        title="Thank for your Email"
        description="Thank you for contacting Burton Pride. We aim to respond within 2 working days."
        keywords="Burton Pride, Pride events, LGBTQ+ events, community events, Pride Parade, inclusivity, diversity"
      />

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white p-8">
        <div className="bg-white/20 backdrop-blur-md rounded-xl p-10 text-center space-y-4">
          <h1 className="text-3xl font-bold mb-4">Thank you for your email!</h1>
          <p>
            Burton Pride will aim to respond within 2 working days.  
            We appreciate your interest and support.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 bg-yellow-400 text-black px-6 py-3 rounded font-bold hover:bg-yellow-300 transition cursor-pointer"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    </>
  );
}
