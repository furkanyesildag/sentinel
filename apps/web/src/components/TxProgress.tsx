/**
 * TxProgress — shared transaction lifecycle UI.
 *
 *   • TxStepper    — the Build → Sign → Submit → Confirm circle tracker
 *   • TxStatusPill — a pending / success / failed status chip
 *
 * Used by both the self-payment proof (TestTransaction) and the on-chain
 * contract calls (AlertRegistryPanel) so transaction status is shown the
 * same way everywhere.
 */

export interface TxStep {
  key: string;
  label: string;
}

/** The standard build → sign → submit → confirm pipeline. */
export const TX_STEPS: TxStep[] = [
  { key: 'building',   label: 'Build' },
  { key: 'signing',    label: 'Sign' },
  { key: 'submitting', label: 'Submit' },
  { key: 'done',       label: 'Confirm' },
];

export function TxStepper({
  steps,
  activeIndex,
  allDone,
}: {
  steps: TxStep[];
  /** index of the step currently in progress (-1 when none). */
  activeIndex: number;
  /** all steps completed (success). */
  allDone: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: '24px' }}>
      {steps.map((step, i) => {
        const done = allDone || activeIndex > i;
        const active = activeIndex === i && !allDone;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
                background: done ? 'var(--mint)' : active ? 'var(--gold)' : 'var(--gray-05)',
                color: done || active ? '#000' : 'var(--gray-08)',
                transition: 'all 200ms',
                boxShadow: active ? '0 0 14px rgba(253,218,36,0.35)' : done ? '0 0 10px rgba(112,225,200,0.3)' : 'none',
              }}>
                {done ? '✓' : active ? <span className="animate-pulse-slow">{i + 1}</span> : i + 1}
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: done ? 'var(--mint)' : active ? 'var(--gold)' : 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? 'var(--mint)' : 'var(--gray-05)', margin: '0 6px', marginBottom: '20px', transition: 'background 300ms', borderRadius: '1px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TxStatusPill({ phase }: { phase: 'pending' | 'success' | 'failed' }) {
  const map = {
    pending: { bg: 'var(--gold-bg)',  text: 'var(--gold)',   border: 'rgba(253,218,36,0.3)', label: '● Pending' },
    success: { bg: 'var(--green-bg)', text: 'var(--mint)',   border: 'rgba(48,164,108,0.3)', label: '✓ Success' },
    failed:  { bg: 'var(--red-bg)',   text: 'var(--red-hi)', border: 'rgba(229,72,77,0.3)',  label: '✕ Failed' },
  };
  const c = map[phase];
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}
