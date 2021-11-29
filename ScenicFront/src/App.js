import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Route,
  Redirect,
  Switch,
} from "react-router-dom";

import MainNavigation from "./shared/components/Navigation/MainNavigation";
import LoadingSpinner from "./shared/components/UIElements/LoadingSpinner";
import { AuthContext } from "./shared/context/auth-context";
import { useAuth } from "./shared/hooks/auth-hook";
import { initializeApp } from "firebase/app";

const LandingPage = React.lazy(() =>
  import("./landing_page/pages/LandingPage")
);
const Users = React.lazy(() => import("./user/pages/Users"));
const NewScene = React.lazy(() => import("./scenes/pages/NewScene"));
const UserScenes = React.lazy(() => import("./scenes/pages/UserScenes"));
const UpdateScene = React.lazy(() => import("./scenes/pages/UpdateScene"));
const Login = React.lazy(() => import("./user/pages/Login"));
const Signup = React.lazy(() => import("./user/pages/SignUp"));

const firebaseConfig = {
  apiKey: "AIzaSyB5lO7dgs92sXhbqUXuM6YhVdysaBMS5_Q",
  authDomain: "scenic-16511.firebaseapp.com",
  projectId: "scenic-16511",
  storageBucket: "scenic-16511.appspot.com",
  messagingSenderId: "722906412107",
  appId: "1:722906412107:web:32802b59e8c6b9e99c89ce",
  measurementId: "G-XV235VDH3Q",
};

const app = initializeApp(firebaseConfig);

const App = () => {
  const { token, login, logout, userId } = useAuth();

  let routes;

  if (token) {
    routes = (
      <Switch>
        {!!token ? (
          <Route path="/" exact>
            <UserScenes id={userId} />
          </Route>
        ) : (
          <Route path="/" exact>
            <LandingPage />
          </Route>
        )}
        <Route path="/landing" exact>
          <LandingPage />
        </Route>
        <Route path="/users" exact>
          <Users />
        </Route>
        <Route path="/:userId/scenes" exact>
          <UserScenes />
        </Route>
        <Route path="/scenes/new" exact>
          <NewScene />
        </Route>
        <Route path="/scenes/:sceneId">
          <UpdateScene />
        </Route>
        <Redirect to="/" />
      </Switch>
    );
  } else {
    routes = (
      <Switch>
        <Route path="/" exact>
          <LandingPage />
        </Route>
        <Route path="/users" exact>
          <Users />
        </Route>
        <Route path="/:userId/scenes" exact>
          <UserScenes />
        </Route>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/signup">
          <Signup />
        </Route>
        <Redirect to="/login" />
      </Switch>
    );
  }

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
