import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, BookOpen, Users, Calendar, DollarSign, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Quản lý nhân sự', desc: 'Giáo viên, học viên, nhân viên với phân quyền linh hoạt. Một người có thể đảm nhận nhiều vai trò.', color: '#3b82f6' },
  { icon: BookOpen, title: 'Quản lý lớp học', desc: 'Hỗ trợ lớp có thời hạn và không thời hạn. Theo dõi tiến độ, sĩ số và giáo viên đứng lớp.', color: '#10b981' },
  { icon: Calendar, title: 'Lịch học thông minh', desc: 'Tạo lịch theo khoảng thời gian, chọn thứ trong tuần. Dễ dàng dời lịch hoặc huỷ buổi cụ thể.', color: '#8b5cf6' },
  { icon: CheckCircle2, title: 'Điểm danh realtime', desc: 'Điểm danh nhanh chóng với trạng thái có mặt / vắng / trễ. Lịch sử đầy đủ, chỉnh sửa bất cứ lúc nào.', color: '#f59e0b' },
  { icon: DollarSign, title: 'Thu học phí linh hoạt', desc: 'Tạo đợt thu theo lớp hoặc từng học viên. Hỗ trợ đóng tiền mặt, chuyển khoản, đóng một phần.', color: '#ef4444' },
  { icon: BarChart3, title: 'Báo cáo & Thống kê', desc: 'Dashboard trực quan với doanh thu, công nợ, tỷ lệ điểm danh và phân tích theo chi nhánh.', color: '#06b6d4' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'var(--font)' }}>
      {/* Nav */}
      <nav style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-100)', position: 'sticky', top: 0, background: 'white', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--gray-900)' }}>Sobu.io</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {['Tính năng', 'Bảng giá', 'Khách hàng', 'FAQ'].map(item => (
            <a key={item} href="#" style={{ color: 'var(--gray-600)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/portal/login')}>Đăng nhập</button>
          <button className="btn btn-primary" onClick={() => navigate('/portal/login')}>Dùng thử miễn phí</button>
        </div>
      </nav>

      {/* Stats bar */}
      <div style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', padding: '12px 48px', display: 'flex', justifyContent: 'center', gap: 48 }}>
        {[
          { val: '500+', label: 'Trung tâm' },
          { val: '10,000+', label: 'Học viên' },
          { val: '50,000+', label: 'Buổi học' },
          { val: '99.9%', label: 'Uptime' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)' }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 48px 60px', maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, color: 'var(--gray-900)', marginBottom: 20 }}>
          Quản lý trung tâm giáo dục vẫn đang...<br />
          <span style={{ color: '#ef4444' }}>thủ công?</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 32 }}>
          Hàng nghìn trung tâm đang lãng phí thời gian với những vấn đề này mỗi ngày
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
          {[
            { badge: 'Lãng phí thời gian', val: '15h', unit: '/ tuần', title: 'Excel chồng Excel', desc: 'Dữ liệu học sinh, điểm danh, học phí rải rác khắp nơi. Tìm kiếm mất hàng giờ, sai sót liên tục.' },
            { badge: 'Rối rắm vận hành', val: '3x', unit: 'xung đột', title: 'Lịch học xếp mãi không xong', desc: 'Trùng phòng, trùng giáo viên, phụ huynh phàn nàn. Mỗi lần thay đổi là một lần đau đầu.' },
            { badge: 'Thất thoát doanh thu', val: '23%', unit: 'sai lệch', title: 'Thu học phí rối như tơ vò', desc: 'Không biết ai đã đóng, đang nợ. Báo cáo tài chính sai lệch, đối soát mất cả ngày.' },
          ].map(card => (
            <div key={card.title} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 24, textAlign: 'left' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-light)', padding: '3px 8px', borderRadius: 20 }}>{card.badge}</span>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#ef4444', margin: '12px 0 4px' }}>{card.val} <span style={{ fontSize: 16, color: 'var(--gray-500)' }}>{card.unit}</span></div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/portal/login')}>
            Xem giải pháp của Sobu.io <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: 'var(--gray-50)', padding: '60px 48px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Tính năng đầy đủ</h2>
        <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 15, marginBottom: 40 }}>Mọi thứ bạn cần để vận hành trung tâm hiệu quả</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: 'white', borderRadius: 14, padding: 24, border: '1px solid var(--gray-100)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: f.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <f.icon size={22} color={f.color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '60px 48px', background: 'var(--gray-900)', color: 'white' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Bắt đầu ngay hôm nay</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 28, fontSize: 15 }}>Miễn phí 14 ngày, không cần thẻ tín dụng</p>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/portal/login')}>
          Đăng nhập / Dùng thử <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
