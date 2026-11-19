import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="logo">EV Charge Network</div>
      <nav className="sidebar-nav">
        <NavLink to="/stations" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          View Stations
        </NavLink>
        <NavLink to="/booking" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Do Booking
        </NavLink>
        <NavLink to="/my-bookings" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Your Bookings
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
}
