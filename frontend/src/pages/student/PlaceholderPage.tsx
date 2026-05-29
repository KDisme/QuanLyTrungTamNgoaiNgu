import React from 'react';

export default function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div className="page-header"><h1 className="page-title">{title}</h1><div className="page-subtitle">{desc}</div></div>
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
        Trang này đã được tách đúng portal. Bạn có thể mở rộng thêm API chi tiết cho chức năng này ở giai đoạn tiếp theo.
      </div>
    </div>
  );
}
