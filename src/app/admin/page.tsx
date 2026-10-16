'use client';

import React, { useState, useEffect } from 'react';
import { 
  Lock, LayoutDashboard, Calendar, FileSpreadsheet, LogOut, 
  Search, ShieldCheck, RefreshCw, Plus, Award, ArrowLeftRight, Check, ListFilter, Users, Trash2,
  ClipboardList, AlertCircle, CheckCircle2, Clock, Filter
} from 'lucide-react';

interface Period {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  type: 'routine' | 'pleno' | 'magista_fgd' | 'magista_bidang' | 'magista_angkatan';
}

interface RankingRow {
  rank: number | string;
  staffId: string;
  name: string;
  department: string;
  countStaff: number;
  avgStaff: number | null;
  countPht: number;
  avgPht: number | null;
  countDirector: number;
  avgDirector: number | null;
  totalEvaluations: number;
  finalScore: number;
  category: string;
}

interface RawEvalRow {
  id: string;
  evaluatorId: string;
  targetId: string;
  evaluatorName: string;
  evaluatorDept: string;
  evaluatorRole: string;
  targetName: string;
  targetDept: string;
  scoreSikap: number;
  scoreKomunikasi: number;
  scoreImprovement: number;
  scoreProfesionalisme: number;
  scoreLeadership: number;
  scorePlenoRespect: number;
  scorePlenoDisiplin: number;
  scorePlenoAktifProker: number;
  scorePlenoKepanitiaan: number;
  scorePlenoPartisipasiLain: number;
  scorePlenoKomunikasiGrup: number;
  scorePlenoTanggungJawab: number;
  overallScore: number;
  createdAt: string;
}

interface EvaluatorProgress {
  id: string;
  name: string;
  department: string;
  role: string;
  jabatan: string;
  totalTargets: number;
  doneCount: number;
  isComplete: boolean;
}

export default function AdminPortal() {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard states
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [rawEvaluations, setRawEvaluations] = useState<RawEvalRow[]>([]);
  const [evaluatorProgress, setEvaluatorProgress] = useState<EvaluatorProgress[]>([]);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'ranking' | 'raw' | 'progress' | 'magista'>('ranking');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  
  // Period creation modal states
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<Period['type']>('routine');
  const [periodLoading, setPeriodLoading] = useState(false);

  // Department filter
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  // MAGISTA states
  const [magistaData, setMagistaData] = useState<any>(null);
  const [loadingMagista, setLoadingMagista] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [magistaDeptFilter, setMagistaDeptFilter] = useState('');
  const [magistaSearch, setMagistaSearch] = useState('');
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('magista_webhook_url');
      if (saved) setWebhookUrl(saved);
    }
  }, []);

  const fetchMagistaData = async () => {
    if (!adminToken) return;
    setLoadingMagista(true);
    try {
      const res = await fetch('/api/admin/magista', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMagistaData(data);
      }
    } catch (err) {
      console.error('Error loading MAGISTA data:', err);
    } finally {
      setLoadingMagista(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'magista') {
      fetchMagistaData();
    }
  }, [isAuthenticated, activeTab]);

  const handleSyncSheets = async () => {
    if (!webhookUrl.trim()) {
      alert('Silakan masukkan Google Apps Script Webhook URL terlebih dahulu.');
      return;
    }
    setSyncingSheets(true);
    setSyncMsg(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('magista_webhook_url', webhookUrl.trim());
      }
      const res = await fetch('/api/admin/magista/sync-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg({ text: 'Data MAGISTA berhasil disinkronkan ke Google Spreadsheet! 🎉' });
      } else {
        setSyncMsg({ text: data.error || 'Gagal menyinkronkan data.', isError: true });
      }
    } catch (err: any) {
      setSyncMsg({ text: 'Koneksi bermasalah saat sync ke Google Sheets.', isError: true });
    } finally {
      setSyncingSheets(false);
    }
  };

  // Fetch dashboard data once authenticated and period is selected
  useEffect(() => {
    if (isAuthenticated && selectedPeriodId) {
      fetchData(selectedPeriodId);
    }
  }, [isAuthenticated, selectedPeriodId]);

  const verifyPasscode = async (code: string) => {
    setAuthError('');
    setAuthLoading(true);
    
    try {
      const res = await fetch('/api/admin/periods', {
        headers: {
          'Authorization': `Bearer ${code}`
        }
      });
      const data = await res.json();
      
      if (res.ok) {
        setIsAuthenticated(true);
        setAdminToken(code);
        setPeriods(data.periods);
        
        // Auto-select active period
        const active = data.periods.find((p: Period) => p.status === 'active');
        if (active) {
          setSelectedPeriodId(active.id);
        } else if (data.periods.length > 0) {
          setSelectedPeriodId(data.periods[0].id);
        }
      } else {
        setAuthError('Passcode tidak valid.');
      }
    } catch (err) {
      setAuthError('Gagal menghubungkan ke server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    verifyPasscode(passcode.trim());
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminToken('');
    setPasscode('');
    setPeriods([]);
    setRankings([]);
    setRawEvaluations([]);
  };

  const fetchData = async (periodId: string) => {
    setLoadingData(true);
    setDataError('');
    const code = adminToken;
    
    try {
      const res = await fetch(`/api/admin/rekap?periodId=${periodId}`, {
        headers: {
          'Authorization': `Bearer ${code}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRankings(data.rankings);
        setRawEvaluations(data.rawEvaluations);
        setEvaluatorProgress(data.evaluatorProgress || []);
      } else {
        setDataError(data.error || 'Gagal memuat rekap data.');
      }
    } catch (err) {
      setDataError('Kesalahan jaringan saat memuat rekap data.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName.trim()) return;
    
    setPeriodLoading(true);
    setErrorMsg('');
    const code = adminToken;

    try {
      const res = await fetch('/api/admin/periods', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${code}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newPeriodName.trim(), type: newPeriodType })
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh periods list
        const refreshedRes = await fetch('/api/admin/periods', {
          headers: { 'Authorization': `Bearer ${code}` }
        });
        const refreshedData = await refreshedRes.json();
        if (refreshedRes.ok) {
          setPeriods(refreshedData.periods);
          const active = refreshedData.periods.find((p: Period) => p.status === 'active');
          if (active) setSelectedPeriodId(active.id);
        }
        setShowAddPeriod(false);
        setNewPeriodName('');
        setNewPeriodType('routine');
      } else {
        alert(data.error || 'Gagal membuat periode baru.');
      }
    } catch (err) {
      alert('Gagal memproses periode baru.');
    } finally {
      setPeriodLoading(false);
    }
  };

  const handleTogglePeriodActive = async (periodId: string) => {
    const code = adminToken;
    try {
      setLoadingData(true);
      const res = await fetch('/api/admin/periods', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${code}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activeId: periodId })
      });
      if (res.ok) {
        // Refresh periods
        const refreshedRes = await fetch('/api/admin/periods', {
          headers: { 'Authorization': `Bearer ${code}` }
        });
        const refreshedData = await refreshedRes.json();
        if (refreshedRes.ok) {
          setPeriods(refreshedData.periods);
        }
      } else {
        alert('Gagal mengaktifkan periode.');
      }
    } catch (err) {
      alert('Koneksi bermasalah.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteEvaluation = async (id: string, evaluatorName: string, targetName: string) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus penilaian dari "${evaluatorName}" untuk "${targetName}"? Penilai akan bisa menilai staf ini kembali.`);
    if (!confirmDelete) return;

    setLoadingData(true);
    try {
      const code = adminToken;
      const res = await fetch(`/api/admin/rekap?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${code}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Penilaian berhasil dihapus.');
        fetchData(selectedPeriodId);
      } else {
        alert(data.error || 'Gagal menghapus penilaian.');
      }
    } catch (err) {
      alert('Koneksi bermasalah saat menghapus data.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteByEvaluator = async (evaluatorId: string, evaluatorName: string) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus SELURUH penilaian yang telah dikirim oleh "${evaluatorName}" pada periode ini? Semua penilaian dari orang tersebut akan direset.`);
    if (!confirmDelete) return;

    setLoadingData(true);
    try {
      const code = adminToken;
      const res = await fetch(`/api/admin/rekap?evaluatorId=${evaluatorId}&periodId=${selectedPeriodId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${code}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Seluruh penilaian penilai tersebut berhasil dihapus.');
        fetchData(selectedPeriodId);
      } else {
        alert(data.error || 'Gagal menghapus data.');
      }
    } catch (err) {
      alert('Koneksi bermasalah saat menghapus data.');
    } finally {
      setLoadingData(false);
    }
  };

  const getExportUrl = () => {
    const code = adminToken;
    return `/api/admin/export?periodId=${selectedPeriodId}&token=${encodeURIComponent(code)}`;
  };

  // Filter rankings based on search query and department filter
  const filteredRankings = (() => {
    let filtered = rankings.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply department filter
    if (departmentFilter) {
      filtered = filtered.filter((r) => r.department === departmentFilter);
    }

    // Re-sort and re-rank within the filtered set
    filtered.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return a.name.localeCompare(b.name);
    });

    // Re-assign rank numbers within filtered results
    return filtered.map((r, index) => ({
      ...r,
      rank: r.totalEvaluations > 0 ? index + 1 : '-' as number | string,
    }));
  })();

  // Get unique departments from rankings for filter dropdown
  const availableDepartments = Array.from(new Set(rankings.map((r) => r.department))).sort();

  // Filter raw evaluations based on search query
  const filteredRaw = rawEvaluations.filter((r) =>
    r.evaluatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.evaluatorDept.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.targetDept.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRankBadge = (rank: number | string) => {
    if (rank === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/25">🥇 Gold</span>;
    if (rank === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-700 border border-slate-500/25">🥈 Silver</span>;
    if (rank === 3) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-700/10 text-amber-800 border border-amber-700/25">🥉 Bronze</span>;
    return null;
  };

  const getCategoryBadgeColor = (cat: string) => {
    if (cat === 'Sangat Baik') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25';
    if (cat === 'Baik') return 'bg-[#d4af37]/15 text-[#b38f24] border-[#d4af37]/35';
    if (cat === 'Cukup') return 'bg-amber-500/10 text-amber-700 border-amber-500/25';
    if (cat === 'Kurang') return 'bg-orange-500/10 text-orange-700 border-orange-500/25';
    if (cat === 'Sangat Kurang') return 'bg-rose-500/10 text-rose-700 border-rose-500/25';
    return 'bg-black/5 text-[#6e6358]/60 border-[#e5dfd3]';
  };

  const [errorMsg, setErrorMsg] = useState('');

  // ----------------------------------------------------
  // LOGIN FORM VIEW
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="flex-1 bg-gradient-to-br from-[#faf8f5] via-[#f5f1eb] to-[#ece7de] text-[#2a241e] flex flex-col justify-between min-h-screen font-sans selection:bg-[#d4af37]/25 selection:text-[#2a241e]">
        <header className="px-6 py-4 border-b border-[#e5dfd3] bg-white/70 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 relative flex items-center justify-center">
              <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-8 h-8" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent">HIMASTA 2026</h1>
              <p className="text-[9px] text-[#6e6358] tracking-wider uppercase font-medium">Portal Admin</p>
            </div>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#b38f24] hover:bg-[#d4af37]/10 hover:text-[#b38f24] border border-[#d4af37]/35 transition"
          >
            Form Penilaian
          </a>
        </header>

        <main className="max-w-md w-full mx-auto px-4 py-16 flex-1 flex flex-col justify-center">
          {authError && (
            <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
              {authError}
            </div>
          )}

          <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden flex flex-col items-center">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-20 h-20 relative flex items-center justify-center mb-1">
              <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-full h-full" />
            </div>

            <div className="text-center space-y-2 w-full">
              <div className="w-10 h-10 bg-[#d4af37]/10 border border-[#d4af37]/25 rounded-2xl flex items-center justify-center mx-auto text-[#b38f24]">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold tracking-tight bg-gradient-to-b from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent">Protected Admin Portal</h2>
              <p className="text-xs text-[#6e6358] max-w-[240px] mx-auto leading-relaxed">
                Masukkan passcode admin untuk masuk ke rekapitulasi penilaian dan ranking.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 w-full">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e6358]/70">Passcode Admin</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl focus:border-[#d4af37] focus:outline-none transition text-sm text-center tracking-widest text-[#2a241e] placeholder-[#a09689]/40"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  disabled={authLoading}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading || !passcode}
                className="w-full py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] disabled:opacity-50 text-[#1f1b18] font-bold rounded-xl text-sm transition shadow-lg shadow-[#d4af37]/15 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Verifikasi & Masuk</>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-[#6e6358]/55 border-t border-[#e5dfd3] bg-[#faf8f5]/50">
          © {new Date().getFullYear()} HIMASTA UNS 2026 KABINET LINTANG LOKA
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN DASHBOARD VIEW
  const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
  const isSelectedPeriodPleno = currentPeriod?.type === 'pleno';

  return (
    <div className="flex-1 bg-gradient-to-br from-[#faf8f5] via-[#f5f1eb] to-[#ece7de] text-[#2a241e] flex flex-col justify-between min-h-screen font-sans selection:bg-[#d4af37]/25 selection:text-[#2a241e]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[#e5dfd3] bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 relative flex items-center justify-center">
            <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-8 h-8" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent">HIMASTA 2026</h1>
            <p className="text-[10px] text-[#b38f24] tracking-wider uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Dashboard Admin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#b38f24] hover:bg-[#d4af37]/10 hover:text-[#b38f24] border border-[#d4af37]/35 transition"
          >
            Halaman Utama
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 space-y-6">
        {dataError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
            {dataError}
          </div>
        )}

        {/* Dashboard Grid Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Period Selector Card */}
          <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6e6358]/70 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#b38f24]" />
              Periode Penilaian
            </h2>

            <div className="flex items-center gap-2">
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="flex-1 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl px-3.5 py-2.5 text-xs text-[#2a241e] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white text-[#2a241e]">
                    {p.name} {p.status === 'active' ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowAddPeriod(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] text-[#1f1b18] font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#d4af37]/15"
                title="Buka Periode Baru"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Baru</span>
              </button>
            </div>

            {currentPeriod && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#6e6358]/70">Status:</span>
                {currentPeriod.status === 'active' ? (
                  <span className="text-[10px] font-bold text-emerald-600 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                    🟢 Sedang Aktif Menerima Nilai
                  </span>
                ) : (
                  <button
                    onClick={() => handleTogglePeriodActive(currentPeriod.id)}
                    className="text-[10px] font-bold text-[#b38f24] hover:text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2.5 py-0.5 rounded-full transition"
                  >
                    Aktifkan Periode Ini
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Metrics Cards */}
          <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6e6358]/70 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#b38f24]" />
              Partisipasi Staf
            </h2>
            <div className="py-2">
              <span className="text-3xl font-black text-[#2a241e]">{rankings.filter(r => r.totalEvaluations > 0).length}</span>
              <span className="text-sm text-[#6e6358]"> / {rankings.length} Staf Dinilai</span>
            </div>
            <p className="text-[10px] text-[#6e6358]/70">
              Jumlah staf yang telah menerima minimal satu suara evaluasi.
            </p>
          </div>

          <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6e6358]/70 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#b38f24]" />
              Ekspor Laporan
            </h2>
            <div className="py-2">
              <span className="text-3xl font-black text-[#2a241e]">{rawEvaluations.length}</span>
              <span className="text-xs text-[#6e6358]"> Form Terkumpul</span>
            </div>
            <a
              href={getExportUrl()}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/15"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Unduh File Excel (.xlsx)
            </a>
          </div>
        </div>

        {/* Dashboard Content Panel */}
        <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e5dfd3] pb-4">
            {/* Tabs */}
            <div className="flex flex-wrap bg-[#faf8f5] border border-[#e5dfd3] p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('ranking')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'ranking' ? 'bg-[#d4af37] text-[#1f1b18] font-bold shadow-sm' : 'text-[#6e6358] hover:text-[#2a241e]'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Ranking Staf
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'progress' ? 'bg-[#d4af37] text-[#1f1b18] font-bold shadow-sm' : 'text-[#6e6358] hover:text-[#2a241e]'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Belum Mengisi
                {evaluatorProgress.filter(p => !p.isComplete).length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white">
                    {evaluatorProgress.filter(p => !p.isComplete).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'raw' ? 'bg-[#d4af37] text-[#1f1b18] font-bold shadow-sm' : 'text-[#6e6358] hover:text-[#2a241e]'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Data Mentah
              </button>
              <button
                onClick={() => setActiveTab('magista')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'magista' ? 'bg-[#EA580C] text-white font-bold shadow-sm' : 'text-[#6e6358] hover:text-[#2a241e]'
                }`}
              >
                <span>🌻</span>
                MAGISTA 2026
              </button>
            </div>

            {/* Search and Refresh */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#6e6358]/55" />
                <input
                  type="text"
                  placeholder="Cari..."
                  className="w-full pl-9 pr-4 py-2 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl text-xs focus:outline-none focus:border-[#d4af37] text-[#2a241e] placeholder-[#a09689]/40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => fetchData(selectedPeriodId)}
                disabled={loadingData}
                className="p-2 bg-[#d4af37]/5 hover:bg-[#d4af37]/12 text-[#b38f24] border border-[#d4af37]/25 rounded-xl transition flex items-center justify-center"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* LOADING STATE */}
          {loadingData ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#6e6358]/70">Memuat rekapitulasi data...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: RANKINGS */}
              {activeTab === 'ranking' && (
                <div className="space-y-4">
                  {/* Department Filter */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-[#6e6358]/60" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6e6358]/70">Departemen:</span>
                    </div>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="bg-[#faf8f5] border border-[#e5dfd3] rounded-lg px-3 py-1.5 text-xs text-[#2a241e] focus:outline-none focus:border-[#d4af37] transition"
                    >
                      <option value="">Semua Departemen</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    {departmentFilter && (
                      <button
                        onClick={() => setDepartmentFilter('')}
                        className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 transition px-2 py-1 rounded-lg hover:bg-rose-50 border border-rose-200"
                      >
                        ✕ Reset Filter
                      </button>
                    )}
                    {departmentFilter && (
                      <span className="text-[10px] font-bold text-[#b38f24] bg-[#d4af37]/10 border border-[#d4af37]/25 px-2.5 py-1 rounded-lg">
                        Menampilkan ranking internal {departmentFilter} ({filteredRankings.length} staf)
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-[#e5dfd3] rounded-xl bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#faf8f5] border-b border-[#e5dfd3] text-[#6e6358]/80 uppercase text-[10px] font-black tracking-wider">
                        <th className="py-3 px-4 text-center w-12">Rank</th>
                        <th className="py-3 px-4">Nama Staf</th>
                        <th className="py-3 px-4">Departemen</th>
                        {!isSelectedPeriodPleno && (
                          <>
                            <th className="py-3 px-4 text-center">Staff (40%)</th>
                            <th className="py-3 px-4 text-center">PHT (50%)</th>
                            <th className="py-3 px-4 text-center">Dir/Wadir (10%)</th>
                          </>
                        )}
                        <th className="py-3 px-4 text-center">Penilai</th>
                        <th className="py-3 px-4 text-center w-24">Nilai Akhir</th>
                        <th className="py-3 px-4 text-center w-28">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5dfd3]">
                      {filteredRankings.length > 0 ? (
                        filteredRankings.map((r, idx) => (
                          <tr key={r.staffId} className="hover:bg-black/[0.02] transition">
                            <td className="py-3.5 px-4 text-center font-bold text-[#2a241e]">
                              {getRankBadge(r.rank) || r.rank}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#2a241e] hover:text-[#b38f24] transition">
                              {r.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-[#faf8f5] border border-[#e5dfd3] text-[10px] text-[#6e6358]">
                                {r.department}
                              </span>
                            </td>
                            {!isSelectedPeriodPleno && (
                              <>
                                <td className="py-3.5 px-4 text-center text-[#2a241e]/90">
                                  {r.avgStaff !== null ? (
                                    <span>{r.avgStaff} <span className="text-[10px] text-[#6e6358]/55">({r.countStaff}x)</span></span>
                                  ) : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-center text-[#2a241e]/90">
                                  {r.avgPht !== null ? (
                                    <span>{r.avgPht} <span className="text-[10px] text-[#6e6358]/55">({r.countPht}x)</span></span>
                                  ) : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-center text-[#2a241e]/90">
                                  {r.avgDirector !== null ? (
                                    <span>{r.avgDirector} <span className="text-[10px] text-[#6e6358]/55">({r.countDirector}x)</span></span>
                                  ) : '-'}
                                </td>
                              </>
                            )}
                            <td className="py-3.5 px-4 text-center font-medium text-[#6e6358]">{r.totalEvaluations}</td>
                            <td className="py-3.5 px-4 text-center font-black text-[#b38f24] text-sm">
                              {r.totalEvaluations > 0 ? r.finalScore : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold ${getCategoryBadgeColor(r.category)}`}>
                                {r.category}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={isSelectedPeriodPleno ? 6 : 9} className="py-8 text-center text-[#6e6358]/40">
                            Tidak ada data ranking.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              )}

              {/* TAB 2: PROGRESS / BELUM MENGISI */}
              {activeTab === 'progress' && (() => {
                const incomplete = evaluatorProgress.filter(p => !p.isComplete);
                const complete = evaluatorProgress.filter(p => p.isComplete);
                const filteredProgress = evaluatorProgress.filter(p =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
                );

                const getRoleLabel = (role: string) => {
                  if (role === 'director_vice') return 'Director/Vice Director';
                  if (role === 'pht') return 'PHT';
                  return 'Staff';
                };

                return (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-600">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-2xl font-black text-rose-700">{incomplete.length}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Belum Selesai</p>
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-2xl font-black text-emerald-700">{complete.length}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Sudah Selesai</p>
                        </div>
                      </div>
                      <div className="bg-[#faf8f5] border border-[#e5dfd3] rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#d4af37]/15 flex items-center justify-center text-[#b38f24]">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-2xl font-black text-[#2a241e]">{evaluatorProgress.length}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6358]">Total Evaluator</p>
                        </div>
                      </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="bg-[#faf8f5] border border-[#e5dfd3] rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#2a241e]">Keseluruhan Progress Pengisian</span>
                        <span className="font-black text-[#b38f24]">
                          {complete.length} / {evaluatorProgress.length} evaluator selesai
                          ({evaluatorProgress.length > 0 ? Math.round((complete.length / evaluatorProgress.length) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-[#e5dfd3] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            complete.length === evaluatorProgress.length
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-[#d4af37] to-[#b38f24]'
                          }`}
                          style={{ width: `${evaluatorProgress.length > 0 ? (complete.length / evaluatorProgress.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-[#e5dfd3] rounded-xl bg-white">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-[#faf8f5] border-b border-[#e5dfd3] text-[#6e6358]/80 uppercase text-[10px] font-black tracking-wider">
                            <th className="py-3 px-4 text-center w-12">No</th>
                            <th className="py-3 px-4">Nama Evaluator</th>
                            <th className="py-3 px-4">Jabatan</th>
                            <th className="py-3 px-4">Departemen</th>
                            <th className="py-3 px-4 text-center">Progress</th>
                            <th className="py-3 px-4 text-center w-28">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5dfd3]">
                          {filteredProgress.length > 0 ? (
                            filteredProgress
                              .sort((a, b) => {
                                if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
                                const ratioA = a.totalTargets > 0 ? a.doneCount / a.totalTargets : 0;
                                const ratioB = b.totalTargets > 0 ? b.doneCount / b.totalTargets : 0;
                                return ratioA - ratioB;
                              })
                              .map((p, idx) => (
                                <tr key={p.id} className={`hover:bg-black/[0.02] transition ${!p.isComplete ? '' : 'opacity-60'}`}>
                                  <td className="py-3 px-4 text-center text-[#6e6358]/55">{idx + 1}</td>
                                  <td className="py-3 px-4 font-bold text-[#2a241e]">{p.name}</td>
                                  <td className="py-3 px-4 text-[#6e6358]">
                                    <span className="text-[10px]">{getRoleLabel(p.role)}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 rounded bg-[#faf8f5] border border-[#e5dfd3] text-[10px] text-[#6e6358]">
                                      {p.department}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 rounded-full bg-[#e5dfd3] overflow-hidden min-w-[60px]">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            p.isComplete ? 'bg-emerald-500' : p.doneCount > 0 ? 'bg-[#d4af37]' : 'bg-rose-400'
                                          }`}
                                          style={{ width: `${p.totalTargets > 0 ? (p.doneCount / p.totalTargets) * 100 : 0}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-[#6e6358] whitespace-nowrap">
                                        {p.doneCount}/{p.totalTargets}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {p.isComplete ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border-emerald-500/25">
                                        <CheckCircle2 className="w-3 h-3" /> Selesai
                                      </span>
                                    ) : p.doneCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold bg-amber-500/10 text-amber-700 border-amber-500/25">
                                        <Clock className="w-3 h-3" /> Belum Lengkap
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold bg-rose-500/10 text-rose-700 border-rose-500/25">
                                        <AlertCircle className="w-3 h-3" /> Belum Mengisi
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-[#6e6358]/40">
                                Tidak ada data evaluator.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: RAW DATA */}
              {activeTab === 'raw' && (
                <div className="space-y-4">
                  {/* Batch Delete Button when filtered to one evaluator */}
                  {(() => {
                    const uniqueEvaluators = Array.from(new Set(filteredRaw.map(r => r.evaluatorId)));
                    const isSingleEvaluatorFiltered = uniqueEvaluators.length === 1 && filteredRaw.length > 0;
                    if (isSingleEvaluatorFiltered) {
                      const evaluatorName = filteredRaw[0].evaluatorName;
                      const evaluatorId = filteredRaw[0].evaluatorId;
                      return (
                        <div className="flex justify-end animate-fade-in">
                          <button
                            onClick={() => handleDeleteByEvaluator(evaluatorId, evaluatorName)}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Semua Penilaian dari {evaluatorName} ({filteredRaw.length} data)
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="overflow-x-auto border border-[#e5dfd3] rounded-xl bg-white">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-[#faf8f5] border-b border-[#e5dfd3] text-[#6e6358]/80 uppercase text-[10px] font-black tracking-wider">
                          <th className="py-3 px-4 text-center w-12">No</th>
                          <th className="py-3 px-4">Nama Penilai</th>
                          <th className="py-3 px-4">Jabatan (Dept) Penilai</th>
                          <th className="py-3 px-4">Staf yang Dinilai</th>
                          {isSelectedPeriodPleno ? (
                            <>
                              <th className="py-3 px-2 text-center" title="Respect & Peduli">Resp</th>
                              <th className="py-3 px-2 text-center" title="Disiplin Kehadiran">Dis</th>
                              <th className="py-3 px-2 text-center" title="Aktif Proker Dept">Prok</th>
                              <th className="py-3 px-2 text-center" title="Kontribusi Kepanitiaan">Pan</th>
                              <th className="py-3 px-2 text-center" title="Partisipasi Dept Lain">Lain</th>
                              <th className="py-3 px-2 text-center" title="Komunikasi Respons Grup">KomG</th>
                              <th className="py-3 px-2 text-center" title="Tanggung Jawab Amanah">Amn</th>
                            </>
                          ) : (
                            <>
                              <th className="py-3 px-4 text-center">Sikap</th>
                              <th className="py-3 px-4 text-center">Komp</th>
                              <th className="py-3 px-4 text-center">Self-Imp</th>
                              <th className="py-3 px-4 text-center">Prof</th>
                              <th className="py-3 px-4 text-center">Lead</th>
                            </>
                          )}
                          <th className="py-3 px-4 text-center w-20">Rerata</th>
                          <th className="py-3 px-4">Waktu Submit</th>
                          <th className="py-3 px-4 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5dfd3]">
                        {filteredRaw.length > 0 ? (
                          filteredRaw.map((r, index) => (
                            <tr key={r.id} className="hover:bg-black/[0.02] transition">
                              <td className="py-3 px-4 text-center text-[#6e6358]/55">{index + 1}</td>
                              <td className="py-3 px-4 font-semibold text-[#2a241e]">{r.evaluatorName}</td>
                              <td className="py-3 px-4 text-[#6e6358]">
                                {r.evaluatorRole.toUpperCase() === 'STAFF' ? 'Staf' : r.evaluatorRole.toUpperCase()} ({r.evaluatorDept})
                              </td>
                              <td className="py-3 px-4 font-semibold text-[#b38f24]">
                                {r.targetName} <span className="text-[10px] text-[#6e6358]/70">({r.targetDept})</span>
                              </td>
                              {isSelectedPeriodPleno ? (
                                <>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoRespect}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoDisiplin}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoAktifProker}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoKepanitiaan}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoPartisipasiLain}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoKomunikasiGrup}</td>
                                  <td className="py-3 px-2 text-center text-[#2a241e]/90">{r.scorePlenoTanggungJawab}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreSikap}</td>
                                  <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreKomunikasi}</td>
                                  <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreImprovement}</td>
                                  <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreProfesionalisme}</td>
                                  <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreLeadership}</td>
                                </>
                              )}
                              <td className="py-3 px-4 text-center font-bold text-[#2a241e]">{r.overallScore}</td>
                              <td className="py-3 px-4 text-[#6e6358]/60 text-[10px]">
                                {new Date(r.createdAt).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-4 text-center">
                                <button
                                  onClick={() => handleDeleteEvaluation(r.id, r.evaluatorName, r.targetName)}
                                  className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-100 transition"
                                  title="Hapus penilaian ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={isSelectedPeriodPleno ? 14 : 12} className="py-8 text-center text-[#6e6358]/40">
                              Belum ada pengisian nilai.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: MAGISTA 2026 */}
              {activeTab === 'magista' && (
                <div className="space-y-6">
                  {/* Top Bar: Header & Actions */}
                  <div className="bg-[#FFFDF9] border-2 border-[#292524] rounded-2xl p-5 shadow-[3px_3px_0px_#292524] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🌻</span>
                        <h3 className="font-extrabold text-base md:text-lg text-[#1C1917]">
                          Rekapitulasi Nilai MAGISTA 2026
                        </h3>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]">
                          103 Peserta Magang
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Monitoring penilaian FGD dan Magang Bidang oleh PHT masing-masing departemen.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={`/api/admin/magista/export?token=${encodeURIComponent(adminToken)}`}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 border-2 border-[#292524] shadow-[2px_2px_0px_#292524] active:translate-x-[1px] active:translate-y-[1px] transition"
                        title="Unduh seluruh rekap nilai dalam file Excel multi-sheet persis format penilaian semuanya.xlsx"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Unduh Excel (.xlsx)</span>
                      </a>

                      <button
                        onClick={() => setShowScriptModal(true)}
                        className="px-3.5 py-2.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] rounded-xl text-xs font-bold border-2 border-[#292524] shadow-[2px_2px_0px_#292524] active:translate-x-[1px] active:translate-y-[1px] transition"
                      >
                        ⚙️ Setup Google Sheets
                      </button>
                    </div>
                  </div>

                  {/* Google Spreadsheet Sync Widget */}
                  <div className="bg-[#FFF8E7] border-2 border-[#292524] rounded-2xl p-4 shadow-[2px_2px_0px_#292524]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
                      <div>
                        <span className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                          <span>📊</span> Sinkronisasi Realtime ke Google Spreadsheet Panitia
                        </span>
                        <p className="text-[11px] text-stone-600">
                          Masukkan URL Google Apps Script Webhook untuk mengupdate data sheet panitia secara instan.
                        </p>
                      </div>
                      <button
                        onClick={handleSyncSheets}
                        disabled={syncingSheets || !webhookUrl}
                        className="px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white rounded-xl text-xs font-bold border-2 border-[#292524] shadow-[2px_2px_0px_#292524] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1.5 shrink-0"
                      >
                        {syncingSheets ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Menyinkronkan...</span>
                          </>
                        ) : (
                          <>
                            <span>Sync ke Spreadsheet</span>
                            <span>⚡</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-[#292524] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                      />
                    </div>
                    {syncMsg && (
                      <p className={`text-xs font-semibold mt-2 ${syncMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {syncMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Department PHT Progress Cards */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-3 flex items-center gap-1.5">
                      <span>👥</span> Status Penilaian PHT per Departemen
                    </h4>
                    {loadingMagista ? (
                      <div className="py-8 text-center text-xs text-stone-500">Memuat status PHT...</div>
                    ) : magistaData?.departmentProgress ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {magistaData.departmentProgress.map((dp: any) => (
                          <div
                            key={dp.department}
                            className="bg-white border-2 border-[#292524] rounded-xl p-3.5 shadow-[2px_2px_0px_#292524] flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-xs text-[#1C1917]">{dp.department}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]">
                                {dp.totalInterns} Peserta
                              </span>
                            </div>
                            <div className="space-y-1">
                              {dp.phts.map((pht: any) => (
                                <div key={pht.id} className="flex items-center justify-between text-[11px] py-1 border-t border-stone-100">
                                  <span className="truncate max-w-[140px] text-stone-700" title={pht.name}>
                                    {pht.name}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    pht.isFinished 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : pht.done > 0 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {pht.done} / {pht.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Master Table of 103 Interns */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-stone-600" />
                        <span className="text-xs font-bold text-stone-700">Filter Departemen:</span>
                        <select
                          value={magistaDeptFilter}
                          onChange={(e) => setMagistaDeptFilter(e.target.value)}
                          className="bg-white border-2 border-[#292524] rounded-xl px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none"
                        >
                          <option value="">Semua Departemen (103 Peserta)</option>
                          {magistaData?.departments?.map((d: string) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        {magistaDeptFilter && (
                          <button
                            onClick={() => setMagistaDeptFilter('')}
                            className="text-xs font-bold text-rose-600 hover:underline"
                          >
                            ✕ Reset
                          </button>
                        )}
                      </div>

                      <div className="relative sm:w-64">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Cari nama / NIM peserta..."
                          value={magistaSearch}
                          onChange={(e) => setMagistaSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border-2 border-[#292524] rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border-2 border-[#292524] rounded-2xl bg-white shadow-[2px_2px_0px_#292524]">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-[#FAF5EC] border-b-2 border-[#292524] text-[#1C1917] uppercase text-[10px] font-black tracking-wider">
                            <th className="py-3 px-3 text-center w-12">No</th>
                            <th className="py-3 px-3 w-32">NIM</th>
                            <th className="py-3 px-4">Nama Mahasiswa</th>
                            <th className="py-3 px-3">Departemen</th>
                            <th className="py-3 px-3 text-center">FGD</th>
                            <th className="py-3 px-3 text-center">Magang Bidang</th>
                            <th className="py-3 px-3 text-center">Magang Angkatan</th>
                            <th className="py-3 px-4 text-center w-28 bg-[#FFF8E7]">Nilai Akhir</th>
                            <th className="py-3 px-3 text-center w-28">Predikat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {(() => {
                            const filtered = (magistaData?.interns || []).filter((item: any) => {
                              const matchDept = !magistaDeptFilter || item.department === magistaDeptFilter;
                              const matchQuery = !magistaSearch || 
                                item.name.toLowerCase().includes(magistaSearch.toLowerCase()) ||
                                item.nim.includes(magistaSearch);
                              return matchDept && matchQuery;
                            });

                            if (loadingMagista) {
                              return (
                                <tr>
                                  <td colSpan={9} className="py-12 text-center text-stone-400">
                                    Memuat data peserta magang...
                                  </td>
                                </tr>
                              );
                            }

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={9} className="py-12 text-center text-stone-400">
                                    Tidak ada data peserta magang yang sesuai.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((item: any, idx: number) => (
                              <tr key={item.id} className="hover:bg-stone-50 transition">
                                <td className="py-3 px-3 text-center font-bold text-stone-500">{idx + 1}</td>
                                <td className="py-3 px-3 font-mono font-bold text-[#1C1917]">{item.nim}</td>
                                <td className="py-3 px-4 font-bold text-[#1C1917]">{item.name}</td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 border border-stone-200">
                                    {item.department}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-bold">
                                  {item.fgd ? item.fgd.average : <span className="text-stone-300">—</span>}
                                </td>
                                <td className="py-3 px-3 text-center font-bold">
                                  {item.bidang ? (
                                    <span>
                                      {item.bidang.average}
                                      <span className="text-[10px] block font-normal text-stone-500">
                                        ({item.bidang.predicate.label})
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-stone-300">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center font-bold">
                                  {item.angkatan ? item.angkatan.average : <span className="text-stone-300">Pending</span>}
                                </td>
                                <td className="py-3 px-4 text-center font-extrabold text-sm bg-[#FFFDF9] text-[#EA580C]">
                                  {item.finalAverage !== null ? item.finalAverage : '—'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {item.finalPredicate ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.finalPredicate.badgeBg}`}>
                                      {item.finalPredicate.label}
                                    </span>
                                  ) : (
                                    <span className="text-stone-300">—</span>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* CREATE PERIOD MODAL */}
      {showAddPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#e5dfd3] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#2a241e] flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-[#b38f24]" />
                Buka Periode Penilaian Baru
              </h3>
              <p className="text-xs text-[#6e6358] mt-1">
                 Ini akan menonaktifkan periode penilaian aktif saat ini, dan membuka periode baru untuk diisi.
              </p>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e6358]/70">
                  Nama Periode (Contoh: "Juni 2026")
                </label>
                <input
                  type="text"
                  placeholder="Nama bulan dan tahun..."
                  className="w-full px-4 py-2.5 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl focus:border-[#d4af37] focus:outline-none transition text-sm text-[#2a241e] placeholder-[#a09689]/40"
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e6358]/70">
                  Tipe Penilaian
                </label>
                <select
                  value={newPeriodType}
                  onChange={(e) => setNewPeriodType(e.target.value as Period['type'])}
                  className="w-full px-4 py-2.5 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl focus:border-[#d4af37] focus:outline-none transition text-sm text-[#2a241e]"
                >
                  <option value="routine">Rutin / Bulanan (5 Pertanyaan Standar)</option>
                  <option value="pleno">Pleno 1 (7 Pertanyaan Keaktifan Pleno)</option>
                  <option value="magista_fgd">🌻 MAGISTA: FGD (Magang Departemen)</option>
                  <option value="magista_bidang">🌻 MAGISTA: Magang Bidang (Magang Departemen)</option>
                  <option value="magista_angkatan">🌻 MAGISTA: Magang Angkatan (Penampilan)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPeriod(false);
                    setNewPeriodName('');
                  }}
                  className="px-4 py-2 hover:bg-black/5 rounded-lg text-[#6e6358] hover:text-[#2a241e] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={periodLoading || !newPeriodName}
                  className="px-4 py-2 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] disabled:opacity-50 text-[#1f1b18] font-bold rounded-lg transition flex items-center gap-1.5 shadow-md shadow-[#d4af37]/15"
                >
                  {periodLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Buka Periode</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOOGLE APPS SCRIPT SETUP MODAL */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FFFDF9] border-2 border-[#292524] rounded-2xl max-w-2xl w-full p-6 shadow-[5px_5px_0px_#292524] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="font-extrabold text-base text-[#1C1917]">
                  Panduan Setup Webhook Google Spreadsheet
                </h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1 hover:bg-stone-200 rounded-lg text-stone-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-700 space-y-3 overflow-y-auto pr-1">
              <div className="bg-[#FFF7ED] p-3.5 rounded-xl border border-[#FDBA74] space-y-2">
                <p className="font-bold text-[#9A3412]">Langkah-langkah Cepat (Hanya 1 Menit):</p>
                <ol className="list-decimal pl-4 space-y-1 text-stone-800">
                  <li>Buka Spreadsheet Google Anda (atau buat baru di <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-orange-600 underline font-semibold">sheets.new</a>).</li>
                  <li>Di menu atas, pilih <strong>Extensions (Ekstensi)</strong> &gt; <strong>Apps Script</strong>.</li>
                  <li>Hapus semua kode bawaan yang ada di editor, lalu tempel kode template di bawah ini.</li>
                  <li>Klik tombol <strong>Deploy (Terapkan)</strong> warna biru di kanan atas &gt; <strong>New deployment</strong>.</li>
                  <li>Pilih icon gerigi &gt; pilih jenis <strong>Web app (Aplikasi web)</strong>.</li>
                  <li>Atur <strong>Execute as:</strong> <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">Me</code> dan <strong>Who has access:</strong> <code className="bg-stone-200 px-1 py-0.5 rounded font-mono text-red-600 font-bold">Anyone (Siapa saja)</code>.</li>
                  <li>Klik <strong>Deploy</strong>, lalu salin <strong>Web app URL</strong> (akhiran <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">/exec</code>).</li>
                  <li>Tempelkan URL tersebut ke kolom input webhook di tab MAGISTA dashboard ini.</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
                    Kode Google Apps Script Template:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="px-3 py-1 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-lg text-xs font-bold border border-[#292524] shadow-[1px_1px_0px_#292524] transition flex items-center gap-1.5"
                  >
                    {copiedScript ? '✓ Tersalin!' : '📋 Salin Kode Script'}
                  </button>
                </div>
                <pre className="bg-[#1C1917] text-amber-200 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed border border-stone-800">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-[#e5dfd3] text-center text-[10px] md:text-xs text-[#6e6358]/55 bg-[#faf8f5]/50">
        © {new Date().getFullYear()} HIMASTA UNS 2026 KABINET LINTANG LOKA
      </footer>
    </div>
  );
}

const GOOGLE_APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "Rekap Nilai MAGISTA 2026";
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear();
    
    var headers = [
      "No", "NIM", "Nama Mahasiswa", "Departemen",
      "Rata-rata FGD", "Rata-rata Magang Bidang", "Predikat Magang Bidang",
      "Rata-rata Magang Angkatan", "Predikat Magang Angkatan",
      "Nilai Akhir Gabungan", "Predikat Akhir"
    ];
    
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#EA580C");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    
    var rows = data.rows || [];
    var rowData = [];
    
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      rowData.push([
        r.no,
        "'" + r.nim,
        r.name,
        r.department,
        r.fgdAverage,
        r.bidangAverage,
        r.bidangPredicate,
        r.angkatanAverage,
        r.angkatanPredicate,
        r.finalAverage,
        r.finalPredicate
      ]);
    }
    
    if (rowData.length > 0) {
      sheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);
      for (var j = 2; j <= rowData.length + 1; j++) {
        sheet.getRange(j, 1, 1, headers.length).setBackground(j % 2 === 0 ? "#FFFDF9" : "#FFF7ED");
      }
      sheet.getRange(2, 1, rowData.length, 1).setHorizontalAlignment("center");
      sheet.getRange(2, 2, rowData.length, 1).setHorizontalAlignment("center");
      sheet.getRange(2, 5, rowData.length, headers.length - 4).setHorizontalAlignment("center");
    }
    
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data MAGISTA berhasil disinkronkan ke Google Spreadsheet!",
      timestamp: new Date().toISOString(),
      rowsCount: rows.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook Penilaian MAGISTA HIMASTA Aktif dan Siap Menerima Data.");
}`;
