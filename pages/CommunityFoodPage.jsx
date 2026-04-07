import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import FoodCard from '../components/food/FoodCard';
import { useFoodListings } from '../utils/hooks/useSupabase';
import communities from '../utils/communities';
import supabase from '../utils/supabaseClient';

export default function CommunityFoodPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const communityId = parseInt(id, 10);
    
    const [community, setCommunity] = React.useState(null);
    const [loadingCommunity, setLoadingCommunity] = React.useState(true);

    // Fetch community from database
    React.useEffect(() => {
        const fetchCommunity = async () => {
            try {
                const { data, error } = await supabase
                    .from('communities')
                    .select('*')
                    .eq('id', communityId)
                    .single();
                
                if (error) throw error;
                
                // Merge with static data for additional fields
                const staticCommunity = communities.find(c => c.name === data.name);
                const mergedCommunity = {
                    ...staticCommunity,
                    ...data,
                    image: staticCommunity?.image || data.image || 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=600&fit=crop',
                    location: staticCommunity?.location || data.location || 'Location TBD',
                    contact: staticCommunity?.contact || data.contact || 'Contact TBD',
                    hours: staticCommunity?.hours || data.hours || 'Hours TBD'
                };
                
                setCommunity(mergedCommunity);
            } catch (error) {
                console.error('Error fetching community:', error);
                // Fallback to static communities
                const staticCommunity = communities.find(c => c.id === communityId);
                setCommunity(staticCommunity);
            } finally {
                setLoadingCommunity(false);
            }
        };
        
        fetchCommunity();
    }, [communityId]);

    const { listings: foods, loading, error, fetchListings } = useFoodListings({ status: ['approved', 'active'] });

    // Filter foods by community - check community_id, donor_city, location address, and full_address
    const communityFoods = useMemo(() => {
        if (!foods) return [];
        if (!community) return [];
        const nameLower = community.name.toLowerCase();
        return foods.filter(f => {
            // Direct community_id match is strongest signal
            if (f.community_id && f.community_id === communityId) return true;
            // Check donor location fields
            const city = (f.donor_city || '') + ' ' + (f.donor_state || '');
            const loc = f.location && typeof f.location === 'object' ? (f.location.address || '') : (typeof f.location === 'string' ? f.location : '');
            const addr = f.full_address || '';
            return city.toLowerCase().includes(nameLower) || loc.toLowerCase().includes(nameLower) || addr.toLowerCase().includes(nameLower);
        });
    }, [foods, community, communityId]);

    if (loadingCommunity) {
        return (
            <div className="max-w-4xl mx-auto py-10 px-4">
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2CABE3] mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading community...</p>
                </div>
            </div>
        );
    }

    if (!community) {
        return (
            <div className="max-w-4xl mx-auto py-10 px-4">
                <Card>
                    <div className="p-6 text-center">
                        <h2 className="text-xl font-bold">Community Not Found</h2>
                        <p className="text-gray-600 mt-2">We couldn't find the community you're looking for.</p>
                        <div className="mt-4">
                            <Button onClick={() => navigate('/')} variant="secondary">Back to Home</Button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-4">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">{community.name}</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            <i className="fas fa-map-marker-alt mr-2"></i>
                            {community.location}
                        </p>
                    </div>
                    <div>
                        <Button variant="secondary" onClick={() => navigate('/find')}>View All Listings</Button>
                    </div>
                </div>
                
                {/* Community Details */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-start">
                        <i className="fas fa-user w-5 text-gray-500 mr-3 mt-1"></i>
                        <div>
                            <p className="text-xs font-semibold text-gray-700 uppercase">Contact</p>
                            <p className="text-sm text-gray-900">{community.contact}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <i className="fas fa-phone w-5 text-gray-500 mr-3 mt-1"></i>
                        <div>
                            <p className="text-xs font-semibold text-gray-700 uppercase">Phone</p>
                            <a href={`tel:${community.phone}`} className="text-sm text-blue-600 hover:underline">
                                {community.phone}
                            </a>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <i className="fas fa-clock w-5 text-gray-500 mr-3 mt-1"></i>
                        <div>
                            <p className="text-xs font-semibold text-gray-700 uppercase">Hours</p>
                            <p className="text-sm text-gray-900">{community.hours}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : error ? (
                    <div className="text-center py-12 text-red-600">Error loading listings</div>
                ) : communityFoods.length === 0 ? (
                    <Card>
                        <div className="p-6 text-center">
                            <h3 className="text-lg font-semibold">No food available right now</h3>
                            <p className="text-gray-600 mt-2">Check back later or view all listings.</p>
                        </div>
                    </Card>
                ) : (
                    communityFoods.map(food => (
                        <FoodCard key={food.id || food.objectId} food={food} onClaim={() => navigate('/claim', { state: { food } })} />
                    ))
                )}
            </div>
        </div>
    );
}
