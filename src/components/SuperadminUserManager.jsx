import React, { useState, useEffect } from 'react';
import { 
  getAdminUsers, 
  provisionAdminAccount, 
  updateAdminRole, 
  removeAdminAccount, 
  PRIMARY_OWNER_EMAIL 
} from '../services/adminUserService';
import { useAuth } from '../context/AuthContext';

export default function SuperadminUserManager() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  
  // Provision Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState('admin');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Load Users
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load admin users:', err);
      setFeedback({ type: 'error', message: 'Could not load admin user roster: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Generate random secure password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
  };

  // Submit New Account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Please provide a valid email address.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const result = await provisionAdminAccount({
        email: newEmail,
        password: newPassword,
        displayName: newName,
        role: newRole,
        createdBy: currentUser?.email || 'superadmin'
      });

      setFeedback({
        type: 'success',
        message: `Successfully provisioned ${result.role.toUpperCase()} account for ${result.email}${newPassword ? ' with initial credentials' : ''}.`
      });

      // Reset form
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('admin');
      setShowAddForm(false);
      
      // Reload list
      await loadUsers();
    } catch (err) {
      console.error('Error provisioning account:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to provision account.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Update Role
  const handleRoleChange = async (user, targetRole) => {
    if ((user.email || '').toLowerCase() === PRIMARY_OWNER_EMAIL) {
      alert('The primary system owner account role is permanent and cannot be modified.');
      return;
    }

    try {
      await updateAdminRole(user.id, targetRole);
      setFeedback({
        type: 'success',
        message: `Updated role for ${user.email} to ${targetRole.toUpperCase()}`
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to change role:', err);
      setFeedback({ type: 'error', message: 'Failed to update role: ' + err.message });
    }
  };

  // Remove Account
  const handleDeleteUser = async (user) => {
    if ((user.email || '').toLowerCase() === PRIMARY_OWNER_EMAIL) {
      alert('The primary system owner account cannot be removed.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove admin access for ${user.email}? This will revoke their administrative credentials.`
    );
    if (!confirmed) return;

    try {
      await removeAdminAccount(user.id, user.email);
      setFeedback({
        type: 'success',
        message: `Removed ${user.email} from the admin accounts roster.`
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setFeedback({ type: 'error', message: 'Failed to remove account: ' + err.message });
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const role = (u.role || u.userType || 'user').toLowerCase();
    const matchesFilter = 
      activeFilter === 'ALL' || 
      (activeFilter === 'SUPERADMIN' && role === 'superadmin') ||
      (activeFilter === 'ADMIN' && role === 'admin') ||
      (activeFilter === 'CREATOR' && (role === 'creator' || role === 'creater'));

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      !searchQuery ||
      (u.email || '').toLowerCase().includes(searchLower) ||
      (u.displayName || '').toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  // Role Metric Counts
  const countSuper = users.filter(u => (u.role || u.userType) === 'superadmin').length;
  const countAdmin = users.filter(u => (u.role || u.userType) === 'admin').length;
  const countCreator = users.filter(u => ['creator', 'creater'].includes(u.role || u.userType)).length;

  return (
    <div className="space-y-8">
      {/* Superadmin Card Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-base text-purple-400">admin_panel_settings</span>
            <span className="font-mono text-xs text-purple-400 uppercase tracking-widest">
              SUPERADMIN PRIVILEGE • ACCESS CONTROL
            </span>
          </div>
          <h3 className="font-bold text-2xl text-on-background tracking-tight font-headline-lg">
            Admin Accounts & Roles Management
          </h3>
          <p className="text-secondary text-xs sm:text-sm mt-1">
            Create new administrator and creator accounts, assign system roles, and govern Studio 4D4 access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-sm">
            {showAddForm ? 'close' : 'person_add'}
          </span>
          <span>{showAddForm ? 'Cancel' : 'Add Admin Account'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback.message && (
        <div className={`p-4 rounded-xl text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in ${
          feedback.type === 'error'
            ? 'bg-red-950/40 border border-red-500/40 text-red-300'
            : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              {feedback.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-secondary hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/20">
          <span className="text-[10px] font-mono text-secondary uppercase block">TOTAL TEAM</span>
          <span className="font-mono text-2xl font-bold text-on-background">{users.length}</span>
          <span className="text-[10px] text-secondary block mt-0.5">Active Roster</span>
        </div>

        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30">
          <span className="text-[10px] font-mono text-purple-300 uppercase block">SUPERADMINS</span>
          <span className="font-mono text-2xl font-bold text-purple-400">{countSuper}</span>
          <span className="text-[10px] text-purple-300/80 block mt-0.5">Full System Access</span>
        </div>

        <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30">
          <span className="text-[10px] font-mono text-sky-300 uppercase block">ADMINISTRATORS</span>
          <span className="font-mono text-2xl font-bold text-sky-400">{countAdmin}</span>
          <span className="text-[10px] text-sky-300/80 block mt-0.5">Store & Operations</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <span className="text-[10px] font-mono text-emerald-300 uppercase block">3D CREATORS</span>
          <span className="font-mono text-2xl font-bold text-emerald-400">{countCreator}</span>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">Studio 4D4 Rigging</span>
        </div>
      </div>

      {/* PROVISION NEW ADMIN ACCOUNT FORM */}
      {showAddForm && (
        <div className="p-6 sm:p-8 rounded-2xl bg-[#141418] border border-purple-500/40 shadow-2xl space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h4 className="font-bold text-lg text-white font-mono uppercase">
                Provision New Admin or Creator
              </h4>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Set credentials and permission role for the new team member.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-mono uppercase font-bold">
              SUPERADMIN AUTHORIZED
            </span>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. designer@ttl44.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.12] focus:border-purple-400 text-white text-xs placeholder-[#52525b] outline-none font-mono transition-colors"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                  Display / Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.12] focus:border-purple-400 text-white text-xs placeholder-[#52525b] outline-none font-mono transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-[#a1a1aa] block">
                  Assigned System Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1c1c22] border border-white/[0.12] focus:border-purple-400 text-white text-xs outline-none font-mono transition-colors cursor-pointer"
                >
                  <option value="superadmin">Superadmin (Full System Access, Roles, Studio 4D4 & AR-Test)</option>
                  <option value="admin">Admin (Inventory, Orders, Analytics, Studio 4D4 & AR-Test)</option>
                  <option value="creator">Creator / Contributor (Catalog Contributor)</option>
                </select>
                <p className="text-[10px] text-[#71717a] font-mono">
                  {newRole === 'superadmin' && '• Has full authority to edit settings, view credentials, manage users, and access Studio 4D4 & AR-Test.'}
                  {newRole === 'admin' && '• Can manage storefront products, orders, and access Studio 4D4 & AR-Test calibration.'}
                  {newRole === 'creator' && '• General contributor profile. Studio 4D4 and AR-Test are restricted to authenticated admins.'}
                </p>
              </div>

              {/* Initial Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-[#a1a1aa]">
                  <span>Initial Password (Min 6 Chars)</span>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10px] text-purple-400 hover:underline cursor-pointer lowercase"
                  >
                    generate random
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set temporary password..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.12] focus:border-purple-400 text-white text-xs placeholder-[#52525b] outline-none font-mono transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-secondary hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[#a1a1aa] font-mono text-xs uppercase cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Provisioning...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">how_to_reg</span>
                    <span>Create Account & Grant Role</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts by email or name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-variant/20 border border-outline-variant/30 text-on-background text-xs font-mono outline-none focus:border-purple-400 transition-colors"
          />
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">
            search
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'SUPERADMIN', 'ADMIN', 'CREATOR'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === f
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface-variant/20 text-secondary hover:text-on-background'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ROSTER TABLE */}
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-variant/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-variant/30 border-b border-outline-variant/20 text-secondary uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Account / Email</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Access Tier</th>
                <th className="py-3 px-4">Studio & AR Access</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-secondary">
                    <span className="material-symbols-outlined text-2xl animate-spin text-purple-400 block mb-2">
                      progress_activity
                    </span>
                    <span>Loading Admin & Creator accounts...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-secondary">
                    No accounts found matching current filter or search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const role = (u.role || u.userType || 'user').toLowerCase();
                  const isOwner = (u.email || '').toLowerCase() === PRIMARY_OWNER_EMAIL;
                  const canStudio = isOwner || ['superadmin', 'admin'].includes(role) || u.isAdmin || u.isSuperAdmin;

                  return (
                    <tr key={u.id} className="hover:bg-surface-variant/20 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            role === 'superadmin'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                              : role === 'creator' || role === 'creater'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                          }`}>
                            {(u.displayName || u.email || 'A').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-on-background truncate flex items-center gap-1.5">
                              <span>{u.displayName || u.email?.split('@')[0]}</span>
                              {isOwner && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] uppercase font-bold">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="text-secondary text-[11px] truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector Badge */}
                      <td className="py-3.5 px-4">
                        {isOwner ? (
                          <span className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/50 text-purple-300 font-bold text-[10px] uppercase">
                            SUPERADMIN (LOCKED)
                          </span>
                        ) : (
                          <select
                            value={role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] uppercase outline-none cursor-pointer transition-colors ${
                              role === 'superadmin'
                                ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                                : role === 'creator' || role === 'creater'
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                                : role === 'admin'
                                ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                                : 'bg-surface-variant border-outline-variant text-secondary'
                            }`}
                          >
                            <option value="superadmin">Superadmin</option>
                            <option value="admin">Admin</option>
                            <option value="creator">Creator</option>
                            <option value="user">Regular User</option>
                          </select>
                        )}
                      </td>

                      {/* Access Tier Description */}
                      <td className="py-3.5 px-4 text-secondary text-[11px]">
                        {role === 'superadmin' && 'Full System Control (Settings + Billing + Roles + Studio/AR)'}
                        {role === 'admin' && 'Store Management (Orders + Inventory + Studio/AR)'}
                        {(role === 'creator' || role === 'creater') && 'Creator / Contributor (Read-only catalog content)'}
                        {role === 'user' && 'Restricted (Customer View Only)'}
                      </td>

                      {/* Studio 4D4 & AR Access Indicator */}
                      <td className="py-3.5 px-4">
                        {canStudio ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[11px]">check_circle</span>
                            <span>Enabled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                            <span className="material-symbols-outlined text-[11px]">block</span>
                            <span>Hidden</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isOwner ? (
                          <span className="text-secondary text-[10px] italic">Permanent Owner</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                            title="Remove Admin Account"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
