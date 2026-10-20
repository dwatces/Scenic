import React, { Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router";

import MainNavigation from "./shared/components/Navigation/MainNavigation";
import LoadingSpinner from "./shared/components/UIElements/LoadingSpinner";
import { AuthContext } from "./shared/context/auth-context";
import { useAuth } from "./shared/hooks/auth-hook";

const LandingPage = React.lazy(() =>
  import("./landing_page/pages/LandingPage")
);
const Users = React.lazy(() => import("./user/pages/Users"));
const NewScene = React.lazy(() => import("./scenes/pages/NewScene"));
const UserScenes = React.lazy(() => import("./scenes/pages/UserScenes"));
const UpdateScene = React.lazy(() => import("./scenes/pages/UpdateScene"));
const Login = React.lazy(() => import("./user/pages/Login"));
const Signup = React.lazy(() => import("./user/pages/SignUp"));

const App = () => {
  const { token, login, logout, userId } = useAuth();

  const routes = token ? (
    <Routes>
      <Route path="/" element={<UserScenes id={userId} />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/users" element={<Users />} />
      <Route path="/:userId/scenes" element={<UserScenes />} />
      <Route path="/scenes/new" element={<NewScene />} />
      <Route path="/scenes/:sceneId" element={<UpdateScene />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/users" element={<Users />} />
      <Route path="/:userId/scenes" element={<UserScenes />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!token,
        token: token,
        userId: userId,
        login: login,
        logout: logout,
      }}
    >
      <Router>
        <MainNavigation />
        <main>
          <Suspense
            fallback={
              <div className="center">
                <LoadingSpinner />
              </div>
            }
          >
            {routes}
          </Suspense>
        </main>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
