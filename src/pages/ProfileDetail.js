import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function ProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);

  useEffect(() => {
    if (!id) return;
    const workerRef = doc(db, "workers", id);
    const unsubscribe = onSnapshot(workerRef, (snap) => {
      setWorker(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsubscribe();
  }, [id]);

  if (worker === null) {
    return <div className="p-6">Worker not found.</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-2 text-blue-600 underline"
      >
        ← Back
      </button>
      <div className="flex items-center mb-4">
        <img
          src={worker.avatarUrl || "/default-user.png"}
          alt={worker.name || "Profile"}
          className="w-20 h-20 rounded-full border mr-4"
        />
        <div>
          <h2 className="text-2xl font-bold">{worker.title || "Untitled"}</h2>
          <div className="flex flex-wrap gap-2 mt-1">
            {worker.tags?.map((tag, idx) => (
              <span
                key={idx}
                className="bg-gray-200 px-2 py-1 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {worker.location?.area}, {worker.location?.landmark}
          </p>
          <p className="text-sm text-gray-500">
            {worker.location?.city} - {worker.location?.pincode}
          </p>
        </div>
      </div>
      <div className="mb-4">{worker.description}</div>
      <div className="mb-4">
        <div className="font-semibold mb-1">Images / Files</div>
        <div className="flex flex-wrap gap-2">
          {worker.files?.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`File ${idx + 1}`}
              className="w-24 h-24 border rounded"
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button className="border py-1 px-3 rounded hover:bg-gray-100">
          Add Favorite
        </button>
        <button className="border py-1 px-3 rounded hover:bg-gray-100">
          Share
        </button>
        <button className="border py-1 px-3 rounded hover:bg-gray-100">
          Rate
        </button>
        <button className="border py-1 px-3 rounded hover:bg-gray-100">
          Chat
        </button>
      </div>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 shadow">
        <div>👥</div>
        <div>⚙️</div>
        <div>📢</div>
        <div>💬</div>
        <div>👤</div>
      </nav>
    </div>
  );
}
