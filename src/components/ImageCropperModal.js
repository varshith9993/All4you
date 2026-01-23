import React, { useState, useRef } from 'react';
import { FiZoomIn, FiZoomOut, FiCheck, FiX } from 'react-icons/fi';

export default function ImageCropperModal({ imageSrc, onCancel, onCropComplete }) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef(null);
    const imageRef = useRef(null);

    // Initial setup to center the image (cover fit)
    const onImageLoad = (e) => {
        // Logic to initially center/fit could go here, 
        // but typically CSS centering and scale=1 is a good start.
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        const newScale = Math.min(Math.max(0.5, scale + delta), 3);
        setScale(newScale);
    };

    // --- Drag Logic ---
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Touch support
    const handleTouchStart = (e) => {
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
        e.preventDefault(); // Prevent scrolling
    };

    // --- Crop Generation ---
    const handleCrop = async () => {
        if (!imageRef.current) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Output size (500x500 as requested for profile)
        const size = 500;
        canvas.width = size;
        canvas.height = size;

        // Draw image transformed
        // We need to map the visual representation to the canvas
        // The container is usually, say, 280px in the UI.
        const uiSize = containerRef.current.clientWidth; // e.g., 280
        const scaleFactor = size / uiSize; // Map UI pixels to Canvas pixels

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Save context for transform
        ctx.save();

        // Move to center of canvas
        ctx.translate(size / 2, size / 2);

        // Apply user scale
        ctx.scale(scale, scale);

        // Apply user translation (scaled up to canvas size)
        ctx.translate(position.x * scaleFactor, position.y * scaleFactor);

        // Draw image centered
        // We rely on the generic HTML <img> behavior where it's centered by CSS Flexbox initially?
        // Actually, simpler logic:
        // We render the image at its natural size, offset by -width/2, -height/2 to center it at 0,0 locally.
        const img = imageRef.current;
        // However, we need to match how it looks in the DOM container.
        // In the DOM, if we center-align the image using flexbox, its center is at the container center.
        // So (0,0) translation means centers aligned.

        // We need to know the rendered aspect ratio vs natural
        // To simplify: we'll draw the Natural Image centered.
        // But we need to scale the Natural Image so it matches the "Screen Scale".
        // If image is 1000x1000, and screen scale is 1 (fit), 
        // we essentially want to draw it such that it covers the canvas.

        // Calculate "Base Scale" to mimic object-fit: contain or cover.
        // Let's assume we start with the image at "natural size" in the context
        // and we scale it down to fit the canvas?

        // Alternative: The visible area in the UI is a square. 
        // The percentage of the image currently visible in that square is what we want.

        // Let's normalize:
        // Screen Square: uiSize x uiSize
        // Image on Screen: img.width * scale, img.height * scale (if we relied on pure CSS scaling)
        // But here we rely on standard Natural dimensions.

        // Let's assume we want "WYSIWYG".
        // The transform applied to the context (translate, scale) mirrors the CSS transform?
        // CSS properties: transform: translate(x,y) scale(s)

        // We need to draw the image such that its center is at (0,0) before translation.
        // But we also need to account for the initial "fit" scaling that CSS typically does for <img> tags.
        // Let's calculate the ratio.
        const widthRatio = uiSize / img.naturalWidth;
        const heightRatio = uiSize / img.naturalHeight;
        // Typically we want 'cover' behavior or 'contain'. Let's pick a base scale that makes the image meaningful.
        // If we choose Math.max(widthRatio, heightRatio), it's 'cover'.
        const baseScale = Math.max(widthRatio, heightRatio); // object-fit: cover initial

        // Apply base scale so image "fits" the canvas naturally like it fits the UI box
        ctx.scale(baseScale, baseScale);

        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

        ctx.restore();

        // Convert to Blob
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Canvas is empty');
                return;
            }
            // Add name property to mimic a File object
            blob.name = "profile_cropped.jpg";
            blob.lastModified = Date.now();
            if (typeof onCropComplete === 'function') {
                onCropComplete(blob);
            }
        }, 'image/jpeg', 0.95);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Adjust Profile Photo</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-full">
                        <FiX size={24} />
                    </button>
                </div>

                <div className="flex-1 bg-gray-900 relative flex items-center justify-center h-[350px] overflow-hidden select-none">
                    {/* Visual Overlay - Circle */}
                    <div
                        ref={containerRef}
                        className="relative w-[280px] h-[280px] border-2 border-white rounded-full z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                    ></div>

                    {/* Image Layer - Interactive */}
                    <div
                        className="absolute inset-0 flex items-center justify-center cursor-move"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        <img
                            ref={imageRef}
                            src={imageSrc}
                            alt="Crop target"
                            className="max-w-none transition-transform duration-75 ease-out select-none"
                            onLoad={onImageLoad}
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                // We rely on a default size logic?
                                // To make WYSIWYG easier, let's style it initially to match 'cover' of a 280x280 box?
                                // Or simpler: constrain height/width to sensible defaults?
                                // If we leave it native, it might be huge.
                                // Let's constrain height to base container size and let width flow, or vice versa.
                                // Actually, let's max-height/max-width it to the container, then scale up from there.
                                maxHeight: '280px',
                                maxWidth: '280px',
                                objectFit: 'cover' // This might fight with transform.
                                // Better: Don't set max sizes here if we use transform.
                                // BUT if we don't, a 4000px image will be unmanageable.
                                // Let's set height to 280px as base baseline.
                            }}
                            height={280}
                        />
                    </div>
                </div>

                <div className="p-4 bg-white space-y-4">
                    <div className="flex items-center gap-4">
                        <FiZoomOut size={20} className="text-gray-500" />
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.05"
                            value={scale}
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <FiZoomIn size={20} className="text-gray-500" />
                    </div>

                    <p className="text-center text-xs text-gray-500">
                        Drag to reposition • Pinch/Scroll to zoom
                    </p>

                    <button
                        onClick={handleCrop}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                        <FiCheck size={20} />
                        Set Profile Photo
                    </button>
                </div>
            </div>
        </div>
    );
}
