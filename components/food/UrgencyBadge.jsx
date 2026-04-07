import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UrgencyService from '../../utils/urgencyService';

/**
 * UrgencyBadge Component
 * Displays urgency level and countdown timer for food listings with expiration deadlines
 * Updates in real-time to show accurate time remaining
 */
function UrgencyBadge({ foodListing, showCountdown = true, compact = false }) {
  const [urgencyInfo, setUrgencyInfo] = useState(null);

  useEffect(() => {
    // Initial calculation
    const updateUrgency = () => {
      const info = UrgencyService.getUrgencyInfo(foodListing);
      setUrgencyInfo(info);
    };

    updateUrgency();

    // Update every minute for accurate countdown
    const interval = setInterval(updateUrgency, 60000);

    return () => clearInterval(interval);
  }, [foodListing]);

  if (!urgencyInfo || urgencyInfo.urgencyLevel === 'none') {
    return null;
  }

  const { config, countdown, isExpired, shouldShowCountdown, urgencyLevel } = urgencyInfo;

  // Don't show if expired
  if (isExpired) {
    return null;
  }

  // Compact version (just icon and level)
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}>
        <span>{config.icon}</span>
        <span className="capitalize">{urgencyLevel}</span>
      </div>
    );
  }

  // Full version with countdown
  return (
    <div className={`rounded-lg border-2 p-3 ${config.bgClass} ${config.borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Urgency indicator */}
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-label={config.label}>{config.icon}</span>
          <div>
            <div className={`font-semibold text-sm ${config.textClass}`}>
              {config.label}
            </div>
            {shouldShowCountdown && showCountdown && (
              <div className={`text-xs mt-0.5 ${config.textClass}`}>
                {countdown.text}
              </div>
            )}
          </div>
        </div>

        {/* Countdown badge */}
        {shouldShowCountdown && showCountdown && (
          <div className={`px-3 py-1 rounded-full ${config.badgeClass} font-bold text-sm whitespace-nowrap`}>
            {countdown.value > 0 && (
              <>
                {countdown.value}
                <span className="text-xs ml-0.5">
                  {countdown.unit === 'days' ? 'd' : countdown.unit === 'hours' ? 'h' : 'm'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Additional details for critical items */}
      {urgencyLevel === 'critical' && (
        <div className={`mt-2 text-xs ${config.textClass} font-medium`}>
          <i className="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>
          Act fast! This item expires very soon.
        </div>
      )}
    </div>
  );
}

UrgencyBadge.propTypes = {
  foodListing: PropTypes.shape({
    pickup_by: PropTypes.string,
    expiry_date: PropTypes.string,
    urgency_level: PropTypes.string
  }).isRequired,
  showCountdown: PropTypes.bool,
  compact: PropTypes.bool
};

/**
 * UrgencyIndicator Component
 * Minimal inline indicator for use in food cards/lists
 */
export function UrgencyIndicator({ foodListing }) {
  const urgencyInfo = UrgencyService.getUrgencyInfo(foodListing);

  if (!urgencyInfo || urgencyInfo.urgencyLevel === 'none' || urgencyInfo.isExpired) {
    return null;
  }

  const { config, countdown, urgencyLevel } = urgencyInfo;

  // Only show for urgent items in compact view
  if (urgencyLevel !== 'critical' && urgencyLevel !== 'high') {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${config.badgeClass}`}>
      <span>{config.icon}</span>
      <span>{countdown.text}</span>
    </div>
  );
}

UrgencyIndicator.propTypes = {
  foodListing: PropTypes.shape({
    pickup_by: PropTypes.string,
    expiry_date: PropTypes.string,
    urgency_level: PropTypes.string
  }).isRequired
};

/**
 * CountdownTimer Component
 * Real-time countdown display that updates every second (for critical items)
 */
export function CountdownTimer({ deadline }) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const updateTimer = () => {
      const deadlineDate = new Date(deadline);
      const seconds = UrgencyService.getSecondsRemaining(deadlineDate);
      const countdown = UrgencyService.formatCountdown(seconds);
      
      setTimeRemaining(countdown.text);
      setIsUrgent(seconds <= 6 * 60 * 60); // Less than 6 hours
    };

    updateTimer();

    // Update every second for critical items, every minute for others
    const interval = setInterval(updateTimer, isUrgent ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [deadline, isUrgent]);

  if (!timeRemaining) return null;

  return (
    <div className={`inline-flex items-center gap-1 ${isUrgent ? 'text-red-600 font-bold animate-pulse' : 'text-gray-600'}`}>
      <i className="fas fa-clock text-xs" aria-hidden="true"></i>
      <span className="text-sm">{timeRemaining}</span>
    </div>
  );
}

CountdownTimer.propTypes = {
  deadline: PropTypes.string.isRequired
};

export default UrgencyBadge;
