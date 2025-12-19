'use client';
import React, { useState, useEffect } from 'react';
import { useForm, ValidationError } from '@formspree/react';

function VolunteerForm() {
  const [state, handleSubmit] = useForm("xpwrlvzk");
  const [dobError, setDobError] = useState("");
  const [emDobError, setEmDobError] = useState("");

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const validateForm = (event: React.FormEvent<HTMLFormElement>) => {
    setDobError("");
    setEmDobError("");

    const form = event.currentTarget;
    const dob = (form.querySelector("#dob") as HTMLInputElement)?.value;
    const emDob = (form.querySelector("#emDob") as HTMLInputElement)?.value;

    let valid = true;

    if (dob) {
      const age = calculateAge(dob);
      if (age < 18) {
        setDobError("⚠️ Volunteers must be at least 18 years old due to our Terms & Conditions.");
        valid = false;
      }
    }

    if (emDob) {
      const emAge = calculateAge(emDob);
      if (emAge < 18) {
        setEmDobError("⚠️ Emergency contacts must be at least 18 years old due to our Terms & Conditions.");
        valid = false;
      }
    }

    if (!valid) {
      event.preventDefault();
    }
  };

  // Redirect to Thank You page on successful submission
  useEffect(() => {
    if (state.succeeded) {
      window.location.href = '/ThankYou';
    }
  }, [state.succeeded]);

  return (
    <form
      onSubmit={(e) => {
        validateForm(e);
        if (!dobError && !emDobError) handleSubmit(e);
      }}
      className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white rounded-3xl shadow-2xl border-4 border-white/30 flex flex-col gap-6"
    >
      {/* Personal Information Section */}
      <h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">Personal Information</h2>

      <div className="flex flex-col sm:flex-row gap-4">
        <input id="firstName" type="text" name="firstName" placeholder="First Name" required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
        <input id="lastName" type="text" name="lastName" placeholder="Last Name" required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      </div>

      <input id="pronouns" type="text" name="pronouns" placeholder="Preferred Pronouns"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>

      <div className="flex flex-col">
        <label htmlFor="dob" className="mb-1 text-white/90 font-medium">Date of Birth</label>
        <input id="dob" type="date" name="dob"
          className="p-3 border border-white/20 rounded-lg bg-white/10 text-white"/>
        {dobError && <p className="text-yellow-300 mt-1">{dobError}</p>}
      </div>

      <input id="address" type="text" name="address" placeholder="Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      <input id="email" type="email" name="email" placeholder="Email Address" required
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      <ValidationError prefix="Email" field="email" errors={state.errors} className="text-yellow-300" />
      <input id="phone" type="tel" name="phone" placeholder="Phone Number"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>

      {/* Emergency Contacts Section */}
      <h2 className="text-2xl font-bold mb-4 mt-6 text-white drop-shadow-md">Emergency Contacts</h2>

      <div className="flex flex-col sm:flex-row gap-4">
        <input id="emFirstName" type="text" name="emFirstName" placeholder="First Name" required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
        <input id="emLastName" type="text" name="emLastName" placeholder="Last Name" required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      </div>

      <input id="relationship" type="text" name="relationship" placeholder="Relationship to You"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>

      <div className="flex flex-col">
        <label htmlFor="emDob" className="mb-1 text-white/90 font-medium">Emergency Contact Date of Birth</label>
        <input id="emDob" type="date" name="emDob"
          className="p-3 border border-white/20 rounded-lg bg-white/10 text-white"/>
        {emDobError && <p className="text-yellow-300 mt-1">{emDobError}</p>}
      </div>

      <input id="emAddress" type="text" name="emAddress" placeholder="Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      <input id="emEmail" type="email" name="emEmail" placeholder="Email Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>
      <ValidationError prefix="Emergency Email" field="emEmail" errors={state.errors} className="text-yellow-300" />
      <input id="emPhone" type="tel" name="emPhone" placeholder="Phone Number"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"/>

      <button
        type="submit"
        disabled={state.submitting}
        className="bg-white text-pink-600 font-bold py-3 px-6 rounded-lg hover:bg-white/90 transition transform hover:scale-105 shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </form>
  );
}

export default function App() {
  return <VolunteerForm />;
}
