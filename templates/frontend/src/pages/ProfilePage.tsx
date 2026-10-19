import React from 'react';
import { Mail, User, Shield, Calendar, Info } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Placeholder only — profile updates are not yet persisted to MongoDB.
  };

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'DL';
  };

  const displayName = user?.name || 'DevLaunch User';
  const displayEmail = user?.email || 'user@devlaunch.local';
  const displayRole = user?.role === 'admin' ? 'Administrator' : 'Developer';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          User Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View and edit your personal information and account preferences.
        </p>
      </div>

      {/* Informational Notice */}
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"
      >
        <Info className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-semibold">Session Profile:</span> Authenticated via{' '}
          <span className="font-medium text-sky-900 capitalize">
            {user?.providers?.join(', ') || 'session'}
          </span>
          . Form modifications below are client-side demonstrations.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* User Identity Card (1 column) */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="mx-auto h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
                  {getInitials(user?.name, user?.email)}
                </div>
              )}
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{displayName}</h2>
              <p className="text-xs text-slate-500">{displayEmail}</p>

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{displayRole} Role</span>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4 text-left space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span>
                    {user?.createdAt
                      ? `Joined ${new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
                      : 'Active Member'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span>
                    {user?.isEmailVerified ? 'Verified email' : 'Standard account'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Information Form (2 columns) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your account details and contact preferences.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSave}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name"
                    id="profile-name"
                    defaultValue={displayName}
                    icon={<User className="h-4 w-4" aria-hidden="true" />}
                  />
                  <Input
                    label="Email address"
                    type="email"
                    id="profile-email"
                    defaultValue={displayEmail}
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Job Title"
                    id="profile-title"
                    defaultValue="Full-Stack Engineer"
                  />
                  <Input
                    label="Company / Organization"
                    id="profile-org"
                    defaultValue="DevLaunch Workspace"
                  />
                </div>

                <div>
                  <label htmlFor="profile-bio" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    defaultValue="Building modern applications with the DevLaunch full-stack starter kit."
                    className="block w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </CardContent>

              <CardFooter className="justify-end gap-3 border-t border-slate-100 pt-4">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Changes (Demo)
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
