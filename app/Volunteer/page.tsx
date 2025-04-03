import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
    title: "Burton Pride - Volunteer",
    description: "Join us to make a difference! Volunteer with Burton Pride and help us create an inclusive and vibrant community.",
};

export default function Volunteer() {
    return (
        <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
            
            <Navbar />

            {/* Hero Section */}
            <header className="text-center flex flex-col items-center gap-6 mt-16">
                <h1 className="text-4xl sm:text-6xl font-bold">Join Our Volunteer Team</h1>
                <p className="text-lg sm:text-xl max-w-2xl">
                    Volunteer with us and be part of an inclusive and vibrant community. Together, we can make Burton Pride a truly unforgettable event!
                </p>
            </header>

            {/* Volunteer Sign-Up Section */}
            <section className="mt-16 text-center w-full max-w-3xl">
                <h2 className="text-3xl font-semibold mb-6">Sign Up to Volunteer</h2>
                <p className="text-lg mb-6">
                    Ready to make a difference? Fill out the volunteer form below, and we'll get in touch with you to confirm your role and schedule.
                </p>

                {/* Embed Google Form */}
                <div className="w-full max-w-3xl mx-auto">
                    <iframe
                        src="https://docs.google.com/forms/d/e/1FAIpQLSdXxxxxxxx/viewform?embedded=true"
                        width="640"
                        height="1200"
                        className="border-0"
                        title="Volunteer Sign-up Form"
                    >
                        Loading…
                    </iframe>
                </div>
            </section>

            <Footer />
        </div>
    );
}
