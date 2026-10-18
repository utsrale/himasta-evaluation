import { supabase } from './supabase';

export interface Staff {
  id: string;
  name: string;
  jabatan: string;
  department: string;
  role: 'director_vice' | 'pht' | 'staff' | 'intern';
  email: string;
}

export interface Period {
  id: string;
  name: string; // e.g., "Mei 2026"
  status: 'active' | 'inactive';
  type: 'routine' | 'pleno' | 'magista_fgd' | 'magista_bidang' | 'magista_angkatan';
}

export interface Evaluation {
  id: string;
  periodId: string;
  evaluatorId: string; // staff ID
  targetId: string; // staff ID
  scoreSikap: number;
  scoreKomunikasi: number;
  scoreImprovement: number;
  scoreProfesionalisme: number;
  scoreLeadership: number;
  // Pleno fields
  scorePlenoRespect?: number;
  scorePlenoDisiplin?: number;
  scorePlenoAktifProker?: number;
  scorePlenoKepanitiaan?: number;
  scorePlenoPartisipasiLain?: number;
  scorePlenoKomunikasiGrup?: number;
  scorePlenoTanggungJawab?: number;
  createdAt: string;
}

// Helpers for Staff
export async function getStaffList(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff').select('*');
  if (error) {
    console.error('Error fetching staff list from Supabase:', error);
    throw error;
  }
  return (data || []) as Staff[];
}

export async function getStaffById(id: string): Promise<Staff | undefined> {
  const { data, error } = await supabase.from('staff').select('*').eq('id', id).single();
  if (error) {
    // If single returns no rows error, return undefined (code PGRST116)
    if (error.code === 'PGRST116') return undefined;
    console.error(`Error fetching staff with id ${id} from Supabase:`, error);
    return undefined;
  }
  return data as Staff;
}

// Helpers for Periods
export async function getPeriods(): Promise<Period[]> {
  const { data, error } = await supabase.from('periods').select('*');
  if (error) {
    console.error('Error fetching periods from Supabase:', error);
    throw error;
  }
  return (data || []) as Period[];
}

export async function getActivePeriod(): Promise<Period | undefined> {
  const { data, error } = await supabase.from('periods').select('*').eq('status', 'active').limit(1);
  if (error) {
    console.error('Error fetching active period from Supabase:', error);
    return undefined;
  }
  return data && data.length > 0 ? (data[0] as Period) : undefined;
}

export async function addPeriod(name: string, type: Period['type'] = 'routine'): Promise<Period> {
  // Set all current periods to inactive
  const { error: updateError } = await supabase.from('periods').update({ status: 'inactive' }).neq('id', '');
  if (updateError) {
    console.error('Error setting periods to inactive in Supabase:', updateError);
    throw updateError;
  }
  
  const newPeriod: Period = {
    id: 'period_' + Date.now().toString(36),
    name,
    status: 'active',
    type,
  };
  const { error: insertError } = await supabase.from('periods').insert(newPeriod);
  if (insertError) {
    console.error('Error inserting period into Supabase:', insertError);
    throw insertError;
  }
  return newPeriod;
}

export async function setActivePeriod(periodId: string): Promise<void> {
  // Set all to inactive
  const { error: err1 } = await supabase.from('periods').update({ status: 'inactive' }).neq('id', '');
  if (err1) {
    console.error('Error updating status to inactive in Supabase:', err1);
    throw err1;
  }
  // Set target to active
  const { error: err2 } = await supabase.from('periods').update({ status: 'active' }).eq('id', periodId);
  if (err2) {
    console.error(`Error activating period ${periodId} in Supabase:`, err2);
    throw err2;
  }
}

// Helpers for Evaluations
export async function getEvaluations(periodId?: string): Promise<Evaluation[]> {
  let allEvaluations: Evaluation[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('evaluations')
      .select('*')
      .order('createdAt', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (periodId) {
      query = query.eq('periodId', periodId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching evaluations from Supabase:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    allEvaluations = allEvaluations.concat(data as Evaluation[]);
    if (data.length < pageSize) break;
    page++;
  }

  return allEvaluations;
}

export async function addEvaluation(evalData: Omit<Evaluation, 'id' | 'createdAt'>): Promise<Evaluation> {
  // Check if evaluator already rated target in this period
  const { data: exists, error: checkError } = await supabase
    .from('evaluations')
    .select('id')
    .eq('periodId', evalData.periodId)
    .eq('evaluatorId', evalData.evaluatorId)
    .eq('targetId', evalData.targetId);
  
  if (checkError) {
    console.error('Error checking duplicate evaluation in Supabase:', checkError);
    throw checkError;
  }
  if (exists && exists.length > 0) {
    throw new Error('Penilai sudah mengisi penilaian untuk staf ini pada periode sekarang.');
  }
  
  const newEval: Omit<Evaluation, 'createdAt'> = {
    ...evalData,
    id: 'eval_' + Math.random().toString(36).substring(2, 11),
  };
  
  const { data, error: insertError } = await supabase
    .from('evaluations')
    .insert(newEval)
    .select('*')
    .single();

  if (insertError) {
    console.error('Error inserting evaluation into Supabase:', insertError);
    throw insertError;
  }
  return data as Evaluation;
}

export async function deleteEvaluationById(id: string): Promise<void> {
  const { error } = await supabase.from('evaluations').delete().eq('id', id);
  if (error) {
    console.error(`Error deleting evaluation ${id} from Supabase:`, error);
    throw error;
  }
}

export async function deleteEvaluationsByEvaluator(evaluatorId: string, periodId: string): Promise<void> {
  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('evaluatorId', evaluatorId)
    .eq('periodId', periodId);
  if (error) {
    console.error(`Error deleting evaluations for evaluator ${evaluatorId} in period ${periodId} from Supabase:`, error);
    throw error;
  }
}

// Helpers for Interns (MAGISTA)
export async function getInterns(department?: string): Promise<Staff[]> {
  let query = supabase.from('staff').select('*').eq('role', 'intern');
  if (department) {
    query = query.eq('department', department);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching interns from Supabase:', error);
    throw error;
  }
  return (data || []) as Staff[];
}

export function getScorePredicate(val: number): { label: string; color: string; badgeBg: string } {
  if (val >= 9) return { label: 'Sangat Baik', color: 'text-emerald-700 font-bold', badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (val >= 7) return { label: 'Baik', color: 'text-amber-700 font-bold', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (val >= 5) return { label: 'Kurang Baik', color: 'text-orange-700 font-bold', badgeBg: 'bg-orange-100 text-orange-800 border-orange-300' };
  return { label: 'Sangat Kurang', color: 'text-rose-700 font-bold', badgeBg: 'bg-rose-100 text-rose-800 border-rose-300' };
}

export function getMagistaCriteriaLabels(type?: Period['type']) {
  if (type === 'magista_fgd') {
    return {
      c1: { title: 'Sikap dan Etika', desc: 'Norma kesopanan, etika berdiskusi, dan penghargaan terhadap sesama anggota saat FGD' },
      c2: { title: 'Komunikasi', desc: 'Keaktifan, partisipasi, dan kejelasan dalam menyampaikan pendapat selama FGD' },
      c3: { title: 'Self Improvement', desc: 'Keterbukaan terhadap kritik/saran dan kemauan untuk berkembang' },
      c4: { title: 'Kesesuaian Jawaban', desc: 'Kesesuaian argumen dengan topik, ketepatan analisis, dan relevansi jawaban saat diskusi FGD' },
      c5: { title: 'Leadership', desc: 'Kemampuan memandu diskusi, inisiatif, dan mengarahkan kelompok' },
    };
  }
  return {
    c1: { title: 'Sikap dan Etika', desc: 'Norma kesopanan, etika berorganisasi, dan saling menghargai sesama anggota' },
    c2: { title: 'Kerja Sama dan Komunikasi', desc: 'Kolaborasi tim, koordinasi tugas, dan keterbukaan komunikasi antaranggota' },
    c3: { title: 'Self Improvement', desc: 'Inisiatif belajar mandiri, refleksi diri, dan adaptasi terhadap arahan kerja' },
    c4: { title: 'Profesionalisme', desc: 'Tanggung jawab terhadap tugas, kedisiplinan tenggat waktu, dan etos kerja' },
    c5: { title: 'Leadership', desc: 'Inisiatif problem solving, kemandirian, dan kepemimpinan dalam program kerja' },
  };
}

