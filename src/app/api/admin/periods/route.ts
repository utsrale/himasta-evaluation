import { NextResponse } from 'next/server';
import { getPeriods, addPeriod, setActivePeriod } from '@/lib/db';
import { isValidPasscode } from '@/lib/auth';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  return isValidPasscode(token);
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const periods = await getPeriods();
    return NextResponse.json({ periods });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, type, activeId } = body;

    if (activeId) {
      // Just change active period
      await setActivePeriod(activeId);
      return NextResponse.json({ success: true });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Nama periode tidak boleh kosong.' }, { status: 400 });
    }

    const newPeriod = await addPeriod(name.trim(), type === 'pleno' ? 'pleno' : 'routine');
    return NextResponse.json({ success: true, period: newPeriod });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
