'use client';

import React, { useState, useEffect } from 'react';
import { 
  Lock, LayoutDashboard, Calendar, FileSpreadsheet, LogOut, 
  Search, ShieldCheck, RefreshCw, Plus, Award, ArrowLeftRight, Check, ListFilter, Users, Trash2,
  ClipboardList, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

interface Period {
  id: string;
  name: string;
  status: 'active' | 'inactive';
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
  const [activeTab, setActiveTab] = useState<'ranking' | 'raw' | 'progress'>('ranking');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  
  // Period creation modal states
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [periodLoading, setPeriodLoading] = useState(false);

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
        body: JSON.stringify({ name: newPeriodName.trim() })
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

  // Filter rankings based on search query
  const filteredRankings = rankings.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
  // ----------------------------------------------------
  const currentPeriod = periods.find((p) => p.id === selectedPeriodId);

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
                <div className="overflow-x-auto border border-[#e5dfd3] rounded-xl bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#faf8f5] border-b border-[#e5dfd3] text-[#6e6358]/80 uppercase text-[10px] font-black tracking-wider">
                        <th className="py-3 px-4 text-center w-12">Rank</th>
                        <th className="py-3 px-4">Nama Staf</th>
                        <th className="py-3 px-4">Departemen</th>
                        <th className="py-3 px-4 text-center">Staff (40%)</th>
                        <th className="py-3 px-4 text-center">PHT (50%)</th>
                        <th className="py-3 px-4 text-center">Dir/Wadir (10%)</th>
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
                          <td colSpan={9} className="py-8 text-center text-[#6e6358]/40">
                            Tidak ada data ranking.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
                          <th className="py-3 px-4 text-center">Sikap</th>
                          <th className="py-3 px-4 text-center">Komp</th>
                          <th className="py-3 px-4 text-center">Self-Imp</th>
                          <th className="py-3 px-4 text-center">Prof</th>
                          <th className="py-3 px-4 text-center">Lead</th>
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
                              <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreSikap}</td>
                              <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreKomunikasi}</td>
                              <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreImprovement}</td>
                              <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreProfesionalisme}</td>
                              <td className="py-3 px-4 text-center text-[#2a241e]/90">{r.scoreLeadership}</td>
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
                            <td colSpan={12} className="py-8 text-center text-[#6e6358]/40">
                              Belum ada pengisian nilai.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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

      {/* Footer */}
      <footer className="py-6 border-t border-[#e5dfd3] text-center text-[10px] md:text-xs text-[#6e6358]/55 bg-[#faf8f5]/50">
        © {new Date().getFullYear()} HIMASTA UNS 2026 KABINET LINTANG LOKA
      </footer>
    </div>
  );
}
