'use client';

import { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, isAdmin: boolean) => {
    setUpdatingUser(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, is_admin: isAdmin } : user
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Users</h1>
          <p className="text-muted text-sm mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="text-sm text-muted">
          {total.toLocaleString()} total users
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full px-4 py-2.5 bg-cream border border-border rounded-lg text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
            className="px-4 py-2.5 text-sm text-muted hover:text-ink transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-cream rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-linen/50">
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  User
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Role
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Joined
                </th>
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Last Active
                </th>
                <th className="text-right px-6 py-4 text-xs uppercase tracking-wider text-muted font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12">
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted text-sm">
                    {search ? 'No users found matching your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-linen/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-medium">
                          {(user.display_name || user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {user.display_name || 'No name'}
                          </p>
                          <p className="text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.is_admin ? 'admin' : 'user'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value === 'admin')}
                        disabled={updatingUser === user.id}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all ${
                          user.is_admin
                            ? 'bg-gold/10 text-gold'
                            : 'bg-linen text-charcoal'
                        } ${updatingUser === user.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-charcoal">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {formatDateTime(user.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {/* TODO: implement user details modal */}}
                        className="text-xs text-gold hover:text-gold-light transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-md text-charcoal hover:bg-linen disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-md text-charcoal hover:bg-linen disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
