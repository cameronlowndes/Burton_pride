"use client";

import React, { useState } from "react";
import BusinessForm from "../components/Forms/BussinessForm";

export default function BusinessFormPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 flex flex-col items-center justify-start pt-24 p-6">
  <h1 className="text-3xl sm:text-5xl font-bold text-white mb-8 text-center drop-shadow-lg">
    Apply for Burton Pride 2026
  </h1>

      <div className="w-full max-w-md bg-white rounded-xl p-6 shadow-lg">
        <BusinessForm />
      </div>
    </div>
  );
}
