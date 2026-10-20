import React, { Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router";

import MainNavigation from "./shared/components/Navigation/MainNavigation";
import { StatusLine } from "./shared/components/UIElements/LoadState";
import { GuestOnly, RequireAuth } from "./shared/components/RouteGuards";
import { AuthContext } from "./shared/context/auth-context";
import { useAuth } from "./shared/hooks/auth-hook";

const LandingPage = React.lazy(() => import("./landing_page/pages/LandingPage"));
const Users = React.lazy(() => import("./user/pages/Users"));
const NewScene = React.lazy(() => import("./scenes/pages/NewScene"));
const UserScenes = React.lazy(() => import("./scenes/pages/UserScenes"));
const ScenePage = React.lazy(() => import("./scenes/pages/ScenePage"));
const UpdateScene = React.lazy(() => import("./scenes/pages/UpdateScene"));
const Login = React.lazy(() => import("./user/pages/Login"));
const Signup = React.lazy(() => import("./user/pages/SignUp"));

const App = () => {
  const { token, login, logout, userId, sessionEnded } = useAuth();

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: !!token, token, userId, sessionEnded, login, logout }}
    >
      <Router>
        <MainNavigation />
        <main>
          <Suspense fallback={<StatusLine>Loading…</StatusLine>}>
            <Routes>
              {/* Signed in, home is "Your scenes"; signed out, the landing page. */}
              <Route path="/" element={token ? <UserScenes own /> : <LandingPage />} />
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/users" element={<Users />} />
              <Route path="/:userId/scenes" element={<UserScenes />} />
              <Route
                path="/scenes/new"
                element={
                  <RequireAuth>
                    <NewScene />
                  </RequireAuth>
                }
              />
              <Route path="/scenes/:sceneId" element={<ScenePage />} />
              <Route
                path="/scenes/:sceneId/edit"
                element={
                  <RequireAuth>
                    <UpdateScene />
                  </RequireAuth>
                }
              />
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <Login />
                  </GuestOnly>
                }
              />
              <Route
                path="/signup"
                element={
                  <GuestOnly>
                    <Signup />
                  </GuestOnly>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
