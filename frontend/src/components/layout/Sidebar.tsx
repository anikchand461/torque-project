"use client";

import {
  Network,
  Play,
  GitBranch,
  ShieldCheck,
  History,
  Settings,
  Plus,
} from "lucide-react";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewGraph: () => void;
}

const navigation = [
  {
    label: "Graph",
    icon: Network,
  },
  {
    label: "Executions",
    icon: Play,
  },
  {
    label: "Relationships",
    icon: GitBranch,
  },
  {
    label: "Protocols",
    icon: ShieldCheck,
  },
  {
    label: "History",
    icon: History,
  },
];

export default function Sidebar({
  activeView,
  onViewChange,
  onNewGraph,
}: SidebarProps) {
  function handleNavigation(
    view: string,
  ) {
    console.log(
      "SIDEBAR NAVIGATION:",
      view,
    );

    onViewChange(view);
  }

  return (
    <aside className="sidebar">
      {/* LOGO */}

      <div className="sidebar-logo">
        <div className="logo-mark">
          <Network size={18} />
        </div>

        <div>
          <div className="logo-title">
            Torque
          </div>

          <div className="logo-subtitle">
            Communications
          </div>
        </div>
      </div>

      {/* WORKSPACE */}

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          WORKSPACE
        </div>

        <button
          type="button"
          className="new-graph-button"
          onClick={() => {
            console.log(
              "NEW GRAPH CLICKED",
            );

            onNewGraph();
          }}
        >
          <Plus size={16} />

          New Graph
        </button>
      </div>

      {/* NAVIGATION */}

      <nav className="sidebar-nav">
        {navigation.map((item) => {
          const Icon = item.icon;

          const active =
            activeView === item.label;

          return (
            <button
              key={item.label}
              type="button"
              className={`sidebar-nav-item ${
                active ? "active" : ""
              }`}
              onClick={() =>
                handleNavigation(
                  item.label,
                )
              }
            >
              <Icon size={18} />

              <span>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* BOTTOM */}

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`sidebar-nav-item ${
            activeView === "Settings"
              ? "active"
              : ""
          }`}
          onClick={() =>
            handleNavigation(
              "Settings",
            )
          }
        >
          <Settings size={18} />

          <span>Settings</span>
        </button>

        <div className="backend-status">
          <span className="status-dot" />

          <div>
            <div className="status-title">
              Backend connected
            </div>

            <div className="status-url">
              localhost:8000
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}