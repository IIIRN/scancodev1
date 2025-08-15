import { NextResponse } from 'next/server';

export async function POST(request) {
  // 👇 1. เปลี่ยนจากการรับ seatNumber มารับ message โดยตรง
  const { userId, message } = await request.json(); 
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!userId || !message || !accessToken) {
    return NextResponse.json(
      { message: 'Missing required parameters: userId, message, or Access Token' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message, // 👈 2. ใช้ข้อความที่ได้รับมาโดยตรง
          },
        ],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to send message to LINE API');
    }

    return NextResponse.json({ message: 'Notification sent successfully!' });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
}