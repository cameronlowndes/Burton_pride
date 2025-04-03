import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
    title: "Burton Pride - Collaborate with Us",
    description: "Looking to collaborate with Burton Pride? Submit your proposal and let's create something amazing together!",
};

export default function Collaborate() {
    return (
        <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
            
            <Navbar />

            {/* Hero Section */}
            <header className="text-center flex flex-col items-center gap-6 mt-16">
                <h1 className="text-4xl sm:text-6xl font-bold">Collaborate with Us</h1>
                <p className="text-lg sm:text-xl max-w-2xl">
                    Want to partner with Burton Pride? We’re always open to new collaborations and ideas to make Burton Pride even better. Let's make it happen together!
                </p>
            </header>

            {/* Collaboration Request Section */}
            <section className="mt-16 text-center w-full max-w-3xl">
                <h2 className="text-3xl font-semibold mb-6">Submit Your Collaboration Proposal</h2>
                <p className="text-lg mb-6">
                    Whether you’re a business, organization, or individual looking to collaborate, we want to hear from you! Fill out the form below and let’s start the conversation.
                </p>

                {/* Embed Google Form */}
                <div className="w-full max-w-3xl mx-auto">
                    <iframe
                        src="https://docs.google.com/forms/d/e/1FAIpQLScxxxxxxxxxxxxxxx/viewform?embedded=true"
                        width="640"
                        height="1200"
                      
                        className="border-0"
                        title="Collaboration Proposal Form"
                    >
                        Loading…
                    </iframe>
                </div>
            </section>

            <Footer />
        </div>
    );
}
