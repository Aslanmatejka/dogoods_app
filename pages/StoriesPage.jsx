import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../utils/supabaseClient';
import { reportError } from '../utils/helpers';
import { useAuthContext } from '../utils/AuthContext';

function StoriesPage() {
    const { isAdmin } = useAuthContext();
    const navigate = useNavigate();
    const [isEditMode, setIsEditMode] = useState(false);
    const [editableContent, setEditableContent] = useState({});
    const [originalContent, setOriginalContent] = useState({});

    // Load saved content on mount
    useEffect(() => {
        const loadSavedContent = async () => {
            try {
                const { data, error } = await supabase
                    .from('page_content')
                    .select('content')
                    .eq('page_name', 'stories')
                    .maybeSingle();

                if (data && !error) {
                    setEditableContent(data.content);
                } else {
                    const saved = localStorage.getItem('storiesPageContent');
                    if (saved) {
                        setEditableContent(JSON.parse(saved));
                    }
                }
            } catch (error) {
                console.error('Error loading content:', error);
                const saved = localStorage.getItem('storiesPageContent');
                if (saved) {
                    setEditableContent(JSON.parse(saved));
                }
            }
        };

        loadSavedContent();
    }, []);

    // Scroll to top when page loads
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const toggleEditMode = () => {
        if (!isAdmin) return;
        
        if (!isEditMode) {
            setOriginalContent({ ...editableContent });
        }
        setIsEditMode(!isEditMode);
    };

    const handleContentEdit = (key, value) => {
        setEditableContent(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleImageEdit = (key, currentUrl) => {
        if (!isEditMode) return;
        
        const newUrl = prompt('Enter new image URL:', currentUrl);
        if (newUrl && newUrl !== currentUrl) {
            setEditableContent(prev => ({
                ...prev,
                [key]: newUrl
            }));
        }
    };

    const saveChanges = async () => {
        try {
            const { error } = await supabase
                .from('page_content')
                .upsert({
                    page_name: 'stories',
                    content: editableContent,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving to Supabase:', error);
                localStorage.setItem('storiesPageContent', JSON.stringify(editableContent));
            }

            localStorage.setItem('storiesPageContent', JSON.stringify(editableContent));
            
            alert('Changes saved successfully!');
            setIsEditMode(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            reportError(error, { context: 'Stories page edit' });
            localStorage.setItem('storiesPageContent', JSON.stringify(editableContent));
            alert('Saved to local storage. Changes may not persist across sessions.');
        }
    };

    const cancelEdit = () => {
        setEditableContent({ ...originalContent });
        setIsEditMode(false);
    };

    const getContent = (key, defaultValue) => {
        return editableContent[key] || defaultValue;
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <style>{`
                .editable {
                    position: relative;
                }
                
                .edit-mode .editable {
                    outline: 2px dashed #3b82f6;
                    outline-offset: 4px;
                    cursor: text;
                    min-height: 30px;
                    padding: 4px;
                }
                
                .edit-mode .editable:hover {
                    outline-color: #1d4ed8;
                    background: rgba(59, 130, 246, 0.05);
                }
                
                .edit-mode .editable:focus {
                    outline-color: #10b981;
                    background: rgba(16, 185, 129, 0.05);
                }
                
                .admin-edit-btn {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    z-index: 1000;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5);
                    transition: all 0.3s ease;
                }
                
                .admin-edit-btn:hover {
                    transform: scale(1.1) rotate(90deg);
                    box-shadow: 0 15px 35px rgba(59, 130, 246, 0.7);
                }
                
                .admin-edit-btn.editing {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                }
                
                .edit-toolbar {
                    position: fixed;
                    top: 100px;
                    right: 2rem;
                    z-index: 1000;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    padding: 1rem;
                    display: none;
                }
                
                .edit-mode .edit-toolbar {
                    display: block;
                }
                
                .editable-image {
                    position: relative;
                    cursor: pointer;
                }
                
                .edit-mode .editable-image::after {
                    content: '📷 Click to edit image URL';
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(59, 130, 246, 0.9);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }
                
                .edit-mode .editable-image:hover::after {
                    opacity: 1;
                }
                
                .edit-mode .editable-image img {
                    outline: 2px dashed #3b82f6;
                    outline-offset: 4px;
                }
                
                .edit-mode .editable-image:hover img {
                    outline-color: #1d4ed8;
                    opacity: 0.8;
                }
            `}</style>

            {/* Admin Edit Button */}
            {isAdmin && (
                <>
                    <button
                        onClick={toggleEditMode}
                        className={`admin-edit-btn ${isEditMode ? 'editing' : ''}`}
                        title="Admin Edit Mode"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>

                    {isEditMode && (
                        <div className="edit-toolbar">
                            <h3 className="font-bold text-gray-900 mb-3">Edit Mode Active</h3>
                            <p className="text-sm text-gray-600 mb-4">Click on any section to edit</p>
                            <button
                                onClick={saveChanges}
                                className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors mb-2"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </>
            )}

            <div className={isEditMode ? 'edit-mode' : ''}>
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="max-w-7xl mx-auto mb-12">
                    <button 
                        onClick={() => navigate('/impact-story')}
                        className="mb-6 flex items-center text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Back to Impact Story
                    </button>
                    <h1 
                        className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 editable"
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => handleContentEdit('pageTitle', e.target.textContent)}
                    >
                        {getContent('pageTitle', 'All Impact Stories')}
                    </h1>
                    <p 
                        className="text-xl text-gray-600 editable"
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => handleContentEdit('pageSubtitle', e.target.textContent)}
                    >
                        {getContent('pageSubtitle', 'Real stories from real people making a difference in our communities')}
                    </p>
                </div>

                {/* Stories Grid */}
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Story 1 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story1Image', getContent('story1Image', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story1Image', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop')}
                                    alt="Community Impact" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story1Title', e.target.textContent)}
                                >
                                    {getContent('story1Title', "Sarah's Story: From Volunteer to Champion")}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story1Text', e.target.textContent)}
                                >
                                    {getContent('story1Text', "I started as a volunteer driver, picking up surplus food from local restaurants. Now I coordinate our entire network in the Bay Area. Seeing families receive fresh, nutritious meals—food that would have been wasted—gives me purpose every single day. We're not just feeding people; we're building a community that cares.")}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story1Attribution', e.target.textContent)}
                                    >
                                        {getContent('story1Attribution', '— Sarah Martinez, Community Coordinator, Alameda')}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Story 2 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story2Image', getContent('story2Image', 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story2Image', 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop')}
                                    alt="Food Distribution" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story2Title', e.target.textContent)}
                                >
                                    {getContent('story2Title', 'Restaurant Partnership: A Win-Win Solution')}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story2Text', e.target.textContent)}
                                >
                                    {getContent('story2Text', "As a restaurant owner, I used to feel terrible about food waste at the end of each day. DoGoods transformed that guilt into impact. Now, instead of throwing away perfectly good food, I know it's helping families in our neighborhood. The platform makes it effortless—I post what I have, and within an hour, it's picked up and distributed.")}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story2Attribution', e.target.textContent)}
                                    >
                                        {getContent('story2Attribution', '— Michael Chen, Owner, Golden Wok Restaurant')}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Story 3 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story3Image', getContent('story3Image', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story3Image', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop')}
                                    alt="Food Bank" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story3Title', e.target.textContent)}
                                >
                                    {getContent('story3Title', 'Feeding 500 Families During the Holidays')}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story3Text', e.target.textContent)}
                                >
                                    {getContent('story3Text', "DoGoods helped us feed over 500 families during the holidays. The AI routing meant we could distribute fresh food within 2 hours of donation—something that was impossible before. Thanks to our network of 150+ partners, we've prevented over 2 million pounds of food waste while providing nutritious meals to families who need them most.")}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story3Attribution', e.target.textContent)}
                                    >
                                        {getContent('story3Attribution', '— Director of Community Services, Alameda County Food Bank')}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Story 4 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story4Image', getContent('story4Image', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story4Image', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop')}
                                    alt="Community" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story4Title', e.target.textContent)}
                                >
                                    {getContent('story4Title', 'Serving 10,000 People Monthly')}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story4Text', e.target.textContent)}
                                >
                                    {getContent('story4Text', 'Partnering with 45+ community centers across the Bay Area to provide fresh meals and groceries to families in need. Our network ensures that nutritious food reaches those who need it most, creating lasting impact in every neighborhood we serve.')}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story4Attribution', e.target.textContent)}
                                    >
                                        {getContent('story4Attribution', '— Community Centers Impact Report')}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Story 5 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story5Image', getContent('story5Image', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story5Image', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop')}
                                    alt="Food Distribution" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story5Title', e.target.textContent)}
                                >
                                    {getContent('story5Title', '200+ Restaurant Partners')}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story5Text', e.target.textContent)}
                                >
                                    {getContent('story5Text', 'Working with restaurants and grocers across the region to rescue surplus food daily. Our AI routing ensures food reaches recipients within 60 minutes of donation, maintaining freshness and quality while reducing waste.')}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story5Attribution', e.target.textContent)}
                                    >
                                        {getContent('story5Attribution', '— Restaurant Partnership Program')}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Story 6 */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div 
                                className="editable-image"
                                onClick={() => handleImageEdit('story6Image', getContent('story6Image', 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop'))}
                            >
                                <img 
                                    src={getContent('story6Image', 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop')}
                                    alt="Impact" 
                                    className="w-full h-64 object-cover" 
                                />
                            </div>
                            <div className="p-6">
                                <h3 
                                    className="text-2xl font-bold text-gray-900 mb-3 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story6Title', e.target.textContent)}
                                >
                                    {getContent('story6Title', 'Saving the Planet, One Meal at a Time')}
                                </h3>
                                <p 
                                    className="text-gray-600 mb-4 editable"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    onBlur={(e) => handleContentEdit('story6Text', e.target.textContent)}
                                >
                                    {getContent('story6Text', "By preventing food waste, we've reduced over 1,200 tons of CO2 emissions and conserved resources equivalent to 30 million gallons of water. Every meal saved is a step toward a more sustainable future for our communities.")}
                                </p>
                                <p className="text-sm text-gray-500 italic">
                                    <strong 
                                        className="editable"
                                        contentEditable={isEditMode}
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleContentEdit('story6Attribution', e.target.textContent)}
                                    >
                                        {getContent('story6Attribution', '— Environmental Impact Assessment')}
                                    </strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Call to Action */}
                    {/* TEMPORARILY DISABLED
                    <div className="text-center mt-12">
                        <button 
                            onClick={() => navigate('/share')} 
                            className="bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg hover:shadow-xl">
                            <span 
                                className="editable"
                                contentEditable={isEditMode}
                                suppressContentEditableWarning
                                onBlur={(e) => handleContentEdit('ctaButtonText', e.target.textContent)}
                            >
                                {getContent('ctaButtonText', 'Join Our Network')}
                            </span>
                        </button>
                    </div>
                    */}
                </div>
            </div>
            </div>
        </div>
    );
}

export default StoriesPage;
