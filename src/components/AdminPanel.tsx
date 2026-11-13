import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, deleteDoc } from 'firebase/firestore';
import { Driver, Vehicle, Trip } from '../types';
import { formatDuration, formatTime } from '../utils';
import { ShieldAlert, CheckCircle2, AlertTriangle, Clock, Wrench, ChevronDown, ChevronUp, Settings, Users, Trash2, Edit2, Car, Phone, Download, Truck, Route, Lock, LogOut, Image, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import config from '../../firebase-applet-config.json';

export default function AdminPanel() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  
  const [activeTab, setActiveTab] = useState<'active_trips' | 'service_requests' | 'history' | 'manage' | 'driver_stats' | 'overtime'>('active_trips');

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

  // New Resolve dialog states
  const [serviceType, setServiceType] = useState<'performed' | 'no_service'>('performed');
  const [serviceCostInput, setServiceCostInput] = useState('');
  const [serviceLocationInput, setServiceLocationInput] = useState('');
  const [billImageBase64, setBillImageBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Date filters
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [costsStartDate, setCostsStartDate] = useState('');
  const [costsEndDate, setCostsEndDate] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'performed' | 'no_service'>('all');

  // Overtime states
  const [overtimePage, setOvertimePage] = useState(1);
  const [overtimeTimeFilter, setOvertimeTimeFilter] = useState<'all' | 'day' | 'custom'>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [hasVisitedOvertime, setHasVisitedOvertime] = useState(false);
  const [selectedOvertimeWeek, setSelectedOvertimeWeek] = useState('all');
  const [selectedOvertimeMonth, setSelectedOvertimeMonth] = useState('all');
  const [selectedOvertimeYear, setSelectedOvertimeYear] = useState('none');

  const toggleExpandLog = (logId: string) => {
    setExpandedLogIds(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Image preview modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Delete confirmation modal state
  interface DeleteTarget {
    type: 'driver' | 'vehicle' | 'trip' | 'overtime';
    id?: string;
    tripIds?: string[];
    title: string;
    description: string;
    itemDetails?: { label: string; value: string }[];
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeTripsPage, setActiveTripsPage] = useState(1);
  const [serviceRequestsPage, setServiceRequestsPage] = useState(1);
  const [resolvedCostsPage, setResolvedCostsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [driversPage, setDriversPage] = useState(1);
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [statsPage, setStatsPage] = useState(1);
  
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [serviceRequestsTab, setServiceRequestsTab] = useState<'pending' | 'resolved'>('pending');
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'driver' && deleteTarget.id) {
        await deleteDoc(doc(db, 'drivers', deleteTarget.id));
      } else if (deleteTarget.type === 'vehicle' && deleteTarget.id) {
        await deleteDoc(doc(db, 'vehicles', deleteTarget.id));
      } else if (deleteTarget.type === 'trip' && deleteTarget.id) {
        await deleteDoc(doc(db, 'trips', deleteTarget.id));
      } else if (deleteTarget.type === 'overtime' && deleteTarget.tripIds) {
        await Promise.all(deleteTarget.tripIds.map(tId => deleteDoc(doc(db, 'trips', tId))));
      }
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete: ' + (err.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDeleteDriver = (driver: Driver) => {
    setDeleteTarget({
      type: 'driver',
      id: driver.id,
      title: 'Delete Driver',
      description: `Are you sure you want to delete driver "${driver.name}"? This action cannot be undone.`,
      itemDetails: [
        { label: 'Driver Name', value: driver.name },
        { label: 'Phone Number', value: driver.phoneNumber || 'None' }
      ]
    });
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

  const requestDeleteVehicle = (vehicle: Vehicle) => {
    setDeleteTarget({
      type: 'vehicle',
      id: vehicle.id,
      title: 'Delete Vehicle',
      description: `Are you sure you want to delete vehicle "${vehicle.name}"? This action cannot be undone.`,
      itemDetails: [
        { label: 'Vehicle Identifier / Plate', value: vehicle.name }
      ]
    });
  };

  const requestDeleteResolvedCost = (trip: Trip) => {
    const resolvedDate = trip.resolvedAt ? new Date(trip.resolvedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
    const costStr = trip.serviceType === 'no_service' ? 'No Service Needed' : `OMR ${(trip.serviceCost || 0).toFixed(3)}`;
    setDeleteTarget({
      type: 'trip',
      id: trip.id,
      title: 'Delete Resolved Cost Record',
      description: 'Are you sure you want to delete this maintenance cost log entry? This will permanently delete this record from the database.',
      itemDetails: [
        { label: 'Vehicle', value: trip.vehicleName },
        { label: 'Reported By', value: trip.driverName },
        { label: 'Resolved Date', value: resolvedDate },
        { label: 'Service Type', value: trip.serviceType === 'no_service' ? 'Solved Without Service' : 'Service Performed' },
        { label: 'Shop / Dealer', value: trip.serviceLocation || '-' },
        { label: 'Cost', value: costStr }
      ]
    });
  };

  const requestDeletePendingService = (trip: Trip) => {
    setDeleteTarget({
      type: 'trip',
      id: trip.id,
      title: 'Delete Service Request',
      description: 'Are you sure you want to delete this service request? This will permanently remove the reported request.',
      itemDetails: [
        { label: 'Driver', value: trip.driverName },
        { label: 'Vehicle', value: trip.vehicleName },
        { label: 'Reported Time', value: trip.startTime ? formatTime(trip.startTime) : 'Unknown' }
      ]
    });
  };

  const requestDeleteActiveTrip = (trip: Trip) => {
    setDeleteTarget({
      type: 'trip',
      id: trip.id,
      title: 'Delete Active Trip',
      description: 'Are you sure you want to delete this active trip? This will immediately remove the active trip from the system.',
      itemDetails: [
        { label: 'Driver', value: trip.driverName },
        { label: 'Vehicle', value: trip.vehicleName },
        { label: 'Start Time', value: trip.startTime ? formatTime(trip.startTime) : 'Unknown' }
      ]
    });
  };

  const requestDeleteTripHistory = (trip: Trip) => {
    const tripDate = trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
    setDeleteTarget({
      type: 'trip',
      id: trip.id,
      title: 'Delete Trip History Record',
      description: 'Are you sure you want to delete this completed trip record? This action cannot be undone.',
      itemDetails: [
        { label: 'Driver', value: trip.driverName },
        { label: 'Vehicle', value: trip.vehicleName },
        { label: 'Date', value: tripDate },
        { label: 'Duration', value: trip.duration ? formatDuration(trip.duration) : '-' }
      ]
    });
  };

  const requestDeleteOvertimeLog = (log: OvertimeLog) => {
    const formattedDate = new Date(log.dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    setDeleteTarget({
      type: 'overtime',
      tripIds: log.trips.map(t => t.id),
      title: 'Delete Overtime Log',
      description: `Are you sure you want to delete this overtime log? This will permanently delete all ${log.trips.length} completed trip record(s) on ${formattedDate} for driver ${log.driverName}.`,
      itemDetails: [
        { label: 'Driver', value: log.driverName },
        { label: 'Date', value: formattedDate },
        { label: 'Total Duration', value: formatDuration(log.totalDuration) },
        { label: 'Trips Count', value: `${log.trips.length} ride(s)` }
      ]
    });
  };

  const requestDeleteSingleOvertimeTrip = (trip: Trip, driverName: string) => {
    setDeleteTarget({
      type: 'trip',
      id: trip.id,
      title: 'Delete Trip Record',
      description: 'Are you sure you want to delete this individual trip record from the overtime breakdown?',
      itemDetails: [
        { label: 'Driver', value: driverName },
        { label: 'Vehicle', value: trip.vehicleName },
        { label: 'Timing', value: `${trip.startTime ? formatTime(trip.startTime) : '-'} → ${trip.endTime ? formatTime(trip.endTime) : '-'}` },
        { label: 'Duration', value: trip.duration ? formatDuration(trip.duration) : '-' }
      ]
    });
  };

  const confirmResolve = (tripId: string, currentStatus: string) => {
    setServiceType('performed');
    setServiceCostInput('');
    setServiceLocationInput('');
    setBillImageBase64('');
    setResolvingTripId(tripId);
    setResolvingTripStatus(currentStatus);
  };

  const handleConfirmResolve = async () => {
    if (!resolvingTripId || !resolvingTripStatus) return;
    
    try {
      const updateData: any = {
        serviceNeeded: false,
        endServiceNeeded: false,
        resolvedAt: Date.now(),
        serviceType: serviceType
      };

      if (serviceType === 'performed') {
        updateData.serviceCost = Number(serviceCostInput) || 0;
        updateData.serviceLocation = serviceLocationInput.trim();
        if (billImageBase64) {
          updateData.billImage = billImageBase64;
        }
      }

      if (resolvingTripStatus === 'waiting_service') {
        updateData.status = 'service_completed';
      }

      await updateDoc(doc(db, 'trips', resolvingTripId), updateData);
    } catch (err: any) {
      console.error(err);
      alert('Failed to resolve request: ' + (err.message || err));
    }
    
    setResolvingTripId(null);
    setResolvingTripStatus(null);
    setServiceType('performed');
    setServiceCostInput('');
    setServiceLocationInput('');
    setBillImageBase64('');
  };

  const downloadHistoryAsCSV = () => {
    const headers = [
      'Sl. No.',
      'Date',
      'Driver Name', 
      'Vehicle Identifier', 
      'Start Time', 
      'End Time', 
      'Duration', 
      'Before Trip Condition', 
      'Before Trip Remarks', 
      'After Trip Condition', 
      'After Trip Remarks'
    ];
    const rows = filteredCompletedTrips.map((trip, idx) => {
      const beforeChecks = trip.condition === 'ok' ? 'All Good' : 'Issues Reported';
      const afterChecks = trip.endCondition === 'ok' ? 'All Good' : (trip.endCondition === 'not_ok' ? 'Issues Reported' : '-');
      const tripDate = trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
      return [
        `"${idx + 1}"`,
        `"${tripDate}"`,
        `"${trip.driverName}"`,
        `"${trip.vehicleName}"`,
        `"${trip.startTime ? formatTime(trip.startTime) : 'Unknown'}"`,
        `"${trip.endTime ? formatTime(trip.endTime) : 'Unknown'}"`,
        `"${trip.startTime && trip.endTime && trip.duration ? formatDuration(trip.duration) : '-'}"`,
        `"${beforeChecks}"`,
        `"${(trip.remarks || '').replace(/"/g, '""')}"`,
        `"${afterChecks}"`,
        `"${(trip.endRemarks || '').replace(/"/g, '""')}"`
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'trip_history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCostsAsCSV = () => {
    const headers = [
      'Sl. No.',
      'Vehicle Identifier',
      'Driver Name',
      'Reported Date',
      'Reported Time',
      'Resolved Date',
      'Resolved Time',
      'Service Type',
      'Shop / Dealer',
      'Cost (OMR)',
      'Issues Reported',
      'Receipt Status'
    ];
    const rows = filteredResolvedTrips.map((trip, idx) => {
      const repDate = trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
      const reportTime = trip.startTime ? formatTime(trip.startTime) : 'Unknown';
      const resDate = trip.resolvedAt ? new Date(trip.resolvedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
      const resolvedTime = trip.resolvedAt ? formatTime(trip.resolvedAt) : 'Unknown';
      const sType = trip.serviceType === 'no_service' ? 'Solved Without Service' : 'Service Performed';
      const costStr = trip.serviceType === 'no_service' ? '-' : (trip.serviceCost || 0).toFixed(3);
      const shopStr = trip.serviceType === 'no_service' ? '-' : (trip.serviceLocation || '');
      
      const beforeIssues = trip.condition === 'not_ok' ? Object.entries(trip.checklist || {}).filter(([_, v]) => v).map(([k]) => k).join('; ') : '';
      const afterIssues = trip.endCondition === 'not_ok' ? Object.entries(trip.endChecklist || {}).filter(([_, v]) => v).map(([k]) => k).join('; ') : '';
      const issuesStr = [beforeIssues, afterIssues].filter(Boolean).join(' | ');

      const receiptStr = trip.billImage ? 'Attached' : 'No Receipt';

      return [
        `"${idx + 1}"`,
        `"${trip.vehicleName}"`,
        `"${trip.driverName}"`,
        `"${repDate}"`,
        `"${reportTime}"`,
        `"${resDate}"`,
        `"${resolvedTime}"`,
        `"${sType}"`,
        `"${shopStr.replace(/"/g, '""')}"`,
        `"${costStr}"`,
        `"${issuesStr.replace(/"/g, '""')}"`,
        `"${receiptStr}"`
      ];
    });

    // Append cost summary info based on current filter applied
    rows.push([]);
    rows.push([
      '"Total Maintenance Cost (OMR)"',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      `"${totalExpense.toFixed(3)}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'maintenance_costs_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadOvertimeAsCSV = () => {
    const headers = [
      'Sl. No.',
      'Driver Name',
      'Date',
      'Total Rides',
      'Total Duration',
      'Trips Breakdown'
    ];
    const rows = filteredOvertimeLogs.map((log, idx) => {
      const formattedDate = new Date(log.dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const durationStr = formatDuration(log.totalDuration);
      
      const breakdownStr = log.trips.map(trip => {
        const timeStr = trip.startTime && trip.endTime 
          ? `${formatTime(trip.startTime)} - ${formatTime(trip.endTime)}` 
          : '';
        const tripDuration = trip.duration ? formatDuration(trip.duration) : '-';
        return `${trip.vehicleName} (${timeStr} | ${tripDuration})`;
      }).join('; ');

      return [
        `"${idx + 1}"`,
        `"${log.driverName}"`,
        `"${formattedDate}"`,
        `"${log.trips.length}"`,
        `"${durationStr}"`,
        `"${breakdownStr.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `overtime_report_${overtimeTimeFilter}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeTrips = trips.filter(t => t.status === 'active');
  const serviceRequests = trips.filter(t => t.status === 'waiting_service' || t.serviceNeeded || (t.status === 'completed' && t.endServiceNeeded));
  const filteredServiceRequests = driverFilter 
    ? serviceRequests.filter(t => t.driverId === driverFilter)
    : serviceRequests;
  const completedTrips = trips.filter(t => t.status === 'completed');
  const resolvedTrips = trips.filter(t => (t.condition === 'not_ok' || t.endCondition === 'not_ok') && t.resolvedAt !== undefined);

  const filteredCompletedTrips = completedTrips.filter(trip => {
    if (!trip.startTime) return false;
    if (historyStartDate) {
      const startLimit = new Date(historyStartDate);
      startLimit.setHours(0, 0, 0, 0);
      if (trip.startTime < startLimit.getTime()) return false;
    }
    if (historyEndDate) {
      const endLimit = new Date(historyEndDate);
      endLimit.setHours(23, 59, 59, 999);
      if (trip.startTime > endLimit.getTime()) return false;
    }
    return true;
  });

  const filteredResolvedTrips = resolvedTrips.filter(trip => {
    if (!trip.resolvedAt) return false;
    if (costsStartDate) {
      const startLimit = new Date(costsStartDate);
      startLimit.setHours(0, 0, 0, 0);
      if (trip.resolvedAt < startLimit.getTime()) return false;
    }
    if (costsEndDate) {
      const endLimit = new Date(costsEndDate);
      endLimit.setHours(23, 59, 59, 999);
      if (trip.resolvedAt > endLimit.getTime()) return false;
    }
    if (serviceTypeFilter !== 'all' && trip.serviceType !== serviceTypeFilter) {
      return false;
    }
    return true;
  });

  const totalExpense = filteredResolvedTrips
    .filter(t => t.serviceType === 'performed')
    .reduce((sum, t) => sum + (t.serviceCost || 0), 0);

  const allTimeExpense = resolvedTrips
    .filter(t => t.serviceType === 'performed')
    .reduce((sum, t) => sum + (t.serviceCost || 0), 0);

  interface OvertimeLog {
    id: string;
    driverId: string;
    driverName: string;
    dateStr: string; // YYYY-MM-DD
    totalDuration: number; // in milliseconds
    trips: Trip[];
  }

  const overtimeLogs: OvertimeLog[] = (() => {
    const groups: Record<string, { driverId: string; driverName: string; dateStr: string; trips: Trip[]; totalDuration: number }> = {};

    completedTrips.forEach(trip => {
      if (!trip.startTime || !trip.duration) return;
      
      const date = new Date(trip.startTime);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const key = `${trip.driverId}_${dateStr}`;
      
      if (!groups[key]) {
        groups[key] = {
          driverId: trip.driverId,
          driverName: trip.driverName,
          dateStr,
          trips: [],
          totalDuration: 0
        };
      }
      
      groups[key].trips.push(trip);
      groups[key].totalDuration += trip.duration;
    });

    return Object.values(groups)
      .filter(g => g.totalDuration >= 8 * 60 * 60 * 1000)
      .map((g, idx) => ({
        id: `${g.driverId}_${g.dateStr}_${idx}`,
        ...g
      }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  })();

  // Get list of last 5 years (current year + past 4 years)
  const availableYears = (() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      years.push(String(currentYear - i));
    }
    return years;
  })();

  const monthsList = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  // Generate all Sundays for the selected Year and Month
  const availableWeeksOfSelectedMonth = (() => {
    if (selectedOvertimeMonth === 'all') return [];
    const year = Number(selectedOvertimeYear);
    const month = Number(selectedOvertimeMonth);
    
    const sundays: { value: string; label: string }[] = [];
    const date = new Date(year, month, 1);
    const startSunday = new Date(date);
    startSunday.setDate(date.getDate() - date.getDay());
    
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const currentSun = new Date(startSunday);
    
    while (currentSun.getTime() <= lastDayOfMonth.getTime() || currentSun.getMonth() === month) {
      const sunStr = `${currentSun.getFullYear()}-${String(currentSun.getMonth() + 1).padStart(2, '0')}-${String(currentSun.getDate()).padStart(2, '0')}`;
      const label = `Week of ${currentSun.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
      sundays.push({ value: sunStr, label });
      currentSun.setDate(currentSun.getDate() + 7);
    }
    return sundays;
  })();

  const filteredOvertimeLogs = overtimeLogs.filter(log => {
    const logDate = new Date(log.dateStr);
    const now = new Date();
    
    if (overtimeTimeFilter === 'day') {
      return logDate.getFullYear() === now.getFullYear() &&
             logDate.getMonth() === now.getMonth() &&
             logDate.getDate() === now.getDate();
    }
    
    if (overtimeTimeFilter === 'custom') {
      if (selectedOvertimeYear === 'none') {
        return false;
      }
      // 1. Year Filter
      if (logDate.getFullYear() !== Number(selectedOvertimeYear)) {
        return false;
      }
      
      // 2. Month Filter
      if (selectedOvertimeMonth !== 'all') {
        if (logDate.getMonth() !== Number(selectedOvertimeMonth)) {
          return false;
        }
        
        // 3. Week Filter
        if (selectedOvertimeWeek !== 'all') {
          const startOfWeek = new Date(selectedOvertimeWeek);
          startOfWeek.setHours(0, 0, 0, 0);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          
          if (logDate.getTime() < startOfWeek.getTime() || logDate.getTime() > endOfWeek.getTime()) {
            return false;
          }
        }
      }
      return true;
    }
    
    return true;
  });

function Pagination({ total, current, onChange, itemsPerPage = 5 }: { total: number, current: number, onChange: (page: number) => void, itemsPerPage?: number }) {
  const pages = Math.max(1, Math.ceil(total / itemsPerPage));
  if (total === 0) return null;
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

function TripConditionDetails({ trip }: { trip: Trip }) {
  const [translatedRemarks, setTranslatedRemarks] = useState<string | null>(null);
  const [translatedEndRemarks, setTranslatedEndRemarks] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslatingEnd, setIsTranslatingEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorEnd, setErrorEnd] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [showingTranslationEnd, setShowingTranslationEnd] = useState(false);

  const beforeChecklist = Object.entries(trip.checklist || {})
    .filter(([_, value]) => value)
    .map(([key]) => key);

  const afterChecklist = Object.entries(trip.endChecklist || {})
    .filter(([_, value]) => value)
    .map(([key]) => key);

  const hasBeforeIssue = trip.condition === 'not_ok' && (beforeChecklist.length > 0 || trip.remarks);
  const hasAfterIssue = trip.endCondition === 'not_ok' && (afterChecklist.length > 0 || trip.endRemarks);

  if (!hasBeforeIssue && !hasAfterIssue) {
    return (
      <div className="text-slate-500 font-semibold text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        No issues reported before or after trip.
      </div>
    );
  }

  const handleTranslateToggleBefore = async () => {
    if (translatedRemarks) {
      setShowingTranslation(!showingTranslation);
      return;
    }
    if (!trip.remarks) return;
    setIsTranslating(true);
    setError(null);
    try {
      const detectArabic = /[^\x00-\x7F]/.test(trip.remarks);
      const langpair = detectArabic ? 'ar|en' : 'en|ar';
      const myMemoryRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trip.remarks)}&langpair=${langpair}`
      );
      if (myMemoryRes.ok) {
        const myMemoryData = await myMemoryRes.json();
        const text = myMemoryData?.responseData?.translatedText;
        if (text) {
          setTranslatedRemarks(text);
          setShowingTranslation(true);
        }
      } else {
        throw new Error('Translation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to translate');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateToggleAfter = async () => {
    if (translatedEndRemarks) {
      setShowingTranslationEnd(!showingTranslationEnd);
      return;
    }
    if (!trip.endRemarks) return;
    setIsTranslatingEnd(true);
    setErrorEnd(null);
    try {
      const detectArabic = /[^\x00-\x7F]/.test(trip.endRemarks);
      const langpair = detectArabic ? 'ar|en' : 'en|ar';
      const myMemoryRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trip.endRemarks)}&langpair=${langpair}`
      );
      if (myMemoryRes.ok) {
        const myMemoryData = await myMemoryRes.json();
        const text = myMemoryData?.responseData?.translatedText;
        if (text) {
          setTranslatedEndRemarks(text);
          setShowingTranslationEnd(true);
        }
      } else {
        throw new Error('Translation failed');
      }
    } catch (err: any) {
      setErrorEnd(err.message || 'Failed to translate');
    } finally {
      setIsTranslatingEnd(false);
    }
  };

  const needsTranslationBefore = trip.remarks && /[^\x00-\x7F]/.test(trip.remarks);
  const needsTranslationAfter = trip.endRemarks && /[^\x00-\x7F]/.test(trip.endRemarks);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden transition-all duration-300">
      <button 
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          View Checkup Details
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 text-xs space-y-4">
          <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            <span className="font-bold text-slate-800 block mb-1">Pre-Trip Check:</span>
            {!hasBeforeIssue ? (
              <span className="text-green-600 font-semibold">All Good</span>
            ) : (
              <div className="mt-1.5 space-y-2">
                {beforeChecklist.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-600">Failed Checks:</span>
                    <span className="text-slate-650 ml-1">{beforeChecklist.join(', ')}</span>
                  </div>
                )}
                {trip.remarks && (
                  <div className="bg-white p-2 rounded border border-slate-150 mt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-semibold text-slate-700">Remarks: </span>
                        <span className="text-slate-600">
                          {showingTranslation && translatedRemarks ? translatedRemarks : trip.remarks}
                        </span>
                      </div>
                      {needsTranslationBefore && (
                        <button
                          type="button"
                          onClick={handleTranslateToggleBefore}
                          disabled={isTranslating}
                          className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          {isTranslating ? '...' : (showingTranslation ? 'Orig' : 'Trans')}
                        </button>
                      )}
                    </div>
                    {error && <p className="text-[10px] text-red-650 mt-1">{error}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            <span className="font-bold text-slate-800 block mb-1">Post-Trip Check:</span>
            {!hasAfterIssue ? (
              <span className="text-green-600 font-semibold">All Good</span>
            ) : (
              <div className="mt-1.5 space-y-2">
                {afterChecklist.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-600">Failed Checks:</span>
                    <span className="text-slate-650 ml-1">{afterChecklist.join(', ')}</span>
                  </div>
                )}
                {trip.endRemarks && (
                  <div className="bg-white p-2 rounded border border-slate-150 mt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-semibold text-slate-700">Remarks: </span>
                        <span className="text-slate-600">
                          {showingTranslationEnd && translatedEndRemarks ? translatedEndRemarks : trip.endRemarks}
                        </span>
                      </div>
                      {needsTranslationAfter && (
                        <button
                          type="button"
                          onClick={handleTranslateToggleAfter}
                          disabled={isTranslatingEnd}
                          className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          {isTranslatingEnd ? '...' : (showingTranslationEnd ? 'Orig' : 'Trans')}
                        </button>
                      )}
                    </div>
                    {errorEnd && <p className="text-[10px] text-red-650 mt-1">{errorEnd}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

  useEffect(() => {
    setActiveTripsPage(1);
    setServiceRequestsPage(1);
    setResolvedCostsPage(1);
    setHistoryPage(1);
    setDriversPage(1);
    setVehiclesPage(1);
    setStatsPage(1);
    if (activeTab !== 'service_requests') {
      setDriverFilter('');
    }
  }, [activeTab]);

  useEffect(() => {
    const maxActive = Math.max(1, Math.ceil(activeTrips.length / ITEMS_PER_PAGE));
    if (activeTripsPage > maxActive) setActiveTripsPage(maxActive);

    const maxService = Math.max(1, Math.ceil(filteredServiceRequests.length / ITEMS_PER_PAGE));
    if (serviceRequestsPage > maxService) setServiceRequestsPage(maxService);

    const maxResolved = Math.max(1, Math.ceil(filteredResolvedTrips.length / ITEMS_PER_PAGE));
    if (resolvedCostsPage > maxResolved) setResolvedCostsPage(maxResolved);

    const maxHistory = Math.max(1, Math.ceil(filteredCompletedTrips.length / ITEMS_PER_PAGE));
    if (historyPage > maxHistory) setHistoryPage(maxHistory);

    const maxOvertime = Math.max(1, Math.ceil(filteredOvertimeLogs.length / ITEMS_PER_PAGE));
    if (overtimePage > maxOvertime) setOvertimePage(maxOvertime);

    const maxDrivers = Math.max(1, Math.ceil(drivers.length / ITEMS_PER_PAGE));
    if (driversPage > maxDrivers) setDriversPage(maxDrivers);
    if (statsPage > maxDrivers) setStatsPage(maxDrivers);

    const maxVehicles = Math.max(1, Math.ceil(vehicles.length / ITEMS_PER_PAGE));
    if (vehiclesPage > maxVehicles) setVehiclesPage(maxVehicles);
  }, [
    activeTrips.length,
    filteredServiceRequests.length,
    filteredResolvedTrips.length,
    filteredCompletedTrips.length,
    filteredOvertimeLogs.length,
    drivers.length,
    vehicles.length,
    activeTripsPage,
    serviceRequestsPage,
    resolvedCostsPage,
    historyPage,
    overtimePage,
    driversPage,
    statsPage,
    vehiclesPage
  ]);

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
            onClick={() => {
              setActiveTab('overtime');
              setOvertimePage(1);
              setHasVisitedOvertime(true);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'overtime' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Clock className="w-4 h-4" /> Overtime Logs
            {!hasVisitedOvertime && filteredOvertimeLogs.length > 0 && (
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${activeTab === 'overtime' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>{filteredOvertimeLogs.length}</span>
            )}
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
                        <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
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
                      {paginatedDrivers.map((d, idx) => {
                        const driverTrips = trips.filter(t => t.driverId === d.id);
                        const rideCount = completedTrips.filter(t => t.driverName === d.name).length;
                        const reportedCount = driverTrips.filter(t => t.condition === 'not_ok').length;
                        const solvedCount = driverTrips.filter(t => t.condition === 'not_ok' && !t.serviceNeeded).length;
                        const toSolveCount = driverTrips.filter(t => t.condition === 'not_ok' && t.serviceNeeded).length;
                        
                        return (
                          <tr key={d.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-2 font-semibold text-slate-500 text-xs">
                              {(driversPage - 1) * ITEMS_PER_PAGE + idx + 1}
                            </td>
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
                                  className="text-orange-600 hover:text-orange-800 underline font-semibold flex items-center gap-1 active:scale-95 text-left cursor-pointer"
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
                                  <button onClick={handleUpdateDriver} className="text-white bg-slate-900 px-3 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer">Save</button>
                                  <button onClick={() => setEditingDriverId(null)} className="text-slate-600 bg-slate-200 px-3 py-1.5 hover:bg-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingDriverId(d.id);
                                      setEditDriverName(d.name);
                                      setEditDriverPhone(d.phoneNumber || '+968');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Driver"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => requestDeleteDriver(d)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Driver"
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
                          <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">No drivers added yet.</td>
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
                  <button type="submit" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer">
                    Add Vehicle
                  </button>
                </form>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                        <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                        <th className="pb-3 font-semibold px-2">Vehicle Identifier / Plate</th>
                        <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedVehicles.map((v, idx) => (
                        <tr key={v.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 font-semibold text-slate-500 text-xs">
                            {(vehiclesPage - 1) * ITEMS_PER_PAGE + idx + 1}
                          </td>
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
                                <button onClick={handleUpdateVehicle} className="text-white bg-slate-900 px-3 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer">Save</button>
                                <button onClick={() => setEditingVehicleId(null)} className="text-slate-600 bg-slate-200 px-3 py-1.5 hover:bg-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => {
                                    setEditingVehicleId(v.id);
                                    setEditVehicleName(v.name);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Vehicle"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => requestDeleteVehicle(v)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Vehicle"
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
                          <td colSpan={3} className="py-8 text-center text-slate-500 font-medium">No vehicles added yet.</td>
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
                    <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                    <th className="pb-3 font-semibold px-2">Driver Name</th>
                    <th className="pb-3 font-semibold px-2">Phone Number</th>
                    <th className="pb-3 font-semibold px-2">Total Rides Completed</th>
                    <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDrivers.map((driver, idx) => {
                    const rideCount = completedTrips.filter(t => t.driverName === driver.name).length;
                    return (
                      <tr key={driver.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                          {(statsPage - 1) * ITEMS_PER_PAGE + idx + 1}
                        </td>
                        <td className="py-4 px-2 font-semibold text-slate-900">{driver.name}</td>
                        <td className="py-4 px-2 font-medium text-slate-600">{driver.phoneNumber || '-'}</td>
                        <td className="py-4 px-2 font-bold text-slate-900">{rideCount}</td>
                        <td className="py-4 px-2 text-right">
                          <button 
                            onClick={() => requestDeleteDriver(driver)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Driver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">No drivers added yet.</td>
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
          return (
            <div className="space-y-6">
              {/* Sub-tab navigation */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit gap-2">
                <button
                  type="button"
                  onClick={() => setServiceRequestsTab('pending')}
                  className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${serviceRequestsTab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                >
                  Pending Requests ({serviceRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setServiceRequestsTab('resolved')}
                  className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${serviceRequestsTab === 'resolved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                >
                  Resolved Costs Log ({filteredResolvedTrips.length})
                </button>
              </div>

              {serviceRequestsTab === 'pending' ? (() => {
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
                          className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer"
                        >
                          Show All
                        </button>
                      </div>
                    )}
                    <h2 className="text-xl font-semibold mb-5 flex items-center gap-2 text-slate-800">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-red-600" />
                      </div>
                      Pending Service Requests ({filteredServiceRequests.length})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                            <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                            <th className="pb-3 font-semibold px-2">Driver & Vehicle</th>
                            <th className="pb-3 font-semibold px-2">Reported Time</th>
                            <th className="pb-3 font-semibold px-2">Condition Checks</th>
                            <th className="pb-3 font-semibold px-2">Reported Issues</th>
                            <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedServiceRequests.map((trip, idx) => (
                            <tr key={trip.id} className="text-slate-800 align-top hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                                {(serviceRequestsPage - 1) * ITEMS_PER_PAGE + idx + 1}
                              </td>
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900">{trip.driverName}</span>
                                  {trip.status === 'active' && (
                                    <span className="text-[10px] font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wide">
                                      Currently Driving
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5">{trip.vehicleName}</div>
                              </td>
                              <td className="py-4 px-2 text-slate-600 font-medium whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {trip.startTime ? formatTime(trip.startTime) : 'Unknown'}
                                </div>
                                {trip.startTime && (
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-2 text-xs font-medium text-slate-500 whitespace-nowrap space-y-1">
                                <div>Pre-Trip: {trip.condition === 'ok' ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-500 font-bold">NOT OK</span>}</div>
                                {trip.endCondition && (
                                  <div>Post-Trip: {trip.endCondition === 'ok' ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-500 font-bold">NOT OK</span>}</div>
                                )}
                              </td>
                              <td className="py-4 px-2 min-w-[260px]">
                                <TripConditionDetails trip={trip} />
                              </td>
                              <td className="py-4 px-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => confirmResolve(trip.id, trip.status)}
                                    className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Mark Resolved
                                  </button>
                                  <button 
                                    onClick={() => requestDeletePendingService(trip)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Service Request"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {filteredServiceRequests.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">No active service requests.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <Pagination total={filteredServiceRequests.length} current={serviceRequestsPage} onChange={setServiceRequestsPage} />
                  </div>
                );
              })() : (() => {
                const paginatedResolved = filteredResolvedTrips.slice((resolvedCostsPage - 1) * ITEMS_PER_PAGE, resolvedCostsPage * ITEMS_PER_PAGE);
                
                return (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
                      <h2 className="text-xl font-semibold text-slate-800">Resolved Requests & Maintenance Costs ({filteredResolvedTrips.length})</h2>
                      {filteredResolvedTrips.length > 0 && (
                        <button
                          onClick={downloadCostsAsCSV}
                          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap text-sm cursor-pointer"
                        >
                          <Download className="w-4 h-4" /> Export Costs Report
                        </button>
                      )}
                    </div>

                    {/* Date & Type Filters */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-sm">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 font-medium">Start Date:</span>
                          <input
                            type="date"
                            value={costsStartDate}
                            onChange={e => {
                              setCostsStartDate(e.target.value);
                              setResolvedCostsPage(1);
                            }}
                            className="border border-slate-250 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-900 outline-none text-slate-800 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 font-medium">End Date:</span>
                          <input
                            type="date"
                            value={costsEndDate}
                            onChange={e => {
                              setCostsEndDate(e.target.value);
                              setResolvedCostsPage(1);
                            }}
                            className="border border-slate-250 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-900 outline-none text-slate-800 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 font-medium">Service Type:</span>
                          <select
                            value={serviceTypeFilter}
                            onChange={e => {
                              setServiceTypeFilter(e.target.value as any);
                              setResolvedCostsPage(1);
                            }}
                            className="border border-slate-250 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-900 outline-none text-slate-800 text-xs bg-white"
                          >
                            <option value="all">All Resolutions</option>
                            <option value="performed">Service Performed</option>
                            <option value="no_service">Solved Without Service</option>
                          </select>
                        </div>
                        {(costsStartDate || costsEndDate || serviceTypeFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setCostsStartDate('');
                              setCostsEndDate('');
                              setServiceTypeFilter('all');
                              setResolvedCostsPage(1);
                            }}
                            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                      
                      {/* Expenses Summary Banner */}
                      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-sm font-bold text-xs">
                        <span>Maintenance Cost Summary:</span>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 text-right lg:text-left">
                          {(costsStartDate || costsEndDate) ? (
                            <>
                              <span className="text-green-400">Range: OMR {totalExpense.toFixed(3)}</span>
                              <span className="text-slate-400 hidden lg:inline">|</span>
                              <span className="text-slate-300">All-Time: OMR {allTimeExpense.toFixed(3)}</span>
                            </>
                          ) : (
                            <span className="text-green-400">OMR {allTimeExpense.toFixed(3)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                            <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                            <th className="pb-3 font-semibold px-2">Vehicle & Driver</th>
                            <th className="pb-3 font-semibold px-2">Resolved Date</th>
                            <th className="pb-3 font-semibold px-2">Resolved Time</th>
                            <th className="pb-3 font-semibold px-2">Service Type</th>
                            <th className="pb-3 font-semibold px-2">Shop / Dealer</th>
                            <th className="pb-3 font-semibold px-2">Cost (OMR)</th>
                            <th className="pb-3 font-semibold px-2">Receipt</th>
                            <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedResolved.map((trip, idx) => (
                            <tr key={trip.id} className="text-slate-800 align-middle hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                                {(resolvedCostsPage - 1) * ITEMS_PER_PAGE + idx + 1}
                              </td>
                              <td className="py-4 px-2">
                                <div className="font-semibold text-slate-900">{trip.vehicleName}</div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5">Reported by {trip.driverName}</div>
                              </td>
                              <td className="py-4 px-2 text-slate-700 font-semibold whitespace-nowrap">
                                {trip.resolvedAt ? new Date(trip.resolvedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </td>
                              <td className="py-4 px-2 text-slate-600 font-medium">
                                {trip.resolvedAt ? formatTime(trip.resolvedAt) : '-'}
                              </td>
                              <td className="py-4 px-2 font-medium">
                                {trip.serviceType === 'no_service' ? (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">No Service Needed</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">Service Performed</span>
                                )}
                              </td>
                              <td className="py-4 px-2 text-slate-700 font-semibold">
                                {trip.serviceType === 'no_service' ? '-' : (trip.serviceLocation || '-')}
                              </td>
                              <td className="py-4 px-2 font-bold text-slate-900">
                                {trip.serviceType === 'no_service' ? '-' : `OMR ${(trip.serviceCost || 0).toFixed(3)}`}
                              </td>
                              <td className="py-4 px-2">
                                {trip.billImage ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImageUrl(trip.billImage!)}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100 inline-block overflow-hidden cursor-pointer"
                                    title="Click to view receipt"
                                  >
                                    <img src={trip.billImage} alt="Receipt Thumbnail" className="h-8 w-8 object-cover rounded-md" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No receipt</span>
                                )}
                              </td>
                              <td className="py-4 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => requestDeleteResolvedCost(trip)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredResolvedTrips.length === 0 && (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">No resolved costs log matching selected filters.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <Pagination total={filteredResolvedTrips.length} current={resolvedCostsPage} onChange={setResolvedCostsPage} />
                  </div>
                );
              })()}
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
              Active Trips ({activeTrips.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                    <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                    <th className="pb-3 font-semibold px-2">Driver & Vehicle</th>
                    <th className="pb-3 font-semibold px-2">Start Time</th>
                    <th className="pb-3 font-semibold px-2">Status & Condition</th>
                    <th className="pb-3 font-semibold px-2">Reported Issues</th>
                    <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedActiveTrips.map((trip, idx) => (
                    <tr key={trip.id} className="text-slate-800 align-top hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                        {(activeTripsPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>
                      <td className="py-4 px-2">
                        <div className="font-semibold text-slate-900">{trip.driverName}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{trip.vehicleName}</div>
                      </td>
                      <td className="py-4 px-2 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-900" />
                          <span>{trip.startTime ? formatTime(trip.startTime) : 'Unknown'}</span>
                        </div>
                        {trip.startTime && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-2 whitespace-nowrap">
                        {trip.serviceNeeded && (
                          <span className="inline-flex items-center text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg text-xs font-semibold">
                            <Wrench className="w-3.5 h-3.5 mr-1.5" />
                            Maintenance Requested
                          </span>
                        )}
                        {trip.condition === 'not_ok' && !trip.serviceNeeded && (
                          <span className="inline-flex items-center text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Issues Resolved
                          </span>
                        )}
                        {trip.condition === 'ok' && !trip.serviceNeeded && (
                          <span className="inline-flex items-center text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Condition OK
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 min-w-[260px]">
                        {trip.condition === 'not_ok' ? (
                          <IssueDetails trip={trip} />
                        ) : (
                          <span className="text-xs text-slate-400 italic">No issues reported</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => requestDeleteActiveTrip(trip)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Active Trip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeTrips.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">No drivers currently on the road.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={activeTrips.length} current={activeTripsPage} onChange={setActiveTripsPage} />
          </div>
          );
        })()}

        {activeTab === 'history' && (() => {
          const paginatedHistory = filteredCompletedTrips.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
          return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
              <h2 className="text-xl font-semibold text-slate-800">Trip History ({filteredCompletedTrips.length})</h2>
              {filteredCompletedTrips.length > 0 && (
                <button
                  onClick={downloadHistoryAsCSV}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap text-sm"
                >
                  <Download className="w-4 h-4" /> Export as CSV
                </button>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 font-medium">Start Date:</span>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={e => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border border-slate-250 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-900 outline-none text-slate-800 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 font-medium">End Date:</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={e => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border border-slate-250 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-900 outline-none text-slate-800 text-xs"
                />
              </div>
              {(historyStartDate || historyEndDate) && (
                <button
                  onClick={() => {
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                    setHistoryPage(1);
                  }}
                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                    <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                    <th className="pb-3 font-semibold px-2">Driver & Vehicle</th>
                    <th className="pb-3 font-semibold px-2">Date</th>
                    <th className="pb-3 font-semibold px-2">Timing</th>
                    <th className="pb-3 font-semibold px-2">Duration</th>
                    <th className="pb-3 font-semibold px-2">Condition Checks & Service</th>
                    <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.map((trip, idx) => (
                    <tr key={trip.id} className="text-slate-800 align-top hover:bg-slate-50 transition-colors">
                       <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                        {(historyPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>
                       <td className="py-4 px-2">
                        <div className="font-semibold text-slate-900">{trip.driverName}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{trip.vehicleName}</div>
                      </td>
                      <td className="py-4 px-2 font-semibold text-slate-700 whitespace-nowrap">
                        {trip.startTime ? new Date(trip.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </td>
                      <td className="py-4 px-2">
                        <div className="text-slate-600 font-medium">{trip.startTime ? formatTime(trip.startTime) : '-'} <span className="text-slate-300 mx-1">→</span> {trip.endTime ? formatTime(trip.endTime) : '-'}</div>
                      </td>
                      <td className="py-4 px-2 font-semibold text-slate-700">
                        {trip.duration ? formatDuration(trip.duration) : '-'}
                      </td>
                      <td className="py-4 px-2">
                         <div className="flex flex-wrap gap-2 items-center mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Pre-Trip:</span>
                              {trip.condition === 'ok' ? (
                                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">All Good</span>
                              ) : (
                                <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Issues</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Post-Trip:</span>
                              {trip.endCondition === 'ok' ? (
                                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">All Good</span>
                              ) : (
                                trip.endCondition === 'not_ok' ? (
                                  <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Issues</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-550 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">-</span>
                                )
                              )}
                            </div>
                            
                            {(trip.serviceNeeded || trip.endServiceNeeded) ? (
                              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded ml-auto">Needs Service</span>
                            ) : (
                              (trip.condition === 'not_ok' || trip.endCondition === 'not_ok') && (
                                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded ml-auto">Resolved</span>
                              )
                            )}
                         </div>
                         <div className="w-full min-w-[280px]">
                           <TripConditionDetails trip={trip} />
                         </div>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => requestDeleteTripHistory(trip)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Trip Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCompletedTrips.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">No trips matched the selected date filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={filteredCompletedTrips.length} current={historyPage} onChange={setHistoryPage} />
          </div>
          );
        })()}

        {activeTab === 'overtime' && (() => {
          const paginatedOvertime = filteredOvertimeLogs.slice((overtimePage - 1) * ITEMS_PER_PAGE, overtimePage * ITEMS_PER_PAGE);
          return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Overtime Logs ({filteredOvertimeLogs.length})</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    Lists drivers whose cumulative driving duration met or exceeded 8 hours on a single calendar day.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {filteredOvertimeLogs.length > 0 && (
                    <button
                      onClick={downloadOvertimeAsCSV}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap text-sm cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Export as CSV
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-sm">
                <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setOvertimeTimeFilter('all');
                      setSelectedOvertimeYear('none');
                      setSelectedOvertimeMonth('all');
                      setSelectedOvertimeWeek('all');
                      setOvertimePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${overtimeTimeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-650 hover:text-slate-900'}`}
                  >
                    All Time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOvertimeTimeFilter('day');
                      setSelectedOvertimeYear('none');
                      setSelectedOvertimeMonth('all');
                      setSelectedOvertimeWeek('all');
                      setOvertimePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${overtimeTimeFilter === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-650 hover:text-slate-900'}`}
                  >
                    Today
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200/80 mx-1" />

                {/* Year Selector */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Year:</span>
                  <select
                    value={selectedOvertimeYear}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedOvertimeYear(val);
                      if (val === 'none') {
                        setOvertimeTimeFilter('all');
                        setSelectedOvertimeMonth('all');
                        setSelectedOvertimeWeek('all');
                      } else {
                        setOvertimeTimeFilter('custom');
                        setSelectedOvertimeMonth('all'); // Reset month when year changes
                        setSelectedOvertimeWeek('all'); // Reset week when year changes
                      }
                      setOvertimePage(1);
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-none"
                  >
                    <option value="none">Select Year</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Month Selector (shown only if a year is selected) */}
                {selectedOvertimeYear !== 'none' && (
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <span className="font-semibold text-slate-700">Month:</span>
                    <select
                      value={selectedOvertimeMonth}
                      onChange={e => {
                        setSelectedOvertimeMonth(e.target.value);
                        setOvertimeTimeFilter('custom');
                        setOvertimePage(1);
                        setSelectedOvertimeWeek('all'); // Reset week when month changes
                      }}
                      className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      <option value="all">All Months</option>
                      {monthsList.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Week Selector (shown only if a specific year and month are selected) */}
                {selectedOvertimeYear !== 'none' && selectedOvertimeMonth !== 'all' && (
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <span className="font-semibold text-slate-700">Week:</span>
                    <select
                      value={selectedOvertimeWeek}
                      onChange={e => {
                        setSelectedOvertimeWeek(e.target.value);
                        setOvertimeTimeFilter('custom');
                        setOvertimePage(1);
                      }}
                      className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      <option value="all">All Weeks</option>
                      {availableWeeksOfSelectedMonth.map(w => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
                      <th className="pb-3 font-semibold px-2 w-16">Sl. No.</th>
                      <th className="pb-3 font-semibold px-2">Driver</th>
                      <th className="pb-3 font-semibold px-2">Date</th>
                      <th className="pb-3 font-semibold px-2">Daily Summary</th>
                      <th className="pb-3 font-semibold px-2">Trips Breakdown</th>
                      <th className="pb-3 font-semibold px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedOvertime.map((log, idx) => (
                      <tr key={log.id} className="text-slate-800 align-top hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2 font-semibold text-slate-500 text-xs">
                          {(overtimePage - 1) * ITEMS_PER_PAGE + idx + 1}
                        </td>
                        <td className="py-4 px-2 font-semibold text-slate-900">{log.driverName}</td>
                        <td className="py-4 px-2 font-semibold text-slate-700 whitespace-nowrap">
                          {new Date(log.dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-4 px-2">
                          <div className="font-bold text-red-650">{formatDuration(log.totalDuration)}</div>
                          <div className="text-xs text-slate-500 font-semibold mt-0.5">{log.trips.length} {log.trips.length === 1 ? 'ride' : 'rides'}</div>
                        </td>
                        <td className="py-4 px-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandLog(log.id)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors focus:outline-none focus:ring-0 active:scale-95 cursor-pointer"
                          >
                            <span>{expandedLogIds[log.id] ? 'Hide Details' : 'Show Details'}</span>
                            {expandedLogIds[log.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {expandedLogIds[log.id] && (
                            <div className="space-y-3 mt-3 animate-fadeIn">
                              {log.trips.map(trip => (
                                <div key={trip.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 max-w-lg">
                                  <div className="text-xs">
                                    <div className="font-semibold text-slate-800">{trip.vehicleName}</div>
                                    <div className="text-slate-500 font-medium mt-0.5">
                                      {trip.startTime ? formatTime(trip.startTime) : '-'} <span className="text-slate-300 mx-1">→</span> {trip.endTime ? formatTime(trip.endTime) : '-'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="font-bold text-slate-700 text-xs md:text-end">
                                      {trip.duration ? formatDuration(trip.duration) : '-'}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => requestDeleteSingleOvertimeTrip(trip, log.driverName)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete This Trip"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => requestDeleteOvertimeLog(log)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Overtime Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOvertimeLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                          No overtime logs match the selected timeframe filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination total={filteredOvertimeLogs.length} current={overtimePage} onChange={setOvertimePage} />
            </div>
          );
        })()}
      </main>

      {resolvingTripId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 text-center mb-4">Resolve Service Request</h3>
            
            <div className="space-y-4">
              {/* Service Type options */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Resolution Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setServiceType('performed')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${serviceType === 'performed' ? 'border-slate-900 bg-slate-50 text-slate-900 font-bold ring-1 ring-slate-900' : 'border-slate-200 text-slate-650 hover:bg-slate-50 bg-white'}`}
                  >
                    Service Performed
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceType('no_service')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${serviceType === 'no_service' ? 'border-slate-900 bg-slate-50 text-slate-900 font-bold ring-1 ring-slate-900' : 'border-slate-200 text-slate-650 hover:bg-slate-50 bg-white'}`}
                  >
                    Solved Without Service
                  </button>
                </div>
              </div>

              {serviceType === 'performed' && (
                <>
                  {/* Shop / Dealer */}
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700">Shop / Dealer Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={serviceLocationInput}
                      onChange={e => setServiceLocationInput(e.target.value)}
                      placeholder="Enter dealer or workshop name..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-800 text-sm"
                      required
                    />
                  </div>

                  {/* Cost */}
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700">Service Cost (OMR) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={serviceCostInput}
                      onChange={e => setServiceCostInput(e.target.value)}
                      placeholder="Enter total cost..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-800 text-sm"
                      required
                    />
                  </div>

                  {/* Receipt Upload */}
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700">Attach Bill / Receipt Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || (config as any).cloudinaryCloudName;
                          const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || (config as any).cloudinaryUploadPreset;

                          if (cloudName && uploadPreset) {
                            setIsUploading(true);
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('upload_preset', uploadPreset);
                              const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                                method: 'POST',
                                body: formData
                              });
                              if (!res.ok) {
                                throw new Error('Upload failed with status ' + res.status);
                              }
                              const data = await res.json();
                              setBillImageBase64(data.secure_url);
                            } catch (err: any) {
                              console.error(err);
                              alert('Cloudinary upload failed, falling back to local storage: ' + (err.message || err));
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setBillImageBase64(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            } finally {
                              setIsUploading(false);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setBillImageBase64(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer disabled:opacity-50"
                    />
                    {isUploading && (
                      <div className="text-xs text-blue-600 font-semibold mt-1 animate-pulse">
                        Uploading to Cloudinary...
                      </div>
                    )}
                    {!isUploading && !import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && !(config as any).cloudinaryCloudName && (
                      <div className="text-[10px] text-amber-600 font-medium mt-1">
                        Note: Cloudinary not configured. Falling back to local Base64 (max 1MB).
                      </div>
                    )}
                    {billImageBase64 && !isUploading && (
                      <div className="mt-2 relative inline-block">
                        <img src={billImageBase64} alt="Bill Preview" className="h-16 rounded border border-slate-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => setBillImageBase64('')}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => {
                  setResolvingTripId(null);
                  setResolvingTripStatus(null);
                  setServiceType('performed');
                  setServiceCostInput('');
                  setServiceLocationInput('');
                  setBillImageBase64('');
                }}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmResolve}
                disabled={isUploading || (serviceType === 'performed' && (!serviceLocationInput.trim() || !serviceCostInput))}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
              >
                {isUploading ? 'Uploading Image...' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-md border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{deleteTarget.title}</h3>
                <p className="text-xs text-slate-500 font-medium">Please confirm this action</p>
              </div>
            </div>

            <p className="text-sm text-slate-650 leading-relaxed mb-4">
              {deleteTarget.description}
            </p>

            {deleteTarget.itemDetails && deleteTarget.itemDetails.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 mb-5 border border-slate-100 text-xs space-y-1.5">
                {deleteTarget.itemDetails.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium shrink-0">{detail.label}:</span>
                    <span className="text-slate-900 font-semibold text-right truncate">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 shadow-2xl w-full max-w-lg border border-slate-100 relative">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full p-2 transition-colors z-10 active:scale-95"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center font-bold text-slate-800 mb-3 text-sm">Receipt Preview</div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[200px] max-h-[70vh]">
              <img src={previewImageUrl} alt="Full Receipt View" className="max-w-full max-h-[65vh] object-contain animate-fadeIn" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

