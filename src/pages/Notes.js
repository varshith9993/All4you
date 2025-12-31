import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    collection,
    query,
    where,
    onSnapshot,
    deleteDoc,
    doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
    FiArrowLeft,
    FiSearch,
    FiMoreVertical,
    FiEdit3,
    FiTrash2,
    FiInfo,
    FiX,
    FiCalendar,
} from "react-icons/fi";

export default function Notes() {
    const navigate = useNavigate();
    const [currentUserId, setCurrentUserId] = useState(null);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // UI State
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpenId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUserId(user.uid);
            } else {
                setCurrentUserId(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch notes
    useEffect(() => {
        if (!currentUserId) return;

        const q = query(
            collection(db, "notes"),
            where("userId", "==", currentUserId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Client-side sorting to avoid index issues
            notesData.sort((a, b) => {
                const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
                const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
                return timeB - timeA;
            });

            setNotes(notesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching notes:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUserId]);

    const handleDeleteNote = async (noteId) => {
        if (window.confirm("Are you sure you want to delete this note?")) {
            try {
                await deleteDoc(doc(db, "notes", noteId));
                setMenuOpenId(null);
            } catch (error) {
                console.error("Error deleting note:", error);
            }
        }
    };

    const handleEditClick = (note) => {
        navigate("/add-notes", { state: { note: note } });
    };

    const handleAboutClick = (note) => {
        setSelectedNote(note);
        setShowAboutModal(true);
        setMenuOpenId(null);
    };

    const handleNoteClick = (note) => {
        navigate("/add-notes", { state: { note: note, readOnly: true } });
    };

    const startCreateNote = () => {
        navigate("/add-notes");
    };

    const filteredNotes = notes.filter(
        (note) =>
            note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            note.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDateTime = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        const time = `${hours}:${minutes} ${ampm}`;

        return `${day}/${month}/${year} ${time}`;
    };



    return (
        <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
            {/* Fixed Header */}
            <div className="bg-white px-4 py-4 sticky top-0 z-10 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate(-1)} // Navigate back to previous page
                            className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Back"
                        >
                            <FiArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-semibold text-gray-900">Notes</h1>
                    </div>
                    <button
                        onClick={startCreateNote}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        New
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <FiSearch
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                    />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-100 text-gray-900 rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all border border-gray-200"
                    />
                </div>
            </div>

            {/* Scrollable Notes List */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="text-center py-12 opacity-75">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiEdit3 size={24} className="text-gray-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">No Notes</h3>
                            <p className="text-xs text-gray-500">Create your first note</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredNotes.map((note) => {

                                return (
                                    <div
                                        key={note.id}
                                        className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors relative"
                                    >
                                        {/* Menu Button */}
                                        <div className="absolute top-3 right-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpenId(menuOpenId === note.id ? null : note.id);
                                                }}
                                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                                aria-label="Options"
                                            >
                                                <FiMoreVertical size={16} />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {menuOpenId === note.id && (
                                                <div
                                                    ref={menuRef}
                                                    className="absolute right-0 top-8 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20 w-32"
                                                >
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(note); }}
                                                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <FiEdit3 size={14} className="text-gray-500" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAboutClick(note); }}
                                                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <FiInfo size={14} className="text-gray-500" />
                                                        <span>Info</span>
                                                    </button>
                                                    <div className="border-t border-gray-100 my-1"></div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <FiTrash2 size={14} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div
                                            onClick={() => handleNoteClick(note)}
                                            className="cursor-pointer pr-8"
                                        >
                                            <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-1">
                                                {note.title || "Untitled"}
                                            </h3>
                                            <p className="text-gray-600 text-xs leading-relaxed line-clamp-2 mb-3">
                                                {note.content || "No content"}
                                            </p>

                                            {/* Footer Info */}
                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        {formatDateTime(
                                                            (note.createdAt && note.updatedAt && note.createdAt.toMillis() !== note.updatedAt.toMillis())
                                                                ? note.updatedAt
                                                                : (note.createdAt || note.updatedAt)
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* About Modal */}
            {showAboutModal && selectedNote && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowAboutModal(false)}
                >
                    <div
                        className="bg-white rounded-lg w-full max-w-xs shadow-lg"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
                            <h3 className="font-medium text-gray-900">Note Info</h3>
                            <button
                                onClick={() => setShowAboutModal(false)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <FiX size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Created</p>
                                <div className="flex items-center gap-2 text-gray-800 text-sm">
                                    <FiCalendar size={14} className="text-gray-400" />
                                    <span>{formatDateTime(selectedNote.createdAt)}</span>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 mb-1">Last Edited</p>
                                <div className="flex items-center gap-2 text-gray-800 text-sm">
                                    <FiEdit3 size={14} className="text-gray-400" />
                                    <span>{formatDateTime(selectedNote.updatedAt)}</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500 mb-2">Statistics</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="text-center p-2 bg-gray-50 rounded">
                                        <p className="text-sm font-medium text-gray-800">
                                            {selectedNote.content ? selectedNote.content.length : 0}
                                        </p>
                                        <p className="text-xs text-gray-500">Characters</p>
                                    </div>
                                    <div className="text-center p-2 bg-gray-50 rounded">
                                        <p className="text-sm font-medium text-gray-800">
                                            {selectedNote.content ? selectedNote.content.trim().split(/\s+/).length : 0}
                                        </p>
                                        <p className="text-xs text-gray-500">Words</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t border-gray-200">
                            <button
                                onClick={() => setShowAboutModal(false)}
                                className="w-full bg-gray-100 text-gray-800 py-2 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}