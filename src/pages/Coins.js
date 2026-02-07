import React, { useState, useEffect } from 'react';
import { useLayoutCache } from '../contexts/GlobalDataCacheContext';
import { db, functions } from '../firebase';
import { doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Layout from '../components/Layout';
import { FiPlay, FiShoppingCart, FiClock } from 'react-icons/fi';

// Helper to load Razorpay script
const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

const CoinPackage = ({ price, coins, onBuy, loading }) => (
    <button
        onClick={() => onBuy(price, coins)}
        disabled={loading}
        className="relative group overflow-hidden bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-blue-500/50 transition-all duration-300 w-full text-left"
    >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex justify-between items-center">
            <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                    {coins.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400 font-medium mt-1">Coins</div>
            </div>
            <div className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                ₹{price}
            </div>
        </div>
    </button>
);

export default function Coins() {
    const { currentUserId } = useLayoutCache();
    const [coins, setCoins] = useState(0);
    const [loading, setLoading] = useState(false);
    const [watchingVideo, setWatchingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);

    useEffect(() => {
        if (!currentUserId) return;

        // Load Razorpay script on mount
        loadRazorpayScript();

        // Real-time listener for coins specific to this page
        const unsub = onSnapshot(doc(db, 'profiles', currentUserId), (doc) => {
            if (doc.exists()) {
                setCoins(doc.data().coins || 0);
            }
        });

        return () => unsub();
    }, [currentUserId]);

    const handleWatchVideo = () => {
        if (watchingVideo) return;
        setWatchingVideo(true);
        setVideoProgress(0);

        // Simulate video watching
        const duration = 3000; // 3 seconds for demo
        const interval = 50;
        const steps = duration / interval;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            setVideoProgress((step / steps) * 100);

            if (step >= steps) {
                clearInterval(timer);
                completeVideo();
            }
        }, interval);
    };

    const completeVideo = async () => {
        try {
            if (!currentUserId) return;
            await updateDoc(doc(db, 'profiles', currentUserId), {
                coins: increment(30)
            });
            setWatchingVideo(false);
        } catch (error) {
            console.error("Error rewarding coins:", error);
            setWatchingVideo(false);
        }
    };

    const initiatePurchase = async (price, amountOfCoins) => {
        if (loading || !currentUserId) return;

        const res = await loadRazorpayScript();
        if (!res) {
            alert('Razorpay SDK failed to load. Are you online?');
            return;
        }

        setLoading(true);

        try {
            // 1. Create Order on Backend
            const createOrder = httpsCallable(functions, 'createOrder');
            const result = await createOrder({ amount: price, currency: 'INR' });

            const { orderId, amount, currency, keyId } = result.data;

            // 2. Open Razorpay Checkout
            const options = {
                key: keyId,
                amount: amount.toString(),
                currency: currency,
                name: "Aerosigil",
                description: `${amountOfCoins} Coins`,
                // image: "https://your-logo-url.com", // Optional
                order_id: orderId,
                handler: async function (response) {
                    // Payment Success!
                    // In a production app, verify signature on backend:
                    // verifyPayment({
                    //   razorpay_payment_id: response.razorpay_payment_id,
                    //   razorpay_order_id: response.razorpay_order_id,
                    //   razorpay_signature: response.razorpay_signature
                    // })

                    // For now, trusting frontend callback to update DB (matches previous logic)
                    await handleSuccess(amountOfCoins);
                },
                prefill: {
                    // name: "User Name", // Can fetch from profile
                    // email: "user@example.com",
                    // contact: "9999999999"
                },
                theme: {
                    color: "#2563EB" // Blue-600
                }
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.description);
                setLoading(false);
            });

            rzp1.open();

        } catch (error) {
            console.error("Error initializing Razorpay:", error);
            alert("Failed to initialize payment. Please try again.");
            setLoading(false);
        }
        // distinct from .finally because Razorpay modal stays open. 
        // We only unset loading on success or explicit failure.
    };

    const handleSuccess = async (newCoins) => {
        try {
            await updateDoc(doc(db, 'profiles', currentUserId), {
                coins: increment(newCoins)
            });
            alert(`Success! ${newCoins} coins added.`);
        } catch (error) {
            console.error("Error updating balance:", error);
            alert("Payment successful but failed to update balance. Please contact support.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="My Wallet" activeTab="coins">
            <div className="min-h-screen bg-gray-50 pb-24">
                {/* Header Section */}
                <div className="bg-white px-6 pt-6 pb-8 rounded-b-[2rem] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <div className="relative text-center">
                        <div className="text-gray-500 font-medium mb-2">Available Balance</div>
                        <div className="text-5xl font-black text-gray-900 tracking-tight flex justify-center items-center gap-2">
                            <span className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full w-10 h-10 flex items-center justify-center text-white text-2xl shadow-lg">
                                ₹
                            </span>
                            {coins.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="px-5 mt-6 space-y-8">
                    {/* Watch & Earn Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FiPlay className="text-red-500" />
                            Watch & Earn
                        </h2>

                        <button
                            onClick={handleWatchVideo}
                            disabled={watchingVideo || loading}
                            className="w-full relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-98 transition-all"
                        >
                            {watchingVideo && (
                                <div
                                    className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-75 ease-linear"
                                    style={{ width: `${videoProgress}%` }}
                                />
                            )}

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                                    {watchingVideo ? <FiClock className="animate-pulse" size={24} /> : <FiPlay size={24} />}
                                </div>
                                <div className="text-left flex-1">
                                    <div className="font-bold text-gray-900">Watch Video Ad</div>
                                    <div className="text-sm text-gray-500">Earn 30 coins instantly</div>
                                </div>
                                <div className="bg-yellow-50 text-yellow-700 font-bold px-3 py-1 rounded-lg text-sm">
                                    +30 🪙
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Buy Coins Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FiShoppingCart className="text-blue-500" />
                            Buy Coins
                        </h2>

                        <div className="grid gap-3">
                            <CoinPackage price={5} coins={600} onBuy={initiatePurchase} loading={loading} />
                            <CoinPackage price={10} coins={1200} onBuy={initiatePurchase} loading={loading} />
                            <CoinPackage price={25} coins={3000} onBuy={initiatePurchase} loading={loading} />
                            <CoinPackage price={50} coins={6200} onBuy={initiatePurchase} loading={loading} />
                            <CoinPackage price={100} coins={12500} onBuy={initiatePurchase} loading={loading} />
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

