

const TermsPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">

         

            {/* Terms & Conditions Section */}
            <main className="container mx-auto p-6 bg-white text-black rounded-lg shadow-lg mt-16 max-w-4xl space-y-8">

                <h1 className="text-2xl sm:text-4xl font-bold text-center mb-6">
                    Burton Pride 2026 – Terms & Conditions
                </h1>

                {/* 1. Introduction */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">1. Introduction</h2>
                    <p>
                        Welcome! These are the Terms and Conditions for Burton Pride 2026. This document outlines the rules and requirements for attending or participating in the event. All visitors, vendors, volunteers, and staff are expected to follow these guidelines to ensure a safe, enjoyable, and inclusive experience for everyone.
                    </p>
                </section>

                {/* 2. About the Event */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">2. About the Event</h2>
                    <p>
                        Burton Pride 2026 is a free, public event organised by Burton Pride C.I.C. It celebrates and supports the LGBTQIA+ community, promoting inclusion, diversity, and equality. The event is open to all and aims to provide a safe, welcoming, and fun environment where people of all ages and backgrounds can come together in celebration.
                    </p>
                </section>

                {/* 3. Visitor Guidelines */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">3. Visitor Guidelines</h2>
                    <p>To ensure the event runs smoothly and safely, all visitors must follow these rules:</p>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.1 Dogs and Pets</h3>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Dogs are welcome but must be kept on a lead at all times.</li>
                        <li>Owners are responsible for cleaning up after their pets and disposing of waste in the bins provided.</li>
                        <li>Burton Pride C.I.C. does not supply dog waste bags, so visitors should bring their own.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.2 Litter and Waste</h3>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Visitors must dispose of their own rubbish responsibly using the bins provided.</li>
                        <li>Minimizing litter helps maintain a clean, safe, and enjoyable environment for all attendees.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.3 Alcohol and Food</h3>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>No outside alcohol is permitted on site. Only alcohol purchased from licensed vendors may be consumed.</li>
                        <li>Outside food and drinks are not permitted, except for special dietary requirements, which should be discussed with event staff in advance.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.4 Health and Safety</h3>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Visitors must behave responsibly and respect other attendees.</li>
                        <li>Dangerous, abusive, or disruptive behavior may result in removal from the event.</li>
                        <li>Burton Pride C.I.C. reserves the right to refuse entry or ask any individual to leave if rules are not followed.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 mb-2">3.5 Accessibility</h3>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Burton Pride is committed to making the event inclusive and accessible.</li>
                        <li>Visitors with accessibility needs should contact event staff in advance so appropriate support can be provided.</li>
                    </ul>
                </section>

                {/* 4. Stage Rules */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">4. Stage Rules</h2>
                    <p>
                        Access to the stage is strictly controlled to ensure the safety of all attendees and participants:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>No one is allowed on stage without prior approval from Burton Pride C.I.C.</li>
                        <li>Only scheduled performers, event staff, and volunteers assisting with operations may access the stage.</li>
                        <li>Authorised personnel will be clearly identifiable by high-visibility clothing or badges labeled ‘Committee Team’ or ‘Volunteers’.</li>
                        <li>Anyone found on stage without authorization may be asked to leave immediately.</li>
                    </ul>
                </section>

                {/* 5. Restricted Areas */}
                <section>
                    <h2 className="text-2xl font-semibold mb-2">5. Restricted Areas</h2>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Access is limited to Burton Pride C.I.C. committee members and authorized volunteers.</li>
                        <li>Visitors may only enter these areas when accompanied by a committee member.</li>
                        <li>Restricted areas include, but are not limited to, behind the stage and behind funfair rides and attractions.</li>
                        <li>Anyone found in restricted areas without authorization may be asked to leave immediately.</li>
                    </ul>
                </section>

                {/* Vendor Terms & Conditions */}
                <section className="space-y-8">
                    <h2 className="text-3xl font-bold mb-4 text-center">Vendor Terms & Conditions</h2>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">1. Introduction</h3>
                        <p>
                            All vendors are required to follow the visitor guidelines above, as well as the rules below. Compliance ensures the event runs safely, smoothly, and successfully for all attendees, performers, staff, and fellow vendors.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">2. Vendor Safety </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Movement of all vehicles on site, including cars, lorries, and service vehicles, is restricted to a maximum speed of 5 mph, with hazard lights required to be on at all times.</li>
                            <li>Vendors requiring assistance during setup or shutdown should contact a committee member.</li>
                            <li>Burton Pride C.I.C. is committed to providing a safe working environment for all vendors, staff, and volunteers.</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">3. Power, Water, and Equipment</h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Burton Pride C.I.C. does not provide power, water, or equipment to vendors.</li>
                            <li>Vendors must bring their own power supply, water, and all other items required to operate during the event.</li>
                            <li>This includes chairs, tables, cooking equipment, display stands, and other necessary tools or supplies.</li>
                            <li>Vendors are fully responsible for setup, maintenance, and security of their equipment.</li>
                            <li>Burton Pride C.I.C. cannot be held responsible for any items lost, damaged, or left behind.</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">4. Setup and Stall Management</h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Vendors must arrive and set up at their allocated times as instructed by the committee.</li>
                            <li>All stalls must remain within their allocated pitch area.</li>
                            <li>Vendors are responsible for keeping their pitch clean and tidy throughout the event.</li>
                            <li>Equipment and displays must comply with health and safety regulations.</li>
                            <li>Vendors must follow committee instructions regarding traffic flow, vehicle movement, and safety signage during setup and shutdown.</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">5. Food, Licensing, and Compliance</h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Vendors selling food or beverages must comply with local food hygiene regulations and provide proof of food hygiene rating and public liability insurance if requested.</li>
                            <li>Only licensed vendors may sell alcohol; no outside alcohol is permitted.</li>
                            <li>Vendors must ensure that all food preparation, storage, and serving meets health and safety standards.</li>
                            <li>Vendors must comply with all applicable laws and event policies.</li>
                            <li>Non-compliance may result in removal from the event or loss of future trading rights.</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">6. Conduct and Communication</h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Vendors must act professionally and respectfully toward attendees, staff, and other vendors.</li>
                            <li>Any disputes or issues should be reported immediately to a committee member.</li>
                            <li>Vendors must cooperate with event staff, security, and volunteers at all times.</li>
                            <li>Unauthorized behavior, including entering restricted areas or allowing unapproved access to their stall, may result in removal from the event.</li>
                            <li>Vendors are encouraged to maintain clear communication with the committee for any questions, assistance, or safety concerns.</li>
                        </ul>
                    </div>
                </section>

                {/* Download Terms Button */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-black/70 mb-2">
                        These Terms & Conditions are valid only in their official form. Any modification, edit, or unauthorized change will automatically invalidate them.
                    </p>
                    <a
                        href="/Document/Burton Pride 2026 Terms.pdf"
                        download
                        className="inline-block bg-yellow-400 text-black font-bold px-6 py-3 rounded-full hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg"
                    >
                        Download Terms & Conditions
                    </a>
                    <p className="text-sm text-black/70 mt-2">
                        PDF is read-only and cannot be edited.
                    </p>
                </div>

            </main>
        </div>
    );
};

export default TermsPage;
