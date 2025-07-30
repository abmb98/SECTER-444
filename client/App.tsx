import "./global.css";

import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { LoginForm } from "@/components/LoginForm";
import { UserSetupDialog } from "@/components/UserSetupDialog";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FirebaseStatus } from "@/components/FirebaseStatus";
import { NetworkStatus } from "@/components/NetworkStatus";
import { FirebaseErrorBoundary } from "@/components/FirebaseErrorBoundary";
import { FirebaseConnectionMonitor } from "@/components/FirebaseConnectionMonitor";
import { suppressWarnings } from "@/utils/warningSuppressionUtils";

// Apply warning suppression immediately at module load
suppressWarnings();

// Development-only: Completely override React warnings if they persist
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    // Convert all arguments to strings for checking
    const fullMessage = args.join(' ');
    const message = String(args[0] || '');
    const componentName = String(args[1] || '');

    // Comprehensive suppression of Recharts defaultProps warnings
    const isDefaultPropsWarning =
      message.includes('defaultProps') ||
      message.includes('Support for defaultProps will be removed') ||
      fullMessage.includes('defaultProps') ||
      fullMessage.includes('Support for defaultProps will be removed');

    const isRechartsComponent =
      componentName === 'XAxis' ||
      componentName === 'YAxis' ||
      componentName === 'XAxis2' ||
      componentName === 'YAxis2' ||
      componentName.includes('Axis') ||
      componentName.includes('Chart') ||
      fullMessage.includes('XAxis') ||
      fullMessage.includes('YAxis') ||
      fullMessage.includes('recharts') ||
      message.includes('%s');

    // Suppress all Recharts defaultProps warnings
    if (isDefaultPropsWarning && isRechartsComponent) {
      return; // Completely suppress in development
    }

    // Also suppress any warning that mentions XAxis or YAxis specifically
    if (fullMessage.includes('XAxis') || fullMessage.includes('YAxis')) {
      return;
    }

    originalWarn.apply(console, args);
  };
}

import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import Rooms from "./pages/Rooms";
import Fermes from "./pages/Fermes";
import Stock from "./pages/Stock";
import Statistics from "./pages/Statistics";
import AdminTools from "./pages/AdminTools";
import SuperAdminSetup from "./pages/SuperAdminSetup";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [showFirebaseStatus, setShowFirebaseStatus] = useState(false);

  useEffect(() => {
    // Show setup dialog if user is authenticated but profile is incomplete
    if (isAuthenticated && user) {
      const isIncomplete = !user.nom || user.nom === 'Utilisateur' || !user.telephone;
      setShowSetup(isIncomplete);
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginForm />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Layout>
        {showFirebaseStatus && (
          <div className="mb-4">
            <FirebaseStatus onRetry={() => setShowFirebaseStatus(false)} />
          </div>
        )}
        {children}
        <UserSetupDialog
          open={showSetup}
          onClose={() => setShowSetup(false)}
        />
      </Layout>
    </ErrorBoundary>
  );
};

const ProtectedRouteWithoutLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    // Show setup dialog if user is authenticated but profile is incomplete
    if (isAuthenticated && user) {
      const isIncomplete = !user.nom || user.nom === 'Utilisateur' || !user.telephone;
      setShowSetup(isIncomplete);
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginForm />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {children}
      <UserSetupDialog
        open={showSetup}
        onClose={() => setShowSetup(false)}
      />
    </ErrorBoundary>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/fermes" element={
        <ProtectedRoute>
          <Fermes />
        </ProtectedRoute>
      } />
      <Route path="/ouvriers" element={
        <ProtectedRoute>
          <Workers />
        </ProtectedRoute>
      } />
      <Route path="/chambres" element={
        <ProtectedRoute>
          <Rooms />
        </ProtectedRoute>
      } />
      <Route path="/stock" element={
        <ProtectedRoute>
          <Stock />
        </ProtectedRoute>
      } />
      <Route path="/statistiques" element={
        <ProtectedRoute>
          <Statistics />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminTools />
        </ProtectedRoute>
      } />
      <Route path="/admin-tools" element={
        <ProtectedRoute>
          <AdminTools />
        </ProtectedRoute>
      } />
      <Route path="/super-admin-setup" element={<SuperAdminSetup />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/parametres" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  // Apply global warning suppression for Recharts
  useEffect(() => {
    const cleanup = suppressWarnings();
    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <NetworkStatus />
          <FirebaseConnectionMonitor />
          <FirebaseErrorBoundary>
            <AuthProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AuthProvider>
          </FirebaseErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
