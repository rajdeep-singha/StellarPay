import React, { useState, useMemo } from "react";
import { upsertEmployeeProfile } from "../libs/supabase";

const DEPARTMENTS = ["All", "Engineering", "Finance", "HR", "Marketing", "Operations", "Sales", "Design", "Legal", "Product"];
const POSITIONS = ["Software Engineer", "Senior Engineer", "Lead Engineer", "Product Manager", "Designer", "Analyst", "Manager", "Director", "Coordinator", "Specialist"];

const EmployeeManagement = ({ employees, onEmployeesUpdate, showNotification }) => {
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", position: "", department: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [sortBy, setSortBy] = useState("name"); // name | salary | department | status

  const departmentStats = useMemo(() => {
    const stats = {};
    employees.forEach((emp) => {
      const dept = emp.department || "Unassigned";
      if (!stats[dept]) stats[dept] = { count: 0, totalSalary: 0 };
      stats[dept].count++;
      stats[dept].totalSalary += emp.salary || 0;
    });
    return stats;
  }, [employees]);

  const filtered = useMemo(() => {
    let list = [...employees];
    if (selectedDepartment !== "All") {
      list = list.filter((e) =>
        selectedDepartment === "Unassigned" ? !e.department : e.department === selectedDepartment
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.position?.toLowerCase().includes(q) ||
          e.department?.toLowerCase().includes(q) ||
          e.walletAddress?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "salary") return b.salary - a.salary;
      if (sortBy === "department") return (a.department || "").localeCompare(b.department || "");
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [employees, selectedDepartment, searchQuery, sortBy]);

  const openEdit = (emp) => {
    setViewingEmployee(null);
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name || "",
      position: emp.position || "",
      department: emp.department || "",
      email: emp.email || "",
    });
  };

  const handleSave = async () => {
    if (!editingEmployee) return;
    setIsSaving(true);
    try {
      const result = await upsertEmployeeProfile({
        walletAddress: editingEmployee.walletAddress,
        empId: editingEmployee.id,
        name: editForm.name,
        position: editForm.position,
        department: editForm.department,
        email: editForm.email,
      });
      if (!result.success) throw new Error(result.error);
      onEmployeesUpdate((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                name: editForm.name || e.name,
                position: editForm.position || null,
                department: editForm.department || null,
                email: editForm.email || null,
              }
            : e
        )
      );
      setEditingEmployee(null);
      showNotification("Employee profile updated successfully");
    } catch (err) {
      showNotification(err.message || "Failed to save profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const activeDepts = Object.keys(departmentStats);
  const filterTabs = ["All", ...activeDepts.filter((d) => d !== "Unassigned"), ...(activeDepts.includes("Unassigned") ? ["Unassigned"] : [])];

  return (
    <div className="space-y-6">
      {/* Department Summary Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Department Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(departmentStats).map(([dept, stats]) => (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept === "Unassigned" ? "Unassigned" : dept)}
              className={`rounded-xl p-4 border text-left transition-all hover:scale-[1.02] ${
                selectedDepartment === dept
                  ? "bg-gradient-to-br from-pink-400/20 to-purple-400/10 border-pink-400/40"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider truncate">{dept}</span>
                <span className={`w-2 h-2 rounded-full ${dept === "Unassigned" ? "bg-gray-500" : "bg-purple-400"}`} />
              </div>
              <p className="text-2xl font-bold text-white">{stats.count}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.totalSalary.toLocaleString()} XLM / mo</p>
            </button>
          ))}
          {employees.length === 0 && (
            <div className="col-span-full text-center py-6 text-gray-600 text-sm">
              No employees found. Connect your wallet and load the dashboard.
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, position, department..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-pink-400/50 text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-pink-400/50"
        >
          <option value="name">Sort by Name</option>
          <option value="salary">Sort by Salary</option>
          <option value="department">Sort by Department</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((dept) => (
          <button
            key={dept}
            onClick={() => setSelectedDepartment(dept)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedDepartment === dept
                ? "bg-gradient-to-r from-pink-400 to-purple-400 text-black"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {dept}
            {dept !== "All" && departmentStats[dept === "Unassigned" ? "Unassigned" : dept] && (
              <span className="ml-1.5 opacity-70">
                ({departmentStats[dept === "Unassigned" ? "Unassigned" : dept]?.count || 0})
              </span>
            )}
            {dept === "All" && <span className="ml-1.5 opacity-70">({employees.length})</span>}
          </button>
        ))}
      </div>

      {/* Employee Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <div
            key={emp.id}
            className="rounded-2xl bg-[#111] border border-white/[0.08] p-5 hover:border-white/20 transition-all group"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 border border-white/10 flex items-center justify-center text-lg font-bold text-white">
                  {(emp.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">{emp.name || `Employee #${emp.id}`}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {emp.walletAddress
                      ? `${emp.walletAddress.slice(0, 6)}…${emp.walletAddress.slice(-4)}`
                      : "No wallet"}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${emp.status === "active" ? "bg-emerald-400/10 text-emerald-400" : "bg-gray-500/10 text-gray-500"}`}>
                {emp.status}
              </span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {emp.position ? (
                <span className="px-2.5 py-1 rounded-lg bg-blue-400/10 border border-blue-400/20 text-blue-300 text-xs">
                  {emp.position}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-600 text-xs italic">
                  No position
                </span>
              )}
              {emp.department ? (
                <span className="px-2.5 py-1 rounded-lg bg-purple-400/10 border border-purple-400/20 text-purple-300 text-xs">
                  {emp.department}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-600 text-xs italic">
                  No dept
                </span>
              )}
            </div>

            {/* Salary Info */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">Monthly Salary</span>
                <span className="text-white font-semibold text-sm">{emp.salary.toLocaleString()} XLM</span>
              </div>
              {emp.email && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-gray-500 text-xs">Email</span>
                  <span className="text-gray-400 text-xs truncate max-w-[140px]">{emp.email}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewingEmployee(emp)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-gray-400 text-xs font-medium hover:bg-white/5 hover:text-white transition-all"
              >
                View Profile
              </button>
              <button
                onClick={() => openEdit(emp)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-400/20 to-purple-400/20 border border-pink-400/30 text-pink-300 text-xs font-medium hover:opacity-80 transition-all"
              >
                Edit Profile
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-600 text-sm">
            No employees match your filters.
          </div>
        )}
      </div>

      {/* View Profile Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-[#111] border border-white/10 p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 border border-white/10 flex items-center justify-center text-2xl font-bold text-white">
                  {(viewingEmployee.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{viewingEmployee.name || `Employee #${viewingEmployee.id}`}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 font-mono">
                    {viewingEmployee.walletAddress?.slice(0, 12)}…{viewingEmployee.walletAddress?.slice(-8)}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingEmployee(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">✕</button>
            </div>

            <div className="space-y-0 mb-6 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
              {[
                { label: "Employee ID", value: `#${viewingEmployee.id}`, cls: "text-white" },
                { label: "Status", value: viewingEmployee.status, cls: viewingEmployee.status === "active" ? "text-emerald-400" : "text-gray-500" },
                { label: "Position", value: viewingEmployee.position || "—", cls: viewingEmployee.position ? "text-blue-300" : "text-gray-600" },
                { label: "Department", value: viewingEmployee.department || "—", cls: viewingEmployee.department ? "text-purple-300" : "text-gray-600" },
                { label: "Email", value: viewingEmployee.email || "—", cls: viewingEmployee.email ? "text-gray-300" : "text-gray-600" },
                { label: "Monthly Salary", value: `${viewingEmployee.salary.toLocaleString()} XLM`, cls: "text-white font-semibold" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between px-4 py-3 border-b border-white/[0.06] last:border-0">
                  <span className="text-gray-500 text-sm">{label}</span>
                  <span className={`text-sm capitalize ${cls}`}>{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setViewingEmployee(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/5"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(viewingEmployee)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold text-sm hover:opacity-90"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-[#111] border border-white/10 p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Edit Profile</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {editingEmployee.walletAddress?.slice(0, 10)}…{editingEmployee.walletAddress?.slice(-8)}
                </p>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">✕</button>
            </div>

            <div className="space-y-4 mb-6">
              <FormField
                label="Full Name"
                placeholder="e.g. Jane Doe"
                value={editForm.name}
                onChange={(v) => setEditForm((p) => ({ ...p, name: v }))}
              />

              <div className="flex flex-col gap-2">
                <label className="text-gray-500 text-xs uppercase tracking-wider">Position / Title</label>
                <input
                  type="text"
                  list="position-suggestions"
                  value={editForm.position}
                  onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))}
                  placeholder="e.g. Software Engineer"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500/50 transition-all text-sm"
                />
                <datalist id="position-suggestions">
                  {POSITIONS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-gray-500 text-xs uppercase tracking-wider">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-all text-sm appearance-none"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <FormField
                label="Email"
                type="email"
                placeholder="e.g. jane@company.com"
                value={editForm.email}
                onChange={(v) => setEditForm((p) => ({ ...p, email: v }))}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : "Save Profile ✦"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FormField = ({ label, placeholder, value, onChange, type = "text" }) => (
  <div className="flex flex-col gap-2">
    <label className="text-gray-500 text-xs uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500/50 transition-all text-sm"
    />
  </div>
);

export default EmployeeManagement;
