import React from 'react';
import { Rocket, Activity, Users, Server, Plus, ArrowUpRight, Clock, Info } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome to your DevLaunch application overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
          >
            Refresh Metrics
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {}}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Placeholder Notice */}
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"
      >
        <Info className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-semibold">Starter Template Mode:</span> Metrics and activity lists below represent sample dashboard data. Live statistics will connect when the Express API and MongoDB services are active.
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Projects</span>
              <div className="rounded-lg bg-sky-100 p-2 text-sky-600">
                <Rocket className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">4</span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                <ArrowUpRight className="h-3 w-3" /> +1 this week
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Sample project count</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Backend API</span>
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                <Server className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">Ready</span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                Port 5000
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Target Express endpoint</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Users</span>
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">1</span>
              <span className="text-xs text-slate-500">Local Admin</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Single developer mode</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">System Health</span>
              <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">100%</span>
              <span className="text-xs text-emerald-600 font-semibold">Optimal</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Frontend bundle healthy</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Overview & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions & Stack Status (2 columns) */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Architecture Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Your DevLaunch application structure is initialized with modular layers. Use the components and layouts as building blocks for your features.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Frontend</span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">React + Vite</p>
                  <p className="text-xs text-slate-500">Tailwind CSS v3</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">API Layer</span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Express (Planned)</p>
                  <p className="text-xs text-slate-500">RESTful routes</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage</span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">MongoDB (Planned)</p>
                  <p className="text-xs text-slate-500">Mongoose ODM</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Placeholder (1 column) */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<Clock className="h-6 w-6" aria-hidden="true" />}
                title="No recent events"
                description="Activity logs will appear here once you begin working with project data."
                className="border-0 bg-transparent p-4 sm:p-6"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
