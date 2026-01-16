import React, { useEffect } from "react";
import { ArrowLeft, Shield, AlertTriangle, Scale, CreditCard, UserCheck, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsAndConditions() {
    const navigate = useNavigate();

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Reusable Section Component
    const Section = ({ title, icon: Icon, children, className = "" }) => (
        <section className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${className}`}>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Icon size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3">
                {children}
            </div>
        </section>
    );

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 pb-10">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 active:scale-95"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <h1 className="text-lg font-bold text-gray-900">Terms of Service</h1>
                    </div>
                    <button
                        onClick={() => navigate("/privacy-policy")}
                        className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
                    >
                        Privacy Policy
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">

                {/* Introduction / Acceptance */}
                <div className="text-center mb-8 px-2">
                    <p className="text-gray-500 text-sm">
                        Please read these terms carefully before using the ServePure application.
                    </p>
                </div>

                {/* Critical Disclaimer - Highlighted */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex gap-3 items-start">
                        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                        <div className="space-y-2">
                            <h3 className="font-bold text-amber-900 text-base">Key Disclaimer</h3>
                            <div className="text-sm text-amber-800/90 leading-relaxed">
                                ServePure is purely a <strong>connection platform</strong>. We do not provide the services listed, employing no service providers directly. We are <strong>not responsible</strong> for:
                                <ul className="list-disc pl-4 mt-2 space-y-1 text-amber-900/80">
                                    <li>Quality or safety of services provided.</li>
                                    <li>Financial disputes or payment failures.</li>
                                    <li>Personal injury or property damage.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. Platform Purpose */}
                <Section title="1. Platform Nature" icon={Shield}>
                    <p>
                        ServePure operates as a marketplace to connect users ("Clients") with independent service providers ("Workers").
                        ServePure is not a party to any service contract between Clients and Workers.
                    </p>
                    <p className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-500 uppercase tracking-wide font-semibold">
                        ServePure does not guarantee the truthfulness of user profiles or the quality of service.
                    </p>
                </Section>

                {/* 2. User Accounts */}
                <Section title="2. User Accounts & Security" icon={UserCheck}>
                    <p>
                        You are responsible for maintaining the confidentiality of your account credentials. You agree to:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 marker:text-indigo-500">
                        <li>Provide accurate, current, and complete information during registration.</li>
                        <li>Update your information to keep it accurate.</li>
                        <li>Notify us immediately of any unauthorized use of your account.</li>
                        <li>Not share your account with others.</li>
                    </ul>
                </Section>

                {/* 3. Payments */}
                <Section title="3. Financial Terms" icon={CreditCard}>
                    <p>
                        <strong>Direct Payments:</strong> ServePure is a connection-only platform. All payments, fees, and pricing are negotiated and transacted solely between the Client and the Worker.
                    </p>
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-red-700 text-xs font-semibold">
                            WE DO NOT PROCESS PAYMENTS AND ARE NOT LIABLE FOR REFUNDS OR FRAUD.
                        </p>
                    </div>
                </Section>

                {/* 4. Prohibited Activities */}
                <Section title="4. Prohibited Conduct" icon={Ban}>
                    <p>Users adhere to a code of conduct. You agree NOT to:</p>
                    <ul className="list-disc pl-5 space-y-1 marker:text-red-500">
                        <li>Harass, abuse, or harm another person.</li>
                        <li>Use the app for any illegal purpose or solicitation of illegal acts.</li>
                        <li>Post false or misleading information.</li>
                        <li>Attempt to reverse engineer the application.</li>
                    </ul>
                </Section>

                {/* 5. Limitation of Liability */}
                <Section title="5. Limitation of Liability" icon={Scale}>
                    <p className="uppercase text-xs font-bold text-gray-400 mb-1">Strict Liability Limit</p>
                    <p>
                        To the fullest extent permitted by law, ServePure shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
                    </p>
                </Section>

                {/* Footer / Contact */}
                <div className="pt-6 pb-10 text-center">
                    <p className="text-xs text-gray-400 mb-4">
                        By continuing to use ServePure, you acknowledge that you have read and understood these terms.
                    </p>
                </div>
            </div>
        </div>
    );
}
