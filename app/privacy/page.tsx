'use client';
export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Privacy Policy</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Last updated: March 2026</p>
      </div>
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Data Storage</h2>
          <p>Finance Planner stores all your financial data exclusively on your device using your browser&apos;s localStorage. No data is ever transmitted to any external server, cloud service, or third party.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">WiFi Sync</h2>
          <p>The optional WiFi Sync feature transfers data directly between your own devices on your local network. This transfer never leaves your home or office network and is not routed through any external server.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">No Analytics or Tracking</h2>
          <p>Finance Planner contains no analytics, no advertising, no tracking pixels, and no third-party SDKs. We do not collect any information about you or your usage of the app.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">No Account Required</h2>
          <p>Finance Planner does not require you to create an account or provide any personal information. The app works entirely without identifying you in any way.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Data Deletion</h2>
          <p>You can delete all your data at any time by going to Settings → Clear local data, or by clearing your browser&apos;s localStorage. Uninstalling the app removes all associated data.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Disclaimer</h2>
          <p>NetWorth Finance Planner is provided for informational purposes only and does not constitute financial advice. Projections and estimates are illustrative only and should not be relied upon for investment or financial decisions. Please consult a qualified financial professional for advice specific to your situation.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Contact</h2>
          <p>If you have questions about this privacy policy, please contact us at <a href="mailto:networthfinanceplanner@gmail.com" className="text-blue-500 hover:underline">networthfinanceplanner@gmail.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
