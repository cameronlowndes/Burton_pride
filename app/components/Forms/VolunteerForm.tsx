import React from 'react';
import { useForm, ValidationError } from '@formspree/react';

function VolunteerForm() {
  const [state, handleSubmit] = useForm("xpwrlvzk");

  if (state.succeeded) {
    return (
      <p className="text-green-400 font-semibold text-lg mt-4 text-center">
        Thanks for submitting your details!
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white rounded-3xl shadow-2xl border-4 border-white/30 flex flex-col gap-6"
    >
      {/* Personal Information Section */}
      <h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">Personal Information</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          id="firstName"
          type="text"
          name="firstName"
          placeholder="First Name"
          required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <input
          id="lastName"
          type="text"
          name="lastName"
          placeholder="Last Name"
          required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
      </div>

      <input
        id="pronouns"
        type="text"
        name="pronouns"
        placeholder="Preferred Pronouns"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <input
        id="dob"
        type="date"
        name="dob"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <input
        id="address"
        type="text"
        name="address"
        placeholder="Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <input
        id="email"
        type="email"
        name="email"
        placeholder="Email Address"
        required
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <ValidationError prefix="Email" field="email" errors={state.errors} className="text-yellow-300" />
      <input
        id="phone"
        type="tel"
        name="phone"
        placeholder="Phone Number"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />

      {/* Emergency Contacts Section */}
      <h2 className="text-2xl font-bold mb-4 mt-6 text-white drop-shadow-md">Emergency Contacts</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          id="emFirstName"
          type="text"
          name="emFirstName"
          placeholder="First Name"
          required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <input
          id="emLastName"
          type="text"
          name="emLastName"
          placeholder="Last Name"
          required
          className="flex-1 p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      <input
        id="relationship"
        type="text"
        name="relationship"
        placeholder="Relationship to You"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <input
        id="emAddress"
        type="text"
        name="emAddress"
        placeholder="Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <input
        id="emEmail"
        type="email"
        name="emEmail"
        placeholder="Email Address"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <ValidationError prefix="Emergency Email" field="emEmail" errors={state.errors} className="text-yellow-300" />
      <input
        id="emPhone"
        type="tel"
        name="emPhone"
        placeholder="Phone Number"
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-red-300"
      />

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
