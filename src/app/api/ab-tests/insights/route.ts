import { NextResponse } from 'next/server';
import { getAllInsights } from '@/lib/ml';

export async function GET() {
  const insights = getAllInsights();
  return NextResponse.json(insights);
}
