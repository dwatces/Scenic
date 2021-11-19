import { createContext } from "react";

export const AuthContext = createContext({
  isLoggedIn: false,
  name: null,
  userId: null,
  token: null,
  login: () => {},
  logout: () => {},
});
