import React, { useEffect } from "react";
import { ArrowLeft, Shield, Lock, Eye, Globe, Server, FileText, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
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
                        <h1 className="text-lg font-bold text-gray-900">Privacy Policy</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">

                {/* Last Updated */}
                <div className="text-center mb-8 px-2">
                    <p className="text-gray-500 text-sm">
                        Last Updated: January 14, 2026
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                        Effective Date: January 14, 2026
                    </p>
                </div>

                {/* Introduction */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-indigo-900 text-sm leading-relaxed">
                        Welcome to <strong>AeroSigil</strong>. We respect your privacy and are committed to protecting your personal data.
                        This privacy policy explains how we look after your personal data when you visit our application (Android, iOS, and Web)
                        and tells you about your privacy rights and how the law protects you.
                    </p>
                </div>

                {/* 1. Information We Collect */}
                <Section title="1. Information We Collect" icon={FileText}>
                    <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
                    <ul className="list-disc pl-5 space-y-1 marker:text-indigo-500">
                        <li><strong>Identity Data:</strong> Includes username, first name, last name.</li>
                        <li><strong>Contact Data:</strong> Includes email address and telephone numbers.</li>
                        <li><strong>Location Data:</strong> We collect your real-time location (latitude and longitude) to connect you with nearby workers and services.</li>
                        <li><strong>Technical Data:</strong> Includes internet protocol (IP) address, login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this app.</li>
                        <li><strong>Usage Data:</strong> Includes information about how you use our app, products, and services.</li>
                    </ul>
                </Section>

                {/* 2. How We Use Your Information */}
                <Section title="2. How We Use Your Information" icon={Server}>
                    <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
                    <ul className="list-disc pl-5 space-y-1 marker:text-indigo-500">
                        <li>To register you as a new user.</li>
                        <li>To provide the services you requested (connecting workers and clients).</li>
                        <li>To manage our relationship with you including notifying you about changes to our terms or privacy policy.</li>
                        <li>To administer and protect our business and this app (including troubleshooting, data analysis, testing, system maintenance, support, reporting and hosting of data).</li>
                        <li>To deliver relevant content and advertisements to you and measure or understand the effectiveness of the advertising we serve to you.</li>
                    </ul>
                </Section>

                {/* 3. Advertising */}
                <Section title="3. Advertising & Payments" icon={Eye}>
                    <p>
                        <strong>Advertising:</strong> We may use third-party advertising companies to serve ads when you visit our app. These companies may use information regarding your use of this and other apps in order to provide advertisements about goods and services of interest to you.
                    </p>
                    <p className="mt-2">
                        <strong>Payments:</strong> For in-app subscriptions or purchases, we use third-party services (e.g. Google Play, App Store). We do not store or collect your payment card details. That information is provided directly to our third-party payment processors whose use of your personal information is governed by their Privacy Policy.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                        * Note: User-to-user payments (for services) are offline/direct and are not processed by AeroSigil. We are not responsible for these transactions.
                    </p>
                </Section>

                {/* 4. Disclosure of Your Information */}
                <Section title="4. Sharing Your Information" icon={Globe}>
                    <p>We may share your personal data with the parties set out below:</p>
                    <ul className="list-disc pl-5 space-y-1 marker:text-indigo-500">
                        <li><strong>Service Providers:</strong> Workers or Clients you choose to interact with on the platform along with valid contact details.</li>
                        <li><strong>Third Parties:</strong> Service providers who provide IT and system administration services, and advertising networks.</li>
                        <li><strong>Legal Requirements:</strong> If required by law or in response to valid requests by public authorities (e.g., a court or a government agency).</li>
                    </ul>
                </Section>

                {/* 5. Data Security */}
                <Section title="5. Data Security" icon={Lock}>
                    <p>
                        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
                    </p>
                </Section>

                {/* 6. Children's Privacy */}
                <Section title="6. Children's Privacy" icon={Shield}>
                    <p>
                        Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us.
                    </p>
                </Section>

                {/* 7. International Transfers */}
                <Section title="7. International Transfers" icon={Globe}>
                    <p>
                        Your information, including Personal Data, is processed at the Company's operating offices and in any other places where the parties involved in the processing are located. It means that this information may be transferred to — and maintained on — computers located outside of Your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from Your jurisdiction.
                    </p>
                    <p className="mt-2">
                        If you are located outside India and choose to provide information to us, please note that we transfer the data, including Personal Data, to India and process it there.
                    </p>
                </Section>

                {/* 8. Contact Us */}
                <Section title="8. Contact Us" icon={Mail}>
                    <p>If you have any questions about this Privacy Policy, please contact us:</p>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3 mt-2">
                        <Mail size={18} className="text-gray-400" />
                        <span className="font-medium text-gray-700">support@aerosigil.com</span>
                    </div>
                </Section>

                {/* Footer */}
                <div className="pt-6 pb-10 text-center">
                    <p className="text-xs text-gray-400 mb-4">
                        By using the AeroSigil app, you agree to the collection and use of information in accordance with this policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
