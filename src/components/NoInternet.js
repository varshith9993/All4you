import React from 'react';

const NoInternet = ({ onRefresh }) => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center animate-fade-in">
            <div className="mb-6 rounded-full bg-red-50 p-6">
                <svg
                    className="h-16 w-16 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                    />
                </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">
                No Internet Connection
            </h2>
            <p className="mb-8 text-gray-600">
                No internet connection or the internet is too slow.
            </p>
            <button
                onClick={onRefresh}
                className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95"
            >
                Refresh
            </button>
        </div>
    );
};

export default NoInternet;
