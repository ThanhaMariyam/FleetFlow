/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import AdminPanel from './components/AdminPanel';
import DriverPanel from './components/DriverPanel';
import { Truck, ShieldCheck } from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/driver" element={<DriverPanel />} />
      </Routes>
    </BrowserRouter>
  );
}

function Home() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200">
            <Truck className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">FleetFlow</h1>
          <p className="mt-3 text-lg text-slate-600">Choose your portal to continue.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <Link 
            to="/driver" 
            className="group relative flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Truck className="w-6 h-6 text-slate-900" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-slate-900">Driver Terminal</h3>
                <p className="text-sm text-slate-500">Start trip and log condition</p>
              </div>
            </div>
            <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link 
            to="/admin" 
            className="group relative flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:slate-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <ShieldCheck className="w-6 h-6 text-slate-700" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-slate-900">Admin Dashboard</h3>
                <p className="text-sm text-slate-500">Manage fleet and trips</p>
              </div>
            </div>
            <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
