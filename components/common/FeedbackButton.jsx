import React, { useState } from 'react';
import FeedbackModal from './FeedbackModal';

function FeedbackButton() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            {/* Floating Feedback Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-24 right-6 z-40 bg-[#2CABE3] hover:opacity-90 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[#2CABE3]/50 group"
                title="Send Feedback"
                aria-label="Send Feedback"
            >
                <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                    />
                </svg>
                
                {/* Tooltip */}
                <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Send Feedback
                </span>
            </button>

            {/* Feedback Modal */}
            <FeedbackModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </>
    );
}

export default FeedbackButton;
