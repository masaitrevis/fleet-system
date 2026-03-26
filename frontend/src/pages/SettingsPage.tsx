import { useState, useEffect } from 'react';
import { 
  Building2, Car, Bell, User, Shield, Globe, Database, Palette, 
  Save, RefreshCw, Check, X, ChevronRight, Lock, Mail, Phone, 
  MapPin, CreditCard, FileText, Users, Truck, AlertTriangle,
  Moon, Sun, Eye, EyeOff, Key, Smartphone, Fingerprint, ShieldCheck,
  Upload, Trash2, Plus, Settings as SettingsIcon, Info
} from 'lucide-react';

interface SettingsPageProps {
  apiUrl: string;
}

type SettingsTab = 'company' | 'fleet' | 'notifications' | 'users' | 'security';

// ==================== TYPES ====================

interface CompanySettings {
  name: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  email: string;
  phone: string;
  website: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  logoUrl?: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  fiscalYearStart: string;
}

interface FleetSettings {
  defaultFuelType: string;
  fuelUnit: 'liters' | 'gallons';
  distanceUnit: 'km' | 'miles';
  currency: string;
  maintenanceReminderDays: number;
  insuranceReminderDays: number;
  licenseReminderDays: number;
  speedLimit: number;
  idleTimeThreshold: number;
  geofenceAlertEnabled: boolean;
  fuelEfficiencyTarget: number;
  co2EmissionFactor: number;
  defaultVehicleStatus: string;
  autoArchiveAfterDays: number;
}

interface NotificationSettings {
  email: {
    enabled: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
    maintenanceAlerts: boolean;
    accidentAlerts: boolean;
    fuelAlerts: boolean;
    requisitionUpdates: boolean;
  };
  push: {
    enabled: boolean;
    maintenanceAlerts: boolean;
    accidentAlerts: boolean;
    geofenceAlerts: boolean;
    routeUpdates: boolean;
  };
  sms: {
    enabled: boolean;
    criticalAlerts: boolean;
    driverAlerts: boolean;
    emergencyContacts: boolean;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  timezone: string;
  sidebarCollapsed: boolean;
  defaultDashboard: string;
  emailNotifications: boolean;
  desktopNotifications: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'app' | 'sms' | 'email';
  passwordExpiryDays: number;
  minPasswordLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  ipWhitelist: string[];
  apiKeyRotationDays: number;
  auditLogEnabled: boolean;
  ssoEnabled: boolean;
  ssoProvider: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  status: 'active' | 'inactive';
  lastLoginAt?: string;
  avatarUrl?: string;
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland'
];

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sw', name: 'Swahili' },
];

export default function SettingsPage({ apiUrl }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [token] = useState(() => localStorage.getItem('token') || '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
            Settings
          </h1>
          <p className="text-gray-500 mt-1">Manage your organization settings and preferences</p>
        </div>
        {saveMessage && (
          <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {saveMessage.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {saveMessage.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {[
              { key: 'company', label: 'Company', icon: Building2, desc: 'Organization details' },
              { key: 'fleet', label: 'Fleet', icon: Truck, desc: 'Vehicle defaults' },
              { key: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alerts & emails' },
              { key: 'users', label: 'User Preferences', icon: User, desc: 'Personal settings' },
              { key: 'security', label: 'Security', icon: Shield, desc: 'Access & auth' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as SettingsTab)}
                className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-50 border-l-4 border-blue-600'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <tab.icon className={`w-5 h-5 mt-0.5 ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-medium ${activeTab === tab.key ? 'text-blue-900' : 'text-gray-700'}`}>
                    {tab.label}
                  </p>
                  <p className="text-xs text-gray-500">{tab.desc}</p>
                </div>
              </button>
            ))}
          </nav>

          {/* Quick Info */}
          <div className="mt-4 bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Need help?</span>
            </div>
            <p className="text-xs text-blue-700">
              Changes are automatically saved. Contact your administrator for restricted settings.
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {activeTab === 'company' && (
              <CompanySettingsTab 
                apiUrl={apiUrl} 
                token={token} 
                onSave={(type, msg) => showSaveMessage(type, msg)}
                saving={saving}
                setSaving={setSaving}
              />
            )}
            {activeTab === 'fleet' && (
              <FleetSettingsTab 
                apiUrl={apiUrl} 
                token={token}
                onSave={(type, msg) => showSaveMessage(type, msg)}
                saving={saving}
                setSaving={setSaving}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab 
                apiUrl={apiUrl} 
                token={token}
                onSave={(type, msg) => showSaveMessage(type, msg)}
                saving={saving}
                setSaving={setSaving}
              />
            )}
            {activeTab === 'users' && (
              <UserPreferencesTab 
                apiUrl={apiUrl} 
                token={token}
                onSave={(type, msg) => showSaveMessage(type, msg)}
                saving={saving}
                setSaving={setSaving}
              />
            )}
            {activeTab === 'security' && (
              <SecuritySettingsTab 
                apiUrl={apiUrl} 
                token={token}
                onSave={(type, msg) => showSaveMessage(type, msg)}
                saving={saving}
                setSaving={setSaving}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== COMPANY SETTINGS TAB ====================

function CompanySettingsTab({ apiUrl, token, onSave, saving, setSaving }: {
  apiUrl: string;
  token: string;
  onSave: (type: 'success' | 'error', msg: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [settings, setSettings] = useState<CompanySettings>({
    name: '',
    legalName: '',
    taxId: '',
    registrationNumber: '',
    email: '',
    phone: '',
    website: '',
    address: { street: '', city: '', state: '', zipCode: '', country: '' },
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    fiscalYearStart: '01-01',
  });
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
        if (data.logoUrl) setLogoPreview(data.logoUrl);
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings/company`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        onSave('success', 'Company settings saved successfully');
      } else {
        onSave('error', 'Failed to save settings');
      }
    } catch (err) {
      onSave('error', 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Company Settings</h2>
          <p className="text-sm text-gray-500">Manage your organization details and branding</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Logo Upload */}
      <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl">
        <div className="w-24 h-24 bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Building2 className="w-10 h-10 text-gray-300" />
          )}
        </div>
        <div>
          <h3 className="font-medium">Company Logo</h3>
          <p className="text-sm text-gray-500 mb-2">Recommended: 200x200px PNG or JPG</p>
          <div className="flex gap-2">
            <label className="bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
            {logoPreview && (
              <button 
                onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                className="text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="NextBotics Fleet Pro"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
            <input
              type="text"
              value={settings.legalName}
              onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="NextBotics Fleet Solutions Inc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / VAT Number</label>
            <input
              type="text"
              value={settings.taxId}
              onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="XX-XXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              type="text"
              value={settings.registrationNumber}
              onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Company registration number"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="contact@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="w-4 h-4 inline mr-1" />
              Website
            </label>
            <input
              type="url"
              value={settings.website}
              onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.company.com"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">
          <MapPin className="w-4 h-4 inline mr-1" />
          Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              value={settings.address.street}
              onChange={(e) => setSettings({ 
                ...settings, 
                address: { ...settings.address, street: e.target.value }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="123 Business Street"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={settings.address.city}
              onChange={(e) => setSettings({ 
                ...settings, 
                address: { ...settings.address, city: e.target.value }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
            <input
              type="text"
              value={settings.address.state}
              onChange={(e) => setSettings({ 
                ...settings, 
                address: { ...settings.address, state: e.target.value }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="NY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / Postal Code</label>
            <input
              type="text"
              value={settings.address.zipCode}
              onChange={(e) => setSettings({ 
                ...settings, 
                address: { ...settings.address, zipCode: e.target.value }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="10001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={settings.address.country}
              onChange={(e) => setSettings({ 
                ...settings, 
                address: { ...settings.address, country: e.target.value }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="United States"
            />
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Regional Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select
              value={settings.dateFormat}
              onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
            <input
              type="date"
              value={settings.fiscalYearStart ? `2024-${settings.fiscalYearStart}` : ''}
              onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value.substring(5) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== FLEET SETTINGS TAB ====================

function FleetSettingsTab({ apiUrl, token, onSave, saving, setSaving }: {
  apiUrl: string;
  token: string;
  onSave: (type: 'success' | 'error', msg: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [settings, setSettings] = useState<FleetSettings>({
    defaultFuelType: 'Diesel',
    fuelUnit: 'liters',
    distanceUnit: 'km',
    currency: 'USD',
    maintenanceReminderDays: 7,
    insuranceReminderDays: 30,
    licenseReminderDays: 14,
    speedLimit: 80,
    idleTimeThreshold: 10,
    geofenceAlertEnabled: true,
    fuelEfficiencyTarget: 8,
    co2EmissionFactor: 2.68,
    defaultVehicleStatus: 'Active',
    autoArchiveAfterDays: 365,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings/fleet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch fleet settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings/fleet`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        onSave('success', 'Fleet settings saved successfully');
      } else {
        onSave('error', 'Failed to save fleet settings');
      }
    } catch (err) {
      onSave('error', 'Error saving fleet settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Fleet Settings</h2>
          <p className="text-sm text-gray-500">Configure default vehicle and fleet management settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Units & Measurements */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Units & Measurements</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Unit</label>
            <div className="flex gap-2">
              {(['liters', 'gallons'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setSettings({ ...settings, fuelUnit: unit })}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    settings.fuelUnit === unit 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {unit.charAt(0).toUpperCase() + unit.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distance Unit</label>
            <div className="flex gap-2">
              {(['km', 'miles'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setSettings({ ...settings, distanceUnit: unit })}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    settings.distanceUnit === unit 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {unit === 'km' ? 'Kilometers' : 'Miles'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reminder Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Reminder Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maintenance Reminder (days before)
            </label>
            <input
              type="number"
              value={settings.maintenanceReminderDays}
              onChange={(e) => setSettings({ ...settings, maintenanceReminderDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="1"
              max="90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Reminder (days before)
            </label>
            <input
              type="number"
              value={settings.insuranceReminderDays}
              onChange={(e) => setSettings({ ...settings, insuranceReminderDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="1"
              max="180"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Reminder (days before)
            </label>
            <input
              type="number"
              value={settings.licenseReminderDays}
              onChange={(e) => setSettings({ ...settings, licenseReminderDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="1"
              max="90"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Tracking */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Vehicle Tracking
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Speed Limit Alert (km/h or mph)
            </label>
            <input
              type="number"
              value={settings.speedLimit}
              onChange={(e) => setSettings({ ...settings, speedLimit: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="10"
              max="200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Idle Time Threshold (minutes)
            </label>
            <input
              type="number"
              value={settings.idleTimeThreshold}
              onChange={(e) => setSettings({ ...settings, idleTimeThreshold: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="1"
              max="60"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            id="geofence"
            checked={settings.geofenceAlertEnabled}
            onChange={(e) => setSettings({ ...settings, geofenceAlertEnabled: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="geofence" className="flex-1">
            <span className="font-medium text-gray-900">Enable Geofence Alerts</span>
            <p className="text-sm text-gray-500">Receive notifications when vehicles enter or exit defined zones</p>
          </label>
        </div>
      </div>

      {/* Environmental Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Environmental Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuel Efficiency Target ({settings.distanceUnit}/{settings.fuelUnit})
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.fuelEfficiencyTarget}
              onChange={(e) => setSettings({ ...settings, fuelEfficiencyTarget: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="8.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CO₂ Emission Factor (kg/L)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.co2EmissionFactor}
              onChange={(e) => setSettings({ ...settings, co2EmissionFactor: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="2.68"
            />
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data Management
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Vehicle Status</label>
            <select
              value={settings.defaultVehicleStatus}
              onChange={(e) => setSettings({ ...settings, defaultVehicleStatus: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auto-archive Records After (days)
            </label>
            <input
              type="number"
              value={settings.autoArchiveAfterDays}
              onChange={(e) => setSettings({ ...settings, autoArchiveAfterDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="30"
              max="3650"
            />
            <p className="text-xs text-gray-500 mt-1">0 to disable auto-archiving</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== NOTIFICATIONS TAB ====================

function NotificationsTab({ apiUrl, token, onSave, saving, setSaving }: {
  apiUrl: string;
  token: string;
  onSave: (type: 'success' | 'error', msg: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      enabled: true,
      dailyDigest: false,
      weeklyReport: true,
      maintenanceAlerts: true,
      accidentAlerts: true,
      fuelAlerts: true,
      requisitionUpdates: true,
    },
    push: {
      enabled: true,
      maintenanceAlerts: true,
      accidentAlerts: true,
      geofenceAlerts: true,
      routeUpdates: false,
    },
    sms: {
      enabled: false,
      criticalAlerts: true,
      driverAlerts: false,
      emergencyContacts: true,
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#fleet-alerts',
    },
  });
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        onSave('success', 'Notification settings saved');
      } else {
        onSave('error', 'Failed to save settings');
      }
    } catch (err) {
      onSave('error', 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async (type: 'email' | 'push' | 'sms') => {
    setTestStatus('sending');
    try {
      const res = await fetch(`${apiUrl}/settings/notifications/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        setTestStatus('sent');
        setTimeout(() => setTestStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Failed to send test:', err);
      setTestStatus('idle');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const NotificationToggle = ({ 
    label, 
    checked, 
    onChange, 
    description 
  }: { 
    label: string; 
    checked: boolean; 
    onChange: (v: boolean) => void;
    description?: string;
  }) => (
    <div className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <span className="font-medium text-gray-900">{label}</span>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Notification Preferences</h2>
          <p className="text-sm text-gray-500">Choose how and when you receive alerts</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Email Notifications */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">Email Notifications</h3>
              <p className="text-sm text-gray-500">Configure email alerts and reports</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.email.enabled}
              onChange={(e) => setSettings({
                ...settings,
                email: { ...settings.email, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        {settings.email.enabled && (
          <div className="border-t pt-4 space-y-1">
            <NotificationToggle
              label="Daily Digest"
              description="Summary of fleet activities sent daily"
              checked={settings.email.dailyDigest}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, dailyDigest: v }
              })}
            />
            <NotificationToggle
              label="Weekly Report"
              description="Comprehensive analytics report every Monday"
              checked={settings.email.weeklyReport}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, weeklyReport: v }
              })}
            />
            <NotificationToggle
              label="Maintenance Alerts"
              description="Upcoming maintenance and service reminders"
              checked={settings.email.maintenanceAlerts}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, maintenanceAlerts: v }
              })}
            />
            <NotificationToggle
              label="Accident Alerts"
              description="Immediate notifications for accidents and incidents"
              checked={settings.email.accidentAlerts}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, accidentAlerts: v }
              })}
            />
            <NotificationToggle
              label="Fuel Alerts"
              description="Fuel anomalies and consumption alerts"
              checked={settings.email.fuelAlerts}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, fuelAlerts: v }
              })}
            />
            <NotificationToggle
              label="Requisition Updates"
              description="Status changes on vehicle requisitions"
              checked={settings.email.requisitionUpdates}
              onChange={(v) => setSettings({
                ...settings,
                email: { ...settings.email, requisitionUpdates: v }
              })}
            />
          </div>
        )}
      </div>

      {/* Push Notifications */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium">Push Notifications</h3>
              <p className="text-sm text-gray-500">Browser and mobile push alerts</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.push.enabled}
              onChange={(e) => setSettings({
                ...settings,
                push: { ...settings.push, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        
        {settings.push.enabled && (
          <div className="border-t pt-4 space-y-1">
            <NotificationToggle
              label="Maintenance Alerts"
              checked={settings.push.maintenanceAlerts}
              onChange={(v) => setSettings({
                ...settings,
                push: { ...settings.push, maintenanceAlerts: v }
              })}
            />
            <NotificationToggle
              label="Accident Alerts"
              checked={settings.push.accidentAlerts}
              onChange={(v) => setSettings({
                ...settings,
                push: { ...settings.push, accidentAlerts: v }
              })}
            />
            <NotificationToggle
              label="Geofence Alerts"
              checked={settings.push.geofenceAlerts}
              onChange={(v) => setSettings({
                ...settings,
                push: { ...settings.push, geofenceAlerts: v }
              })}
            />
            <NotificationToggle
              label="Route Updates"
              checked={settings.push.routeUpdates}
              onChange={(v) => setSettings({
                ...settings,
                push: { ...settings.push, routeUpdates: v }
              })}
            />
          </div>
        )}
      </div>

      {/* SMS Notifications */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium">SMS Notifications</h3>
              <p className="text-sm text-gray-500">Text message alerts for critical events</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sms.enabled}
              onChange={(e) => setSettings({
                ...settings,
                sms: { ...settings.sms, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        
        {settings.sms.enabled && (
          <div className="border-t pt-4 space-y-1">
            <NotificationToggle
              label="Critical Alerts"
              description="Accidents, breakdowns, and emergencies"
              checked={settings.sms.criticalAlerts}
              onChange={(v) => setSettings({
                ...settings,
                sms: { ...settings.sms, criticalAlerts: v }
              })}
            />
            <NotificationToggle
              label="Driver Alerts"
              description="Direct messages to drivers"
              checked={settings.sms.driverAlerts}
              onChange={(v) => setSettings({
                ...settings,
                sms: { ...settings.sms, driverAlerts: v }
              })}
            />
            <NotificationToggle
              label="Emergency Contacts"
              description="Notifications to emergency contacts"
              checked={settings.sms.emergencyContacts}
              onChange={(v) => setSettings({
                ...settings,
                sms: { ...settings.sms, emergencyContacts: v }
              })}
            />
          </div>
        )}
      </div>

      {/* Slack Integration */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-medium">Slack Integration</h3>
              <p className="text-sm text-gray-500">Send notifications to Slack channels</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.slack.enabled}
              onChange={(e) => setSettings({
                ...settings,
                slack: { ...settings.slack, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
        
        {settings.slack.enabled && (
          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <input
                type="password"
                value={settings.slack.webhookUrl}
                onChange={(e) => setSettings({
                  ...settings,
                  slack: { ...settings.slack, webhookUrl: e.target.value }
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <input
                type="text"
                value={settings.slack.channel}
                onChange={(e) => setSettings({
                  ...settings,
                  slack: { ...settings.slack, channel: e.target.value }
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                placeholder="#fleet-alerts"
              />
            </div>
          </div>
        )}
      </div>

      {/* Test Buttons */}
      <div className="flex flex-wrap gap-3 pt-4">
        <button
          onClick={() => sendTestNotification('email')}
          disabled={testStatus === 'sending'}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
        >
          {testStatus === 'sending' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Test Email
        </button>
        <button
          onClick={() => sendTestNotification('push')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          Test Push
        </button>
        <button
          onClick={() => sendTestNotification('sms')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
        >
          <MessageIcon className="w-4 h-4" />
          Test SMS
        </button>
      </div>
    </div>
  );
}

// ==================== USER PREFERENCES TAB ====================

function UserPreferencesTab({ apiUrl, token, onSave, saving, setSaving }: {
  apiUrl: string;
  token: string;
  onSave: (type: 'success' | 'error', msg: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'light',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '24h',
    timezone: 'UTC',
    sidebarCollapsed: false,
    defaultDashboard: 'dashboard',
    emailNotifications: true,
    desktopNotifications: false,
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    fetchPreferences();
    fetchUserProfile();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings/user-preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings/user-preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      
      if (res.ok) {
        onSave('success', 'Preferences saved successfully');
      } else {
        onSave('error', 'Failed to save preferences');
      }
    } catch (err) {
      onSave('error', 'Error saving preferences');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      onSave('error', 'New passwords do not match');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      
      if (res.ok) {
        onSave('success', 'Password changed successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        onSave('error', 'Failed to change password');
      }
    } catch (err) {
      onSave('error', 'Error changing password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">User Preferences</h2>
          <p className="text-sm text-gray-500">Customize your personal experience</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Profile Card */}
      {user && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{user.name || user.email}</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{user.role}</span>
              {user.department && (
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{user.department}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Appearance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setPreferences({ ...preferences, theme })}
                  className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 ${
                    preferences.theme === theme 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {theme === 'light' && <Sun className="w-4 h-4" />}
                  {theme === 'dark' && <Moon className="w-4 h-4" />}
                  {theme === 'system' && <SettingsIcon className="w-4 h-4" />}
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Date & Time
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
            <div className="flex gap-2">
              {(['12h', '24h'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setPreferences({ ...preferences, timeFormat: format })}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    preferences.timeFormat === format 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Default Dashboard */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Default Dashboard</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Landing Page</label>
          <select
            value={preferences.defaultDashboard}
            onChange={(e) => setPreferences({ ...preferences, defaultDashboard: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="dashboard">Main Dashboard</option>
            <option value="fleet">Fleet Overview</option>
            <option value="analytics">Analytics</option>
            <option value="operations">Operations</option>
            <option value="fuel">Fuel Management</option>
          </select>
        </div>
      </div>

      {/* Password Change */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type={showPasswords.new ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 pr-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SECURITY SETTINGS TAB ====================

function SecuritySettingsTab({ apiUrl, token, onSave, saving, setSaving }: {
  apiUrl: string;
  token: string;
  onSave: (type: 'success' | 'error', msg: string) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    twoFactorMethod: 'app',
    passwordExpiryDays: 90,
    minPasswordLength: 8,
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60,
    ipWhitelist: [],
    apiKeyRotationDays: 90,
    auditLogEnabled: true,
    ssoEnabled: false,
    ssoProvider: '',
  });
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchSessions();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings/security`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch security settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings/security`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        onSave('success', 'Security settings saved');
      } else {
        onSave('error', 'Failed to save security settings');
      }
    } catch (err) {
      onSave('error', 'Error saving security settings');
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (newIp && !settings.ipWhitelist.includes(newIp)) {
      setSettings({ ...settings, ipWhitelist: [...settings.ipWhitelist, newIp] });
      setNewIp('');
    }
  };

  const removeIp = (ip: string) => {
    setSettings({ ...settings, ipWhitelist: settings.ipWhitelist.filter(i => i !== ip) });
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${apiUrl}/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSessions();
        onSave('success', 'Session terminated');
      }
    } catch (err) {
      onSave('error', 'Failed to terminate session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Security Settings</h2>
          <p className="text-sm text-gray-500">Manage authentication and access controls</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div className="border rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.twoFactorEnabled}
              onChange={(e) => setSettings({ ...settings, twoFactorEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        
        {settings.twoFactorEnabled && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">2FA Method</label>
            <div className="flex gap-4">
              {(['app', 'sms', 'email'] as const).map((method) => (
                <label key={method} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="2fa-method"
                    checked={settings.twoFactorMethod === method}
                    onChange={() => setSettings({ ...settings, twoFactorMethod: method })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm capitalize">{method === 'app' ? 'Authenticator App' : method}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Password Policy */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium">Password Policy</h3>
            <p className="text-sm text-gray-500">Configure password requirements</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Password Length</label>
            <input
              type="number"
              value={settings.minPasswordLength}
              onChange={(e) => setSettings({ ...settings, minPasswordLength: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="6"
              max="32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Expiry (days)</label>
            <input
              type="number"
              value={settings.passwordExpiryDays}
              onChange={(e) => setSettings({ ...settings, passwordExpiryDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="0"
              max="365"
            />
            <p className="text-xs text-gray-500 mt-1">0 = never expire</p>
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.requireUppercase}
              onChange={(e) => setSettings({ ...settings, requireUppercase: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Require uppercase letters</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.requireNumbers}
              onChange={(e) => setSettings({ ...settings, requireNumbers: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Require numbers</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.requireSpecialChars}
              onChange={(e) => setSettings({ ...settings, requireSpecialChars: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Require special characters (!@#$%^&*)</span>
          </label>
        </div>
      </div>

      {/* Login Security */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium">Login Security</h3>
            <p className="text-sm text-gray-500">Account lockout and session settings</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
            <input
              type="number"
              value={settings.maxLoginAttempts}
              onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="3"
              max="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lockout Duration (minutes)</label>
            <input
              type="number"
              value={settings.lockoutDurationMinutes}
              onChange={(e) => setSettings({ ...settings, lockoutDurationMinutes: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="5"
              max="1440"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
            <input
              type="number"
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              min="5"
              max="1440"
            />
          </div>
        </div>
      </div>

      {/* IP Whitelist */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium">IP Whitelist</h3>
            <p className="text-sm text-gray-500">Restrict access to specific IP addresses (leave empty for all)</p>
          </div>
        </div>
        
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="Enter IP address (e.g., 192.168.1.1)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
          />
          <button
            onClick={addIp}
            disabled={!newIp}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        
        {settings.ipWhitelist.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {settings.ipWhitelist.map((ip) => (
              <span key={ip} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm">
                {ip}
                <button onClick={() => removeIp(ip)} className="text-gray-500 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No IP restrictions configured</p>
        )}
      </div>

      {/* Audit Log */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium">Audit Logging</h3>
              <p className="text-sm text-gray-500">Track all security events and changes</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auditLogEnabled}
              onChange={(e) => setSettings({ ...settings, auditLogEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium">Active Sessions</h3>
            <p className="text-sm text-gray-500">Manage your logged-in devices</p>
          </div>
        </div>
        
        <div className="space-y-2">
          {activeSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">{session.device} • {session.browser}</p>
                <p className="text-xs text-gray-500">{session.ip} • Last active: {new Date(session.lastActive).toLocaleString()}</p>
                {session.isCurrent && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Current</span>}
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => terminateSession(session.id)}
                  className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                >
                  Terminate
                </button>
              )}
            </div>
          ))}
          {activeSessions.length === 0 && (
            <p className="text-sm text-gray-500 italic">No active sessions found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== ICON COMPONENTS ====================

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
