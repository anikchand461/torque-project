"use client";

import {
  Network,
  Play,
  GitBranch,
  ShieldCheck,
  History,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewGraph: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  function handleNavigation(
    view: string,
  ) {
    onViewChange(view);
  }

  return (
    <aside
      className={`sidebar ${
        collapsed ? "sidebar-collapsed" : ""
      }`}
    >
      {/* COLLAPSE TOGGLE */}

      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        title={
          collapsed
            ? "Expand sidebar"
            : "Collapse sidebar"
        }
      >
        {collapsed ? (
          <ChevronRight size={13} />
        ) : (
          <ChevronLeft size={13} />
        )}
      </button>

      {/* LOGO */}

      <div className="sidebar-logo">
        <div className="logo-mark">
          <Network size={18} />
        </div>

        {!collapsed && (
          <div>
            <div className="logo-title">
              Torque
            </div>

            <div className="logo-subtitle">
              Communications
            </div>
          </div>
        )}
      </div>

      {/* WORKSPACE */}

      <div className="sidebar-section">
        {!collapsed && (
          <div className="sidebar-section-title">
            WORKSPACE
          </div>
        )}

        <button
          type="button"
          className="new-graph-button"
          title="New Graph"
          onClick={() => {
            onNewGraph();
          }}
        >
          <Plus size={16} />

          {!collapsed && "New Graph"}
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
              title={item.label}
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

              {!collapsed && (
                <span>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* BOTTOM */}

      <div className="sidebar-bottom">
        <button
          type="button"
          title="Settings"
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

          {!collapsed && (
            <span>Settings</span>
          )}
        </button>

        <div
          className="backend-status"
          title="Backend connected — localhost:8000"
        >
          <span className="status-dot" />

          {!collapsed && (
            <div>
              <div className="status-title">
                Backend connected
              </div>

              <div className="status-url">
                localhost:8000
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
