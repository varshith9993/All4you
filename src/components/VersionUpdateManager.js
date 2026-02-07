import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone } from 'lucide-react';
import packageJson from '../../package.json';

const VersionUpdateManager = ({ children }) => {
    // State management
    const [status, setStatus] = useState('checking'); // checking, up-to-date, prompt-auto, update-available, mandatory-update
    const [remoteVersion, setRemoteVersion] = useState(null);
    const [storeUrl, setStoreUrl] = useState('');
    const [canSkip, setCanSkip] = useState(true);

    // Config
    const CURRENT_VERSION = packageJson.version;
    const PLATFORM = Capacitor.getPlatform(); // 'web', 'ios', 'android'
    const COLLECTION_NAME = 'app_settings';
    const DOC_NAME = 'version_info';

    // Helper: Compare semantic versions (v1 > v2 ?)
    const isUpdateAvailable = (current, latest) => {
        if (!latest) return false;
        const v1 = current.split('.').map(Number);
        const v2 = latest.split('.').map(Number);

        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const num1 = v1[i] || 0;
            const num2 = v2[i] || 0;
            if (num2 > num1) return true;
            if (num1 > num2) return false;
        }
        return false;
    };

    // Helper: Save preference
    const saveAutoUpdatePreference = (enabled) => {
        localStorage.setItem('auto_update_enabled', JSON.stringify(enabled));
    };

    // Helper: Get preference
    const getAutoUpdatePreference = () => {
        const pref = localStorage.getItem('auto_update_enabled');
        return pref ? JSON.parse(pref) : null;
    };

    // Helper: Perform Update
    const performUpdate = (url) => {
        if (!url) return;
        window.open(url, '_system');
    };

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // 1. Fetch Remote Config
                const docRef = doc(db, COLLECTION_NAME, DOC_NAME);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    // No version config found - silently continue
                    setStatus('up-to-date');
                    return;
                }

                const data = docSnap.data();
                const latestVersion = PLATFORM === 'ios' ? data.ios_version : (PLATFORM === 'android' ? data.android_version : data.web_version) || data.version;
                const updateUrl = PLATFORM === 'ios' ? data.ios_url : (PLATFORM === 'android' ? data.android_url : data.web_url);
                const isMandatory = data.force_update || false;

                setRemoteVersion(latestVersion);
                setStoreUrl(updateUrl);
                setCanSkip(!isMandatory);

                // 2. Compare Versions
                if (isUpdateAvailable(CURRENT_VERSION, latestVersion)) {
                    // Update IS available
                    const autoUpdatePref = getAutoUpdatePreference();

                    if (autoUpdatePref === true) {
                        // User opted for "Auto Update"
                        // Since we can't silently install, we show a brief "Updating..." then redirect
                        // OR if mandatory, we just treat like update-available but proceed faster
                        setStatus('auto-updating');
                        setTimeout(() => performUpdate(updateUrl), 1500);
                    } else {
                        // Regular flow
                        setStatus(isMandatory ? 'mandatory-update' : 'update-available');
                    }
                } else {
                    // Up to date. Check if first run setting is needed.
                    const autoUpdatePref = getAutoUpdatePreference();
                    if (autoUpdatePref === null) {
                        setStatus('prompt-auto');
                    } else {
                        setStatus('up-to-date');
                    }
                }

            } catch (error) {
                // Silently fail - version checking is optional
                // This prevents console errors when Firestore rules block access
                setStatus('up-to-date');
            }
        };

        checkVersion();
    }, [CURRENT_VERSION, PLATFORM]);


    // RENDER LOGIC

    if (status === 'up-to-date') {
        return children;
    }

    // Modal Components
    const Overlay = ({ children }) => (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in-opacity">
            {children}
        </div>
    );

    const Card = ({ children, title, icon: Icon, color = "blue" }) => {
        const colorStyles = {
            blue: {
                gradient: "from-blue-500",
                bg: "bg-blue-100 dark:bg-blue-900/30",
                text: "text-blue-600 dark:text-blue-400"
            },
            indigo: {
                gradient: "from-indigo-500",
                bg: "bg-indigo-100 dark:bg-indigo-900/30",
                text: "text-indigo-600 dark:text-indigo-400"
            }
        };

        const theme = colorStyles[color] || colorStyles.blue;

        return (
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in">
                <div className={`h-2 w-full bg-gradient-to-r ${theme.gradient} to-indigo-600`} />
                <div className="p-6 text-center">
                    <div className={`mx-auto w-16 h-16 rounded-full ${theme.bg} flex items-center justify-center mb-4`}>
                        <Icon className={`w-8 h-8 ${theme.text}`} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
                    {children}
                </div>
            </div>
        );
    };

    if (status === 'prompt-auto') {
        return (
            <>
                {children}
                <Overlay>
                    <Card title="Enable Auto Updates?" icon={Smartphone} color="indigo">
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Would you like the app to automatically check and apply updates when available?
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => {
                                    saveAutoUpdatePreference(false);
                                    setStatus('up-to-date');
                                }}
                                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                No Thanks
                            </button>
                            <button
                                onClick={() => {
                                    saveAutoUpdatePreference(true);
                                    setStatus('up-to-date');
                                }}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Yes, Enable
                            </button>
                        </div>
                    </Card>
                </Overlay>
            </>
        );
    }

    if (status === 'mandatory-update' || status === 'update-available') {
        return (
            // Note: If mandatory, we DON'T render children to block interaction.
            // If optional (update-available), we technically DO render children behind the overlay?
            // Initial req: "user must update to continue". So we BLOCK.
            <>
                {!canSkip && <div className="hidden">{children}</div>}
                {canSkip && children}
                <Overlay>
                    <Card title="Update Available" icon={Download} color="blue">
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                            A new version ({remoteVersion}) is available.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {canSkip ? "We recommend updating for the best experience." : "This update is required to continue using the app."}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => performUpdate(storeUrl)}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                Update Now
                            </button>

                            {canSkip && (
                                <button
                                    onClick={() => setStatus('up-to-date')}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                                >
                                    Skip for now
                                </button>
                            )}
                        </div>
                    </Card>
                </Overlay>
            </>
        );
    }

    if (status === 'auto-updating') {
        return (
            <Overlay>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                    <h2 className="text-xl font-bold text-white">Starting Update...</h2>
                </div>
            </Overlay>
        );
    }

    return children;
};

export default VersionUpdateManager;
