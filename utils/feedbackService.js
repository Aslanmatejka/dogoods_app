import supabase from './supabaseClient.js';
import { reportError } from './helpers.js';

class FeedbackService {
    /**
     * Submit user feedback
     * @param {Object} feedbackData - Feedback data
     * @returns {Promise<Object>} Result of submission
     */
    async submitFeedback(feedbackData) {
        try {
            // Get current user if authenticated
            const { data: { user } } = await supabase.auth.getUser();
            
            // Get browser info
            const browserInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                timestamp: new Date().toISOString()
            };

            // Prepare feedback object
            const feedback = {
                user_id: user?.id || null,
                user_email: feedbackData.email || user?.email || null,
                feedback_type: feedbackData.type || 'other',
                subject: feedbackData.subject,
                message: feedbackData.message,
                page_url: feedbackData.pageUrl || window.location.href,
                browser_info: browserInfo,
                screenshot_url: feedbackData.screenshotUrl || null,
                status: 'new'
            };

            // Insert feedback
            const { data, error } = await supabase
                .from('user_feedback')
                .insert([feedback])
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Feedback submitted successfully:', data.id);
            return { success: true, data };
        } catch (error) {
            reportError(error);
            console.error('Failed to submit feedback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's own feedback submissions
     * @returns {Promise<Array>} User's feedback
     */
    async getUserFeedback() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await supabase
                .from('user_feedback')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            reportError(error);
            console.error('Failed to fetch user feedback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all feedback (admin only)
     * @param {Object} filters - Filters for feedback
     * @returns {Promise<Array>} All feedback
     */
    async getAllFeedback(filters = {}) {
        try {
            let query = supabase
                .from('user_feedback')
                .select('*');

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.type) {
                query = query.eq('feedback_type', filters.type);
            }
            if (filters.priority) {
                query = query.eq('priority', filters.priority);
            }

            // Order by created_at
            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            reportError(error);
            console.error('Failed to fetch all feedback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update feedback status (admin only)
     * @param {string} feedbackId - Feedback ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Result of update
     */
    async updateFeedback(feedbackId, updates) {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Prepare update object
            const updateData = { ...updates };

            // If resolving, set resolved_by and resolved_at
            if (updates.status === 'resolved' || updates.status === 'closed') {
                updateData.resolved_by = user?.id;
                updateData.resolved_at = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from('user_feedback')
                .update(updateData)
                .eq('id', feedbackId)
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Feedback updated successfully:', feedbackId);
            return { success: true, data };
        } catch (error) {
            reportError(error);
            console.error('Failed to update feedback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete feedback (admin only)
     * @param {string} feedbackId - Feedback ID
     * @returns {Promise<Object>} Result of deletion
     */
    async deleteFeedback(feedbackId) {
        try {
            const { error } = await supabase
                .from('user_feedback')
                .delete()
                .eq('id', feedbackId);

            if (error) throw error;

            console.log('✅ Feedback deleted successfully:', feedbackId);
            return { success: true };
        } catch (error) {
            reportError(error);
            console.error('Failed to delete feedback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get feedback statistics (admin only)
     * @returns {Promise<Object>} Feedback statistics
     */
    async getFeedbackStats() {
        try {
            const { data, error } = await supabase
                .from('user_feedback')
                .select('status, feedback_type, priority');

            if (error) throw error;

            // Calculate statistics
            const stats = {
                total: data.length,
                byStatus: {},
                byType: {},
                byPriority: {}
            };

            data.forEach(feedback => {
                // Count by status
                stats.byStatus[feedback.status] = (stats.byStatus[feedback.status] || 0) + 1;
                
                // Count by type
                stats.byType[feedback.feedback_type] = (stats.byType[feedback.feedback_type] || 0) + 1;
                
                // Count by priority
                stats.byPriority[feedback.priority] = (stats.byPriority[feedback.priority] || 0) + 1;
            });

            return { success: true, data: stats };
        } catch (error) {
            reportError(error);
            console.error('Failed to fetch feedback stats:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new FeedbackService();
