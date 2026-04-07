import React from 'react';

function DonatePage() {
    return (
        <div data-name="donate-page" className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
                    Support Our Mission
                </h1>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                    Your donation helps us reduce food waste and fight hunger in our communities.
                    Every contribution makes a difference.
                </p>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-lg border border-cyan-100 bg-white" style={{ minHeight: '900px' }}>
                <iframe
                    src="https://donorbox.org/embed/school-donations-2"
                    name="donorbox"
                    seamless="seamless"
                    frameBorder="0"
                    scrolling="yes"
                    height="1200px"
                    width="100%"
                    style={{
                        maxWidth: '500px',
                        minWidth: '250px',
                        display: 'block',
                        margin: '0 auto',
                        border: 'none',
                    }}
                    allow="payment"
                    title="Donate to All Good Living Foundation"
                />
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
                <p>
                    Donations are securely processed through{' '}
                    <a
                        href="https://donorbox.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 hover:underline"
                    >
                        Donorbox
                    </a>
                    . All Good Living Foundation is a registered nonprofit organization.
                </p>
            </div>
        </div>
    );
}

export default DonatePage;
