import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { usePreferences } from './hooks/usePreferences';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load pages for better initial bundle size
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const Home = React.lazy(() => import('./pages/Home'));
const Journal = React.lazy(() => import('./pages/Journal'));
const Settings = React.lazy(() => import('./pages/Settings'));

export default function App() {
  const { profile, isLoading } = usePreferences();

  if (isLoading) {
    return (
      <div className="page">
        <div className="glass p-lg w-full text-center">
          <p>Waking Emoh up...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <React.Suspense fallback={<div className="page">Loading...</div>}>
          <Routes>
            <Route 
              path="/" 
              element={
                profile?.onboardingComplete 
                  ? <Home profile={profile} /> 
                  : <Navigate to="/onboarding" replace />
              } 
            />
            <Route 
              path="/onboarding" 
              element={
                profile?.onboardingComplete 
                  ? <Navigate to="/" replace /> 
                  : <Onboarding profile={profile} />
              } 
            />
            <Route 
              path="/journal" 
              element={
                profile?.onboardingComplete 
                  ? <Journal /> 
                  : <Navigate to="/onboarding" replace />
              } 
            />
            <Route 
              path="/settings" 
              element={
                profile?.onboardingComplete 
                  ? <Settings /> 
                  : <Navigate to="/onboarding" replace />
              } 
            />
          </Routes>
        </React.Suspense>
      </Router>
    </ErrorBoundary>
  );
}
