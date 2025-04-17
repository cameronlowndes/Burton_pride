import Head from "next/head"; // Keep this for future use or fallback
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import MetaHead from "../components/MetaHead";

export default function Volunteer() {
    return (
        <>
            <MetaHead
                title="Burton Pride - Volunteer"
                description="Join us to make a difference! Volunteer with Burton Pride and help us create an inclusive and vibrant community."
                
            />

            <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
                <Navbar />

                {/* Hero Section */}
                <header className="text-center flex flex-col items-center gap-6 mt-16">
                    <h1 className="text-4xl sm:text-6xl font-bold">Join Our Volunteer Team</h1>
                    <p className="text-lg sm:text-xl max-w-2xl">
                        Volunteer with us and be part of an inclusive and vibrant community. Together, we can make Burton Pride a truly unforgettable event!
                    </p>
                </header>

                {/* Volunteer Section */}
                <section className="mt-16 w-full max-w-5xl flex flex-col md:flex-row gap-10">
                    {/* Text Content (Left Side) */}
                    <div className="md:w-1/2 text-left">
                        <h2 className="text-3xl font-semibold mb-4">Why does Burton Pride C.I.C. need volunteers?</h2>
                        <p className="text-lg mb-4">
                            Because your involvement can make a real difference. Your information is crucial for us to comply with our legal obligations and ensure the safety of everyone we serve.
                        </p>
                        <p className="text-lg mb-4">
                            Nearly all tasks that Burton Pride asks its volunteers to take on require interaction with the public, including potential contact with children and vulnerable adults.
                        </p>
                        <p className="text-lg mb-4">
                            Your trust is important to us. Burton Pride requires this information to comply with legal obligations. Your actions as a volunteer significantly impact our operations and the lives of those we serve.
                        </p>
                        <p className="text-lg mb-6">
                            Rest assured, Burton Pride C.I.C. values your privacy. We will only share your information if requested by the appropriate authority.
                        </p>
                        <p className="text-lg">
                            If you have any questions, please don’t hesitate to contact us at 
                            <a href="mailto:prideburton@gmail.com" className="text-yellow-300 underline ml-1">prideburton@gmail.com</a>. We would love to hear from you.
                        </p>
                    </div>

                    {/* Google Form (Right Side) */}
                    <div className="md:w-1/2 flex justify-center">
                        <iframe
                            src="https://forms.gle/oFteosGZ9sJPQR6T9"
                            width="100%"
                            height="600"
                            className="border-0 rounded-lg shadow-lg"
                            title="Volunteer Sign-up Form"
                        >
                            Loading…
                        </iframe>
                    </div>
                </section>

                <Footer />
            </div>
        </>
    );
}
