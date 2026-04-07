import React, { useState } from 'react';
import PropTypes from 'prop-types';
import feedbackService from '../../utils/feedbackService';
import { useAuthContext } from '../../utils/AuthContext';

function FeedbackModal({ isOpen, onClose }) {
    const { user, isAuthenticated } = useAuthContext();
    const [formData, setFormData] = useState({
        type: 'error',
        subject: '',
        message: '',
        email: user?.email || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);

    const feedbackTypes = [
        { value: 'error', label: '🐛 Error/Bug Report', description: 'Something is broken or not working' },
        { value: 'bug', label: '⚠️ Bug', description: 'Unexpected behavior' },
        { value: 'suggestion', label: '💡 Suggestion', description: 'Idea for improvement' },
        { value: 'feature', label: '✨ Feature Request', description: 'New feature you\'d like to see' },
        { value: 'other', label: '📝 Other', description: 'General feedback' }
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.subject.trim() || !formData.message.trim()) {
            setSubmitStatus({ type: 'error', message: 'Please fill in all required fields' });
            return;
        }

        if (!isAuthenticated && !formData.email.trim()) {
            setSubmitStatus({ type: 'error', message: 'Please provide your email address' });
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const result = await feedbackService.submitFeedback({
                type: formData.type,
                subject: formData.subject,
                message: formData.message,
                email: formData.email,
                pageUrl: window.location.href
            });

            if (result.success) {
                setSubmitStatus({ 
                    type: 'success', 
                    message: 'Thank you! Your feedback has been submitted successfully.' 
                });
                
                // Reset form
                setTimeout(() => {
                    setFormData({
                        type: 'error',
                        subject: '',
                        message: '',
                        email: user?.email || ''
                    });
                    setSubmitStatus(null);
                    onClose();
                }, 2000);
            } else {
                setSubmitStatus({ 
                    type: 'error', 
                    message: result.error || 'Failed to submit feedback. Please try again.' 
                });
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            setSubmitStatus({ 
                type: 'error', 
                message: 'An unexpected error occurred. Please try again.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div 
                    className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                    onClick={onClose}
                ></div>

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white">
                                Send Feedback
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-white hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-primary-50 text-sm mt-1">
                            We value your feedback! Help us improve DoGoods.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="px-6 py-4">
                        {/* Feedback Type */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Feedback Type *
                            </label>
                            <div className="space-y-2">
                                {feedbackTypes.map(type => (
                                    <label key={type.value} className="flex items-start cursor-pointer">
                                        <input
                                            type="radio"
                                            name="type"
                                            value={type.value}
                                            checked={formData.type === type.value}
                                            onChange={handleInputChange}
                                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="ml-3">
                                            <span className="text-sm font-medium text-gray-900">{type.label}</span>
                                            <p className="text-xs text-gray-500">{type.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Email (for non-authenticated users) */}
                        {!isAuthenticated && (
                            <div className="mb-4">
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        )}

                        {/* Subject */}
                        <div className="mb-4">
                            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                                Subject *
                            </label>
                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                value={formData.subject}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Brief description of your feedback"
                                required
                            />
                        </div>

                        {/* Message */}
                        <div className="mb-4">
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                Message *
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleInputChange}
                                rows="5"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                placeholder="Please provide as much detail as possible..."
                                required
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                Include steps to reproduce if reporting an error
                            </p>
                        </div>

                        {/* Status Message */}
                        {submitStatus && (
                            <div className={`mb-4 p-3 rounded-md ${
                                submitStatus.type === 'success' 
                                    ? 'bg-primary-50 text-primary-800 border border-primary-200' 
                                    : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                <p className="text-sm">{submitStatus.message}</p>
                            </div>
                        )}

                        {/* Page Info */}
                        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                            <p className="text-xs text-gray-600">
                                <strong>Current Page:</strong> {window.location.pathname}
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

FeedbackModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
};

export default FeedbackModal;
