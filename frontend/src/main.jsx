import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";
import "./index.css";

const theme = createTheme({
  components: {
    MuiTable: { styleOverrides: { root: { minWidth: 480 } } },
    MuiTableContainer: { styleOverrides: { root: { overflowX: "auto", WebkitOverflowScrolling: "touch" } } },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
