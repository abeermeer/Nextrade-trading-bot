import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-accent-glow via-transparent to-transparent opacity-20" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-wider">NexTrade AI</span>
          </Link>
          <h1 className="font-heading text-2xl font-bold">Forgot Password</h1>
          <p className="text-gray-400 text-sm mt-1">We'll send you a reset link</p>
        </div>

        {sent ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-dark-700/50 border border-white/5 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <p className="text-green-400 font-semibold">Check your email</p>
            <p className="text-gray-400 text-sm">If that email is registered, you'll receive a password reset link.</p>
            <Link to="/login" className="inline-block bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all">
              Back to Login
            </Link>
          </motion.div>
        ) : (
          <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="bg-dark-700/50 border border-white/5 rounded-2xl p-8 space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                placeholder="you@example.com" required
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent-dark text-dark-900 font-bold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Remember your password?{" "}
              <Link to="/login" className="text-accent hover:underline">Sign in</Link>
            </p>
          </motion.form>
        )}
      </div>
    </div>
  );
}
