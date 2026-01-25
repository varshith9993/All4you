import React, { useState, useEffect } from 'react';
import { useLayoutCache } from '../contexts/GlobalDataCacheContext';
import { db } from '../firebase';
import { doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import Layout from '../components/Layout';
import { FiPlay, FiShoppingCart, FiClock, FiCreditCard, FiSmartphone, FiGift, FiX, FiCheck } from 'react-icons/fi';
// Examples removed

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

const PaymentMethod = ({ icon: Icon, title, onClick, selected }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${selected
            ? 'bg-blue-50 border-blue-500 text-blue-700'
            : 'bg-white border-gray-100 hover:border-gray-200 text-gray-700'
            }`}
    >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <Icon size={20} />
        </div>
        <span className="font-medium flex-1 text-left">{title}</span>
        {selected && <FiCheck className="text-blue-500" size={20} />}
    </button>
);

export default function Coins() {
    const { currentUserId } = useLayoutCache();
    const [coins, setCoins] = useState(0);
    const [loading, setLoading] = useState(false);
    const [watchingVideo, setWatchingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [paymentStep, setPaymentStep] = useState('select'); // select, processing, success
    const [selectedMethod, setSelectedMethod] = useState(null);

    // Mock Inputs
    const [redeemCode, setRedeemCode] = useState('');
    const [cardNumber, setCardNumber] = useState('');

    useEffect(() => {
        if (!currentUserId) return;

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

    const initiatePurchase = (price, amount) => {
        if (loading || !currentUserId) return;
        setSelectedPackage({ price, amount });
        setPaymentStep('select');
        setSelectedMethod(null);
        setRedeemCode('');
        setCardNumber('');
        setShowPaymentModal(true);
    };

    const handlePayment = async () => {
        if (!selectedMethod) return;
        setPaymentStep('processing');
        setLoading(true);

        try {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            await updateDoc(doc(db, 'profiles', currentUserId), {
                coins: increment(selectedPackage.amount)
            });

            setPaymentStep('success');
            setTimeout(() => {
                setShowPaymentModal(false);
                setLoading(false);
                setSelectedPackage(null);
            }, 2000);
        } catch (error) {
            console.error("Payment failed:", error);
            alert("Payment failed. Please try again.");
            setPaymentStep('select');
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

                {/* Payment Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                                <h3 className="font-bold text-lg">Select Payment Method</h3>
                                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                    <FiX size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto">
                                {paymentStep === 'select' && (
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center mb-6">
                                            <div>
                                                <div className="text-sm text-blue-600 font-medium">Buying</div>
                                                <div className="text-xl font-bold text-blue-900">{selectedPackage?.coins.toLocaleString()} Coins</div>
                                            </div>
                                            <div className="text-2xl font-bold text-blue-600">₹{selectedPackage?.price}</div>
                                        </div>

                                        <div className="space-y-3">
                                            <PaymentMethod
                                                icon={FiSmartphone}
                                                title="UPI (GPay, PhonePe, Paytm)"
                                                selected={selectedMethod === 'upi'}
                                                onClick={() => setSelectedMethod('upi')}
                                            />
                                            {selectedMethod === 'upi' && (
                                                <div className="ml-2 pl-4 border-l-2 border-blue-100 space-y-2 animate-in slide-in-from-top-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Enter UPI ID (e.g. name@upi)"
                                                        className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                    />
                                                </div>
                                            )}

                                            <PaymentMethod
                                                icon={FiCreditCard}
                                                title="Credit / Debit Card (Visa, Master, Rupay)"
                                                selected={selectedMethod === 'card'}
                                                onClick={() => setSelectedMethod('card')}
                                            />
                                            {selectedMethod === 'card' && (
                                                <div className="ml-2 pl-4 border-l-2 border-blue-100 space-y-2 animate-in slide-in-from-top-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Card Number"
                                                        className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                        maxLength={19}
                                                        value={cardNumber}
                                                        onChange={(e) => setCardNumber(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <input type="text" placeholder="MM/YY" className="w-1/2 p-3 bg-gray-50 rounded-lg border text-sm" />
                                                        <input type="text" placeholder="CVV" className="w-1/2 p-3 bg-gray-50 rounded-lg border text-sm" />
                                                    </div>
                                                </div>
                                            )}

                                            <PaymentMethod
                                                icon={FiGift}
                                                title="Google Play Redeem Code"
                                                selected={selectedMethod === 'redeem'}
                                                onClick={() => setSelectedMethod('redeem')}
                                            />
                                            {selectedMethod === 'redeem' && (
                                                <div className="ml-2 pl-4 border-l-2 border-blue-100 space-y-2 animate-in slide-in-from-top-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Enter 16-digit code"
                                                        className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono text-sm"
                                                        maxLength={20}
                                                        value={redeemCode}
                                                        onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handlePayment}
                                            disabled={!selectedMethod}
                                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-6 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                        >
                                            Pay ₹{selectedPackage?.price}
                                        </button>
                                    </div>
                                )}

                                {paymentStep === 'processing' && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6" />
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Payment</h3>
                                        <p className="text-gray-500">Please do not close this window...</p>
                                    </div>
                                )}

                                {paymentStep === 'success' && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-300">
                                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                            <FiCheck size={40} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                                        <p className="text-gray-500">
                                            <span className="font-bold text-gray-900">{selectedPackage?.coins.toLocaleString()}</span> coins added to your wallet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
