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
  type: string;
}

interface Progress {
  done: number;
  total: number;
  isFinished: boolean;
}

export default function EvaluationForm() {
  // Step state: 'select_evaluator' | 'select_target' | 'rating' | 'success'
  const [step, setStep] = useState<'select_evaluator' | 'select_target' | 'rating' | 'success'>('select_evaluator');

  // Data lists
  const [availableTargets, setAvailableTargets] = useState<Staff[]>([]);
  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  // Selections
  const [evaluator, setEvaluator] = useState<Staff | null>(null);
  const [target, setTarget] = useState<Staff | null>(null);

  // Search queries & login inputs
  const [emailInput, setEmailInput] = useState('');
  const [targetSearch, setTargetSearch] = useState('');

  // Ratings (1-10), initialized to 0 (must be selected by user)
  const [scoreSikap, setScoreSikap] = useState<number>(0);
  const [scoreKomunikasi, setScoreKomunikasi] = useState<number>(0);
  const [scoreImprovement, setScoreImprovement] = useState<number>(0);
  const [scoreProfesionalisme, setScoreProfesionalisme] = useState<number>(0);
  const [scoreLeadership, setScoreLeadership] = useState<number>(0);

  // Pleno ratings
  const [scorePlenoRespect, setScorePlenoRespect] = useState<number>(0);
  const [scorePlenoDisiplin, setScorePlenoDisiplin] = useState<number>(0);
  const [scorePlenoAktifProker, setScorePlenoAktifProker] = useState<number>(0);
  const [scorePlenoKepanitiaan, setScorePlenoKepanitiaan] = useState<number>(0);
  const [scorePlenoPartisipasiLain, setScorePlenoPartisipasiLain] = useState<number>(0);
  const [scorePlenoKomunikasiGrup, setScorePlenoKomunikasiGrup] = useState<number>(0);
  const [scorePlenoTanggungJawab, setScorePlenoTanggungJawab] = useState<number>(0);

  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  // Auto-scroll to top when evaluated target changes
  useEffect(() => {
    if (target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [target]);

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
        setProgress(data.progress || null);
        
        // Auto-select first target if available
        if (data.staff && data.staff.length > 0) {
          setTarget(data.staff[0]);
          setStep('rating');
        } else {
          // If no targets available, show target selection screen (it will show completed state)
          setTarget(null);
          setStep('select_target');
        }
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

  // Skip target (e.g. absent during FGD) without submitting score
  const handleSkipTarget = () => {
    if (!target || availableTargets.length === 0) return;
    const currentIndex = availableTargets.findIndex((s) => s.id === target.id);
    const nextIndex = (currentIndex + 1) % availableTargets.length;

    // Reset scores
    setScoreSikap(0);
    setScoreKomunikasi(0);
    setScoreImprovement(0);
    setScoreProfesionalisme(0);
    setScoreLeadership(0);

    if (availableTargets.length > 1 && currentIndex !== nextIndex) {
      setTarget(availableTargets[nextIndex]);
      setStep('rating');
    } else {
      setStep('select_target');
    }
  };

  // Handle Form Submission
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluator || !target || !activePeriod) return;

    const isPleno = activePeriod.type === 'pleno';

    if (isPleno) {
      if (
        scorePlenoRespect === 0 ||
        scorePlenoDisiplin === 0 ||
        scorePlenoAktifProker === 0 ||
        scorePlenoKepanitiaan === 0 ||
        scorePlenoPartisipasiLain === 0 ||
        scorePlenoKomunikasiGrup === 0 ||
        scorePlenoTanggungJawab === 0
      ) {
        setErrorMsg('Harap berikan nilai pada semua indikator sebelum mengirim.');
        return;
      }
    } else {
      // Validation: make sure all indicators are filled (greater than 0)
      if (scoreSikap === 0 || scoreKomunikasi === 0 || scoreImprovement === 0 || scoreProfesionalisme === 0 || scoreLeadership === 0) {
        setErrorMsg('Harap berikan nilai pada semua indikator sebelum mengirim.');
        return;
      }
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluatorId: evaluator.id,
          targetId: target.id,
          ...(isPleno ? {
            scorePlenoRespect,
            scorePlenoDisiplin,
            scorePlenoAktifProker,
            scorePlenoKepanitiaan,
            scorePlenoPartisipasiLain,
            scorePlenoKomunikasiGrup,
            scorePlenoTanggungJawab,
          } : {
            scoreSikap,
            scoreKomunikasi,
            scoreImprovement,
            scoreProfesionalisme,
            scoreLeadership,
          })
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Reset scores for next target
        setScoreSikap(0);
        setScoreKomunikasi(0);
        setScoreImprovement(0);
        setScoreProfesionalisme(0);
        setScoreLeadership(0);
        setScorePlenoRespect(0);
        setScorePlenoDisiplin(0);
        setScorePlenoAktifProker(0);
        setScorePlenoKepanitiaan(0);
        setScorePlenoPartisipasiLain(0);
        setScorePlenoKomunikasiGrup(0);
        setScorePlenoTanggungJawab(0);

        // Filter out evaluated target from available list
        const remainingTargets = availableTargets.filter((s) => s.id !== target.id);
        setAvailableTargets(remainingTargets);
        
        // Update progress count
        if (progress) {
          setProgress({
            done: progress.done + 1,
            total: progress.total,
            isFinished: progress.done + 1 >= progress.total,
          });
        }

        // If there are remaining targets, auto-select next one
        if (remainingTargets.length > 0) {
          setTarget(remainingTargets[0]);
          setStep('rating');
        } else {
          // If all done, go to success screen
          setStep('success');
        }
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

  const isMagista = Boolean(activePeriod?.type?.startsWith('magista_'));

  const getScoreDescription = (val: number) => {
    if (isMagista) {
      if (val >= 9) return { label: 'Sangat Baik', color: 'text-emerald-700 font-bold' };
      if (val >= 7) return { label: 'Baik', color: 'text-amber-800 font-bold' };
      if (val >= 5) return { label: 'Kurang Baik', color: 'text-orange-800 font-bold' };
      return { label: 'Sangat Kurang', color: 'text-rose-800 font-bold' };
    }
    if (val >= 9) return { label: 'Sangat Baik (A)', color: 'text-emerald-600 font-bold' };
    if (val >= 7) return { label: 'Baik (B)', color: 'text-amber-600 font-bold' };
    if (val >= 5) return { label: 'Cukup (C)', color: 'text-amber-700/90 font-bold' };
    if (val >= 3) return { label: 'Kurang (D)', color: 'text-orange-600 font-bold' };
    return { label: 'Sangat Kurang (E)', color: 'text-rose-600 font-bold' };
  };

  return (
    <div className={`flex-1 flex flex-col justify-between min-h-screen font-sans ${
      isMagista 
        ? 'bg-gradient-to-br from-[#FAF5EC] via-[#FFF9EE] to-[#F5ECE0] text-[#292524] selection:bg-[#F59E0B]/30' 
        : 'bg-gradient-to-br from-[#faf8f5] via-[#f5f1eb] to-[#ece7de] text-[#2a241e] selection:bg-[#d4af37]/25 selection:text-[#2a241e]'
    }`}>
      {/* Header */}
      <header className={`px-6 py-4 flex items-center justify-between sticky top-0 z-30 ${
        isMagista 
          ? 'border-b-2 border-[#292524] bg-[#FFFDF9]/90 backdrop-blur-md' 
          : 'border-b border-[#e5dfd3] bg-white/70 backdrop-blur-md'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 relative flex items-center justify-center">
            <img src="/logo.png" alt="Logo HIMASTA" className="object-contain w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`font-extrabold text-sm md:text-base tracking-wide ${
                isMagista ? 'text-[#1C1917]' : 'bg-gradient-to-r from-[#2a241e] to-[#b38f24] bg-clip-text text-transparent'
              }`}>
                HIMASTA 2026
              </h1>
              {isMagista && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#FEF3C7] text-[#B45309] border border-[#292524]">
                  MAGISTA
                </span>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-[#6e6358] tracking-wider uppercase font-medium">
              {isMagista ? 'Portal Penilaian Magang' : 'Staff Evaluation System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activePeriod && (
            isMagista ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E] border-2 border-[#292524] shadow-[2px_2px_0px_#292524]">
                <span>🌻</span>
                {activePeriod.name}
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#d4af37]/10 text-[#b38f24] border border-[#d4af37]/25">
                <Award className="w-3.5 h-3.5" />
                Periode: {activePeriod.name}
              </span>
            )
          )}
          <a
            href="/admin"
            className={isMagista
              ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#FFFDF9] text-[#292524] hover:bg-[#FEF3C7] border-2 border-[#292524] shadow-[2px_2px_0px_#292524] active:translate-x-[1px] active:translate-y-[1px] transition"
              : "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#b38f24] hover:bg-[#d4af37]/10 hover:text-[#b38f24] border border-[#d4af37]/35 transition"
            }
          >
            <LogIn className="w-3.5 h-3.5" />
            Admin Portal
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {errorMsg && (
          <div className={`mb-6 p-4 rounded-xl text-sm ${
            isMagista 
              ? 'bg-[#FEE2E2] border-2 border-[#292524] text-[#991B1B] font-bold shadow-[2px_2px_0px_#292524]' 
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-600'
          }`}>
            {errorMsg}
          </div>
        )}

        <div className={isMagista
          ? "bg-[#FFFDF9] border-2 border-[#292524] shadow-[4px_4px_0px_#292524] rounded-3xl p-6 md:p-8 relative overflow-hidden"
          : "bg-white/95 border border-[#e5dfd3] backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-xl shadow-[#6e6358]/5 relative overflow-hidden"
        }>
          {/* Decorative background glow */}
          {isMagista ? (
            <>
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#F59E0B]/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-[#EA580C]/15 rounded-full blur-2xl pointer-events-none" />
            </>
          ) : (
            <>
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#d4af37]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#b38f24]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            </>
          )}

          {/* Stepper info */}
          {step !== 'success' && (
            <div className="flex items-center gap-2 mb-6">
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                isMagista
                  ? step === 'select_evaluator' ? 'bg-[#FEF3C7] border-2 border-[#292524] text-[#92400E] shadow-[1px_1px_0px_#292524]' : 'bg-stone-100 border border-stone-300 text-stone-500'
                  : step === 'select_evaluator' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
              }`}>
                Step 1
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6e6358]/30" />
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                isMagista
                  ? step === 'select_target' ? 'bg-[#FEF3C7] border-2 border-[#292524] text-[#92400E] shadow-[1px_1px_0px_#292524]' : 'bg-stone-100 border border-stone-300 text-stone-500'
                  : step === 'select_target' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
              }`}>
                Step 2
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6e6358]/30" />
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${
                isMagista
                  ? step === 'rating' ? 'bg-[#FEF3C7] border-2 border-[#292524] text-[#92400E] shadow-[1px_1px_0px_#292524]' : 'bg-stone-100 border border-stone-300 text-stone-500'
                  : step === 'rating' ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#b38f24]' : 'bg-[#faf8f5] border-[#e5dfd3] text-[#6e6358]'
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

              {/* Progress bar */}
              {progress && progress.total > 0 && (
                <div className="bg-[#faf8f5] border border-[#e5dfd3] rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#2a241e]">Progress Penilaian Anda</span>
                    <span className={`font-bold ${progress.isFinished ? 'text-emerald-600' : 'text-[#b38f24]'}`}>
                      {progress.done} / {progress.total} {progress.isFinished && '✓'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#e5dfd3] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progress.isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#d4af37] to-[#b38f24]'}`}
                      style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

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
                    <div className="p-8 text-center space-y-3">
                      {progress && progress.isFinished ? (
                        <>
                          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-emerald-700">Penilaian Anda Sudah Lengkap! 🎉</p>
                            <p className="text-xs text-[#6e6358] mt-1">
                              Anda sudah menilai semua {progress.total} target di periode <strong>{activePeriod?.name}</strong>.
                              <br />Terima kasih atas kontribusi Anda!
                            </p>
                          </div>
                        </>
                      ) : progress && progress.total === 0 ? (
                        <>
                          <p className="font-semibold text-sm text-[#2a241e]">Belum ada target untuk dinilai</p>
                          <p className="text-xs text-[#6e6358]">
                            Tidak ada staf di departemen <strong>{evaluator.department}</strong> yang dapat Anda nilai pada periode ini.
                          </p>
                        </>
                      ) : targetSearch ? (
                        <p className="text-sm text-[#6e6358]/60">
                          Tidak ada staf yang cocok dengan pencarian "<strong>{targetSearch}</strong>".
                        </p>
                      ) : (
                        <p className="text-sm text-[#6e6358]/60">
                          Tidak ada staf yang tersedia untuk dinilai di periode ini.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Rating Slider Input */}
          {step === 'rating' && evaluator && target && (
            <form onSubmit={handleSubmitRating} className="space-y-6">
              {/* Progress bar */}
              {progress && progress.total > 0 && (
                <div className="bg-[#faf8f5] border border-[#e5dfd3] rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#2a241e]">Progres Evaluasi Staf</span>
                    <span className="font-bold text-[#b38f24]">
                      {progress.done + 1} / {progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#e5dfd3] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#d4af37] to-[#b38f24]"
                      style={{ width: `${Math.min(100, ((progress.done + 1) / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className={`flex items-start justify-between pb-4 ${isMagista ? 'border-b-2 border-[#292524]' : 'border-b border-[#e5dfd3]'}`}>
                <div>
                  <span className={`text-[10px] font-bold tracking-wider uppercase block mb-1 ${isMagista ? 'text-[#EA580C]' : 'text-[#6e6358]/70'}`}>
                    {activePeriod?.type === 'magista_fgd'
                      ? '🌻 Penilaian FGD MAGISTA 2026'
                      : isMagista
                      ? '🌻 Penilaian Magang Departemen MAGISTA 2026'
                      : 'Evaluasi Kinerja Staf'}
                  </span>
                  <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#2a241e]">
                    {target.name}
                  </h2>
                  <div className="text-[11px] text-[#6e6358] mt-1.5 flex flex-wrap items-center gap-2">
                    {isMagista ? (
                      <>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B] font-mono font-bold text-[#92400E]">
                          {target.jabatan.replace('Peserta Magang', '').replace(/[()]/g, '').trim()}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F3E8FF] border border-[#7C3AED] font-semibold text-[#7C3AED]">
                          {target.department}
                        </span>
                        <span>•</span>
                        <span>Penilai: <strong>{evaluator.name}</strong> (PHT)</span>
                      </>
                    ) : (
                      <>
                        <span className="px-2 py-0.5 rounded bg-[#faf8f5] border border-[#e5dfd3] text-[#6e6358]">
                          {target.department}
                        </span>
                        <span>•</span>
                        <span>Penilai: <strong>{evaluator.name}</strong></span>
                      </>
                    )}
                  </div>
                  {activePeriod?.type === 'magista_fgd' && (
                    <div className="mt-2.5 text-[11px] font-medium text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B] rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-[1px_1px_0px_#292524]">
                      <span>💡</span>
                      <span>Peserta tidak hadir saat FGD? Anda bisa klik tombol <strong>"Lewati (Skip)"</strong> di bawah.</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep('select_target')}
                  className={`text-xs transition font-semibold ${
                    isMagista 
                      ? 'px-3 py-1.5 rounded-lg border-2 border-[#292524] bg-white hover:bg-stone-100 text-stone-700 shadow-[1px_1px_0px_#292524]' 
                      : 'text-[#6e6358]/60 hover:text-[#2a241e]'
                  }`}
                >
                  Kembali
                </button>
              </div>

              {/* Grid inputs for criteria */}
              <div className="space-y-5">
                {(activePeriod?.type === 'pleno'
                  ? [
                      {
                        title: 'Respect & Kepedulian',
                        desc: 'Respect dan peduli terhadap teman, baik di dalam department maupun di lingkungan HIMASTA.',
                        val: scorePlenoRespect,
                        setVal: setScorePlenoRespect,
                      },
                      {
                        title: 'Kedisiplinan',
                        desc: 'Disiplin dalam menghadiri rapat department, rapat kepanitiaan, dan seluruh kegiatan HIMASTA.',
                        val: scorePlenoDisiplin,
                        setVal: setScorePlenoDisiplin,
                      },
                      {
                        title: 'Keaktifan Internal Department',
                        desc: 'Aktif dan responsif dalam menjalankan program kerja dan non program kerja department.',
                        val: scorePlenoAktifProker,
                        setVal: setScorePlenoAktifProker,
                      },
                      {
                        title: 'Kontribusi Kepanitiaan Besar',
                        desc: 'Aktif berkontribusi dalam kepanitiaan besar di HIMASTA.',
                        val: scorePlenoKepanitiaan,
                        setVal: setScorePlenoKepanitiaan,
                      },
                      {
                        title: 'Partisipasi Lintas Department',
                        desc: 'Aktif berpartisipasi dalam program kerja and non program kerja department lain.',
                        val: scorePlenoPartisipasiLain,
                        setVal: setScorePlenoPartisipasiLain,
                      },
                      {
                        title: 'Komunikasi Grup',
                        desc: 'Aktif berkomunikasi dan memberikan respons di grup department maupun grup besar HIMASTA.',
                        val: scorePlenoKomunikasiGrup,
                        setVal: setScorePlenoKomunikasiGrup,
                      },
                      {
                        title: 'Tanggung Jawab Amanah',
                        desc: 'Bertanggung jawab terhadap tugas dan amanah sebagai pengurus dalam keberjalanan HIMASTA.',
                        val: scorePlenoTanggungJawab,
                        setVal: setScorePlenoTanggungJawab,
                      },
                    ]
                  : activePeriod?.type === 'magista_fgd'
                  ? [
                      {
                        title: '1. Sikap dan Etika',
                        desc: 'Norma kesopanan, etika berdiskusi, saling menghargai pendapat, dan kedisiplinan selama FGD.',
                        val: scoreSikap,
                        setVal: setScoreSikap,
                      },
                      {
                        title: '2. Komunikasi',
                        desc: 'Keaktifan, partisipasi, kejelasan artikulasi, dan keterbukaan dalam menyampaikan pendapat saat FGD.',
                        val: scoreKomunikasi,
                        setVal: setScoreKomunikasi,
                      },
                      {
                        title: '3. Self Improvement',
                        desc: 'Keterbukaan terhadap saran/kritik, kemampuan berpikir solutif, dan kemauan untuk berkembang.',
                        val: scoreImprovement,
                        setVal: setScoreImprovement,
                      },
                      {
                        title: '4. Kesesuaian Jawaban',
                        desc: 'Kesesuaian argumen dengan topik masalah, kedalaman analisis, dan relevansi solusi yang diutarakan.',
                        val: scoreProfesionalisme,
                        setVal: setScoreProfesionalisme,
                      },
                      {
                        title: '5. Leadership',
                        desc: 'Kemampuan memandu jalannya diskusi, inisiatif memecahkan kebuntuan, dan mengarahkan kelompok.',
                        val: scoreLeadership,
                        setVal: setScoreLeadership,
                      },
                    ]
                  : isMagista
                  ? [
                      {
                        title: '1. Sikap dan Etika',
                        desc: 'Norma kesopanan, etika berorganisasi, keaktifan, dan kedisiplinan selama magang departemen.',
                        val: scoreSikap,
                        setVal: setScoreSikap,
                      },
                      {
                        title: '2. Kerja Sama dan Komunikasi',
                        desc: 'Kolaborasi dalam tim/departemen, koordinasi tugas, dan keterbukaan komunikasi antaranggota.',
                        val: scoreKomunikasi,
                        setVal: setScoreKomunikasi,
                      },
                      {
                        title: '3. Self Improvement',
                        desc: 'Inisiatif belajar mandiri, refleksi diri, dan adaptasi terhadap arahan kerja PHT.',
                        val: scoreImprovement,
                        setVal: setScoreImprovement,
                      },
                      {
                        title: '4. Profesionalisme',
                        desc: 'Tanggung jawab penyelesaian tugas magang, komitmen, dan ketepatan waktu tenggat tugas.',
                        val: scoreProfesionalisme,
                        setVal: setScoreProfesionalisme,
                      },
                      {
                        title: '5. Leadership',
                        desc: 'Inisiatif pribadi, kemandirian pemecahan masalah, dan kontribusi kepemimpinan program kerja.',
                        val: scoreLeadership,
                        setVal: setScoreLeadership,
                      },
                    ]
                  : [
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
                    ]
                ).map((item, idx) => (
                  <div key={idx} className={isMagista
                    ? "bg-[#FFFDF9] border-2 border-[#292524] shadow-[2px_2px_0px_#292524] p-4 rounded-2xl space-y-3"
                    : "bg-[#faf8f5] border border-[#e5dfd3] p-4 rounded-xl space-y-3"
                  }>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-[#2a241e]">{item.title}</h3>
                        <p className="text-[11px] text-[#6e6358] leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                      <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${
                        isMagista
                          ? item.val > 0
                            ? 'bg-[#FEF3C7] border-2 border-[#292524] text-[#92400E] shadow-[1px_1px_0px_#292524]'
                            : 'text-stone-400 bg-stone-100 border border-stone-200'
                          : item.val > 0 
                            ? getScoreDescription(item.val).color + ' bg-[#d4af37]/5 border border-[#d4af37]/20' 
                            : 'text-[#6e6358]/40 bg-black/5'
                      }`}>
                        {item.val > 0 ? item.val : '-'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Rating Buttons 1-10 */}
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const isSelected = item.val === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => item.setVal(num)}
                              className={`py-2 text-xs font-bold rounded-lg transition ${
                                isMagista
                                  ? isSelected
                                    ? 'bg-[#F59E0B] text-[#1C1917] font-extrabold border-2 border-[#292524] shadow-[2px_2px_0px_#292524] scale-[1.03]'
                                    : 'bg-[#FFFDF9] hover:bg-[#FEF3C7] border-2 border-[#292524] text-[#292524] shadow-[1px_1px_0px_#292524]'
                                  : isSelected
                                    ? 'bg-[#d4af37] border-[#b38f24] text-[#1f1b18] scale-[1.03] shadow-sm shadow-[#d4af37]/25'
                                    : 'bg-white hover:bg-black/5 border-[#e5dfd3] text-[#6e6358] hover:text-[#2a241e]'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-[#6e6358]/55 px-0.5">
                        <span>1 (Sangat Kurang)</span>
                        <span className={`font-semibold ${item.val > 0 ? getScoreDescription(item.val).color : 'text-[#6e6358]/40'}`}>
                          {item.val > 0 ? getScoreDescription(item.val).label : 'Belum Dinilai'}
                        </span>
                        <span>10 (Sangat Baik)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              {(() => {
                const isPleno = activePeriod?.type === 'pleno';
                const isFormIncomplete = isPleno
                  ? scorePlenoRespect === 0 ||
                    scorePlenoDisiplin === 0 ||
                    scorePlenoAktifProker === 0 ||
                    scorePlenoKepanitiaan === 0 ||
                    scorePlenoPartisipasiLain === 0 ||
                    scorePlenoKomunikasiGrup === 0 ||
                    scorePlenoTanggungJawab === 0
                  : scoreSikap === 0 ||
                    scoreKomunikasi === 0 ||
                    scoreImprovement === 0 ||
                    scoreProfesionalisme === 0 ||
                    scoreLeadership === 0;

                const filledScores = (isPleno
                  ? [
                      scorePlenoRespect,
                      scorePlenoDisiplin,
                      scorePlenoAktifProker,
                      scorePlenoKepanitiaan,
                      scorePlenoPartisipasiLain,
                      scorePlenoKomunikasiGrup,
                      scorePlenoTanggungJawab,
                    ]
                  : [
                      scoreSikap,
                      scoreKomunikasi,
                      scoreImprovement,
                      scoreProfesionalisme,
                      scoreLeadership,
                    ]
                ).filter((s) => s > 0);
                const liveAverage =
                  filledScores.length > 0
                    ? filledScores.reduce((a, b) => a + b, 0) / filledScores.length
                    : 0;
                const liveAverageDesc = liveAverage > 0 ? getScoreDescription(liveAverage) : null;

                return (
                  <div className="space-y-2">
                    {/* Live average chip */}
                    <div className={isMagista
                      ? "bg-[#FFF8E7] border-2 border-[#292524] shadow-[2px_2px_0px_#292524] rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                      : "bg-[#faf8f5] border border-[#e5dfd3] rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    }>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-bold tracking-wider uppercase ${isMagista ? 'text-[#B45309]' : 'text-[#6e6358]/70'}`}>
                          {isMagista ? 'Rata-rata Skor Sementara' : 'Rata-rata Penilaian'}
                        </p>
                        <p className="text-[11px] text-[#6e6358] mt-0.5">
                          {filledScores.length > 0
                            ? `${filledScores.length} dari ${isPleno ? 7 : 5} indikator terisi`
                            : 'Belum ada indikator terisi'}
                        </p>
                      </div>
                      {liveAverageDesc ? (
                        <span
                          className={`shrink-0 text-sm px-3.5 py-1.5 rounded-xl border ${
                            isMagista
                              ? 'bg-[#F59E0B] text-[#1C1917] border-2 border-[#292524] shadow-[1px_1px_0px_#292524]'
                              : `bg-[#d4af37]/5 border-[#d4af37]/20 ${liveAverageDesc.color}`
                          }`}
                        >
                          <span className="font-black text-base">{liveAverage.toFixed(2)}</span>
                          <span className={`text-[10px] font-bold ml-1.5 ${isMagista ? 'text-[#1C1917]' : ''}`}>
                            · {liveAverageDesc.label}
                          </span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-sm font-black px-3.5 py-1.5 rounded-xl text-[#6e6358]/40 bg-black/5">
                          —
                        </span>
                      )}
                    </div>
                    {isFormIncomplete && (
                      <p className="text-center text-[11px] text-rose-500 font-semibold animate-pulse">
                        * Mohon berikan nilai untuk seluruh 5 indikator di atas agar bisa melanjutkan.
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-2">
                      {isMagista && availableTargets.length > 1 && (
                        <button
                          type="button"
                          onClick={handleSkipTarget}
                          className="w-full sm:w-1/3 py-3.5 bg-[#FFFDF9] hover:bg-[#FEF3C7] text-[#292524] font-bold border-2 border-[#292524] rounded-2xl text-xs transition shadow-[2px_2px_0px_#292524] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 order-2 sm:order-1"
                          title="Lewati peserta ini (misal tidak hadir FGD) dan lanjut ke peserta berikutnya tanpa menyimpan nilai"
                        >
                          <span>Lewati (Skip)</span>
                          <span>↷</span>
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={loading || isFormIncomplete}
                        className={isMagista
                          ? `${availableTargets.length > 1 ? 'w-full sm:w-2/3' : 'w-full'} py-3.5 bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold border-2 border-[#292524] rounded-2xl text-sm transition shadow-[3px_3px_0px_#292524] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 order-1 sm:order-2`
                          : "w-full py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] disabled:opacity-30 disabled:cursor-not-allowed text-[#1f1b18] font-bold rounded-xl text-sm transition shadow-lg shadow-[#d4af37]/15 flex items-center justify-center gap-2"
                        }
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Mengirimkan...
                          </>
                        ) : (
                          <>
                            {isMagista ? 'Simpan & Lanjut ⚡' : 'Kirim & Lanjutkan Penilaian'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          )}

          {/* STEP 4: Success View */}
          {step === 'success' && evaluator && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-pulse">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-[#2a241e]">Evaluasi Selesai! 🎉</h2>
                <p className="text-sm text-[#6e6358] max-w-sm mx-auto">
                  Terima kasih <strong>{evaluator.name}</strong>. Anda telah menyelesaikan seluruh penilaian staf di departemen <strong>{evaluator.department}</strong> pada periode ini dengan lengkap.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center">
                <button
                  onClick={() => {
                    setEvaluator(null);
                    setTarget(null);
                    setStep('select_evaluator');
                  }}
                  className="w-full sm:w-auto px-12 py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c255] hover:to-[#c29d2b] text-[#1f1b18] font-bold text-sm rounded-xl transition shadow-md shadow-[#d4af37]/15"
                >
                  Keluar dari Sistem
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
