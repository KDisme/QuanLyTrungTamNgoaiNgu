import React from 'react';

export default function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="hw-progress-ring-wrap">
      <div
        style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `conic-gradient(var(--primary) ${clamped * 3.6}deg, var(--gray-200) 0deg)`,
          display: 'grid', placeItems: 'center',
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--gray-100)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{clamped}%</div>
            <div style={{ fontSize: 9, color: 'var(--gray-500)', fontWeight: 700, letterSpacing: 0.4 }}>HOÀN THÀNH</div>
          </div>
        </div>
      </div>
    </div>
  );
}