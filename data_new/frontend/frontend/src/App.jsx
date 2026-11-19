import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import DashboardLayout from "./components/Layout/DashboardLayout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AccessDenied from "./pages/AccessDenied.jsx";
import "./styles/auth.css";
import HaversinePage from "./pages/Haversinepages.jsx";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/nearby" element={<HaversinePage />} />
    </Routes>
  );
}
