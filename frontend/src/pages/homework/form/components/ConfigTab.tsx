import React from 'react';

export default function ConfigTab({ form, setForm }: { form: any; setForm: (updater: (prev: any) => any) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="toggle-row">
        <div className="toggle-row-text">
          <div className="toggle-row-title">Giới hạn thời gian làm bài</div>
          <div className="toggle-row-desc">
            {form.hasTimeLimit
              ? `Bật: khi học viên bắt đầu làm bài, đồng hồ đếm ngược ${form.timeLimitMinutes || 0} phút sẽ chạy. Hết giờ, bài tự đóng lại, học viên không vào làm tiếp được nữa.`
              : 'Tắt: học viên làm bài không giới hạn thời gian (chỉ phụ thuộc hạn nộp).'}
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.hasTimeLimit}
            onChange={(e) => setForm((prev: any) => ({ ...prev, hasTimeLimit: e.target.checked }))}
          />
          <span className="toggle-track" />
        </label>
      </div>

      {form.hasTimeLimit && (
        <div className="form-group" style={{ maxWidth: 240 }}>
          <label className="form-label">Thời gian làm bài (phút)</label>
          <input
            type="number"
            min={1}
            className="form-input"
            value={form.timeLimitMinutes}
            onChange={(e) => setForm((prev: any) => ({ ...prev, timeLimitMinutes: e.target.value }))}
            placeholder="VD: 30"
          />
        </div>
      )}

      <div className="toggle-row">
        <div className="toggle-row-text">
          <div className="toggle-row-title">Xáo trộn câu hỏi và đáp án</div>
          <div className="toggle-row-desc">
            {form.shuffleQuestions
              ? 'Bật: mỗi học viên sẽ thấy thứ tự câu hỏi và thứ tự đáp án (A/B/C/D) khác nhau, hạn chế nhìn bài nhau. Thứ tự được giữ cố định trong suốt quá trình học viên làm bài.'
              : 'Tắt: tất cả học viên thấy câu hỏi và đáp án theo đúng thứ tự giáo viên đã soạn.'}
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.shuffleQuestions}
            onChange={(e) => setForm((prev: any) => ({ ...prev, shuffleQuestions: e.target.checked }))}
          />
          <span className="toggle-track" />
        </label>
      </div>

      <label className="toggle-row" style={{ cursor: 'pointer' }}>
        <div className="toggle-row-text">
          <div className="toggle-row-title">Cho phép nộp muộn</div>
          <div className="toggle-row-desc">
            {form.allowLateSubmission
              ? 'Bật: học viên vẫn nộp được bài sau khi quá hạn nộp.'
              : 'Tắt: học viên không thể nộp bài sau khi quá hạn.'}
          </div>
        </div>
        <span className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.allowLateSubmission}
            onChange={(e) => setForm((prev: any) => ({ ...prev, allowLateSubmission: e.target.checked }))}
          />
          <span className="toggle-track" />
        </span>
      </label>

      <div className="toggle-row">
        <div className="toggle-row-text">
          <div className="toggle-row-title">Cho phép học viên xem đáp án sau khi nộp bài</div>
          <div className="toggle-row-desc">
            {form.showAnswersAfterSubmit
              ? 'Bật: ngay sau khi nộp, học viên sẽ thấy đáp án đúng và biết câu nào đúng/sai.'
              : 'Tắt: học viên không thấy đáp án đúng và không biết câu nào đúng/sai.'}
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.showAnswersAfterSubmit}
            onChange={(e) => setForm((prev: any) => ({ ...prev, showAnswersAfterSubmit: e.target.checked }))}
          />
          <span className="toggle-track" />
        </label>
      </div>

      <div className="toggle-row">
        <div className="toggle-row-text">
          <div className="toggle-row-title">Cho phép học viên xem điểm sau khi nộp bài</div>
          <div className="toggle-row-desc">
            {form.showScoreAfterSubmit
              ? 'Bật: học viên thấy điểm tổng và nhận xét ngay sau khi nộp/được chấm.'
              : 'Tắt: học viên chỉ biết bài đã nộp/đã chấm, không thấy điểm số hay nhận xét.'}
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!form.showScoreAfterSubmit}
            onChange={(e) => setForm((prev: any) => ({ ...prev, showScoreAfterSubmit: e.target.checked }))}
          />
          <span className="toggle-track" />
        </label>
      </div>
    </div>
  );
}