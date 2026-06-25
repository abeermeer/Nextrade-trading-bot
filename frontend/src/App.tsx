import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./context/AuthContext";
import { WalletProvider } from "./context/WalletContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnimatePresence, motion } from "framer-motion";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const Positions = lazy(() => import("./pages/Positions"));
const Signals = lazy(() => import("./pages/Signals"));
const Trades = lazy(() => import("./pages/Trades"));
const Docs = lazy(() => import("./pages/Docs"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Whitepaper = lazy(() => import("./pages/Whitepaper"));
const About = lazy(() => import("./pages/About"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Security = lazy(() => import("./pages/Security"));
const StrategyPerformance = lazy(() => import("./pages/StrategyPerformance"));
const Backtesting = lazy(() => import("./pages/Backtesting"));
const Status = lazy(() => import("./pages/Status"));
const Subscribe = lazy(() => import("./pages/Subscribe"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchInterval: 5000, retry: 2 } },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-accent animate-pulse" />
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
              <Route path="/signals" element={<ProtectedRoute><Signals /></ProtectedRoute>} />
              <Route path="/trades" element={<ProtectedRoute><Trades /></ProtectedRoute>} />
              <Route path="/strategy-performance" element={<ProtectedRoute><StrategyPerformance /></ProtectedRoute>} />
              <Route path="/backtesting" element={<ProtectedRoute><Backtesting /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/whitepaper" element={<Whitepaper />} />
              <Route path="/about" element={<About />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/security" element={<Security />} />
              <Route path="/status" element={<Status />} />
              <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <WalletProvider>
                <AnimatedRoutes />
              </WalletProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
