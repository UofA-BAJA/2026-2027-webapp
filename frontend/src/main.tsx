import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import keycloak from "./Keycloak";

const render = () =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

// VITE_NO_AUTH=1 (npm run dev:ui) runs the UI alone, without Keycloak/backend
if (import.meta.env.VITE_NO_AUTH) {
  render();
} else {
  keycloak.init({ onLoad: "login-required", pkceMethod: "S256" }).then(() => {
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30);
    };
    render();
  });
}
