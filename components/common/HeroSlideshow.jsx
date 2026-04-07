import { useState, useEffect } from 'react';
import { useAuthContext } from '../../utils/AuthContext';
import supabase from '../../utils/supabaseClient';

function HeroSlideshow({ children }) {
    const { isAdmin } = useAuthContext();
    const [slides, setSlides] = useState([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [newSlideUrl, setNewSlideUrl] = useState('');
    const [newSlideCaption, setNewSlideCaption] = useState('');
    const [loading, setLoading] = useState(true);

    // Default slides if none in database
    const defaultSlides = [
        {
            id: 'default-1',
            image_url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1920&q=80',
            caption: 'Share Food, Reduce Waste, Build Community',
            order_index: 0
        },
        {
            id: 'default-2',
            image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1920&q=80',
            caption: 'Fighting Food Waste Together',
            order_index: 1
        },
        {
            id: 'default-3',
            image_url: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1920&q=80',
            caption: 'Connecting Communities Through Food',
            order_index: 2
        }
    ];

    // Load slides from database
    useEffect(() => {
        let mounted = true;
        
        const loadSlides = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('hero_slides')
                    .select('*')
                    .order('order_index', { ascending: true });

                if (!mounted) return;

                if (error) {
                    console.error('Error loading slides:', error);
                    setSlides(defaultSlides);
                } else if (data && data.length > 0) {
                    setSlides(data);
                } else {
                    setSlides(defaultSlides);
                }
            } catch (err) {
                console.error('Error:', err);
                if (mounted) {
                    setSlides(defaultSlides);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadSlides();

        return () => {
            mounted = false;
        };
    }, []);

    // Separate loadSlides function for manual reloads (admin use)
    const reloadSlides = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('hero_slides')
                .select('*')
                .order('order_index', { ascending: true });

            if (error) {
                console.error('Error loading slides:', error);
                setSlides(defaultSlides);
            } else if (data && data.length > 0) {
                setSlides(data);
            } else {
                setSlides(defaultSlides);
            }
        } catch (err) {
            console.error('Error:', err);
            setSlides(defaultSlides);
        } finally {
            setLoading(false);
        }
    };

    // Auto-advance slideshow
    useEffect(() => {
        if (slides.length === 0) return;
        
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000); // Change slide every 5 seconds

        return () => clearInterval(interval);
    }, [slides.length]);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const goToSlide = (index) => {
        setCurrentSlide(index);
    };

    const addSlide = async () => {
        if (!newSlideUrl.trim()) {
            alert('Please enter an image URL');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('hero_slides')
                .insert({
                    image_url: newSlideUrl,
                    caption: newSlideCaption,
                    order_index: slides.length
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding slide:', error);
                alert('Failed to add slide. Check console for details.');
            } else {
                setSlides([...slides, data]);
                setNewSlideUrl('');
                setNewSlideCaption('');
                alert('Slide added successfully!');
                await reloadSlides();
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to add slide.');
        }
    };

    const removeSlide = async (slideId) => {
        if (!confirm('Are you sure you want to remove this slide?')) return;

        try {
            const { error } = await supabase
                .from('hero_slides')
                .delete()
                .eq('id', slideId);

            if (error) {
                console.error('Error removing slide:', error);
                alert('Failed to remove slide.');
            } else {
                if (currentSlide >= slides.length - 1) {
                    setCurrentSlide(Math.max(0, slides.length - 2));
                }
                alert('Slide removed successfully!');
                await reloadSlides();
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to remove slide.');
        }
    };

    if (loading) {
        return (
            <div className="relative h-[500px] bg-gray-200 flex items-center justify-center">
                <div className="text-gray-500">Loading slideshow...</div>
            </div>
        );
    }

    if (slides.length === 0) {
        return (
            <div className="relative h-[500px] bg-gray-200 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">No slides available</p>
                    {isAdmin && (
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                            Add Slides
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-[600px] overflow-hidden bg-gray-900">
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                        index === currentSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    <img
                        src={slide.image_url}
                        alt={slide.caption || `Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/40" />
                </div>
            ))}

            {/* Hero Content - Rendered above slideshow */}
            <div className="relative z-10 flex items-center justify-center min-h-[600px]">
                {children}
            </div>

            {/* Navigation Arrows */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full transition-all backdrop-blur-sm z-20"
                        aria-label="Previous slide"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full transition-all backdrop-blur-sm z-20"
                        aria-label="Next slide"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </>
            )}

            {/* Dot Indicators */}
            {slides.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-2 z-20">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-3 h-3 rounded-full transition-all ${
                                index === currentSlide
                                    ? 'bg-white w-8'
                                    : 'bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Admin Controls */}
            {isAdmin && (
                <>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg z-50 cursor-pointer"
                        title="Manage Slides"
                    >
                        {isEditMode ? 'Close' : 'Manage Slides'}
                    </button>

                    {/* Admin Panel */}
                    {isEditMode && (
                        <div className="absolute top-16 right-4 bg-white rounded-lg shadow-2xl p-6 w-96 max-h-[400px] overflow-y-auto z-50">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Manage Slideshow</h3>
                            
                            {/* Add New Slide */}
                            <div className="mb-6 pb-6 border-b border-gray-200">
                                <h4 className="font-semibold text-gray-900 mb-3">Add New Slide</h4>
                                <input
                                    type="text"
                                    placeholder="Image URL"
                                    value={newSlideUrl}
                                    onChange={(e) => setNewSlideUrl(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <input
                                    type="text"
                                    placeholder="Caption (optional)"
                                    value={newSlideCaption}
                                    onChange={(e) => setNewSlideCaption(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={addSlide}
                                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                                >
                                    Add Slide
                                </button>
                            </div>

                            {/* Current Slides */}
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Current Slides ({slides.length})</h4>
                                <div className="space-y-3">
                                    {slides.map((slide, index) => (
                                        <div key={slide.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <img
                                                src={slide.image_url}
                                                alt={slide.caption}
                                                className="w-20 h-12 object-cover rounded"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {slide.caption || `Slide ${index + 1}`}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {slide.image_url}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeSlide(slide.id)}
                                                className="text-red-600 hover:text-red-800 p-2"
                                                title="Remove slide"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18"/>
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default HeroSlideshow;
