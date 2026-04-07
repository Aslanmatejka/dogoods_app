import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../common/Button';
import VerificationService, { VERIFICATION_TYPES } from '../../utils/verificationService';

/**
 * VerificationModal Component
 * Modal for before/after pickup verification with photo upload
 */
function VerificationModal({ 
  isOpen, 
  onClose, 
  listingId, 
  verificationType, 
  foodTitle,
  onVerificationComplete 
}) {
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isBeforePickup = verificationType === VERIFICATION_TYPES.BEFORE;
  const title = isBeforePickup ? 'Verify Before Pickup' : 'Verify After Pickup';
  const description = isBeforePickup
    ? 'Take photos to confirm the food is ready and as described before the recipient picks it up.'
    : 'Take photos to confirm you received the food and it matches the description.';

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Limit to 3 photos
    if (files.length > 3) {
      setError('Maximum 3 photos allowed');
      return;
    }

    setPhotos(files);
    setError(null);

    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setPhotoPreviews(previews);
  };

  const removePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    const newPreviews = photoPreviews.filter((_, i) => i !== index);
    
    // Revoke old preview URL
    URL.revokeObjectURL(photoPreviews[index]);
    
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Require at least one photo
      if (photos.length === 0) {
        setError('Please upload at least one photo for verification');
        setLoading(false);
        return;
      }

      const verificationData = {
        photos,
        notes: notes.trim() || null
      };

      // Submit verification
      let result;
      if (isBeforePickup) {
        result = await VerificationService.verifyBeforePickup(listingId, verificationData);
      } else {
        result = await VerificationService.verifyAfterPickup(listingId, verificationData);
      }

      // Clean up preview URLs
      photoPreviews.forEach(url => URL.revokeObjectURL(url));

      // Notify parent component
      if (onVerificationComplete) {
        onVerificationComplete(result);
      }

      // Close modal
      onClose();
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Clean up preview URLs
    photoPreviews.forEach(url => URL.revokeObjectURL(url));
    setPhotos([]);
    setPhotoPreviews([]);
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-primary-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-primary-100 text-sm mt-1">{foodTitle}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-primary-100 transition-colors"
              aria-label="Close"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Description */}
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-3"></i>
              <p className="text-sm text-blue-800">{description}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <i className="fas fa-exclamation-circle text-red-500 mt-0.5 mr-3"></i>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-red-500">*</span> (1-3 photos required)
            </label>
            
            {/* Upload Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
                id="verification-photos"
                disabled={loading}
              />
              <label
                htmlFor="verification-photos"
                className="cursor-pointer"
              >
                <i className="fas fa-camera text-4xl text-gray-400 mb-3"></i>
                <p className="text-sm text-gray-600">
                  Click to upload photos or take pictures
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum 3 photos, 5MB each
                </p>
              </label>
            </div>

            {/* Photo Previews */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isBeforePickup 
                ? "Add any notes about the food condition, packaging, etc."
                : "Add notes about the pickup experience, food condition, etc."}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              maxLength="500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {notes.length}/500 characters
            </p>
          </div>

          {/* Tips */}
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <h4 className="font-semibold text-yellow-800 mb-2">
              <i className="fas fa-lightbulb mr-2"></i>
              Verification Tips
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Ensure photos are clear and well-lit</li>
              <li>• Capture multiple angles of the food</li>
              <li>• Show packaging and any labels if applicable</li>
              {isBeforePickup ? (
                <li>• This helps recipients know what to expect</li>
              ) : (
                <li>• This confirms successful pickup and quality</li>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || photos.length === 0}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle mr-2"></i>
                  Submit Verification
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

VerificationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  listingId: PropTypes.string.isRequired,
  verificationType: PropTypes.oneOf([VERIFICATION_TYPES.BEFORE, VERIFICATION_TYPES.AFTER]).isRequired,
  foodTitle: PropTypes.string.isRequired,
  onVerificationComplete: PropTypes.func
};

export default VerificationModal;
