import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }
    api.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Email verified successfully!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [searchParams]);

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
          <h1 className="font-heading text-2xl font-bold">Email Verification</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-dark-700/50 border border-white/5 rounded-2xl p-8 text-center">
          {status === "loading" && (
            <div className="space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-400">Verifying your email...</p>
            </div>
          )}
          {status === "success" && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-positive/15 border border-positive/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-positive text-2xl">✓</span>
              </div>
              <p className="text-positive font-semibold">{message}</p>
              <Link to="/login" className="inline-block bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all">
                Go to Login
              </Link>
            </div>
          )}
          {status === "error" && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-negative/15 border border-negative/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-negative text-2xl">!</span>
              </div>
              <p className="text-negative">{message}</p>
              <Link to="/" className="inline-block bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all">
                Go Home
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
