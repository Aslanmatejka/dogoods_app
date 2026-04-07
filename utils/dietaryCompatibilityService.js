/**
 * Dietary Compatibility Service
 * Checks if food listings are compatible with user dietary restrictions and allergies
 */

export class DietaryCompatibilityService {
    /**
     * Check if a food listing is compatible with user dietary restrictions
     * @param {Object} userProfile - User profile with dietary restrictions and allergies
     * @param {Object} foodListing - Food listing with dietary tags and allergens
     * @returns {Object} Compatibility result with score, warnings, and conflicts
     */
    static checkCompatibility(userProfile, foodListing) {
        const result = {
            compatible: true,
            score: 100,
            warnings: [],
            allergenConflicts: [],
            reasons: []
        };

        const userRestrictions = userProfile?.dietary_restrictions || [];
        const userAllergies = userProfile?.allergies || [];
        const foodTags = foodListing?.dietary_tags || [];
        const foodAllergens = foodListing?.allergens || [];

        // Check allergens first (critical)
        if (userAllergies.length > 0 && foodAllergens.length > 0) {
            const conflicts = userAllergies.filter(allergen => 
                foodAllergens.includes(allergen)
            );

            if (conflicts.length > 0) {
                result.compatible = false;
                result.score = 0;
                result.allergenConflicts = conflicts;
                result.warnings.push(
                    `❌ ALLERGEN ALERT: Contains ${conflicts.join(', ')}`
                );
                return result; // Stop immediately if allergens found
            }
        }

        // Check dietary restrictions
        if (userRestrictions.length > 0) {
            // Vegetarian check
            if (userRestrictions.includes('vegetarian')) {
                if (!foodTags.includes('vegetarian') && !foodTags.includes('vegan')) {
                    result.score -= 50;
                    result.warnings.push('⚠️ May not meet vegetarian requirements');
                } else {
                    result.reasons.push('✓ Suitable for vegetarians');
                }
            }

            // Vegan check
            if (userRestrictions.includes('vegan')) {
                if (!foodTags.includes('vegan')) {
                    result.score -= 50;
                    result.warnings.push('⚠️ May not meet vegan requirements');
                } else {
                    result.reasons.push('✓ Suitable for vegans');
                }
            }

            // Gluten-free check
            if (userRestrictions.includes('gluten-free')) {
                if (!foodTags.includes('gluten-free')) {
                    result.score -= 30;
                    result.warnings.push('⚠️ May contain gluten');
                } else {
                    result.reasons.push('✓ Gluten-free');
                }
            }

            // Dairy-free check
            if (userRestrictions.includes('dairy-free')) {
                if (!foodTags.includes('dairy-free') && !foodTags.includes('vegan')) {
                    result.score -= 30;
                    result.warnings.push('⚠️ May contain dairy');
                } else {
                    result.reasons.push('✓ Dairy-free');
                }
            }

            // Halal check
            if (userRestrictions.includes('halal')) {
                if (!foodTags.includes('halal')) {
                    result.score -= 40;
                    result.warnings.push('⚠️ May not be halal certified');
                } else {
                    result.reasons.push('✓ Halal certified');
                }
            }

            // Kosher check
            if (userRestrictions.includes('kosher')) {
                if (!foodTags.includes('kosher')) {
                    result.score -= 40;
                    result.warnings.push('⚠️ May not be kosher certified');
                } else {
                    result.reasons.push('✓ Kosher certified');
                }
            }

            // Pescatarian check
            if (userRestrictions.includes('pescatarian')) {
                if (!foodTags.includes('pescatarian') && !foodTags.includes('vegetarian') && !foodTags.includes('vegan')) {
                    result.score -= 40;
                    result.warnings.push('⚠️ May not meet pescatarian requirements');
                } else {
                    result.reasons.push('✓ Suitable for pescatarians');
                }
            }
        }

        // Bonus points for matching preferences
        const userPreferences = userProfile?.dietary_preferences || [];
        if (userPreferences.length > 0) {
            const matchedPreferences = userPreferences.filter(pref => 
                foodTags.includes(pref)
            );

            if (matchedPreferences.length > 0) {
                result.score = Math.min(100, result.score + (matchedPreferences.length * 5));
                result.reasons.push(`✓ Matches your preferences: ${matchedPreferences.join(', ')}`);
            }
        }

        return result;
    }

    /**
     * Filter food listings based on user dietary requirements
     * @param {Array} foodListings - Array of food listings
     * @param {Object} userProfile - User profile with dietary restrictions
     * @param {Boolean} strictMode - If true, only show 100% compatible foods
     * @returns {Array} Filtered and sorted food listings with compatibility info
     */
    static filterFoodListings(foodListings, userProfile, strictMode = false) {
        return foodListings
            .map(food => ({
                ...food,
                dietaryCompatibility: this.checkCompatibility(userProfile, food)
            }))
            .filter(food => {
                if (strictMode) {
                    // In strict mode, only show foods with no allergen conflicts
                    return food.dietaryCompatibility.compatible;
                }
                // Otherwise, show all but mark incompatible ones
                return true;
            })
            .sort((a, b) => {
                // Sort by compatibility score (highest first)
                return b.dietaryCompatibility.score - a.dietaryCompatibility.score;
            });
    }

    /**
     * Get a summary of dietary compatibility for display
     * @param {Object} compatibilityResult - Result from checkCompatibility
     * @returns {String} Human-readable summary
     */
    static getCompatibilitySummary(compatibilityResult) {
        if (!compatibilityResult.compatible) {
            return `Not Suitable: ${compatibilityResult.warnings.join(', ')}`;
        }

        if (compatibilityResult.score === 100) {
            return 'Perfect Match! ' + (compatibilityResult.reasons.join(', ') || 'No dietary conflicts');
        }

        if (compatibilityResult.score >= 70) {
            return 'Good Match: ' + (compatibilityResult.warnings.join(', ') || 'Minor considerations');
        }

        return 'Partial Match: ' + compatibilityResult.warnings.join(', ');
    }

    /**
     * Get color code for compatibility score
     * @param {Number} score - Compatibility score (0-100)
     * @returns {String} CSS class name
     */
    static getCompatibilityColor(score) {
        if (score === 0) return 'text-red-600';
        if (score >= 90) return 'text-primary-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-orange-600';
    }

    /**
     * Get badge style for compatibility
     * @param {Number} score - Compatibility score (0-100)
     * @returns {String} CSS classes for badge
     */
    static getCompatibilityBadge(score) {
        if (score === 0) return 'bg-red-100 text-red-800 border-red-200';
        if (score >= 90) return 'bg-primary-100 text-primary-800 border-primary-200';
        if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
        if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
}

export default DietaryCompatibilityService;
