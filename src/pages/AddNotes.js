import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
    FiArrowLeft,
    FiSave,
    FiCornerUpLeft,
    FiCornerUpRight,
    FiEdit3,
    FiClock
} from "react-icons/fi";
import { useNotesCache } from "../contexts/GlobalDataCacheContext";

export default function AddNotes() {
    const navigate = useNavigate();
    const location = useLocation();
    const { notes } = useNotesCache();
    const [currentUserId, setCurrentUserId] = useState(null);

    // Check if we are editing
    const editingNote = location.state?.note || null;
    const isReadOnly = location.state?.readOnly || false;

    // Note Form State
    const [noteForm, setNoteForm] = useState({
        title: editingNote?.title || "",
        content: editingNote?.content || ""
    });
    const [saving, setSaving] = useState(false);

    // Undo/Redo State
    const [history, setHistory] = useState([{
        title: editingNote?.title || "",
        content: editingNote?.content || ""
    }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Refs
    const titleInputRef = useRef(null);
    const contentTextareaRef = useRef(null);

    // Focus title input on load
    useEffect(() => {
        if (!isReadOnly && titleInputRef.current) {
            setTimeout(() => {
                titleInputRef.current.focus();
            }, 100);
        }
    }, [isReadOnly]);

    // Handle Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUserId(user.uid);
            } else {
                setCurrentUserId(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Track changes for unsaved changes warning
    useEffect(() => {
        const originalTitle = editingNote?.title || "";
        const originalContent = editingNote?.content || "";
        setHasUnsavedChanges(
            noteForm.title !== originalTitle || noteForm.content !== originalContent
        );
    }, [noteForm, editingNote]);

    const updateNoteForm = useCallback((newForm) => {
        setNoteForm(newForm);

        // Add to history - create a new array properly
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push(newForm);
            return newHistory;
        });

        setHistoryIndex(prevIndex => prevIndex + 1);
    }, [historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setNoteForm(history[newIndex]);
        }
    }, [historyIndex, history]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setNoteForm(history[newIndex]);
        }
    }, [historyIndex, history]);

    const handleSaveNote = async () => {
        if (!noteForm.title.trim() && !noteForm.content.trim()) {
            navigate(-1);
            return;
        }

        if (!currentUserId) {
            alert("You must be logged in to save notes.");
            return;
        }

        setSaving(true);
        try {
            const noteData = {
                title: noteForm.title.trim() || "Untitled",
                content: noteForm.content,
                userId: currentUserId,
                updatedAt: serverTimestamp(),
            };

            if (editingNote?.id) {
                await updateDoc(doc(db, "notes", editingNote.id), noteData);
                console.group(`[Action: UPDATE NOTE]`);
                console.log(`%c✔ Note updated successfully`, "color: green; font-weight: bold");
                console.log(`- Reads: 0`);
                console.log(`- Writes: 1`);
                console.groupEnd();
            } else {
                // Check limit before creating new note
                if (notes.length >= 5) {
                    alert("Note Limit Reached: You can only have up to 5 notes. Please delete an existing note to create a new one.");
                    setSaving(false);
                    return;
                }

                noteData.createdAt = serverTimestamp();
                await addDoc(collection(db, "notes"), noteData);
                console.group(`[Action: CREATE NOTE]`);
                console.log(`%c✔ Note created successfully`, "color: green; font-weight: bold");
                console.log(`- Reads: 0`);
                console.log(`- Writes: 1`);
                console.groupEnd();
            }

            setHasUnsavedChanges(false);
            navigate(-1);
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note");
        } finally {
            setSaving(false);
        }
    };

    // Format current date to dd/mm/yyyy hh:mm AM/PM
    const formatCurrentDateTime = () => {
        const now = new Date();

        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear();

        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
    };

    const handleBack = () => {
        if (hasUnsavedChanges) {
            if (window.confirm("You have unsaved changes. Save before leaving?")) {
                handleSaveNote();
            } else {
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-white max-w-md mx-auto flex flex-col">
            {/* Fixed Header */}
            <div className="px-4 py-3 sticky top-0 z-10 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Back"
                    >
                        <FiArrowLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2">
                        {!isReadOnly && (
                            <>
                                <button
                                    onClick={handleUndo}
                                    disabled={historyIndex <= 0}
                                    className={`p-1.5 rounded ${historyIndex <= 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                                    aria-label="Undo"
                                >
                                    <FiCornerUpLeft size={18} />
                                </button>
                                <button
                                    onClick={handleRedo}
                                    disabled={historyIndex >= history.length - 1}
                                    className={`p-1.5 rounded ${historyIndex >= history.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                                    aria-label="Redo"
                                >
                                    <FiCornerUpRight size={18} />
                                </button>

                                <button
                                    onClick={handleSaveNote}
                                    disabled={saving}
                                    className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    aria-label="Save"
                                >
                                    {saving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                            <span>Saving</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiSave size={14} />
                                            <span>Save</span>
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                        {isReadOnly && (
                            <button
                                onClick={() => navigate("/add-notes", {
                                    state: {
                                        note: editingNote,
                                        readOnly: false
                                    }
                                })}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                                <FiEdit3 size={14} />
                                <span>Edit</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4">
                    {/* Title Input */}
                    <input
                        ref={titleInputRef}
                        type="text"
                        placeholder={!isReadOnly ? "Title" : ""}
                        value={noteForm.title}
                        onChange={(e) => updateNoteForm({ ...noteForm, title: e.target.value })}
                        readOnly={isReadOnly}
                        className="w-full text-xl font-semibold text-gray-900 placeholder-gray-400 border-none outline-none bg-transparent mb-3 focus:placeholder-gray-300"
                        style={{ lineHeight: '1.3' }}
                    />

                    {/* Last Updated & Info */}
                    <div className="text-xs text-gray-400 mb-4 flex flex-wrap items-center gap-2">
                        {/* Always show current date/time */}
                        <div className="flex items-center gap-1">
                            <FiClock size={10} />
                            <span>{formatCurrentDateTime()}</span>
                        </div>

                        {!isReadOnly && hasUnsavedChanges && (
                            <>
                                <span>•</span>
                                <span className="text-amber-500 font-medium">Unsaved changes</span>
                            </>
                        )}

                        <span>•</span>
                        <span>{noteForm.content.length} characters</span>
                    </div>

                    {/* Content Textarea */}
                    <textarea
                        ref={contentTextareaRef}
                        placeholder={isReadOnly ? "" : "Start typing..."}
                        value={noteForm.content}
                        onChange={(e) => updateNoteForm({ ...noteForm, content: e.target.value })}
                        readOnly={isReadOnly}
                        className="w-full text-gray-700 placeholder-gray-400 border-none outline-none bg-transparent resize-none"
                        style={{
                            minHeight: 'calc(100vh - 180px)',
                            lineHeight: '1.5',
                            fontSize: '15px',
                            letterSpacing: '-0.01em'
                        }}
                    />
                </div>
            </div>
        </div>
    );
}