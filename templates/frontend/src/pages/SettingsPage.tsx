import React from 'react';
import { Sliders, Bell, Server, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';

export const SettingsPage: React.FC = () => {
  const handleSaveSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Placeholder only — settings changes are not yet persisted.
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your application preferences, backend endpoints, and notification rules.
        </p>
      </div>

      {/* Informational Notice */}
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"
      >
        <Info className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-semibold">Placeholder Settings:</span> The configuration toggles below represent UI controls for future features. No configuration is modified on the server.
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* General Application Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <CardTitle>General Preferences</CardTitle>
            </div>
            <CardDescription>
              Basic workspace and regional settings for your DevLaunch template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Application Name"
                id="settings-app-name"
                defaultValue="DevLaunch Starter"
              />
              <Input
                label="Environment Mode"
                id="settings-env-mode"
                defaultValue="Development (Vite)"
                disabled
                helperText="Configured via .env"
              />
            </div>
          </CardContent>
        </Card>

        {/* API & Backend Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <CardTitle>Backend API Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure the connection target for your future Express service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="API Base URL"
              id="settings-api-url"
              defaultValue="http://localhost:5000/api"
              helperText="Set via VITE_API_BASE_URL in templates/frontend/.env"
            />
          </CardContent>
        </Card>

        {/* Notification Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>
              Select how and when you receive system alerts (demo controls).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="font-medium">System Alert Banners</p>
                <p className="text-xs text-slate-500">Show in-app notices for development status updates.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer pt-2">
              <input
                type="checkbox"
                defaultChecked={false}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="font-medium">Email Digest Notifications</p>
                <p className="text-xs text-slate-500">Receive weekly summaries of workspace actions (demo).</p>
              </div>
            </label>
          </CardContent>
          <CardFooter className="justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" type="button">
              Reset Defaults
            </Button>
            <Button variant="primary" type="submit">
              Save Preferences (Demo)
            </Button>
          </CardFooter>
        </Card>

        {/* Danger Zone */}
        <Card className="border-rose-200 bg-rose-50/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <CardTitle className="text-rose-900">Danger Zone</CardTitle>
            </div>
            <CardDescription className="text-rose-700/80">
              Irreversible actions affecting your project workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Reset Local Project Data</h4>
                <p className="text-xs text-slate-500">Clear local template storage and cached developer state.</p>
              </div>
              <Button variant="danger" size="sm" type="button" onClick={() => {}}>
                Reset Project Data (Demo)
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};
