"use client";

import { SignIn } from "@clerk/nextjs";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SignIn
        routing="path"
        path="/admin/login"
        afterSignInUrl="/admin/dashboard"
        fallbackRedirectUrl="/admin/dashboard"
      />
    </div>
  );
}