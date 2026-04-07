import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../utils/AuthContext';
import feedbackService from '../../utils/feedbackService';
import { reportError } from '../../utils/helpers';

function UserFeedback() {
    const { isAdmin } = useAuthContext();
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        priority: ''
    });
    const [selectedFeedback, setSelectedFeedback] = useState(null);

    useEffect(() => {
        loadFeedback();
        if (isAdmin) {
            loadStats();
        }
    }, [filters, isAdmin]);

    const loadFeedback = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = isAdmin 
                ? await feedbackService.getAllFeedback(filters)
                : await feedbackService.getUserFeedback();

            if (result.success) {
                setFeedback(result.data || []);
            } else {
                setError(result.error || 'Failed to load feedback');
            }
        } catch (err) {
            reportError(err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const result = await feedbackService.getFeedbackStats();
            if (result.success) {
                setStats(result.data);
            }
        } catch (err) {
            reportError(err);
        }
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    const handleUpdateFeedback = async (feedbackId, updates) => {
        try {
            const result = await feedbackService.updateFeedback(feedbackId, updates);
            
            if (result.success) {
                loadFeedback();
                loadStats();
                setSelectedFeedback(null);
            } else {
                alert('Failed to update feedback: ' + result.error);
            }
        } catch (err) {
            reportError(err);
            alert('An error occurred while updating feedback');
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!window.confirm('Are you sure you want to delete this feedback?')) {
            return;
        }

        try {
            const result = await feedbackService.deleteFeedback(feedbackId);
            
            if (result.success) {
                loadFeedback();
                loadStats();
                setSelectedFeedback(null);
            } else {
                alert('Failed to delete feedback: ' + result.error);
            }
        } catch (err) {
            reportError(err);
            alert('An error occurred while deleting feedback');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'new': 'bg-blue-100 text-blue-800',
            'in-progress': 'bg-yellow-100 text-yellow-800',
            'resolved': 'bg-[#2CABE3]/20 text-[#2CABE3]',
            'closed': 'bg-gray-100 text-gray-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'urgent': 'bg-red-100 text-red-800',
            'high': 'bg-orange-100 text-orange-800',
            'medium': 'bg-yellow-100 text-yellow-800',
            'low': 'bg-[#2CABE3]/20 text-[#2CABE3]'
        };
        return colors[priority] || 'bg-gray-100 text-gray-800';
    };

    const getTypeIcon = (type) => {
        const icons = {
            'error': '🐛',
            'bug': '⚠️',
            'suggestion': '💡',
            'feature': '✨',
            'other': '📝'
        };
        return icons[type] || '📝';
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    {isAdmin ? 'User Feedback Management' : 'My Feedback'}
                </h1>
                <p className="text-gray-600 mt-2">
                    {isAdmin 
                        ? 'View and manage all user feedback submissions' 
                        : 'View your submitted feedback and track their status'}
                </p>
            </div>

            {/* Statistics (Admin only) */}
            {isAdmin && stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-600">Total Feedback</h3>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-600">New</h3>
                        <p className="text-2xl font-bold text-blue-600">{stats.byStatus.new || 0}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-600">In Progress</h3>
                        <p className="text-2xl font-bold text-yellow-600">{stats.byStatus['in-progress'] || 0}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-600">Resolved</h3>
                        <p className="text-2xl font-bold text-[#2CABE3]">{stats.byStatus.resolved || 0}</p>
                    </div>
                </div>
            )}

            {/* Filters (Admin only) */}
            {isAdmin && (
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Filters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2CABE3]"
                            >
                                <option value="">All Statuses</option>
                                <option value="new">New</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                value={filters.type}
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2CABE3]"
                            >
                                <option value="">All Types</option>
                                <option value="error">Error</option>
                                <option value="bug">Bug</option>
                                <option value="suggestion">Suggestion</option>
                                <option value="feature">Feature Request</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select
                                value={filters.priority}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2CABE3]"
                            >
                                <option value="">All Priorities</option>
                                <option value="urgent">Urgent</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#2CABE3] mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading feedback...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                    <p>{error}</p>
                </div>
            )}

            {/* Feedback List */}
            {!loading && !error && (
                <div className="space-y-4">
                    {feedback.length === 0 ? (
                        <div className="bg-white p-8 rounded-lg shadow text-center">
                            <p className="text-gray-600">No feedback found</p>
                        </div>
                    ) : (
                        feedback.map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="text-2xl">{getTypeIcon(item.feedback_type)}</span>
                                            <h3 className="text-lg font-semibold text-gray-900">{item.subject}</h3>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(item.status)}`}>
                                                {item.status}
                                            </span>
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(item.priority)}`}>
                                                {item.priority}
                                            </span>
                                            <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                                                {item.feedback_type}
                                            </span>
                                        </div>
                                        
                                        <p className="text-gray-700 mb-3">{item.message}</p>
                                        
                                        <div className="text-sm text-gray-500 space-y-1">
                                            {isAdmin && item.user_email && (
                                                <p>📧 {item.user_email}</p>
                                            )}
                                            <p>📍 {item.page_url}</p>
                                            <p>🕒 {new Date(item.created_at).toLocaleString()}</p>
                                        </div>

                                        {item.admin_notes && (
                                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                                <p className="text-sm font-medium text-blue-900">Admin Notes:</p>
                                                <p className="text-sm text-blue-800">{item.admin_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isAdmin && (
                                        <div className="ml-4 flex flex-col space-y-2">
                                            <button
                                                onClick={() => setSelectedFeedback(item)}
                                                className="px-3 py-1 text-sm bg-[#2CABE3] text-white rounded hover:opacity-90"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Admin Management Modal */}
            {isAdmin && selectedFeedback && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedFeedback(null)}></div>
                        
                        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                            <h3 className="text-xl font-bold mb-4">Manage Feedback</h3>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        defaultValue={selectedFeedback.status}
                                        onChange={(e) => handleUpdateFeedback(selectedFeedback.id, { status: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    >
                                        <option value="new">New</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        defaultValue={selectedFeedback.priority}
                                        onChange={(e) => handleUpdateFeedback(selectedFeedback.id, { priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                                    <textarea
                                        defaultValue={selectedFeedback.admin_notes || ''}
                                        onBlur={(e) => handleUpdateFeedback(selectedFeedback.id, { admin_notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        rows="4"
                                        placeholder="Add internal notes..."
                                    ></textarea>
                                </div>
                            </div>
                            
                            <div className="flex justify-between">
                                <button
                                    onClick={() => handleDeleteFeedback(selectedFeedback.id)}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setSelectedFeedback(null)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserFeedback;
