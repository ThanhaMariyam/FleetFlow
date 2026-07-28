import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, deleteDoc } from 'firebase/firestore';
import { Driver, Vehicle, Trip } from '../types';
import { formatDuration, formatTime } from '../utils';
import { ShieldAlert, CheckCircle2, AlertTriangle, Clock, Wrench, ChevronDown, ChevronUp, Settings, Users, Trash2, Edit2, Car, Phone, Download, Truck, Route, Lock, LogOut } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function AdminPanel() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  
  const [activeTab, setActiveTab] = useState<'active_trips' | 'service_requests' | 'history' | 'manage' | 'driver_stats'>('active_trips');

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('fleetflow_admin_auth') === 'true';
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      localStorage.setItem('fleetflow_admin_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      setPassword('');
    } else {
      setLoginError('Invalid password. Please try again.');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('fleetflow_admin_auth');
    setIsAuthenticated(false);
  };

  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('+968');
  const [newVehicleName, setNewVehicleName] = useState('');

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleName, setEditVehicleName] = useState('');

  const [manageTab, setManageTab] = useState<'drivers' | 'vehicles'>('drivers');
  
  const [resolvingTripId, setResolvingTripId] = useState<string | null>(null);
  const [resolvingTripStatus, setResolvingTripStatus] = useState<string | null>(null);

  const [activeTripsPage, setActiveTripsPage] = useState(1);
  const [serviceRequestsPage, setServiceRequestsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [driversPage, setDriversPage] = useState(1);
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [statsPage, setStatsPage] = useState(1);
  
  const [driverFilter, setDriverFilter] = useState<string>('');
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    const qDrivers = query(collection(db, 'drivers'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    });

    const qVehicles = query(collection(db, 'vehicles'));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
    });

    const qTrips = query(collection(db, 'trips'));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
      let fetchedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      fetchedTrips = fetchedTrips.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setTrips(fetchedTrips);
    });

    return () => {
      unsubDrivers();
      unsubVehicles();
      unsubTrips();
    };
  }, []);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverPhone.trim()) return;
    try {
      await addDoc(collection(db, 'drivers'), { 
        name: newDriverName.trim(), 
        phoneNumber: newDriverPhone.trim() 
      });
      setNewDriverName('');
      setNewDriverPhone('+968');
    } catch (err: any) {
      console.error(err);
      alert('Failed to add driver: ' + (err.message || err));
    }
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriverId || !editDriverName.trim() || !editDriverPhone.trim()) return;
    try {
      await updateDoc(doc(db, 'drivers', editingDriverId), {
        name: editDriverName.trim(),
        phoneNumber: editDriverPhone.trim(),
      });
      setEditingDriverId(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update driver: ' + (err.message || err));
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      try {
        await deleteDoc(doc(db, 'drivers', id));
      } catch (err: any) {
        console.error(err);
        alert('Failed to delete driver: ' + (err.message || err));
      }
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleName.trim()) return;
    try {
      await addDoc(collection(db, 'vehicles'), { name: newVehicleName.trim() });
      setNewVehicleName('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to add vehicle: ' + (err.message || err));
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicleId || !editVehicleName.trim()) return;
    try {
      await updateDoc(doc(db, 'vehicles', editingVehicleId), {
        name: editVehicleName.trim(),
      });
      setEditingVehicleId(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update vehicle: ' + (err.message || err));
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await deleteDoc(doc(db, 'vehicles', id));
      } catch (err: any) {
        console.error(err);
        alert('Failed to delete vehicle: ' + (err.message || err));
      }
    }
  };

  const confirmResolve = (tripId: string, currentStatus: string) => {
    setResolvingTripId(tripId);
    setResolvingTripStatus(currentStatus);
  };

  const handleConfirmResolve = async () => {
    if (!resolvingTripId || !resolvingTripStatus) return;
    
    if (resolvingTripStatus === 'waiting_service') {
      await updateDoc(doc(db, 'trips', resolvingTripId), {
        status: 'service_completed',
        serviceNeeded: false
      });
    } else {
      await updateDoc(doc(db, 'trips', resolvingTripId), {
        serviceNeeded: false
      });
    }
    
    setResolvingTripId(null);
    setResolvingTripStatus(null);
  };

  const downloadHistoryAsCSV = () => {
    const headers = ['Driver Name', 'Vehicle Identifier', 'Start Time', 'End Time', 'Duration', 'Service Required', 'Remarks'];
    const rows = completedTrips.map(trip => {
      return [
        `"${trip.driverName}"`,
        `"${trip.vehicleName}"`,
        `"${trip.startTime ? formatTime(trip.startTime) : 'Unknown'}"`,
        `"${trip.endTime ? formatTime(trip.endTime) : 'Unknown'}"`,
        `"${trip.startTime && trip.endTime && trip.duration ? formatDuration(trip.duration) : '-'}"`,
        `"${trip.serviceNeeded ? 'Yes' : 'No'}"`,
        `"${(trip.remarks || '').replace(/"/g, '""')}"`
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'trip_history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeTrips = trips.filter(t => t.status === 'active');
  const serviceRequests = trips.filter(t => t.status === 'waiting_service' || t.serviceNeeded);
  const completedTrips = trips.filter(t => t.status === 'completed');

function Pagination({ total, current, onChange, itemsPerPage = 5 }: { total: number, current: number, onChange: (page: number) => void, itemsPerPage?: number }) {
  const pages = Math.ceil(total / itemsPerPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button 
        onClick={() => onChange(current - 1)} 
        disabled={current === 1}
        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        Prev
      </button>
      <span className="text-sm font-medium text-slate-500">
        Page {current} of {pages}
      </span>
      <button 
        onClick={() => onChange(current + 1)} 
        disabled={current === pages}
        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        Next
      </button>
    </div>
  );
}

function IssueDetails({ trip }: { trip: Trip }) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showingTranslation, setShowingTranslation] = useState(false);

  if (trip.condition !== 'not_ok') return null;
  
  const checklistItems = Object.entries(trip.checklist || {})
    .filter(([_, value]) => value)
    .map(([key]) => key);

  if (checklistItems.length === 0 && !trip.remarks) return null;

  const handleTranslateToggle = async () => {
    if (translatedText) {
      setShowingTranslation(!showingTranslation);
      return;
    }

    if (!trip.remarks) return;
    setIsTranslating(true);
    setError(null);
    try {
      // 1. Try MyMemory Translation API (100% Free, No API key required, works globally)
      const detectArabic = /[^\x00-\x7F]/.test(trip.remarks);
      const langpair = detectArabic ? 'ar|en' : 'en|ar';
      try {
        const myMemoryRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trip.remarks)}&langpair=${langpair}`
        );
        if (myMemoryRes.ok) {
          const myMemoryData = await myMemoryRes.json();
          const text = myMemoryData?.responseData?.translatedText;
          if (text) {
            setTranslatedText(text);
            setShowingTranslation(true);
            setIsTranslating(false);
            return; // Success!
          }
        }
      } catch (myMemErr) {
        console.warn('MyMemory translation failed, trying Gemini...', myMemErr);
      }

      // 2. Fallback to Gemini if MyMemory fails
      const apiKey = import.meta.env.VITE_TRANSLATION_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "your-api-key") {
        throw new Error('Could not translate text automatically. Please configure a valid VITE_TRANSLATION_API_KEY in your .env.local file.');
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following text to English if it is in Arabic, or to Arabic if it is in English. Only return the translated text without any conversational fillers.\n\nText: ${trip.remarks}`
              }]
            }]
          })
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API error (${res.status})`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setTranslatedText(text.trim());
        setShowingTranslation(true);
      } else {
        throw new Error('Failed to get translation response');
      }
    } catch (err: any) {
      let msg = err.message || 'Failed to translate';
      try {
        if (msg.includes('{')) {
          const parsed = JSON.parse(msg.substring(msg.indexOf('{')));
          if (parsed?.error?.message) {
            msg = parsed.error.message;
          }
        }
        
        // Self-diagnostic: Fetch available models
        const apiKey = import.meta.env.VITE_TRANSLATION_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey && apiKey !== "your-api-key") {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const models = listData?.models?.map((m: any) => m.name.replace('models/', '')) || [];
            if (models.length > 0) {
              msg += ` | Available models on your key: ${models.join(', ')}`;
            }
          }
        }
      } catch (e) {
        // Fallback
      }
      setError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const needsTranslation = trip.remarks && /[^\x00-\x7F]/.test(trip.remarks);

  return (
    <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          View Reported Issues
        </span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-sm">
          {checklistItems.length > 0 && (
            <div className="mb-3">
              <span className="font-medium text-slate-700 block mb-1">Failed Checks:</span>
              <ul className="list-disc list-inside text-slate-600 space-y-1 ml-1">
                {checklistItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {trip.remarks && (
            <div className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="font-medium text-slate-900 block mb-1">Driver Remarks:</span>
                  <p className="leading-relaxed">
                    {showingTranslation && translatedText ? translatedText : trip.remarks}
                  </p>
                </div>
                {needsTranslation && (
                  <button 
                    onClick={handleTranslateToggle} 
                    disabled={isTranslating}
                    className="text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
                  >
                    {isTranslating ? 'Translating...' : (showingTranslation ? 'See Original' : 'Translate')}
                  </button>
                )}
              </div>
              {error && (
                <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

  useEffect(() => {
    setActiveTripsPage(1);
    setServiceRequestsPage(1);
    setHistoryPage(1);
    setDriversPage(1);
    setVehiclesPage(1);
    setStatsPage(1);
    if (activeTab !== 'service_requests') {
      setDriverFilter('');
    }
  }, [activeTab]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-slate-900 p-6 text-white text-center">
            <Truck className="w-8 h-8 mx-auto mb-2 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">FleetFlow</h1>
            <p className="text-slate-400 text-sm font-medium">Admin Dashboard Portal</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Enter Admin Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-800"
                  required
                  autoFocus
                />
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              </div>
              {loginError && (
                <p className="text-sm font-semibold text-red-600 mt-2 flex items-center gap-1 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" /> {loginError}
                </p>
              )}
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-md shadow-slate-100 flex items-center justify-center gap-2"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight">FleetFlow <span className="text-slate-400 font-normal">| Admin</span></h1>
          </div>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg transition-colors border border-slate-700 active:scale-95"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-500 font-medium text-sm">Active Trips</span>
              <Route className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-end gap-2 mt-auto">
              <span className="text-3xl font-bold text-slate-900">{activeTrips.length}</span>
              <span className="text-sm text-slate-600 font-medium mb-1">Current</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-500 font-medium text-sm">Service Requests</span>
              <Wrench className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-end gap-2 mt-auto">
              <span className="text-3xl font-bold text-red-600">{serviceRequests.length}</span>
              <span className="text-sm text-red-600 font-medium mb-1">Pending</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-500 font-medium text-sm">Total Drivers</span>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-3xl font-bold text-slate-900 mt-auto">{drivers.length}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-500 font-medium text-sm">Total Vehicles</span>
              <Car className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-3xl font-bold text-slate-900 mt-auto">{vehicles.length}</span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          <button 
            onClick={() => setActiveTab('active_trips')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'active_trips' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Route className="w-4 h-4" /> Active Trips
          </button>
          <button 
            onClick={() => setActiveTab('service_requests')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'service_requests' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Wrench className="w-4 h-4" /> Service Requests
            {serviceRequests.length > 0 && (
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${activeTab === 'service_requests' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>{serviceRequests.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Clock className="w-4 h-4" /> Trip History
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Settings className="w-4 h-4" /> Manage Resources
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'manage' && (() => {
          const paginatedDrivers = drivers.slice((driversPage - 1) * ITEMS_PER_PAGE, driversPage * ITEMS_PER_PAGE);
          const paginatedVehicles = vehicles.slice((vehiclesPage - 1) * ITEMS_PER_PAGE, vehiclesPage * ITEMS_PER_PAGE);
          
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex overflow-x-auto gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                <button
                  onClick={() => setManageTab('drivers')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${manageTab === 'drivers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Manage Drivers
                </button>
                <button
                  onClick={() => setManageTab('vehicles')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${manageTab === 'vehicles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Manage Vehicles
                </button>
              </div>
            </div>

            {manageTab === 'drivers' && (
              <div>
                <form onSubmit={handleAddDriver} className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input
                    type="text"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="Driver Name"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  />
                  <input
                    type="text"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="Phone Number (e.g. +968...)"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  />
                  <button type="submit" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
                    Add Driver
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                        <th className="pb-3 font-semibold px-2">Driver Name</th>
                        <th className="pb-3 font-semibold px-2">Phone Number</th>
                        <th className="pb-3 font-semibold px-2">Total Rides</th>
                        <th className="pb-3 font-semibold px-2">Issues Reported</th>
                        <th className="pb-3 font-semibold px-2">Solved</th>
                        <th className="pb-3 font-semibold px-2">To Be Solved</th>
                        <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedDrivers.map(d => {
                        const driverTrips = trips.filter(t => t.driverId === d.id);
                        const rideCount = completedTrips.filter(t => t.driverName === d.name).length;
                        const reportedCount = driverTrips.filter(t => t.condition === 'not_ok').length;
                        const solvedCount = driverTrips.filter(t => t.condition === 'not_ok' && !t.serviceNeeded).length;
                        const toSolveCount = driverTrips.filter(t => t.condition === 'not_ok' && t.serviceNeeded).length;
                        
                        return (
                          <tr key={d.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-2">
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverName}
                                  onChange={e => setEditDriverName(e.target.value)}
                                  className="w-full min-w-[120px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                />
                              ) : (
                                <span className="font-semibold">{d.name}</span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverPhone}
                                  onChange={e => setEditDriverPhone(e.target.value)}
                                  className="w-full min-w-[120px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600">{d.phoneNumber || '-'}</span>
                                  {d.phoneNumber && (
                                    <a href={`tel:${d.phoneNumber}`} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Call Driver">
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 font-bold text-slate-900">{rideCount}</td>
                            <td className="py-3 px-2 font-medium text-slate-600">{reportedCount}</td>
                            <td className="py-3 px-2 font-semibold text-green-600">{solvedCount}</td>
                            <td className="py-3 px-2">
                              {toSolveCount > 0 ? (
                                <button
                                  onClick={() => {
                                    setDriverFilter(d.id);
                                    setActiveTab('service_requests');
                                    setServiceRequestsPage(1);
                                  }}
                                  className="text-orange-600 hover:text-orange-800 underline font-semibold flex items-center gap-1 active:scale-95 text-left"
                                  title="Click to view unsolved requests"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" /> {toSolveCount} pending
                                </button>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              {editingDriverId === d.id ? (
                                <div className="flex gap-2 justify-end">
                                  <button onClick={handleUpdateDriver} className="text-white bg-slate-900 px-3 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors">Save</button>
                                  <button onClick={() => setEditingDriverId(null)} className="text-slate-600 bg-slate-200 px-3 py-1.5 hover:bg-slate-300 rounded-lg text-xs font-medium transition-colors">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingDriverId(d.id);
                                      setEditDriverName(d.name);
                                      setEditDriverPhone(d.phoneNumber || '+968');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteDriver(d.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {drivers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">No drivers added yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={drivers.length} current={driversPage} onChange={setDriversPage} />
              </div>
            )}

            {manageTab === 'vehicles' && (
              <div>
                <form onSubmit={handleAddVehicle} className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input
                    type="text"
                    value={newVehicleName}
                    onChange={(e) => setNewVehicleName(e.target.value)}
                    placeholder="Vehicle Identifier / Plate"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  />
                  <button type="submit" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
                    Add Vehicle
                  </button>
                </form>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                        <th className="pb-3 font-semibold px-2">Vehicle Identifier / Plate</th>
                        <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedVehicles.map(v => (
                        <tr key={v.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2">
                            {editingVehicleId === v.id ? (
                              <input
                                type="text"
                                value={editVehicleName}
                                onChange={e => setEditVehicleName(e.target.value)}
                                className="w-full max-w-sm border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                              />
                            ) : (
                              <span className="font-semibold">{v.name}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {editingVehicleId === v.id ? (
                              <div className="flex gap-2 justify-end">
                                <button onClick={handleUpdateVehicle} className="text-white bg-slate-900 px-3 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors">Save</button>
                                <button onClick={() => setEditingVehicleId(null)} className="text-slate-600 bg-slate-200 px-3 py-1.5 hover:bg-slate-300 rounded-lg text-xs font-medium transition-colors">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => {
                                    setEditingVehicleId(v.id);
                                    setEditVehicleName(v.name);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteVehicle(v.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {vehicles.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-slate-500 font-medium">No vehicles added yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={vehicles.length} current={vehiclesPage} onChange={setVehiclesPage} />
              </div>
            )}
          </div>
          );
        })()}

        {activeTab === 'driver_stats' && (() => {
          const paginatedDrivers = drivers.slice((statsPage - 1) * ITEMS_PER_PAGE, statsPage * ITEMS_PER_PAGE);
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-5 text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-900" /> Driver Statistics
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                    <th className="pb-3 font-semibold px-2">Driver Name</th>
                    <th className="pb-3 font-semibold px-2">Phone Number</th>
                    <th className="pb-3 font-semibold px-2">Total Rides Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDrivers.map(driver => {
                    const rideCount = completedTrips.filter(t => t.driverName === driver.name).length;
                    return (
                      <tr key={driver.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2 font-semibold text-slate-900">{driver.name}</td>
                        <td className="py-4 px-2 font-medium text-slate-600">{driver.phoneNumber || '-'}</td>
                        <td className="py-4 px-2 font-bold text-slate-900">{rideCount}</td>
                      </tr>
                    );
                  })}
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-500 font-medium">No drivers added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={drivers.length} current={statsPage} onChange={setStatsPage} />
          </div>
          );
        })()}


        {activeTab === 'service_requests' && (() => {
          const filteredServiceRequests = driverFilter 
            ? serviceRequests.filter(t => t.driverId === driverFilter)
            : serviceRequests;
          const paginatedServiceRequests = filteredServiceRequests.slice((serviceRequestsPage - 1) * ITEMS_PER_PAGE, serviceRequestsPage * ITEMS_PER_PAGE);
          
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-red-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            {driverFilter && (
              <div className="mb-4 bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center justify-between text-sm text-orange-800 font-medium">
                <span>
                  Showing pending service requests for <strong>{drivers.find(dr => dr.id === driverFilter)?.name || 'selected driver'}</strong>
                </span>
                <button
                  onClick={() => setDriverFilter('')}
                  className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
                >
                  Show All
                </button>
              </div>
            )}
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-2 text-slate-800">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-red-600" />
              </div>
              Service Requests ({filteredServiceRequests.length})
            </h2>
            {filteredServiceRequests.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                <p className="text-slate-500 font-medium">No active service requests.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedServiceRequests.map(trip => (
                  <div key={trip.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-start justify-between gap-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <div className="flex-1 pl-2">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-lg text-slate-900">{trip.driverName}</p>
                        <span className="text-slate-400 text-sm font-medium">reported an issue with</span>
                        <p className="font-bold text-lg text-slate-900">{trip.vehicleName}</p>
                        {trip.status === 'active' && (
                          <span className="ml-2 text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-wide">
                            Currently Driving
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        <Clock className="w-3 h-3 inline mr-1" /> Reported at {trip.startTime ? formatTime(trip.startTime) : 'Unknown'}
                      </p>
                      <IssueDetails trip={trip} />
                    </div>
                    <div>
                      <button 
                        onClick={() => confirmResolve(trip.id, trip.status)}
                        className="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2 active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination total={filteredServiceRequests.length} current={serviceRequestsPage} onChange={setServiceRequestsPage} />
          </div>
          );
        })()}

        {activeTab === 'active_trips' && (() => {
          const paginatedActiveTrips = activeTrips.slice((activeTripsPage - 1) * ITEMS_PER_PAGE, activeTripsPage * ITEMS_PER_PAGE);
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-2 text-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                 <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse"></span>
              </div>
              Active Trips
            </h2>
            {activeTrips.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                <p className="text-slate-500 font-medium">No drivers currently on the road.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedActiveTrips.map(trip => (
                  <div key={trip.id} className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-lg text-slate-900">{trip.driverName} <span className="text-slate-500 text-base font-normal mx-1">in</span> {trip.vehicleName}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1.5 font-medium">
                          <Clock className="w-4 h-4 text-slate-900" /> Started at {trip.startTime ? formatTime(trip.startTime) : 'Unknown'}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {trip.serviceNeeded && (
                          <div className="flex items-center text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg text-sm font-semibold">
                            <Wrench className="w-4 h-4 mr-1.5" />
                            Maintenance Requested
                          </div>
                        )}
                        {trip.condition === 'not_ok' && !trip.serviceNeeded && (
                          <div className="flex items-center text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Issues Resolved
                          </div>
                        )}
                        {trip.condition === 'ok' && !trip.serviceNeeded && (
                          <div className="flex items-center text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Condition OK
                          </div>
                        )}
                      </div>
                    </div>
                    <IssueDetails trip={trip} />
                  </div>
                ))}
              </div>
            )}
            <Pagination total={activeTrips.length} current={activeTripsPage} onChange={setActiveTripsPage} />
          </div>
          );
        })()}

        {activeTab === 'history' && (() => {
          const paginatedHistory = completedTrips.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
              <h2 className="text-xl font-semibold text-slate-800">Trip History</h2>
              {completedTrips.length > 0 && (
                <button
                  onClick={downloadHistoryAsCSV}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap text-sm"
                >
                  <Download className="w-4 h-4" /> Export as CSV
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                    <th className="pb-3 font-semibold px-2">Driver & Vehicle</th>
                    <th className="pb-3 font-semibold px-2">Timing</th>
                    <th className="pb-3 font-semibold px-2">Duration</th>
                    <th className="pb-3 font-semibold px-2">Condition & Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.map(trip => (
                    <tr key={trip.id} className="text-slate-800 align-top hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-2">
                        <div className="font-semibold text-slate-900">{trip.driverName}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{trip.vehicleName}</div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="text-slate-600 font-medium">{trip.startTime ? formatTime(trip.startTime) : '-'} <span className="text-slate-300 mx-1">→</span> {trip.endTime ? formatTime(trip.endTime) : '-'}</div>
                      </td>
                      <td className="py-4 px-2 font-semibold text-slate-700">
                        {trip.duration ? formatDuration(trip.duration) : '-'}
                      </td>
                      <td className="py-4 px-2">
                         <div className="flex flex-col gap-2 items-start">
                            {trip.serviceNeeded && (
                              <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">Service Required</span>
                            )}
                            {trip.condition === 'not_ok' && !trip.serviceNeeded && (
                              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">Issues Resolved</span>
                            )}
                            {trip.condition === 'ok' && !trip.serviceNeeded && (
                              <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">All Good</span>
                            )}
                         </div>
                         <div className="mt-3 w-full min-w-[280px]">
                           <IssueDetails trip={trip} />
                         </div>
                      </td>
                    </tr>
                  ))}
                  {completedTrips.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">No completed trips yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={completedTrips.length} current={historyPage} onChange={setHistoryPage} />
          </div>
          );
        })()}
      </main>

      {resolvingTripId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Resolve Issue?</h3>
            <p className="text-slate-500 text-center text-sm mb-6">
              Are you sure you want to mark this service request as resolved? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setResolvingTripId(null); setResolvingTripStatus(null); }}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmResolve}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

