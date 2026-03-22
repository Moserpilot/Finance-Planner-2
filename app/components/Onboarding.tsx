'use client';
import { useState } from 'react';
import type { Plan } from '../lib/store';
import { createDefaultPlan, savePlan } from '../lib/store';

const ONBOARDING_KEY = 'finance_planner_onboarded_v1';

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_KEY) === 'done';
}

function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, 'done');
}

interface Props { onComplete: () => void; }

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<Plan>(() => createDefaultPlan());
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'cash'|'taxable'|'retirement'|'other'>('cash');

  function next() { setStep(s => s + 1); }

  function finish() {
    const finalPlan = accountName.trim()
      ? { ...plan, netWorthAccounts: [{ id: 'acct_first', name: accountName.trim(), type: accountType, balances: [] }] }
      : plan;
    savePlan(finalPlan);
    markOnboardingDone();
    onComplete();
  }

  function skip() {
    savePlan(plan);
    markOnboardingDone();
    onComplete();
  }

  const steps = [
    <div key='welcome' className='flex flex-col items-center text-center px-6 py-8 gap-6'>
      <div className='w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center'>
        <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' className='text-blue-500'>
          <polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/>
        </svg>
      </div>
      <div>
        <div className='text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2'>Welcome to Finance Planner</div>
        <div className='text-sm text-slate-500 dark:text-slate-400 leading-relaxed'>Track your net worth, plan your cash flow, and project your financial future.</div>
        <div className='mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-4 py-2 text-xs text-blue-700 dark:text-blue-300 font-medium'>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>
          Your data never leaves your device
        </div>
      </div>
      <button onClick={next} className='w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition'>Get Started</button>
      <button onClick={skip} className='text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition'>Skip setup</button>
    </div>,

    <div key='setup' className='flex flex-col px-6 py-8 gap-6'>
      <div>
        <div className='text-xl font-bold text-slate-900 dark:text-slate-100 mb-1'>Basic Setup</div>
        <div className='text-sm text-slate-500 dark:text-slate-400'>Set your currency and planning start date.</div>
      </div>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Currency</div>
        <select className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-400' value={plan.currency} onChange={e => setPlan(p => ({ ...p, currency: e.target.value }))}>
          <option value='USD'>USD - US Dollar</option>
          <option value='EUR'>EUR - Euro</option>
          <option value='GBP'>GBP - British Pound</option>
          <option value='CAD'>CAD - Canadian Dollar</option>
          <option value='AUD'>AUD - Australian Dollar</option>
          <option value='JPY'>JPY - Japanese Yen</option>
          <option value='CHF'>CHF - Swiss Franc</option>
        </select>
      </label>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Planning start month</div>
        <input type='month' className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-400' value={plan.startMonthISO} onChange={e => setPlan(p => ({ ...p, startMonthISO: e.target.value, netWorthViewMonthISO: e.target.value }))} />
      </label>
      <button onClick={next} className='w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition'>Continue</button>
    </div>,

    <div key='goal' className='flex flex-col px-6 py-8 gap-6'>
      <div>
        <div className='text-xl font-bold text-slate-900 dark:text-slate-100 mb-1'>Your Financial Goal</div>
        <div className='text-sm text-slate-500 dark:text-slate-400'>Set a net worth target and expected investment return.</div>
      </div>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Net worth goal</div>
        <div className='flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-400'>
          <span className='pl-3 text-slate-500 text-sm'>$</span>
          <input type='number' placeholder='1000000' className='w-full bg-transparent px-2 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none' value={plan.goalNetWorth||''} onChange={e => setPlan(p => ({ ...p, goalNetWorth: Number(e.target.value)||0 }))} />
        </div>
      </label>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Expected annual return</div>
        <div className='flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-400'>
          <input type='number' placeholder='7' className='w-full bg-transparent pl-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none' value={plan.expectedReturnPct||''} onChange={e => setPlan(p => ({ ...p, expectedReturnPct: Number(e.target.value)||0 }))} />
          <span className='pr-3 text-slate-500 text-sm'>%</span>
        </div>
        <div className='mt-1.5 text-xs text-slate-400'>Historical S&P 500 average is ~7% after inflation</div>
      </label>
      <button onClick={next} className='w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition'>Continue</button>
    </div>,

    <div key='account' className='flex flex-col px-6 py-8 gap-6'>
      <div>
        <div className='text-xl font-bold text-slate-900 dark:text-slate-100 mb-1'>Add Your First Account</div>
        <div className='text-sm text-slate-500 dark:text-slate-400'>Add a bank or investment account to start tracking your net worth.</div>
      </div>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Account name</div>
        <input type='text' placeholder='e.g. Checking, Brokerage, Roth IRA' className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-400' value={accountName} onChange={e => setAccountName(e.target.value)} />
      </label>
      <label className='block'>
        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>Account type</div>
        <select className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-400' value={accountType} onChange={e => setAccountType(e.target.value as any)}>
          <option value='cash'>Cash (checking, savings)</option>
          <option value='taxable'>Taxable (brokerage)</option>
          <option value='retirement'>Retirement (401k, IRA)</option>
          <option value='other'>Other</option>
        </select>
      </label>
      <button onClick={finish} className='w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition'>Start Planning</button>
      <button onClick={skip} className='text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition text-center'>Skip for now</button>
    </div>,
  ];

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      <div className='w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden'>
        <div className='flex items-center justify-center gap-2 pt-5'>
          {[0,1,2,3].map(i => (<div key={i} className={'rounded-full transition-all '+(i===step?'w-5 h-2 bg-blue-500':'w-2 h-2 bg-slate-200 dark:bg-slate-700')} />))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}
