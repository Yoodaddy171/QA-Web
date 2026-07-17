import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Script generation is disabled. Please use the AI Summary feature on the dashboard to analyze test results.' 
  });
}
