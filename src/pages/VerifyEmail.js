import React, { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState("verifying"); // verifying, success, error
    const [error, setError] = useState("");

    useEffect(() => {
        const verify = async () => {
            const mode = searchParams.get("mode");
            const oobCode = searchParams.get("oobCode");

            if (mode !== "verifyEmail" || !oobCode) {
                setStatus("error");
                setError("Invalid verification link.");
                return;
            }

            try {
                await applyActionCode(auth, oobCode);
                setStatus("success");
                // Reload user to update emailVerified status locally if they are logged in
                if (auth.currentUser) {
                    await auth.currentUser.reload();
                }
                setTimeout(() => {
                    navigate("/workers");
                }, 2000); // Short delay to show success message
            } catch (err) {
                console.error(err);
                setStatus("error");
                setError(err.message || "Verification failed. Link may be expired.");
            }
        };

        verify();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center animate-fade-in">

                {status === "verifying" && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Verifying Email...</h2>
                        <p className="text-gray-500">Please wait while we verify your account.</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 text-3xl">
                            ✓
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Email Verified!</h2>
                        <p className="text-gray-500 mb-6">Redirecting you to the app...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 text-3xl">
                            ✕
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification Failed</h2>
                        <p className="text-red-500 mb-6">{error}</p>
                        <button
                            onClick={() => navigate("/login")}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
