import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

export async function POST() {
  try {
    const email = 'dalalviral1973@gmail.com';
    const password = 'password123';
    const auth = getAuth();

    try {
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password });
      return NextResponse.json({ success: true, message: `Password for ${email} reset to ${password}` });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        await auth.createUser({ email, password });
        return NextResponse.json({ success: true, message: `Admin user ${email} created with password ${password}` });
      }
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
