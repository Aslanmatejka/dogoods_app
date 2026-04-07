import React from 'react';
import PropTypes from 'prop-types';
import DietaryCompatibilityService from '../../utils/dietaryCompatibilityService';

/**
 * Display dietary compatibility information for a food listing
 */
function DietaryCompatibilityBadge({ foodListing, userProfile, showDetails = false }) {
    if (!userProfile || (!userProfile.dietary_restrictions?.length && !userProfile.allergies?.length)) {
        // User hasn't set dietary preferences, show nothing
        return null;
    }

    const compatibility = DietaryCompatibilityService.checkCompatibility(userProfile, foodListing);
    const badgeClass = DietaryCompatibilityService.getCompatibilityBadge(compatibility.score);
    const summary = DietaryCompatibilityService.getCompatibilitySummary(compatibility);

    return (
        <div className="dietary-compatibility">
            {/* Badge */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${badgeClass}`}>
                {compatibility.score === 0 && <span className="mr-1">❌</span>}
                {compatibility.score >= 90 && <span className="mr-1">✅</span>}
                {compatibility.score >= 70 && compatibility.score < 90 && <span className="mr-1">✓</span>}
                {compatibility.score >= 50 && compatibility.score < 70 && <span className="mr-1">⚠️</span>}
                {compatibility.score > 0 && compatibility.score < 50 && <span className="mr-1">⚠</span>}
                
                <span>{compatibility.score}% Match</span>
            </div>

            {/* Details */}
            {showDetails && (
                <div className="mt-2 text-sm">
                    {/* Summary */}
                    <p className="font-medium text-gray-700 mb-2">{summary}</p>

                    {/* Allergen Conflicts */}
                    {compatibility.allergenConflicts.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                            <p className="text-red-800 font-semibold">
                                ⛔ ALLERGEN ALERT: Contains {compatibility.allergenConflicts.join(', ')}
                            </p>
                        </div>
                    )}

                    {/* Warnings */}
                    {compatibility.warnings.length > 0 && (
                        <div className="space-y-1">
                            {compatibility.warnings.map((warning, idx) => (
                                <p key={idx} className="text-orange-700">{warning}</p>
                            ))}
                        </div>
                    )}

                    {/* Positive Reasons */}
                    {compatibility.reasons.length > 0 && (
                        <div className="space-y-1 mt-2">
                            {compatibility.reasons.map((reason, idx) => (
                                <p key={idx} className="text-primary-700">{reason}</p>
                            ))}
                        </div>
                    )}

                    {/* Dietary Tags */}
                    {foodListing.dietary_tags && foodListing.dietary_tags.length > 0 && (
                        <div className="mt-2">
                            <p className="text-gray-600 text-xs font-medium mb-1">Dietary Tags:</p>
                            <div className="flex flex-wrap gap-1">
                                {foodListing.dietary_tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 bg-primary-100 text-primary-800 rounded text-xs">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Allergens */}
                    {foodListing.allergens && foodListing.allergens.length > 0 && (
                        <div className="mt-2">
                            <p className="text-gray-600 text-xs font-medium mb-1">Contains Allergens:</p>
                            <div className="flex flex-wrap gap-1">
                                {foodListing.allergens.map(allergen => (
                                    <span key={allergen} className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                                        ⚠️ {allergen}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ingredients */}
                    {foodListing.ingredients && (
                        <div className="mt-2">
                            <p className="text-gray-600 text-xs font-medium mb-1">Ingredients:</p>
                            <p className="text-gray-700 text-xs">{foodListing.ingredients}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

DietaryCompatibilityBadge.propTypes = {
    foodListing: PropTypes.shape({
        dietary_tags: PropTypes.arrayOf(PropTypes.string),
        allergens: PropTypes.arrayOf(PropTypes.string),
        ingredients: PropTypes.string
    }).isRequired,
    userProfile: PropTypes.shape({
        dietary_restrictions: PropTypes.arrayOf(PropTypes.string),
        allergies: PropTypes.arrayOf(PropTypes.string),
        dietary_preferences: PropTypes.arrayOf(PropTypes.string)
    }),
    showDetails: PropTypes.bool
};

export default DietaryCompatibilityBadge;
