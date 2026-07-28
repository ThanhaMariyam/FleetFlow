import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Driver, Vehicle, Trip } from '../types';
import { ShieldCheck, AlertCircle, Wrench, Play, Square, Truck, Route, Clock, CheckCircle2, Check, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDuration } from '../utils';

const CHECKLIST_ITEMS = [
  "Tires", "Lights", "Brakes", "Horn", "Mirrors", 
  "Windshield/Wipers", "Engine Oil", "Coolant Level", 
  "Fuel Level", "Battery Condition", "Seat Belts", 
  "Fire Extinguisher", "First Aid Kit", "Vehicle Body Condition", 
  "Leaks (Oil/Coolant/Fuel)", "Others"
];

export default function DriverPanel() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [selectedDriverId, setSelectedDriverId] = useState(() => {
    return localStorage.getItem('fleetflow_driver_id') || '';
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const savedDriver = drivers.find(d => d.id === selectedDriverId);
  
  const [step, setStep] = useState<'setup' | 'condition' | 'checklist' | 'waiting_service' | 'ready' | 'driving'>('setup');
  const [condition, setCondition] = useState<'ok' | 'not_ok' | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Cleanup session if the driver was deleted from database
  useEffect(() => {
    if (selectedDriverId && drivers.length > 0) {
      const exists = drivers.some(d => d.id === selectedDriverId);
      if (!exists) {
        localStorage.removeItem('fleetflow_driver_id');
        setSelectedDriverId('');
      }
    }
  }, [drivers, selectedDriverId]);
  
  // Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState('');
  const [isDriveable, setIsDriveable] = useState<boolean | null>(null);
  const [serviceNeeded, setServiceNeeded] = useState(false);
  
  // Active Trip State
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'history'>('terminal');
  const [historyTab, setHistoryTab] = useState<'trips' | 'issues'>('trips');
  const [tripsPage, setTripsPage] = useState(1);
  const [issuesPage, setIssuesPage] = useState(1);

  useEffect(() => {
    setTripsPage(1);
    setIssuesPage(1);
  }, [selectedDriverId, historyTab]);

  const handleGoBack = () => {
    if (step === 'condition') {
      setStep('setup');
    } else if (step === 'checklist') {
      setStep('condition');
      setCondition(null);
    } else if (step === 'waiting_service') {
      setStep('checklist');
    } else if (step === 'ready') {
      if (condition === 'ok') {
        setStep('condition');
        setCondition(null);
      } else {
        setStep('checklist');
      }
    }
  };

  useEffect(() => {
    const unsubD = onSnapshot(query(collection(db, 'drivers')), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
    });
    const unsubV = onSnapshot(query(collection(db, 'vehicles')), (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });
    const unsubT = onSnapshot(query(collection(db, 'trips')), (snap) => {
      let fetchedTrips = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      fetchedTrips = fetchedTrips.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setTrips(fetchedTrips);
    });
    return () => { unsubD(); unsubV(); unsubT(); };
  }, []);
  // Restore active trip or service status on page reload/driver changes
  useEffect(() => {
    if (!selectedDriverId || trips.length === 0) return;
    
    if (step === 'setup') {
      const activeTrip = trips.find(t => t.driverId === selectedDriverId && t.status === 'active');
      if (activeTrip) {
        setActiveTripId(activeTrip.id);
        setSelectedVehicleId(activeTrip.vehicleId);
        setStep('driving');
        return;
      }
      
      const waitingTrip = trips.find(t => t.driverId === selectedDriverId && t.status === 'waiting_service');
      if (waitingTrip) {
        setActiveTripId(waitingTrip.id);
        setSelectedVehicleId(waitingTrip.vehicleId);
        setStep('waiting_service');
        return;
      }
    }
  }, [selectedDriverId, trips, step]);
  // Listen to active trip changes (e.g. admin updating service status)
  useEffect(() => {
    if (!activeTripId) return;
    const unsub = onSnapshot(doc(db, 'trips', activeTripId), (docSnap) => {
      if (docSnap.exists()) {
        const tripData = docSnap.data() as Trip;
        if (tripData.status === 'service_completed' && step === 'waiting_service') {
          setStep('ready');
        }
      }
    });
    return () => unsub();
  }, [activeTripId, step]);

  const handleSetupNext = () => {
    if (selectedDriverId && selectedVehicleId) {
      localStorage.setItem('fleetflow_driver_id', selectedDriverId);
      setStep('condition');
    }
  };

  const handleConditionSelect = (isOk: boolean) => {
    setCondition(isOk ? 'ok' : 'not_ok');
    if (isOk) {
      setStep('ready');
    } else {
      setStep('checklist');
    }
  };

  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDriveable === null) return;

    if (isDriveable) {
      setStep('ready');
    } else {
      // Request service
      const driver = drivers.find(d => d.id === selectedDriverId);
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (!driver || !vehicle) return;

      const newTrip: Omit<Trip, 'id'> = {
        driverId: driver.id,
        driverName: driver.name,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        status: 'waiting_service',
        condition: 'not_ok',
        serviceNeeded: true,
        checklist,
        remarks
      };

      const docRef = await addDoc(collection(db, 'trips'), newTrip);
      setActiveTripId(docRef.id);
      setStep('waiting_service');
    }
  };

  const handleStartDriving = async () => {
    if (activeTripId) {
      // It means they were waiting for service and now it's completed
      await updateDoc(doc(db, 'trips', activeTripId), {
        status: 'active',
        startTime: Date.now()
      });
      setStep('driving');
    } else {
      // Regular start
      const driver = drivers.find(d => d.id === selectedDriverId);
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (!driver || !vehicle) return;

      const newTrip: Omit<Trip, 'id'> = {
        driverId: driver.id,
        driverName: driver.name,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        status: 'active',
        startTime: Date.now(),
        condition: condition!,
        serviceNeeded: condition === 'not_ok' ? serviceNeeded : false,
      };

      if (condition === 'not_ok') {
        newTrip.checklist = checklist;
        newTrip.remarks = remarks;
      }

      const docRef = await addDoc(collection(db, 'trips'), newTrip);
      setActiveTripId(docRef.id);
      setStep('driving');
    }
  };

  const handleEndDriving = async () => {
    if (!activeTripId) return;
    
    const endTime = Date.now();
    const docRef = doc(db, 'trips', activeTripId);
    
    // In a real app we'd fetch the startTime from the DB or state, assuming we have it locally if we started it
    // To be safe and simple, we let a cloud function or simple subtraction handle it if we stored start time.
    // We'll just fetch current time. Since we only just created it, we can calculate roughly or fetch.
    // Best way: just store endTime and calculate duration now.
    // For exactness, we'd read the doc, but we can assume we know it's about now minus when we clicked start.
    // Let's just do a simple read to be accurate, or just trust the DB will update it.
    
    // Since we need duration to save to DB, let's just record endTime and let a cloud func do it? No, we calculate here.
    // We don't have startTime in state cleanly, let's assume we can just pass endTime. 
    // Actually, we can fetch it or just use a local startTime state.
    
    // Let's fetch the document to get the exact start time to calculate duration accurately.
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const tripData = snap.data() as Trip;
      const duration = endTime - tripData.startTime;
      await updateDoc(docRef, {
        status: 'completed',
        endTime: endTime,
        duration: duration
      });
    }

    // Reset for next driver
    setStep('setup');
    setSelectedVehicleId('');
    setCondition(null);
    setChecklist({});
    setRemarks('');
    setIsDriveable(null);
    setServiceNeeded(false);
    setActiveTripId(null);
  };

  const toggleChecklist = (item: string) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const myTrips = trips.filter(t => t.driverId === selectedDriverId);
  const myTripLogs = myTrips.filter(t => t.status === 'completed' || t.status === 'active' || (t.status === 'ready' && t.startTime));
  const myIssues = myTrips.filter(t => t.condition === 'not_ok');
  
  const TRIPS_PER_PAGE = 3;

  // Trips Log Pagination
  const totalTripsPages = Math.ceil(myTripLogs.length / TRIPS_PER_PAGE);
  const paginatedTripLogs = myTripLogs.slice((tripsPage - 1) * TRIPS_PER_PAGE, tripsPage * TRIPS_PER_PAGE);

  // Issues Pagination
  const totalIssuesPages = Math.ceil(myIssues.length / TRIPS_PER_PAGE);
  const paginatedIssues = myIssues.slice((issuesPage - 1) * TRIPS_PER_PAGE, issuesPage * TRIPS_PER_PAGE);

  const getTripStatusBadge = (trip: Trip) => {
    if (trip.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Active
        </span>
      );
    }
    if (trip.status === 'waiting_service' || (trip.status === 'completed' && trip.serviceNeeded)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 animate-pulse">
          <Wrench className="w-3 h-3" />
          Service Pending
        </span>
      );
    }
    if (trip.status === 'service_completed' || (trip.condition === 'not_ok' && !trip.serviceNeeded)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-green-700 bg-green-50 border border-green-200">
          <CheckCircle2 className="w-3 h-3" />
          Maintenance Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100">
        <Check className="w-3 h-3" />
        Completed
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header Bar (Full width, no rounded corners) */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-400 font-bold" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">FleetFlow</h1>
              <p className="text-xs text-slate-400">Driver Terminal</p>
            </div>
          </div>
          <div className="text-right text-xs md:text-sm font-semibold text-slate-400">
            <div>{formattedDate}</div>
            <div className="font-mono mt-0.5">{formattedTime}</div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Persistent Tab Navigation (Shown on all pages) */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl w-full md:w-fit gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('terminal')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeSubTab === 'terminal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {step === 'driving' ? 'Active Trip' : (step === 'setup' ? 'Start Trip' : 'Trip Setup')}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${activeSubTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            My History
            {selectedDriverId && myTrips.some(t => t.status === 'waiting_service' || t.serviceNeeded) && (
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {activeSubTab === 'terminal' ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto w-full">
            {/* Back Button (shown on eligible steps) */}
            {step !== 'setup' && step !== 'driving' && (
              <button
                type="button"
                onClick={handleGoBack}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4 group active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back
              </button>
            )}

            <AnimatePresence mode="wait">
              {step === 'setup' && (
                <motion.div 
                  key="setup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Select Driver / Welcome Message */}
                  {selectedDriverId && savedDriver ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-medium">Driver</span>
                        <span className="text-lg font-bold text-slate-800">Hi, {savedDriver.name}!</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('fleetflow_driver_id');
                          setSelectedDriverId('');
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        Change Driver
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Select Driver</label>
                      <select 
                        value={selectedDriverId} 
                        onChange={e => setSelectedDriverId(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-800"
                      >
                        <option value="" disabled>Choose your name</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Select Vehicle */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Select Vehicle</label>
                    <select 
                      value={selectedVehicleId} 
                      onChange={e => setSelectedVehicleId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-800"
                    >
                      <option value="" disabled>Choose your vehicle</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={handleSetupNext}
                    disabled={!selectedDriverId || !selectedVehicleId}
                    className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 'condition' && (
                <motion.div 
                  key="condition"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center space-y-6"
                >
                  <h2 className="text-xl font-semibold text-slate-800">Vehicle Condition</h2>
                  <p className="text-slate-600">Is the vehicle in good condition for the trip?</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button 
                      onClick={() => handleConditionSelect(true)}
                      className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-slate-100 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <ShieldCheck className="w-10 h-10 text-green-500 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-slate-700">All Good</span>
                    </button>
                    <button 
                      onClick={() => handleConditionSelect(false)}
                      className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-slate-100 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all group"
                    >
                      <AlertCircle className="w-10 h-10 text-orange-500 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-slate-700">Report Issue</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'checklist' && (
                <motion.div 
                  key="checklist"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-xl font-semibold text-slate-800 mb-2">Issue Report</h2>
                  <p className="text-sm text-slate-500 mb-6">Please check the items that are NOT OK.</p>
                  
                  <form onSubmit={handleChecklistSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {CHECKLIST_ITEMS.map(item => (
                        <label key={item} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${checklist[item] ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
                          <input 
                            type="checkbox" 
                            checked={!!checklist[item]}
                            onChange={() => toggleChecklist(item)}
                            className="mt-1 rounded text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-sm text-slate-700 select-none">{item}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Additional Remarks</label>
                      <textarea 
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all resize-none h-24"
                        placeholder="Describe the issue..."
                      />
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">Is the vehicle okay to drive?</label>
                        <div className="flex gap-4">
                          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${isDriveable === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50'}`}>
                            <input 
                              type="radio" 
                              name="driveable"
                              checked={isDriveable === true}
                              onChange={() => setIsDriveable(true)}
                              className="hidden"
                            />
                            <span className="font-semibold">Yes, OK to drive</span>
                          </label>
                          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${isDriveable === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50'}`}>
                            <input 
                              type="radio" 
                              name="driveable"
                              checked={isDriveable === false}
                              onChange={() => setIsDriveable(false)}
                              className="hidden"
                            />
                            <span className="font-semibold">No, request service</span>
                          </label>
                        </div>
                      </div>
                      
                      {isDriveable === true && (
                        <motion.label 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${serviceNeeded ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={serviceNeeded}
                            onChange={e => setServiceNeeded(e.target.checked)}
                            className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                          />
                          <div>
                            <span className="block font-medium text-slate-800">Request Maintenance</span>
                            <span className="block text-xs text-slate-500 mt-0.5">Vehicle requires service (e.g. after trip)</span>
                          </div>
                        </motion.label>
                      )}
                    </div>

                    <button 
                      type="submit"
                      disabled={isDriveable === null}
                      className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                    >
                      Submit Report
                    </button>
                  </form>
                </motion.div>
              )}

              {step === 'waiting_service' && (
                <motion.div 
                  key="waiting_service"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="text-center py-8 space-y-6"
                >
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                    <Wrench className="w-10 h-10 text-orange-500 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Service Requested</h2>
                    <p className="text-slate-500 mt-2">Waiting for admin to resolve the issue...</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-sm text-orange-800 font-medium">
                    We'll notify you here once the vehicle is ready to go.
                  </div>
                  <button 
                    onClick={() => {
                      setActiveTripId(null);
                      setSelectedVehicleId('');
                      setCondition(null);
                      setChecklist({});
                      setRemarks('');
                      setIsDriveable(null);
                      setServiceNeeded(false);
                      setStep('setup');
                    }}
                    className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    Select Another Vehicle
                  </button>
                </motion.div>
              )}

              {step === 'ready' && (
                <motion.div 
                  key="ready"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="text-center py-8 space-y-8"
                >
                  <div>
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-10 h-10 text-slate-900 ml-1" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Ready to go!</h2>
                    <p className="text-slate-500 mt-2">Have a safe and pleasant journey.</p>
                  </div>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={handleStartDriving}
                      className="w-full bg-slate-900 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Start Driving
                    </button>
                    <button 
                      onClick={() => {
                        setActiveTripId(null);
                        setSelectedVehicleId('');
                        setCondition(null);
                        setChecklist({});
                        setRemarks('');
                        setIsDriveable(null);
                        setServiceNeeded(false);
                        setStep('setup');
                      }}
                      className="w-full text-slate-500 hover:text-slate-800 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                    >
                      Choose Different Vehicle
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'driving' && (
                <motion.div 
                  key="driving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 space-y-8"
                >
                  <div>
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-50"></div>
                      <div className="relative w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                        <Route className="w-10 h-10 text-green-600" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Trip in Progress</h2>
                    <p className="text-green-600 font-medium mt-2">Stay safe on the road!</p>
                  </div>
                  
                  <button 
                    onClick={handleEndDriving}
                    className="w-full bg-slate-900 text-white flex items-center justify-center gap-2 text-lg font-bold py-4 rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    End Trip
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full space-y-6">
            {!selectedDriverId ? (
              <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 min-h-[220px]">
                <Clock className="w-8 h-8 text-slate-300 mb-2" />
                <h3 className="text-sm font-semibold text-slate-600">No Driver Selected</h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">Select your name under the "Start Trip" tab first to view your history logs.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* History Sub-tab Toggle Bar */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryTab('trips')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'trips' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    Trips Log ({myTripLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab('issues')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'issues' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Service Requests ({myIssues.length})
                  </button>
                </div>

                {historyTab === 'trips' ? (
                  <div className="space-y-4">
                    {myTripLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        No completed trips recorded yet.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5 min-h-[180px]">
                          {paginatedTripLogs.map(trip => (
                            <div key={trip.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-between gap-4 text-xs">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 text-sm block truncate">{trip.vehicleName}</span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                                  {trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                                </span>
                              </div>
                              
                              <div className="text-right shrink-0">
                                <span className="font-bold text-slate-700 text-sm block mb-1">
                                  {trip.duration ? formatDuration(trip.duration) : (trip.status === 'active' ? 'Active' : '-')}
                                </span>
                                {getTripStatusBadge(trip)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Trips Log Pagination Controls */}
                        {totalTripsPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                            <button
                              type="button"
                              onClick={() => setTripsPage(p => Math.max(1, p - 1))}
                              disabled={tripsPage === 1}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Prev
                            </button>
                            <span className="text-slate-500 font-semibold">Page {tripsPage} of {totalTripsPages}</span>
                            <button
                              type="button"
                              onClick={() => setTripsPage(p => Math.min(totalTripsPages, p + 1))}
                              disabled={tripsPage === totalTripsPages}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myIssues.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        No reported issues or service requests found.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5 min-h-[180px]">
                          {paginatedIssues.map(trip => {
                            const checklistItems = Object.entries(trip.checklist || {})
                              .filter(([_, value]) => value)
                              .map(([key]) => key);
                            return (
                              <div key={trip.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300 transition-colors space-y-3 text-xs">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 text-sm block truncate">{trip.vehicleName}</span>
                                    <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                                      {trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {getTripStatusBadge(trip)}
                                  </div>
                                </div>
                                
                                {/* Checklist & Remarks details */}
                                <div className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-2">
                                  {checklistItems.length > 0 && (
                                    <div>
                                      <strong className="text-slate-800">Failed Items:</strong> {checklistItems.join(', ')}
                                    </div>
                                  )}
                                  {trip.remarks && (
                                    <div>
                                      <strong className="text-slate-800">Remarks:</strong> "{trip.remarks}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Issues Pagination Controls */}
                        {totalIssuesPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                            <button
                              type="button"
                              onClick={() => setIssuesPage(p => Math.max(1, p - 1))}
                              disabled={issuesPage === 1}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Prev
                            </button>
                            <span className="text-slate-500 font-semibold">Page {issuesPage} of {totalIssuesPages}</span>
                            <button
                              type="button"
                              onClick={() => setIssuesPage(p => Math.min(totalIssuesPages, p + 1))}
                              disabled={issuesPage === totalIssuesPages}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
