import React from 'react';
import PropTypes from 'prop-types';
import { VERIFICATION_STATUS } from '../../utils/verificationService';

/**
 * VerificationStatus Component
 * Displays verification status badge with visual indicators
 */
function VerificationStatus({ status, showIcon = true, compact = false }) {
  const statusConfig = {
    [VERIFICATION_STATUS.PENDING]: {
      label: 'Verification Pending',
      shortLabel: 'Pending',
      icon: '⏳',
      color: 'gray',
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-700',
      borderClass: 'border-gray-300'
    },
    [VERIFICATION_STATUS.VERIFIED_BEFORE]: {
      label: 'Verified Before Pickup',
      shortLabel: 'Pre-Verified',
      icon: '📸',
      color: 'blue',
      bgClass: 'bg-blue-100',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-300'
    },
    [VERIFICATION_STATUS.VERIFIED_AFTER]: {
      label: 'Verified After Pickup',
      shortLabel: 'Post-Verified',
      icon: '📦',
      color: 'purple',
      bgClass: 'bg-purple-100',
      textClass: 'text-purple-700',
      borderClass: 'border-purple-300'
    },
    [VERIFICATION_STATUS.COMPLETED]: {
      label: 'Fully Verified',
      shortLabel: 'Verified',
      icon: '✅',
      color: 'green',
      bgClass: 'bg-primary-100',
      textClass: 'text-primary-700',
      borderClass: 'border-primary-300'
    },
    [VERIFICATION_STATUS.DISPUTED]: {
      label: 'Under Dispute',
      shortLabel: 'Disputed',
      icon: '⚠️',
      color: 'red',
      bgClass: 'bg-red-100',
      textClass: 'text-red-700',
      borderClass: 'border-red-300'
    },
    [VERIFICATION_STATUS.SKIPPED]: {
      label: 'Verification Skipped',
      shortLabel: 'Skipped',
      icon: '−',
      color: 'gray',
      bgClass: 'bg-gray-50',
      textClass: 'text-gray-500',
      borderClass: 'border-gray-200'
    }
  };

  const config = statusConfig[status] || statusConfig[VERIFICATION_STATUS.PENDING];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}>
        {showIcon && <span>{config.icon}</span>}
        <span>{config.shortLabel}</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgClass} ${config.textClass} ${config.borderClass}`}>
      {showIcon && <span className="text-lg">{config.icon}</span>}
      <span className="font-medium text-sm">{config.label}</span>
    </div>
  );
}

VerificationStatus.propTypes = {
  status: PropTypes.oneOf(Object.values(VERIFICATION_STATUS)).isRequired,
  showIcon: PropTypes.bool,
  compact: PropTypes.bool
};

/**
 * VerificationProgress Component
 * Shows progress through verification steps
 */
export function VerificationProgress({ 
  verifiedBefore, 
  verifiedAfter, 
  verificationRequired = true 
}) {
  if (!verificationRequired) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          <i className="fas fa-info-circle mr-2"></i>
          Verification not required for this listing
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h4 className="font-semibold text-gray-800 mb-3">Verification Progress</h4>
      
      <div className="space-y-3">
        {/* Before Pickup */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            verifiedBefore 
              ? 'bg-primary-500 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {verifiedBefore ? (
              <i className="fas fa-check text-sm"></i>
            ) : (
              <i className="fas fa-camera text-sm"></i>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm text-gray-800">Before Pickup</div>
            <div className="text-xs text-gray-500">
              {verifiedBefore ? 'Verified by donor' : 'Awaiting verification'}
            </div>
          </div>
        </div>

        {/* Connector Line */}
        <div className="ml-4 border-l-2 border-gray-200 h-4"></div>

        {/* After Pickup */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            verifiedAfter 
              ? 'bg-primary-500 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {verifiedAfter ? (
              <i className="fas fa-check text-sm"></i>
            ) : (
              <i className="fas fa-box text-sm"></i>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm text-gray-800">After Pickup</div>
            <div className="text-xs text-gray-500">
              {verifiedAfter ? 'Verified by recipient' : 'Awaiting verification'}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Status */}
      {verifiedBefore && verifiedAfter && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-primary-600">
            <i className="fas fa-check-circle"></i>
            <span className="font-medium text-sm">Verification Complete!</span>
          </div>
        </div>
      )}
    </div>
  );
}

VerificationProgress.propTypes = {
  verifiedBefore: PropTypes.bool,
  verifiedAfter: PropTypes.bool,
  verificationRequired: PropTypes.bool
};

/**
 * VerificationPhotos Component
 * Display verification photos in a gallery
 */
export function VerificationPhotos({ photos, title }) {
  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h5 className="font-medium text-gray-700 mb-2 text-sm">{title}</h5>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photoUrl, index) => (
          <a
            key={index}
            href={photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block overflow-hidden rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
          >
            <img
              src={photoUrl}
              alt={`Verification photo ${index + 1}`}
              className="w-full h-24 object-cover group-hover:scale-110 transition-transform"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
              <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

VerificationPhotos.propTypes = {
  photos: PropTypes.arrayOf(PropTypes.string),
  title: PropTypes.string.isRequired
};

export default VerificationStatus;
