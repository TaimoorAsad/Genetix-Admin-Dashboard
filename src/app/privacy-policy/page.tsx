import React from 'react';
import { Shield, Lock, Database, Mail } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-slate-200">
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            Privacy Policy
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400">
            Genetix DMIT App - Developed by Brain-Vita.com
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div className="p-8 md:p-12 space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Shield className="w-6 h-6 mr-3 text-blue-500" />
                Welcome to the DMIT app for Android!
              </h2>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                This is an Android app developed by <a href="http://www.brainvita.com/" className="text-blue-600 dark:text-blue-400 hover:underline">www.BrainVita.com</a>. The app is available on Google Play.
                As avid Android users ourselves, we take privacy very seriously. We know how irritating it is when apps collect your data without your knowledge.
              </p>
            </section>

            <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Database className="w-6 h-6 mr-3 text-indigo-500" />
                Data Collection & Handling
              </h2>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300 mb-4">
                We have programmed this app to collect only the necessary personally identifiable information for authentication purposes and core functionality. 
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>Personal Data:</strong> We may collect your name, email address, and phone number exclusively for authenticating you into the platform and managing your profile.</li>
                <li><strong>Biometric/DMIT Data:</strong> The images/fingerprints and related data you submit for generating the DMIT report are processed strictly for the report generation.</li>
                <li><strong>Storage:</strong> All data shared by you is stored in our secured database only and is not shared with any third-party application.</li>
                <li><strong>Media:</strong> All images are stored securely on our cloud and are not shared with any third-party vendors or applications.</li>
              </ul>
            </section>

            <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Lock className="w-6 h-6 mr-3 text-emerald-500" />
                App Functionality & Permissions
              </h2>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300 mb-4">
                To provide you with the best experience and generate accurate DMIT reports, our app requires certain permissions:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>Camera/Storage Permission:</strong> Required to capture or upload images for processing your reports.</li>
                <li><strong>Network Access:</strong> Required to securely communicate with our cloud servers and database for authentication and saving reports.</li>
              </ul>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300 mt-4">
                We do not sell, rent, or lease your personal information to third parties. We strictly use it to deliver the services you have requested from Genetix.
              </p>
            </section>

            <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Mail className="w-6 h-6 mr-3 text-rose-500" />
                Contact & Support
              </h2>
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                If you find any security vulnerability that has been inadvertently caused by us, or have any question regarding how the app protects your privacy, please send us an email and we will surely try to fix it/help you.
              </p>
              <div className="mt-6">
                <Link href="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  Return to Dashboard
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
