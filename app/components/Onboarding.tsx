'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDefaultPlan, savePlan } from '../lib/store';

const KEY = 'finance_planner_onboarded_v1';
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY) === 'done';
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0,7));
  const [goal, setGoal] = useState('');
  const [ret, setRet] = useState('7');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'cash'|'taxable'|'retirement'|'other'>('cash');

  function finish() {
    const base = createDefaultPlan();
    const goalNum = Number(goal.replace(/[^0-9.]/g,'')) || 0;
    const retNum = Number(ret.replace(/[^0-9.]/g,'')) || 7;
    const plan = {
      ...base,
      currency,
      startMonthISO: startMonth,
      netWorthViewMonthISO: startMonth,
      goalNetWorth: goalNum,
      expectedReturnPct: retNum,
      netWorthAccounts: accountName.trim()
        ? [{ id: 'acct_first', name: accountName.trim(), type: accountType, balances: [] }]
        : base.netWorthAccounts,
    };
    savePlan(plan);
    localStorage.setItem(KEY, 'done');
    onComplete();
    router.push('/net-worth');
  }

  function skip() {
    localStorage.setItem(KEY, 'done');
    onComplete();
  }

  const btn = 'w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition';
  const inp = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-400';
  const row = 'flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-400';
  const lbl = 'block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1.5';
  const pfx = 'px-3 text-sm text-slate-400 select-none';
  const rin = 'flex-1 bg-transparent py-3 text-sm text-slate-900 dark:text-slate-100 outline-none min-w-0';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      <div className='w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden'>
        <div className='flex items-center justify-center gap-2 pt-5'>
          {[0,1,2,3].map(i => (<div key={i} className={'rounded-full transition-all '+(i===step?'w-5 h-2 bg-blue-500':'w-2 h-2 bg-slate-200 dark:bg-slate-700')} />))}
        </div>

        {step===0 && <div className='flex flex-col items-center text-center px-6 py-8 gap-6'>
          <div className='w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center'>
            <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' className='text-blue-500'>
              <polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/>
            </svg>
          </div>
          <div>
            <div className='text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2'>Welcome to NetWorth</div>
            <div className='text-sm text-slate-500 dark:text-slate-200 leading-relaxed'>Track your net worth, plan your cash flow, and project your financial future.</div>
            <div className='mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-4 py-2 text-xs text-blue-700 dark:text-blue-300 font-medium'>
              <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>
              Your data never leaves your device
            </div>
          </div>
          <button onClick={()=>setStep(1)} className={btn}>Get Started</button>
          <button onClick={skip} className='text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition'>Skip setup</button>
          <p className='text-xs text-slate-400 dark:text-slate-500 -mt-2'>For informational purposes only. Not financial advice.</p>
        </div>}

        {step===1 && <div className='flex flex-col px-6 py-8 gap-5'>
          <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>Basic Setup</div>
          <div className='text-sm text-slate-500 dark:text-slate-200 -mt-3'>Set your currency and planning start date.</div>
          <div><div className={lbl}>Currency</div>
            <select className={inp} value={currency} onChange={e=>setCurrency(e.target.value)}>
              <option value='USD'>USD - US Dollar</option>
              <option value='EUR'>EUR - Euro</option>
              <option value='GBP'>GBP - British Pound</option>
              <option value='CAD'>CAD - Canadian Dollar</option>
              <option value='AUD'>AUD - Australian Dollar</option>
              <option value='JPY'>JPY - Japanese Yen</option>
              <option value='CHF'>CHF - Swiss Franc</option>
            </select>
          </div>
          <div><div className={lbl}>Planning start month</div>
            <input type='month' className={inp+' dark:[color-scheme:dark]'} value={startMonth} onChange={e=>setStartMonth(e.target.value)} />
          </div>
          <button onClick={()=>setStep(2)} className={btn}>Continue</button>
        </div>}

        {step===2 && <div className='flex flex-col px-6 py-8 gap-5'>
          <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>Your Financial Goal</div>
          <div className='text-sm text-slate-500 dark:text-slate-200 -mt-3'>Set a net worth target and expected return.</div>
          <div><div className={lbl}>Net worth goal</div>
            <div className={row}>
              <span className='pl-3 text-sm text-slate-400 select-none'>{currency==='USD'?'$':currency==='EUR'?'€':currency==='GBP'?'£':currency}</span>
              <input type='text' inputMode='numeric' className={rin+' pr-3'} placeholder='1,000,000' value={goal} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,'');if(!raw){setGoal('');return;}setGoal(new Intl.NumberFormat('en-US').format(parseInt(raw,10)));}} />
            </div>
          </div>
          <div><div className={lbl}>Expected annual return</div>
            <div className={row+' pl-3'}>
              <input type='text' inputMode='decimal' className='bg-transparent py-3 text-sm text-slate-900 dark:text-slate-100 outline-none' placeholder='7' value={ret} onChange={e=>setRet(e.target.value.replace(/[^0-9.]/g,''))} style={{width:`calc(${(ret||'7').length}ch + 4px)`}} />
              <span className='text-sm text-slate-400 select-none'>%</span>
            </div>
            <div className='mt-1.5 text-xs text-slate-400'>Historical S&P 500 average is ~7% after inflation</div>
          </div>
          <button onClick={()=>setStep(3)} className={btn}>Continue</button>
        </div>}

        {step===3 && <div className='flex flex-col px-6 py-8 gap-5'>
          <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>Add Your First Account</div>
          <div className='text-sm text-slate-500 dark:text-slate-200 -mt-3'>Add a bank or investment account to start tracking.</div>
          <div><div className={lbl}>Account name</div>
            <input type='text' className={inp} placeholder='e.g. Checking, Brokerage, Roth IRA' value={accountName} onChange={e=>setAccountName(e.target.value)} />
          </div>
          <div><div className={lbl}>Account type</div>
            <select className={inp} value={accountType} onChange={e=>setAccountType(e.target.value as any)}>
              <option value='cash'>Cash (checking, savings)</option>
              <option value='taxable'>Taxable (brokerage)</option>
              <option value='retirement'>Retirement (401k, IRA)</option>
              <option value='other'>Other</option>
            </select>
          </div>
          <button onClick={finish} className={btn}>Start Planning</button>
          <button onClick={skip} className='text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition text-center'>Skip for now</button>
        </div>}

      </div>
    </div>
  );
}
