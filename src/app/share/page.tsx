"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SharePage() {
  const router = useRouter();

  useEffect(() => {
    // The custom scheme URL to open the app (using intent or directly).
    // If the app is installed, Android and iOS should intercept this automatically 
    // via App Links / Universal Links before the page even loads.
    // If it reaches this page, it means the app is likely not installed or it's on desktop.
    
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    // Fallback URLs
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.brainvita.dmit';
    const appStoreUrl = 'https://apps.apple.com/app/id1498909115'; 

    if (/android/i.test(userAgent)) {
      window.location.replace(playStoreUrl);
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      window.location.replace(appStoreUrl);
    } else {
      // Desktop or other - fallback to dashboard home
      router.push('/');
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-center">
      <h2 className="text-2xl font-bold mb-4">Redirecting to Genetix App...</h2>
      <p className="text-gray-600">
        If you are not redirected automatically,{' '}
        <a href="https://play.google.com/store/apps/details?id=com.brainvita.dmit" className="text-blue-600 underline">
          click here
        </a>.
      </p>
    </div>
  );
}
