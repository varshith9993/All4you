import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { confirmPasswordReset } from "firebase/auth";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  // Firebase usually sends 'oobCode'
  const oobCode = searchParams.get("oobCode");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const validatePassword = (pwd) => {
    if (pwd.length < 6 || pwd.length > 12) {
      return "Password must be 6-12 characters long.";
    }
    return "";
  };

  const handleReset = async () => {
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message || "Invalid or expired reset code.");
    }
  };

  if (!oobCode) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow bg-white text-center">
        <p>Invalid password reset link.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow bg-white">
      <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>

      <div className="relative mb-4">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="New Password"
          className="w-full p-3 border rounded pr-12"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
        </button>
      </div>

      <input
        type={showPassword ? "text" : "password"}
        placeholder="Confirm New Password"
        className="w-full p-3 border rounded mb-2"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <p className="text-xs text-gray-500 mb-4">Password must be 6-12 characters</p>
      <button
        onClick={handleReset}
        className="w-full bg-blue-600 text-white py-3 rounded font-bold"
      >
        Reset Password
      </button>
      {message && <p className="mt-4 text-green-600">{message}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}
