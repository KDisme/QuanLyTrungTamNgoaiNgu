import React, { useEffect, useState, useCallback } from 'react';
import { Users, BookOpen, GraduationCap, CalendarDays, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { dashboardApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../../components/common';

const fmt = (n: any) => parseFloat(n || 0).toLocaleString('vi-VN');
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const PM_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', transfer: 'Chuyển khoản',
  momo: 'MoMo', zalopay: 'ZaloPay', vnpay: 'VNPay/QR', card: 'Thẻ', other: 'Khác',
};

type Tab = 'overview' | 'revenue' | 'debt' | 'branch' | 'ratio';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<'current' | 'previous'>('current');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const load = useCallback(() => {
    setLoading(true);
    dashboardApi.getStats({ month: selectedMonth, year: selectedYear })
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth, selectedYear]);

  useEffect(() => { load(); }, [load]);

  const handlePeriod = (p: 'current' | 'previous') => {
    setPeriod(p);
    const d = new Date();
    if (p === 'previous') d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.getMonth() + 1);
    setSelectedYear(d.getFullYear());
  };

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading) return <Loading />;

  const totalRevenue = stats?.revenue?.total || 0;
  const totalExpenses = stats?.expenses?.total || 0;
  const netProfit = stats?.netProfit || 0;
  const byMethod = stats?.revenue?.byMethod || [];
  const byDay = (stats?.revenue?.byDay || []).map((d: any) => ({
    day: new Date(d.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    amount: parseFloat(d.amount || 0),
  }));
  const debtAging = stats?.debtAging || {};
  const branchStats = stats?.branchStats || [];
  const pending = stats?.pendingInvoices || {};

  const debtBuckets = [
    { label: '1-30 ngày', students: parseInt(debtAging.days_1_30 || 0), amount: parseFloat(debtAging.amt_1_30 || 0), color: '#f59e0b' },
    { label: '31-60 ngày', students: parseInt(debtAging.days_31_60 || 0), amount: parseFloat(debtAging.amt_31_60 || 0), color: '#f97316' },
    { label: '61-90 ngày', students: parseInt(debtAging.days_61_90 || 0), amount: parseFloat(debtAging.amt_61_90 || 0), color: '#ef4444' },
    { label: '>90 ngày', students: parseInt(debtAging.days_90_plus || 0), amount: parseFloat(debtAging.amt_90_plus || 0), color: '#991b1b' },
  ];
  const totalDebt = parseFloat(debtAging.total_debt || 0);
  const totalStudentsInDebt = parseInt(debtAging.total_students_in_debt || 0);
  const debtRiskLevel = totalDebt > 10000000 ? 'Cao' : totalDebt > 3000000 ? 'Trung bình' : 'Thấp';
  const debtRiskColor = totalDebt > 10000000 ? '#dc2626' : totalDebt > 3000000 ? '#f97316' : '#16a34a';

  const pieData = byMethod.map((r: any) => ({
    name: PM_LABEL[r.payment_method] || r.payment_method,
    value: parseFloat(r.total),
    count: parseInt(r.count),
  }));
  const pieTotal = pieData.reduce((s: number, r: any) => s + r.value, 0);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: '📊' },
    { key: 'revenue', label: 'Doanh thu', icon: '💰' },
    { key: 'debt', label: 'Công nợ', icon: '⚠️' },
    { key: 'branch', label: 'Chi nhánh', icon: '🏢' },
    { key: 'ratio', label: 'Tỷ lệ thu', icon: '📈' },
  ];

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={`${selectedMonth}/${selectedYear}`}
            onChange={e => { const [m, y] = e.target.value.split('/'); setSelectedMonth(parseInt(m)); setSelectedYear(parseInt(y)); }}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 13, fontWeight: 600 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i);
              const m = d.getMonth() + 1; const y = d.getFullYear();
              return <option key={`${m}/${y}`} value={`${m}/${y}`}>Tháng {m}/{y}</option>;
            })}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['current', 'previous'] as const).map(p => (
            <button key={p} onClick={() => handlePeriod(p)}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === 'current' ? 'Tháng này' : 'Tháng trước'}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm">Tuỳ chỉnh</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, background: 'white', borderRadius: 12, padding: 4, boxShadow: 'var(--shadow)', width: 'fit-content', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 9, background: tab === t.key ? '#111827' : 'transparent', color: tab === t.key ? 'white' : 'var(--gray-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ---- OVERVIEW TAB ---- */}
      {tab === 'overview' && (
        <>
          {/* Greeting */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Xin chào, {user?.fullName?.split(' ').pop()} 👋</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{today}</div>
          </div>

          {/* Stat cards */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'HỌC VIÊN ĐANG HỌC', value: stats?.students ?? 0, icon: Users, color: '#2563eb', bg: '#eff6ff' },
              { label: 'LỚP ĐANG HOẠT ĐỘNG', value: stats?.activeClasses ?? 0, icon: BookOpen, color: '#10b981', bg: '#ecfdf5' },
              { label: 'GIÁO VIÊN ĐANG DẠY', value: stats?.teachers ?? 0, icon: GraduationCap, color: '#8b5cf6', bg: '#f5f3ff' },
              { label: 'BUỔI HỌC HÔM NAY', value: stats?.todaySessions ?? 0, icon: CalendarDays, color: '#f97316', bg: '#fff7ed' },
            ].map(card => (
              <div className="stat-card" key={card.label}>
                <div style={{ flex: 1 }}>
                  <div className="stat-value">{card.value.toLocaleString()}</div>
                  <div className="stat-label">{card.label}</div>
                </div>
                <div className="stat-icon" style={{ background: card.bg }}>
                  <card.icon size={22} color={card.color} />
                </div>
              </div>
            ))}
          </div>

          {/* Finance summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'TỔNG DOANH THU', value: fmt(totalRevenue) + 'đ', sub: `${stats?.transactions || 0} giao dịch`, icon: '📈', bg: '#f0fdf4', color: '#16a34a', trend: '+' },
              { label: 'TỔNG CHI PHÍ', value: fmt(totalExpenses) + 'đ', sub: 'Chi phí phát sinh', icon: '📉', bg: '#fff7ed', color: '#f97316', trend: '' },
              { label: 'LỢI NHUẬN RÒNG', value: fmt(netProfit) + 'đ', sub: netProfit >= 0 ? 'Dương' : 'Âm', icon: '💎', bg: '#eff6ff', color: '#2563eb', trend: netProfit >= 0 ? '+' : '-' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.color, margin: '6px 0' }}>{c.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Pending & Debt alert */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={20} color="#f59e0b" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Hóa đơn chờ thanh toán</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{pending.count} hóa đơn · <strong style={{ color: '#dc2626' }}>{fmt(pending.total)}đ</strong></div>
                </div>
              </div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={20} color="#dc2626" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Công nợ quá hạn</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{totalStudentsInDebt} học viên · <strong style={{ color: '#dc2626' }}>{fmt(totalDebt)}đ</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart + Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Doanh thu — Chi phí — Lợi nhuận · Tháng {selectedMonth}/{selectedYear}</h3>
              {byDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={byDay}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={(v: any) => fmt(v) + 'đ'} />
                    <Area type="monotone" dataKey="amount" stroke="#2563eb" fill="url(#colorAmt)" strokeWidth={2} name="Doanh thu" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Chưa có doanh thu trong tháng này</div>
              )}
            </div>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Phương thức thanh toán</h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                        {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(v) + 'đ'} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8 }}>
                    {pieData.map((r: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                          <span>{r.name}</span>
                        </div>
                        <strong>{pieTotal > 0 ? ((r.value / pieTotal) * 100).toFixed(1) : 0}%</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Chưa có giao dịch</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- REVENUE TAB ---- */}
      {tab === 'revenue' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'TỔNG DOANH THU', value: fmt(totalRevenue) + 'đ', sub: `${stats?.transactions || 0} giao dịch`, bg: '#f0fdf4', color: '#16a34a' },
              { label: 'TỔNG CHI PHÍ', value: fmt(totalExpenses) + 'đ', sub: 'Chi phí phát sinh', bg: '#fff7ed', color: '#f97316' },
              { label: 'LỢI NHUẬN RÒNG', value: fmt(netProfit) + 'đ', sub: netProfit >= 0 ? 'Dương' : 'Âm', bg: '#eff6ff', color: '#2563eb' },
              { label: 'SỐ GIAO DỊCH', value: stats?.transactions || 0, sub: `Kỳ Tháng ${selectedMonth}/${selectedYear}`, bg: '#f5f3ff', color: '#8b5cf6' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color, margin: '4px 0' }}>{c.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Doanh thu theo ngày — Tháng {selectedMonth}/{selectedYear}</h3>
              {byDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={byDay}>
                    <defs>
                      <linearGradient id="dRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={(v: any) => fmt(v) + 'đ'} />
                    <Area type="monotone" dataKey="amount" stroke="#2563eb" fill="url(#dRev)" strokeWidth={2} name="Doanh thu" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Chưa có doanh thu trong tháng này</div>
              )}
            </div>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Phương thức thanh toán</h3>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Tỷ trọng theo số tiền</div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value">
                        {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8 }}>
                    {pieData.map((r: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                          {r.name}
                        </div>
                        <span><strong>{pieTotal > 0 ? ((r.value / pieTotal) * 100).toFixed(1) : 0}%</strong></span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>Chưa có giao dịch</div>
              )}
            </div>
          </div>

          {/* Payment method detail */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Chi tiết Phương thức thanh toán</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Phân tích theo giá trị giao dịch</p>
            {byMethod.map((r: any, i: number) => {
              const pct = pieTotal > 0 ? (parseFloat(r.total) / pieTotal) * 100 : 0;
              return (
                <div key={r.payment_method} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontWeight: 600 }}>{PM_LABEL[r.payment_method] || r.payment_method}</span>
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>{r.count} giao dịch</span>
                    </div>
                    <span style={{ fontWeight: 700, color: COLORS[i % COLORS.length] }}>{fmt(r.total)}đ ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            {byMethod.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>Chưa có giao dịch trong tháng này</div>}
          </div>
        </>
      )}

      {/* ---- DEBT TAB ---- */}
      {tab === 'debt' && (
        <>
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#be123c' }}>
            ℹ️ Số liệu công nợ là snapshot tại thời điểm hiện tại, không lọc theo khoảng thời gian/chi nhánh đã chọn.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'HV NỢ QUÁ HẠN', value: totalStudentsInDebt, sub: 'Cần đôn đốc', icon: '🔴', color: '#dc2626', bg: '#fee2e2' },
              { label: 'TỔNG NỢ QUÁ HẠN', value: fmt(totalDebt) + 'đ', sub: 'Nợ gốc', icon: '💸', color: '#dc2626', bg: '#fef2f2' },
              { label: 'TỔNG DƯ NỢ', value: fmt(parseFloat(debtAging.total_debt || 0)) + 'đ', sub: 'Kể cả chưa đến hạn', icon: '📊', color: '#8b5cf6', bg: '#f5f3ff' },
              { label: 'HV CHƯA ĐÓNG', value: pending.count || 0, sub: 'Hóa đơn chờ thanh toán', icon: '📋', color: '#f97316', bg: '#fff7ed' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>{c.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Debt risk badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Báo Cáo Phân Tích Công Nợ Quá Hạn</h3>
            <div>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Mức độ rủi ro: </span>
              <span style={{ fontWeight: 700, color: debtRiskColor }}>{debtRiskLevel}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card">
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Phân Tích Theo Độ Tuổi Công Nợ</h4>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Theo độ tuổi công nợ — Cập nhật: {new Date().toLocaleDateString('vi-VN')}</p>
              {debtBuckets.map((b, i) => (
                <div key={i} style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: parseInt(debtAging[`days_${i === 0 ? '1_30' : i === 1 ? '31_60' : i === 2 ? '61_90' : '90_plus'}`] || 0) > 0 ? '#fffbeb' : '#f9fafb', border: `1px solid ${b.amount > 0 ? b.color + '40' : 'var(--gray-100)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: b.color }}>{b.students}</span>
                      <span style={{ fontSize: 13, marginLeft: 4 }}>Nợ quá hạn {b.label}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: b.color, fontSize: 14 }}>{fmt(b.amount)}đ</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                    <div style={{ width: `${totalDebt > 0 ? (b.amount / totalDebt) * 100 : 0}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    Nợ trung bình: {b.students > 0 ? fmt(b.amount / b.students) : 0}đ / học viên
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Phân bổ công nợ</h4>
              {debtBuckets.some(b => b.amount > 0) ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={debtBuckets.filter(b => b.amount > 0).map(b => ({ name: b.label, value: b.amount }))}
                      cx="50%" cy="50%" outerRadius={65} dataKey="value">
                      {debtBuckets.filter(b => b.amount > 0).map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v) + 'đ'} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: '#16a34a', fontSize: 24 }}>✅</div>
              )}
              {debtBuckets.every(b => b.amount === 0) ? (
                <div style={{ textAlign: 'center', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>Không có công nợ quá hạn!</div>
              ) : debtBuckets.filter(b => b.amount > 0).map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
                    {b.label}
                  </div>
                  <strong style={{ color: b.color }}>{totalDebt > 0 ? ((b.amount / totalDebt) * 100).toFixed(0) : 0}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Top debtors */}
          {debtAging.topDebtors?.length > 0 && (
            <div className="card">
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Top học viên nợ nhiều nhất</h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>HỌC VIÊN</th><th>SỐ ĐỢT QUÁ HẠN</th><th>SỐ TIỀN NỢ</th><th>QUÁ HẠN TỐI ĐA</th></tr>
                  </thead>
                  <tbody>
                    {debtAging.topDebtors.map((d: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{d.full_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.student_code}</div>
                        </td>
                        <td>{d.overdue_collections} đợt</td>
                        <td style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(d.debt_amount)}đ</td>
                        <td>
                          <span style={{ color: parseInt(d.max_overdue_days) > 60 ? '#dc2626' : '#f97316', fontWeight: 600 }}>
                            {d.max_overdue_days} ngày
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- BRANCH TAB ---- */}
      {tab === 'branch' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Phân bổ học viên theo Chi nhánh</h3>
          {branchStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={branchStats} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="branch_name" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="student_count" fill="#2563eb" radius={[0, 6, 6, 0]} name="Học viên" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 20 }}>
                {branchStats.map((b: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontWeight: 600 }}>{b.branch_name}</span>
                    </div>
                    <strong>{b.student_count} học viên</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Chưa có dữ liệu chi nhánh</div>
          )}
        </div>
      )}

      {/* ---- RATIO TAB ---- */}
      {tab === 'ratio' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>💰 Doanh thu tháng {selectedMonth}/{selectedYear}</h3>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{fmt(totalRevenue)}đ</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{stats?.transactions || 0} giao dịch</div>
              <div style={{ marginTop: 12 }}>
                {byMethod.map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                    <span style={{ color: 'var(--gray-600)' }}>{PM_LABEL[r.payment_method] || r.payment_method}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{fmt(r.total)}đ</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.count} giao dịch · {pieTotal > 0 ? ((parseFloat(r.total) / pieTotal) * 100).toFixed(1) : 0}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Tỷ lệ thu tổng thể</h3>
              {pending.count > 0 ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>Đã thu</span><strong style={{ color: '#16a34a' }}>{fmt(totalRevenue)}đ</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span>Chưa thu</span><strong style={{ color: '#dc2626' }}>{fmt(pending.total)}đ</strong>
                    </div>
                    {(() => {
                      const grandTotal = totalRevenue + (pending.total || 0);
                      const pct = grandTotal > 0 ? Math.round((totalRevenue / grandTotal) * 100) : 0;
                      return (
                        <>
                          <div style={{ height: 12, background: '#e5e7eb', borderRadius: 6 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 6 }} />
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 8 }}>{pct}% đã thu</div>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ background: '#fee2e2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                    ⚠️ Còn <strong>{fmt(pending.total)}đ</strong> chưa thu từ <strong>{pending.count}</strong> hóa đơn
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#16a34a', fontSize: 14, fontWeight: 600 }}>
                  ✅ Tất cả hóa đơn đã được thanh toán!
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
