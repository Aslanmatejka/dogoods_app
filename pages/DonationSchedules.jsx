import { useState, useEffect } from 'react';
import { useAuthContext } from '../utils/AuthContext';
import dataService from '../utils/dataService';
import DonationScheduleForm from '../components/donations/DonationScheduleForm';
import DonationScheduleList from '../components/donations/DonationScheduleList';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const DonationSchedules = () => {
  const { user } = useAuthContext();
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [stats, setStats] = useState({
    totalDonated: 0,
    totalDonations: 0,
    activeSchedules: 0
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadStats();
    }
  }, [user?.id, refreshKey]);

  const loadStats = async () => {
    try {
      const data = await dataService.getUserDonationStats(user.id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load donation stats:', error);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSchedule(null);
  };

  const handleCreateNew = () => {
    setEditingSchedule(null);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Donation Schedules</h1>
          <p className="mt-2 text-gray-600">
            Set up recurring donations to support the community on a regular basis
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Donated</p>
              <p className="text-3xl font-bold text-primary-600">
                ${stats.totalDonated.toFixed(2)}
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Donations</p>
              <p className="text-3xl font-bold text-blue-600">
                {stats.totalDonations}
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Active Schedules</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats.activeSchedules}
              </p>
            </div>
          </Card>
        </div>

        {!showForm && (
          <div className="mb-6">
            <Button onClick={handleCreateNew}>
              <svg className="h-5 w-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Schedule
            </Button>
          </div>
        )}

        {showForm && (
          <div className="mb-8">
            <DonationScheduleForm
              schedule={editingSchedule}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        )}

        <DonationScheduleList
          key={refreshKey}
          userId={user?.id}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
};

export default DonationSchedules;
