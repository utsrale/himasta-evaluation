import { supabase } from './supabase';

export interface Staff {
  id: string;
  name: string;
  jabatan: string;
  department: string;
  role: 'director_vice' | 'pht' | 'staff';
  email: string;
}

export interface Period {
  id: string;
  name: string; // e.g., "Mei 2026"
  status: 'active' | 'inactive';
  type: 'routine' | 'pleno';
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
  const { data, error } = await supabase.from('periods').select('*').eq('status', 'active').single();
  if (error) {
    if (error.code === 'PGRST116') return undefined;
    console.error('Error fetching active period from Supabase:', error);
    return undefined;
  }
  return data as Period;
}

export async function addPeriod(name: string, type: 'routine' | 'pleno' = 'routine'): Promise<Period> {
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
  let query = supabase.from('evaluations').select('*');
  if (periodId) {
    query = query.eq('periodId', periodId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching evaluations from Supabase:', error);
    throw error;
  }
  return (data || []) as Evaluation[];
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
