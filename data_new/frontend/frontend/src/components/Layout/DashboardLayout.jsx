import React from 'react';
import Sidebar from '../Sidebar';
import '../../styles/dashboardLayout.css';

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-root">
      <Sidebar />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
