'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, CheckCircle2, UserCheck, Star, Award, LogIn, RefreshCw } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  jabatan: string;
  department: string;
  role: string;
}

interface Period {
  id: string;
  name: string;
  status: string;
}

export default function EvaluationForm() {
  // Step state: 'select_evaluator' | 'select_target' | 'rating' | 'success'
  const [step, setStep] = useState<'select_evaluator' | 'select_target' | 'rating' | 'success'>('select_evaluator');
  
  // Data lists
  const [availableTargets, setAvailableTargets] = useState<Staff[]>([]);
  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  
  // Selections
  const [evaluator, setEvaluator] = useState<Staff | null>(null);
  const [target, setTarget] = useState<Staff | null>(null);
  
  // Search queries & login inputs
  const [emailInput, setEmailInput] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  
  // Ratings (1-10)
  const [scoreSikap, setScoreSikap] = useState(8);
  const [scoreKomunikasi, setScoreKomunikasi] = useState(8);
  const [scoreImprovement, setScoreImprovement] = useState(8);
  const [scoreProfesionalisme, setScoreProfesionalisme] = useState(8);
  const [scoreLeadership, setScoreLeadership] = useState(8);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load initial data (only to fetch the active period name)
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const res = await fetch('/api/staff');
        const data = await res.json();
        if (res.ok) {
          setActivePeriod(data.activePeriod);
        } else {
          setErrorMsg(data.error || 'Gagal memuat data staf.');
        }
      } catch (err) {
        setErrorMsg('Koneksi internet bermasalah.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Handle email login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorMsg('Silakan masukkan email SSO Anda.');
      return;
    }
    setErrorMsg('');
    try {
      setLoading(true);
      const res = await fetch(`/api/staff?email=${encodeURIComponent(emailInput.trim().toLowerCase())}`);
      const data = await res.json();
      if (res.ok) {
        setEvaluator(data.evaluator);
        setAvailableTargets(data.staff);
        setStep('select_target');
      } else {
        setErrorMsg(data.error || 'Email SSO tidak ditemukan.');
      }
    } catch (err) {
      setErrorMsg('Gagal memproses email Anda.');
    } finally {
      setLoading(false);
    }
  };

  // When target is selected, proceed to rating
  const handleSelectTarget = (selected: Staff) => {
    setTarget(selected);
    setStep('rating');
  };

  // Reset target selection to rate another person
  const handleRateAnother = async () => {
    if (!evaluator) return;
    setErrorMsg('');
    setTarget(null);
    // Reset scores to default
    setScoreSikap(8);
    setScoreKomunikasi(8);
    setScoreImprovement(8);
    setScoreProfesionalisme(8);
    setScoreLeadership(8);
    
    try {
      setLoading(true);
      const res = await fetch(`/api/staff?evaluatorId=${evaluator.id}`);
      const data = await res.json();
      if (res.ok) {
        setAvailableTargets(data.staff);
        setStep('select_target');
      } else {
        setErrorMsg(data.error || 'Gagal menyegarkan daftar staf.');
      }
    } catch (err) {
      setErrorMsg('Koneksi bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Form Submission
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluator || !target || !activePeriod) return;
    
    setErrorMsg('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluatorId: evaluator.id,
          targetId: target.id,
          scoreSikap,
          scoreKomunikasi,
          scoreImprovement,
          scoreProfesionalisme,
          scoreLeadership,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('success');
      } else {
        setErrorMsg(data.error || 'Gagal mengirimkan penilaian.');
      }
    } catch (err) {
      setErrorMsg('Gagal mengirim data penilaian.');
    } finally {
      setLoading(false);
    }
  };

  // Filter lists based on search queries
  const filteredTargets = availableTargets.filter((s) =>
    s.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
    s.department.toLowerCase().includes(targetSearch.toLowerCase()) ||
    s.jabatan.toLowerCase().includes(targetSearch.toLowerCase())
  );

  // Group targets by department for Directors
  const departments = Array.from(new Set(filteredTargets.map((s) => s.department)));

  const getScoreDescription = (val: number) => {
    if (val >= 9) return { label: 'Sangat Baik (A)', color: 'text-emerald-600 font-bold' };
    if (val >= 7) return { label: 'Baik (B)', color: 'text-amber-600 font-bold' };
    if (val >= 5) return { label: 'Cukup (C)', color: 'text-amber-700/90 font-bold' };
    if (val >= 3) return { label: 'Kurang (D)', color: 'text-orange-600 font-bold' };
    return { label: 'Sangat Kurang (E)', color: 'text-rose-600 font-bold' };
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-[#faf8f5] via-[#f5f1eb] to-[#ece7de] text-[#2a241e] flex flex-col justify-between min-h-screen font-sans selection:bg-[#d4af37]/25 selection:text-[#2a241e]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[#e5dfd3] bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 relative flex items-center justify-center">
            <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-8 h-8" />
          </div>
          <div>
            <h1 className="font-bold text-sm md:text-base tracking-wide bg-gradient-to-r from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent">
              HIMASTA 2026
            </h1>
            <p className="text-[10px] md:text-xs text-[#6e6358] tracking-wider uppercase font-medium">
              Staff Evaluation System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activePeriod && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#d4af37]/10 text-[#b38f24] border border-[#d4af37]/25">
              <Award className="w-3.5 h-3.5" />
              Periode: {activePeriod.name}
            </span>
          )}
          <a
            href="/admin"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#b38f24] hover:bg-[#d4af37]/10 hover:text-[#b38f24] border border-[#d4af37]/35 transition"
          >
            <LogIn className="w-3.5 h-3.5" />
            Admin Portal
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-xl shadow-[#6e6358]/5 relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#d4af37]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#b38f24]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Stepper info */}
          {step !== 'success' && (
            <div className="flex items-center gap-2 mb-6">
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                step === 'select_evaluator' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
              }`}>
                Step 1
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6e6358]/30" />
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                step === 'select_target' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
              }`}>
                Step 2
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6e6358]/30" />
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                step === 'rating' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
              }`}>
                Step 3
              </span>
            </div>
          )}

          {/* STEP 1: Email Authentication */}
          {step === 'select_evaluator' && (
            <form onSubmit={handleLogin} className="space-y-6 flex flex-col items-center">
              <div className="w-28 h-28 relative flex items-center justify-center mb-2">
                <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-full h-full" />
              </div>
              <div className="text-center w-full">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-b from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent">Sistem Penilaian Staf</h2>
                <p className="text-sm text-[#6e6358] mt-1">
                  Masukkan email SSO HIMASTA Anda untuk memverifikasi identitas.
                </p>
              </div>

              <div className="space-y-4 w-full">
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-[#6e6358]/45 text-sm font-semibold">@</span>
                  <input
                    type="email"
                    required
                    placeholder="nama@student.uns.ac.id"
                    className="w-full pl-10 pr-4 py-3.5 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl focus:border-[#d4af37] focus:outline-none transition text-sm text-[#2a241e] placeholder-[#a09689]/50"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] disabled:opacity-50 text-[#1f1b18] font-bold rounded-xl text-sm transition shadow-lg shadow-[#d4af37]/15 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>Masuk ke Penilaian</>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Select Target Staf */}
          {step === 'select_target' && evaluator && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#2a241e]">Siapa yang ingin dinilai?</h2>
                  <p className="text-sm text-[#6e6358] mt-1">
                    {evaluator.role === 'director_vice' 
                      ? 'Sebagai Director/Vice Director, Anda dapat menilai semua departemen.' 
                      : `Hanya staf di departemen Anda (${evaluator.department}) yang dapat dinilai.`
                    }
                  </p>
                </div>
                <button
                  onClick={() => setStep('select_evaluator')}
                  className="text-xs text-[#b38f24] hover:text-[#d4af37] flex items-center gap-1 font-semibold transition"
                >
                  Ganti Penilai
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-[#6e6358]/40" />
                <input
                  type="text"
                  placeholder="Cari staf yang ingin dinilai..."
                  className="w-full pl-10 pr-4 py-3 bg-[#faf8f5] border border-[#e5dfd3] rounded-xl focus:border-[#d4af37] focus:outline-none transition text-sm text-[#2a241e] placeholder-[#a09689]/50"
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-5 h-5 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto border border-[#e5dfd3] rounded-xl bg-[#faf8f5]/50 p-2 space-y-4">
                  {filteredTargets.length > 0 ? (
                    evaluator.role === 'director_vice' ? (
                      // Show grouped by department for Directors
                      departments.map((dept) => {
                        const deptStaff = filteredTargets.filter((s) => s.department === dept);
                        if (deptStaff.length === 0) return null;
                        return (
                          <div key={dept} className="space-y-1.5">
                            <h3 className="text-[10px] font-bold tracking-wider text-[#b38f24] uppercase px-2 mt-2">
                              {dept}
                            </h3>
                            <div className="divide-y divide-[#e5dfd3]">
                              {deptStaff.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => handleSelectTarget(s)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-black/5 rounded-lg flex items-center justify-between group transition"
                                >
                                  <div>
                                    <p className="font-semibold text-sm group-hover:text-[#b38f24] transition text-[#2a241e]">{s.name}</p>
                                    <p className="text-xs text-[#6e6358]/70">{s.jabatan}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-[#6e6358]/40 group-hover:text-[#2a241e] group-hover:translate-x-0.5 transition" />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Just list staff for normal department evaluator
                      <div className="divide-y divide-[#e5dfd3]">
                        {filteredTargets.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleSelectTarget(s)}
                            className="w-full text-left px-3 py-3 hover:bg-black/5 rounded-lg flex items-center justify-between group transition"
                          >
                            <div>
                              <p className="font-semibold text-sm group-hover:text-[#b38f24] transition text-[#2a241e]">
                                {s.name} {s.id === evaluator.id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4af37]/10 text-[#b38f24] ml-1 border border-[#d4af37]/20">Saya</span>}
                              </p>
                              <p className="text-xs text-[#6e6358]/70">{s.jabatan}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#6e6358]/40 group-hover:text-[#2a241e] group-hover:translate-x-0.5 transition" />
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center text-sm text-[#6e6358]/40">
                      Tidak ada staf yang tersedia untuk dinilai di periode ini.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Rating Slider Input */}
          {step === 'rating' && evaluator && target && (
            <form onSubmit={handleSubmitRating} className="space-y-6">
              <div className="flex items-start justify-between border-b border-[#e5dfd3] pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-1.5 text-[#b38f24]">
                    <UserCheck className="w-5 h-5" />
                    Penilaian Kinerja
                  </h2>
                  <div className="text-xs text-[#6e6358] mt-1 flex flex-wrap gap-2">
                    <span>Penilai: <strong>{evaluator.name}</strong></span>
                    <span>•</span>
                    <span>Menilai: <strong>{target.name}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('select_target')}
                  className="text-xs text-[#6e6358]/60 hover:text-[#2a241e] transition font-semibold"
                >
                  Kembali
                </button>
              </div>

              {/* Range inputs for 5 criteria */}
              <div className="space-y-5">
                {[
                  {
                    title: 'Sikap & Etika',
                    desc: 'Karakter, sopan santun, integritas, dan cara bertingkah laku sehari-hari.',
                    val: scoreSikap,
                    setVal: setScoreSikap,
                  },
                  {
                    title: 'Kerjasama & Komunikasi',
                    desc: 'Kolaborasi tim, keaktifan berdiskusi, kejelasan penyampaian ide/informasi.',
                    val: scoreKomunikasi,
                    setVal: setScoreKomunikasi,
                  },
                  {
                    title: 'Self Improvement',
                    desc: 'Keinginan belajar hal baru, menerima kritik konstruktif, kemauan untuk tumbuh.',
                    val: scoreImprovement,
                    setVal: setScoreImprovement,
                  },
                  {
                    title: 'Profesionalisme',
                    desc: 'Tanggung jawab penyelesaian tugas, ketepatan waktu, dan kualitas kerja.',
                    val: scoreProfesionalisme,
                    setVal: setScoreProfesionalisme,
                  },
                  {
                    title: 'Leadership',
                    desc: 'Inisiatif, kepemimpinan (baik untuk diri sendiri maupun tim), kemampuan mengarahkan.',
                    val: scoreLeadership,
                    setVal: setScoreLeadership,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#faf8f5] border border-[#e5dfd3] p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold text-[#2a241e]">{item.title}</h3>
                        <p className="text-[11px] text-[#6e6358] leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                      <span className={`text-lg font-black ${getScoreDescription(item.val).color}`}>
                        {item.val}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        className="w-full h-1.5 bg-[#e5dfd3] rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
                        value={item.val}
                        onChange={(e) => item.setVal(parseInt(e.target.value))}
                      />
                      <div className="flex justify-between text-[10px] text-[#6e6358]/55 px-0.5">
                        <span>1 (Sangat Buruk)</span>
                        <span className={`font-semibold ${getScoreDescription(item.val).color}`}>
                          {getScoreDescription(item.val).label}
                        </span>
                        <span>10 (Sempurna)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] disabled:opacity-50 text-[#1f1b18] font-bold rounded-xl text-sm transition shadow-lg shadow-[#d4af37]/15 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Mengirimkan...
                  </>
                ) : (
                  <>Kirim Penilaian</>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Success View */}
          {step === 'success' && evaluator && target && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-pulse">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-[#2a241e]">Penilaian Berhasil Dikirim!</h2>
                <p className="text-sm text-[#6e6358] max-w-sm mx-auto">
                  Terima kasih atas penilaian objektif Anda untuk <strong>{target.name}</strong> pada periode ini.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleRateAnother}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] text-[#1f1b18] font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-[#d4af37]/15"
                >
                  <RefreshCw className="w-4 h-4" />
                  Nilai Anggota Lain
                </button>
                <button
                  onClick={() => {
                    setEvaluator(null);
                    setTarget(null);
                    setStep('select_evaluator');
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-[#faf8f5] hover:bg-[#e5dfd3] text-[#6e6358] font-semibold text-sm rounded-xl border border-[#e5dfd3] transition"
                >
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#e5dfd3] text-center text-[10px] md:text-xs text-[#6e6358]/55 bg-[#faf8f5]/50">
        © {new Date().getFullYear()} HIMASTA UNS 2026 KABINET LINTANG LOKA
      </footer>
    </div>
  );
}
