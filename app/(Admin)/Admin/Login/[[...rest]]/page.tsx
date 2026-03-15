"use client";

import { SignIn } from "@clerk/nextjs";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SignIn
        routing="path"
        path="/Admin/Login"
        forceRedirectUrl="/Admin/Dashboard"
        fallbackRedirectUrl="/Admin/Dashboard"
      />
    </div>
  );
}