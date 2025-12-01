import { useState, useEffect } from 'react';
import { User, Bell, Lock, Database, Eye, EyeOff, Shield, LogOut, Smartphone, Globe, Download, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    setProfile(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <User className="text-blue-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Profile</h3>
              <p className="text-sm text-gray-500">Your account information</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile?.full_name || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile?.email || user?.email || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile?.currency || 'INR'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <div className="px-4 py-3 bg-emerald-50 rounded-lg text-emerald-700 font-medium capitalize">
                {profile?.plan_type || 'Free'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                <Bell className="text-amber-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Notifications</h3>
                <p className="text-sm text-gray-500">Manage alert preferences</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Budget alerts</span>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Transaction alerts</span>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Goal reminders</span>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <Lock className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Security</h3>
                <p className="text-sm text-gray-500">Protect your account</p>
              </div>
            </div>
            <div className="space-y-3">
              <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition">
                Change password
              </button>
              <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition">
                Enable two-factor authentication
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <Database className="text-gray-600" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">Data Management</h3>
            <p className="text-sm text-gray-500">Backup, export, or delete your data</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <Download className="text-blue-600" size={20} />
              <div>
                <h4 className="font-medium text-gray-900">Export Data</h4>
                <p className="text-xs text-gray-500">Download all your data as CSV/JSON</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition">
              Export
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <Database className="text-emerald-600" size={20} />
              <div>
                <h4 className="font-medium text-gray-900">Automatic Backup</h4>
                <p className="text-xs text-gray-500">Scheduled daily backups to cloud</p>
              </div>
            </div>
            <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg hover:bg-red-50 transition">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <div>
                <h4 className="font-medium text-gray-900">Delete Account</h4>
                <p className="text-xs text-gray-500">Permanently delete your account and data</p>
              </div>
            </div>
            <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition">
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Smartphone className="text-blue-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Devices</h3>
              <p className="text-sm text-gray-500">Manage your active sessions</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">This Device</div>
                <div className="text-xs text-gray-500">Last active: Now</div>
              </div>
              <span className="text-xs font-semibold text-emerald-600">Current</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Globe className="text-purple-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Preferences</h3>
              <p className="text-sm text-gray-500">Language and regional settings</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                <option>English</option>
                <option>हिंदी</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                <option>₹ INR (Indian Rupee)</option>
                <option>$ USD (US Dollar)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
