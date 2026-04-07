import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dataService from '../../utils/dataService';
import Button from '../common/Button';
import Card from '../common/Card';

const DonationScheduleList = ({ userId, onEdit }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadSchedules();
  }, [userId]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await dataService.getUserDonationSchedules(userId);
      setSchedules(data);
    } catch (error) {
      console.error('Failed to load donation schedules:', error);
      toast.error('Failed to load donation schedules');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (scheduleId) => {
    try {
      await dataService.pauseDonationSchedule(scheduleId);
      toast.success('Schedule paused');
      loadSchedules();
    } catch (error) {
      console.error('Failed to pause schedule:', error);
      toast.error('Failed to pause schedule');
    }
  };

  const handleResume = async (scheduleId) => {
    try {
      await dataService.resumeDonationSchedule(scheduleId);
      toast.success('Schedule resumed');
      loadSchedules();
    } catch (error) {
      console.error('Failed to resume schedule:', error);
      toast.error('Failed to resume schedule');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this donation schedule?')) {
      return;
    }

    try {
      await dataService.deleteDonationSchedule(scheduleId);
      toast.success('Schedule deleted');
      loadSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-primary-100 text-primary-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFrequencyLabel = (frequency) => {
    switch (frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
      default:
        return frequency;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (filter === 'all') return true;
    return schedule.status === filter;
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2CABE3] mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading donation schedules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">My Donation Schedules</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('paused')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'paused'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Paused
          </button>
        </div>
      </div>

      {filteredSchedules.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No donation schedules</h3>
            <p className="mt-1 text-gray-500">
              {filter === 'all'
                ? 'Get started by creating your first donation schedule.'
                : `No ${filter} schedules found.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {schedule.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {getFrequencyLabel(schedule.frequency)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">
                        ${parseFloat(schedule.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">per {schedule.frequency === 'daily' ? 'day' : schedule.frequency === 'weekly' ? 'week' : schedule.frequency === 'monthly' ? 'month' : 'year'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-500">Next Donation</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(schedule.next_donation_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Donated</p>
                      <p className="font-medium text-gray-900">
                        ${parseFloat(schedule.total_donated || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Donations Made</p>
                      <p className="font-medium text-gray-900">
                        {schedule.donation_count || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Recipient</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {schedule.recipient_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {schedule.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">{schedule.notes}</p>
                    </div>
                  )}

                  {schedule.reminder_enabled && (
                    <div className="mt-2 flex items-center text-sm text-gray-600">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Reminder {schedule.reminder_days_before} day(s) before
                    </div>
                  )}
                </div>

                <div className="flex flex-row md:flex-col gap-2">
                  {onEdit && (
                    <Button
                      onClick={() => onEdit(schedule)}
                      variant="secondary"
                      className="flex-1 md:flex-none"
                    >
                      Edit
                    </Button>
                  )}

                  {schedule.status === 'active' ? (
                    <Button
                      onClick={() => handlePause(schedule.id)}
                      variant="secondary"
                      className="flex-1 md:flex-none"
                    >
                      Pause
                    </Button>
                  ) : schedule.status === 'paused' ? (
                    <Button
                      onClick={() => handleResume(schedule.id)}
                      variant="primary"
                      className="flex-1 md:flex-none"
                    >
                      Resume
                    </Button>
                  ) : null}

                  <Button
                    onClick={() => handleDelete(schedule.id)}
                    variant="danger"
                    className="flex-1 md:flex-none"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DonationScheduleList;
