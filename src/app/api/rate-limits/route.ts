import { NextResponse } from 'next/server';
import { getRateLimits, getDailyLimit, getSentCountToday, getSentCountLastHour, getSentCountLastMinute, advanceRampUp } from '@/lib/email';

export async function GET() {
  const limits = getRateLimits();
  const dailyLimit = getDailyLimit();

  return NextResponse.json({
    limits,
    dailyLimit,
    usage: {
      today: getSentCountToday(),
      lastHour: getSentCountLastHour(),
      lastMinute: getSentCountLastMinute(),
    },
    rampUpSchedule: {
      1: 10, 2: 15, 3: 25, 4: 35, 5: 50, 6: 65, 7: 80,
      8: 100, 9: 120, 10: 140, 11: 160, 12: 180, 13: 200, 14: 200,
    },
  });
}

// POST to advance ramp-up day
export async function POST() {
  advanceRampUp();
  return NextResponse.json({ success: true });
}
