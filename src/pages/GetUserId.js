import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function GetUserId() {
    const [userId, setUserId] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setUserId(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(userId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">Your User ID</h1>

                {userId ? (
                    <>
                        <div className="bg-gray-100 p-4 rounded-xl mb-4 break-all font-mono text-sm border-2 border-indigo-200">
                            {userId}
                        </div>

                        <button
                            onClick={copyToClipboard}
                            className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg"
                        >
                            {copied ? "✓ Copied!" : "Copy User ID"}
                        </button>

                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <h2 className="font-bold text-blue-900 mb-2">Next Steps:</h2>
                            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                                <li>Copy your User ID above</li>
                                <li>Go to Firebase Console → Firestore Database</li>
                                <li>Open the "workers" collection</li>
                                <li>For each worker document, add a field:
                                    <ul className="ml-6 mt-1 list-disc">
                                        <li>Field name: <code className="bg-white px-1 rounded">createdBy</code></li>
                                        <li>Field value: Paste your User ID</li>
                                    </ul>
                                </li>
                                <li>Save each document</li>
                            </ol>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p>Loading your User ID...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
