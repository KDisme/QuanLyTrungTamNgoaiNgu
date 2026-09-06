import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Headphones, BookOpen, Mic, PenLine, UploadCloud, ClipboardList, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { examMediaApi, examQuestionsApi, homeworkQuestionBankApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Badge, ConfirmDialog, EmptyState, Loading, Modal, StatusBadge, Tabs } from '../../components/common';

const FORMAT_OPTIONS = [
  { code: 'TOEIC_LR', label: 'TOEIC hai kỹ năng', duration: 120 },
  { code: 'TOEIC_4_SKILLS', label: 'TOEIC bốn kỹ năng', duration: 200 },
  { code: 'VSTEP_4_SKILLS', label: 'VSTEP bốn kỹ năng', duration: 172 },
];

const BLUEPRINTS: Record<string, any[]> = {
  TOEIC_LR: [
    { skill: 'Listening', part: 'Part 1', label: 'Part 1 - Mô tả tranh', type: 'single_choice', options: ['A','B','C','D'], image: true, audio: true, hideText: true, transition: 2 },
    { skill: 'Listening', part: 'Part 2', label: 'Part 2 - Hỏi đáp', type: 'audio_choice', options: ['A','B','C'], audio: true, hideText: true, transition: 5 },
    { skill: 'Listening', part: 'Part 3', label: 'Part 3 - Hội thoại ngắn', type: 'group_choice', options: ['A','B','C','D'], audio: true, optionalImage: true, group: true, qPerGroup: 3, transition: 8 },
    { skill: 'Listening', part: 'Part 4', label: 'Part 4 - Bài nói ngắn', type: 'group_choice', options: ['A','B','C','D'], audio: true, optionalImage: true, group: true, qPerGroup: 3, transition: 8 },
    { skill: 'Reading', part: 'Part 5', label: 'Part 5 - Hoàn thành câu', type: 'single_choice', options: ['A','B','C','D'] },
    { skill: 'Reading', part: 'Part 6', label: 'Part 6 - Hoàn thành đoạn văn', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, qPerGroup: 4 },
    { skill: 'Reading', part: 'Part 7', label: 'Part 7 - Đọc hiểu văn bản', type: 'group_choice', options: ['A','B','C','D'], group: true, splitScreen: true, minQ: 2, maxQ: 5 },
  ],
  TOEIC_4_SKILLS: [
    { skill: 'Listening', part: 'Part 1', label: 'Part 1 - Mô tả tranh', type: 'single_choice', options: ['A','B','C','D'], image: true, audio: true, hideText: true, transition: 2 },
    { skill: 'Listening', part: 'Part 2', label: 'Part 2 - Hỏi đáp', type: 'audio_choice', options: ['A','B','C'], audio: true, hideText: true, transition: 5 },
    { skill: 'Listening', part: 'Part 3', label: 'Part 3 - Hội thoại ngắn', type: 'group_choice', options: ['A','B','C','D'], audio: true, optionalImage: true, group: true, qPerGroup: 3, transition: 8 },
    { skill: 'Listening', part: 'Part 4', label: 'Part 4 - Bài nói ngắn', type: 'group_choice', options: ['A','B','C','D'], audio: true, optionalImage: true, group: true, qPerGroup: 3, transition: 8 },
    { skill: 'Reading', part: 'Part 5', label: 'Part 5 - Hoàn thành câu', type: 'single_choice', options: ['A','B','C','D'] },
    { skill: 'Reading', part: 'Part 6', label: 'Part 6 - Hoàn thành đoạn văn', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, qPerGroup: 4 },
    { skill: 'Reading', part: 'Part 7', label: 'Part 7 - Đọc hiểu văn bản', type: 'group_choice', options: ['A','B','C','D'], group: true, splitScreen: true, minQ: 2, maxQ: 5 },
    { skill: 'Speaking', part: 'Question 1-2', label: 'Câu 1-2 - Đọc thành tiếng', type: 'speaking_read_aloud', prep: 45, response: 45, textOnly: true },
    { skill: 'Speaking', part: 'Question 3-4', label: 'Câu 3-4 - Mô tả tranh', type: 'speaking_describe_picture', prep: 45, response: 30, image: true },
    { skill: 'Speaking', part: 'Question 5-6', label: 'Câu 5-6 - Trả lời câu hỏi', type: 'speaking_answer_question', prep: 3, response: 15, audio: true },
    { skill: 'Speaking', part: 'Question 7', label: 'Câu 7 - Trả lời câu hỏi', type: 'speaking_answer_question', prep: 3, response: 30, audio: true },
    { skill: 'Speaking', part: 'Question 8-9', label: 'Câu 8-9 - Trả lời bằng thông tin cho sẵn', type: 'speaking_info_question', prep: 3, response: 15, group: true, audio: true, groupPreview: 45 },
    { skill: 'Speaking', part: 'Question 10', label: 'Câu 10 - Trả lời bằng thông tin cho sẵn', type: 'speaking_info_question', prep: 3, response: 30, group: true, audio: true, groupPreview: 45 },
    { skill: 'Speaking', part: 'Question 11', label: 'Câu 11 - Trình bày quan điểm', type: 'speaking_opinion', prep: 30, response: 60, textOnly: true },
    { skill: 'Writing', part: 'Question 1-5', label: 'Câu 1-5 - Viết câu dựa trên tranh', type: 'writing_picture_sentence', section: 480, image: true, keywords: true, note: '5 câu / 8 phút, mỗi câu dùng 1 ảnh và 2 từ gợi ý' },
    { skill: 'Writing', part: 'Question 6-7', label: 'Câu 6-7 - Phản hồi Email', type: 'writing_email_response', section: 1200, email: true, note: '2 email / 20 phút, mỗi email 10 phút' },
    { skill: 'Writing', part: 'Question 8', label: 'Câu 8 - Viết bài luận', type: 'writing_essay', section: 1800, minWords: 300, note: 'Essay tối thiểu 300 từ / 30 phút' },
  ],
  VSTEP_4_SKILLS: [
    { skill: 'Listening', part: 'Listening Part 1', label: 'Listening Phần 1 - Audio chung Part 1', type: 'group_choice', options: ['A','B','C','D'], audio: true, group: true, qPerGroup: 8, section: 2400, note: 'VSTEP: 1 audio chung cho cả Part 1, bên dưới là 8 câu hỏi' },
    { skill: 'Listening', part: 'Listening Part 2', label: 'Listening Phần 2 - Audio chung Part 2', type: 'group_choice', options: ['A','B','C','D'], audio: true, group: true, qPerGroup: 12, section: 2400, note: 'VSTEP: 1 audio chung cho cả Part 2, bên dưới là 12 câu hỏi' },
    { skill: 'Listening', part: 'Listening Part 3', label: 'Listening Phần 3 - Audio chung Part 3', type: 'group_choice', options: ['A','B','C','D'], audio: true, group: true, qPerGroup: 15, section: 2400, note: 'VSTEP: 1 audio chung cho cả Part 3, bên dưới là 15 câu hỏi' },
    { skill: 'Reading', part: 'Reading Part 1', label: 'Reading Phần 1 - 1 bài đọc + 10 câu', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, splitScreen: true, qPerGroup: 10, section: 3600, passagesMax: 1, note: 'Split-screen: trái đoạn văn, phải 10 câu hỏi' },
    { skill: 'Reading', part: 'Reading Part 2', label: 'Reading Phần 2 - 1 bài đọc + 10 câu', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, splitScreen: true, qPerGroup: 10, section: 3600, passagesMax: 1, note: 'Split-screen: trái đoạn văn, phải 10 câu hỏi' },
    { skill: 'Reading', part: 'Reading Part 3', label: 'Reading Phần 3 - 1 bài đọc + 10 câu', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, splitScreen: true, qPerGroup: 10, section: 3600, passagesMax: 1, note: 'Split-screen: trái đoạn văn, phải 10 câu hỏi' },
    { skill: 'Reading', part: 'Reading Part 4', label: 'Reading Phần 4 - 1 bài đọc + 10 câu', type: 'group_choice', options: ['A','B','C','D'], group: true, richText: true, splitScreen: true, qPerGroup: 10, section: 3600, passagesMax: 1, note: 'Split-screen: trái đoạn văn, phải 10 câu hỏi' },
    { skill: 'Writing', part: 'Writing Task 1', label: 'Writing Task 1 - Viết thư/Email', type: 'writing_email_letter', section: 1200, minWords: 120, email: true, note: 'Tối thiểu 120 từ, chiếm 1/3 điểm Writing' },
    { skill: 'Writing', part: 'Writing Task 2', label: 'Writing Task 2 - Viết bài luận', type: 'writing_essay', section: 2400, minWords: 250, note: 'Tối thiểu 250 từ, chiếm 2/3 điểm Writing' },
    { skill: 'Speaking', part: 'Speaking Part 1', label: 'Speaking Phần 1 - Tương tác xã hội', type: 'speaking_social_interaction', group: true, audio: true, section: 180, note: 'Nhập 2 chủ đề, mỗi chủ đề 3 câu hỏi; ghi âm liên tục' },
    { skill: 'Speaking', part: 'Speaking Part 2', label: 'Speaking Phần 2 - Thảo luận giải pháp', type: 'speaking_solution_discussion', group: true, prep: 60, response: 180, note: 'Tổng 4 phút: 60 giây chuẩn bị + 3 phút nói' },
    { skill: 'Speaking', part: 'Speaking Part 3', label: 'Speaking Phần 3 - Phát triển chủ đề', type: 'speaking_topic_development', group: true, image: true, prep: 60, response: 240, note: 'Tổng 5 phút: 60 giây chuẩn bị + 4 phút nói' },
  ],
};

const makeOptions = (labels: string[]) => labels.map(label => ({ optionLabel: label, optionText: '', isCorrect: false, allowEmptyText: false }));

const slug = (value: any) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const pad2 = (n: number) => String(Math.max(1, n || 1)).padStart(2, '0');

function buildAutoGroupKey(form: any, rule: any) {
  if (!rule?.group) return '';
  const base = `${slug(form.formatCode)}_${slug(form.skill)}_${slug(form.part)}`;
  const seq = parseInt(form.sequenceNo || '1', 10) || 1;
  const perGroup = rule.qPerGroup || rule.questionsPerGroup || 0;
  const groupNo = perGroup > 0 ? Math.ceil(seq / perGroup) : 1;

  // VSTEP Listening/Speaking/Reading dùng 1 nhóm cố định theo từng Part.
  if (form.formatCode === 'VSTEP_4_SKILLS') return base;

  // TOEIC Part 3/4/6/7 gom theo nhóm câu; hệ thống tự tính nhóm dựa trên số thứ tự câu.
  if (perGroup > 0) return `${base}_GROUP_${pad2(groupNo)}`;
  return base;
}

function getGroupContentLabel(form: any, rule: any) {
  if (form.skill === 'Reading') return 'Bài đọc / đoạn văn chung của Part';
  if (form.skill === 'Listening') return form.formatCode === 'VSTEP_4_SKILLS' ? 'Hướng dẫn hiển thị trước audio (tuỳ chọn)' : 'Nội dung nhóm audio / hội thoại';
  if (form.skill === 'Writing') return 'Đề bài / email / nội dung yêu cầu';
  if (form.skill === 'Speaking') return 'Nội dung đề Speaking / tình huống / chủ đề';
  return 'Nội dung chung của nhóm';
}

function getGroupContentPlaceholder(form: any) {
  if (form.skill === 'Reading') return 'Nhập bài đọc hiển thị bên trái màn hình làm bài.';
  if (form.skill === 'Listening') return form.formatCode === 'VSTEP_4_SKILLS' ? 'Có thể nhập hướng dẫn chung của Part. Nếu để trống, giao diện thi sẽ dùng hướng dẫn mặc định. Không nhập mã nhóm kỹ thuật ở đây.' : 'Nhập mô tả audio hoặc transcript/ghi chú nội bộ. Audio thật upload ở trường Audio bên dưới.';
  if (form.skill === 'Writing') return 'Nhập đề bài, email hoặc yêu cầu viết.';
  if (form.skill === 'Speaking') return 'Nhập chủ đề, tình huống, gợi ý hoặc nội dung hướng dẫn Speaking.';
  return 'Nhập nội dung chung của nhóm câu hỏi.';
}

function FileUpload({ label, accept, onUploaded }: { label: string; accept: string; onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await examMediaApi.upload(file);
      onUploaded(res.data.url);
      toast.success(`Đã upload ${label.toLowerCase()}`);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Upload thất bại'); }
    finally { setBusy(false); }
  };
  return <label className="btn btn-secondary" style={{ cursor: 'pointer' }}><UploadCloud size={14}/> {busy ? 'Đang upload...' : label}<input type="file" accept={accept} hidden onChange={e => upload(e.target.files?.[0])} /></label>;
}

function QuestionForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const initialFormat = initial?.format_code || initial?.formatCode || 'TOEIC_LR';
  const initialRule = BLUEPRINTS[initialFormat]?.find(r => r.part === initial?.part) || BLUEPRINTS[initialFormat]?.[0] || BLUEPRINTS.TOEIC_LR[4];
  const [form, setForm] = useState<any>({
    formatCode: initialFormat,
    examType: initialFormat === 'VSTEP_4_SKILLS' ? 'VSTEP' : 'TOEIC',
    skill: initial?.skill || initialRule.skill,
    part: initial?.part || initialRule.part,
    questionType: initial?.question_type || initial?.questionType || initialRule.type,
    sequenceNo: initial?.sequence_no || initial?.sequenceNo || '',
    groupKey: initial?.group_key || initial?.groupKey || '',
    questionText: initial?.question_text || initial?.questionText || '',
    questionGroup: initial?.question_group || initial?.questionGroup || initial?.group?.content || '',
    imageUrl: initial?.image_url || initial?.imageUrl || initial?.media?.imageUrl || '',
    audioUrl: initial?.audio_url || initial?.audioUrl || initial?.media?.audioUrl || '',
    topic: initial?.topic || '',
    difficulty: initial?.difficulty || 'medium',
    explanation: initial?.explanation || '',
    score: initial?.score || 1,
    status: initial?.status || 'active',
    prepSeconds: initial?.prep_seconds || initial?.prepSeconds || initialRule.prep || '',
    responseSeconds: initial?.response_seconds || initial?.responseSeconds || initialRule.response || '',
    sectionSeconds: initial?.section_seconds || initial?.sectionSeconds || initialRule.section || '',
    minWords: initial?.min_words || initial?.minWords || initialRule.minWords || '',
    metadata: initial?.metadata || {},
    group: initial?.group || { content: '', passages: [''], media: {}, displayConfig: {} },
    options: initial?.options?.map((o: any) => ({ optionLabel: o.option_label || o.optionLabel, optionText: o.option_text || o.optionText, isCorrect: o.is_correct ?? o.isCorrect })) || makeOptions(initialRule.options || []),
  });
  const [loading, setLoading] = useState(false);
  const rules = BLUEPRINTS[form.formatCode] || BLUEPRINTS.TOEIC_LR;
  const rule = rules.find(r => r.part === form.part) || rules[0];
  const isObjective = ['single_choice','audio_choice','group_choice'].includes(rule.type);

  const changeRule = (part: string) => {
    const next = rules.find(r => r.part === part) || rules[0];
    setForm((f: any) => ({ ...f, skill: next.skill, part: next.part, questionType: next.type, options: makeOptions(next.options || []), prepSeconds: next.prep || '', responseSeconds: next.response || '', sectionSeconds: next.section || '', minWords: next.minWords || '', groupKey: next.group ? '' : '' }));
  };
  const changeFormat = (formatCode: string) => {
    const next = BLUEPRINTS[formatCode][0];
    setForm((f: any) => ({ ...f, formatCode, examType: formatCode === 'VSTEP_4_SKILLS' ? 'VSTEP' : 'TOEIC', skill: next.skill, part: next.part, questionType: next.type, options: makeOptions(next.options || []), prepSeconds: next.prep || '', responseSeconds: next.response || '', sectionSeconds: next.section || '', minWords: next.minWords || '', groupKey: next.group ? '' : '' }));
  };
  const setOption = (idx: number, patch: any) => setForm((f: any) => ({ ...f, options: f.options.map((x: any, i: number) => i === idx ? { ...x, ...patch } : (patch.isCorrect ? { ...x, isCorrect: false } : x)) }));
  const setPassage = (idx: number, value: string) => setForm((f: any) => ({ ...f, group: { ...f.group, passages: (f.group.passages || ['']).map((x: string, i: number) => i === idx ? value : x) } }));
  const addPassage = () => setForm((f: any) => ({ ...f, group: { ...f.group, passages: [...(f.group.passages || ['']), ''].slice(0, rule.passagesMax || 3) } }));

  const submit = async () => {
    if (isObjective && !form.options.some((o: any) => o.isCorrect)) return toast.error('Vui lòng chọn 1 đáp án đúng');
    if (rule.image && !form.imageUrl) return toast.error('Part này bắt buộc có hình ảnh');
    if (rule.audio && !rule.group && !form.audioUrl) return toast.error('Part này bắt buộc có audio');
    if (!form.questionText.trim() && !rule.hideText && !rule.image) return toast.error('Vui lòng nhập nội dung câu hỏi');
    setLoading(true);
    const generatedGroupKey = rule.group ? (form.groupKey || buildAutoGroupKey(form, rule)) : '';
    const payload = {
      ...form,
      groupKey: generatedGroupKey,
      displayConfig: { showQuestionText: !rule.hideText, showOptionText: !rule.hideText, splitScreen: !!rule.splitScreen, transitionSeconds: rule.transition || 0, groupPreviewSeconds: rule.groupPreview || 0, wordCount: form.skill === 'Writing', countdown: ['Speaking','Writing'].includes(form.skill), recording: form.skill === 'Speaking' },
      media: { imageUrl: form.imageUrl, audioUrl: form.audioUrl },
      metadata: { ...form.metadata, examRule: rule.label, note: rule.note || '', keywords: form.metadata?.keywords || '', followUpQuestions: form.metadata?.followUpQuestions || '', solutions: form.metadata?.solutions || '' },
      group: rule.group ? { ...form.group, groupKey: generatedGroupKey, content: form.questionGroup, media: { imageUrl: form.imageUrl, audioUrl: form.audioUrl }, displayConfig: { splitScreen: !!rule.splitScreen, richText: !!rule.richText, qPerGroup: rule.qPerGroup || null, autoGeneratedGroupKey: true } } : undefined,
    };
    try {
      if (initial) await examQuestionsApi.update(initial.id, payload); else await examQuestionsApi.create(payload);
      toast.success(initial ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi');
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return <Modal title={initial ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} size="lg" onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={loading} onClick={submit}>{loading ? 'Đang lưu...' : 'Lưu'}</button></>}>
    <div className="grid-2">
      <div className="form-group"><label className="form-label">Loại đề thi</label><select className="form-select" value={form.formatCode} onChange={e => changeFormat(e.target.value)}>{FORMAT_OPTIONS.map(f => <option key={f.code} value={f.code}>{f.label}</option>)}</select></div>
      <div className="form-group"><label className="form-label">Phần thi</label><select className="form-select" value={form.part} onChange={e => changeRule(e.target.value)}>{rules.map(r => <option key={r.part} value={r.part}>{r.label}</option>)}</select></div>
      <div className="form-group"><label className="form-label">Kỹ năng</label><input className="form-input" value={form.skill} readOnly /></div>
      <div className="form-group"><label className="form-label">Số thứ tự câu trong Part</label><input type="number" className="form-input" value={form.sequenceNo} onChange={e => setForm((f: any) => ({ ...f, sequenceNo: e.target.value }))} /></div>
    </div>

    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13 }}>
      <b>{rule.label}</b> · {rule.hideText ? 'Màn hình thi chỉ hiện nút đáp án, không hiện text câu hỏi/đáp án.' : rule.splitScreen ? 'Màn hình thi chia đôi: trái là đoạn văn, phải là câu hỏi.' : form.skill === 'Speaking' ? 'Màn hình thi có microphone và countdown.' : form.skill === 'Writing' ? 'Màn hình thi có word count trực tiếp.' : 'Màn hình thi hiển thị nội dung và đáp án.'}
      {rule.transition ? ` · Chuyển tiếp ${rule.transition}s.` : ''}{rule.prep ? ` · Chuẩn bị ${rule.prep}s, trả lời ${rule.response}s.` : ''}{rule.section ? ` · Thời gian nhóm ${Math.round(rule.section/60)} phút.` : ''}{rule.note ? ` · ${rule.note}.` : ''}
    </div>

    {rule.group && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
      Hệ thống tự gom các câu cùng Part/nhóm, bạn không cần nhập mã nhóm kỹ thuật. {form.formatCode === 'VSTEP_4_SKILLS' && form.skill === 'Listening' ? 'Với VSTEP Listening, mỗi Part chỉ có 1 audio chung; các câu trong cùng Part sẽ dùng chung audio đó.' : ''}
    </div>}

    {(rule.group || rule.richText || rule.email || rule.splitScreen) && <div className="form-group"><label className="form-label">{getGroupContentLabel(form, rule)}</label><textarea className="form-textarea" style={{ minHeight: 120 }} value={form.questionGroup} onChange={e => setForm((f: any) => ({ ...f, questionGroup: e.target.value, group: { ...f.group, content: e.target.value } }))} placeholder={getGroupContentPlaceholder(form)} /></div>}

    {rule.splitScreen && form.formatCode !== 'VSTEP_4_SKILLS' && <div className="form-group"><label className="form-label">Các đoạn văn/ngữ liệu hiển thị bên trái</label>{(form.group.passages || ['']).map((p: string, idx: number) => <textarea key={idx} className="form-textarea" style={{ marginBottom: 8 }} value={p} onChange={e => setPassage(idx, e.target.value)} placeholder={`Đoạn ${idx + 1}`} />)}<button className="btn btn-secondary btn-sm" onClick={addPassage} disabled={(form.group.passages || []).length >= (rule.passagesMax || 3)}>+ Thêm đoạn</button></div>}

    <div className="form-group"><label className="form-label">Nội dung câu hỏi</label><textarea className="form-textarea" value={form.questionText} onChange={e => setForm((f: any) => ({ ...f, questionText: e.target.value }))} placeholder={rule.hideText ? 'Có thể nhập transcript/nội dung nội bộ, học viên sẽ không thấy' : 'Nhập câu hỏi hoặc đề bài'} /></div>

    <div className="grid-2">
      {(rule.image || rule.optionalImage) && <div className="form-group"><label className="form-label">Hình ảnh / bảng biểu {rule.image && <span className="required">*</span>}</label><div style={{ display: 'flex', gap: 8 }}><input className="form-input" value={form.imageUrl} onChange={e => setForm((f: any) => ({ ...f, imageUrl: e.target.value }))} placeholder="URL hình ảnh"/><FileUpload label="Upload ảnh" accept="image/*" onUploaded={url => setForm((f: any) => ({ ...f, imageUrl: url }))}/></div></div>}
      {rule.audio && <div className="form-group"><label className="form-label">{form.formatCode === 'VSTEP_4_SKILLS' && form.skill === 'Listening' ? 'Audio chung của Part' : rule.group ? 'Audio chung của nhóm' : 'Audio của câu'} {!rule.group && rule.audio && <span className="required">*</span>}</label><div style={{ display: 'flex', gap: 8 }}><input className="form-input" value={form.audioUrl} onChange={e => setForm((f: any) => ({ ...f, audioUrl: e.target.value }))} placeholder="URL audio"/><FileUpload label="Upload audio" accept="audio/*" onUploaded={url => setForm((f: any) => ({ ...f, audioUrl: url }))}/></div>{form.formatCode === 'VSTEP_4_SKILLS' && form.skill === 'Listening' && <small style={{ color: '#64748b' }}>Chỉ cần upload audio chung một lần cho Part. Các câu còn lại trong cùng Part sẽ tự dùng audio này; nếu để trống, hệ thống giữ audio chung đã có trước đó.</small>}</div>}
    </div>

    {['Speaking','Writing'].includes(form.skill) && <div className="grid-2"><div className="form-group"><label className="form-label">Thời gian chuẩn bị giây</label><input type="number" className="form-input" value={form.prepSeconds} onChange={e => setForm((f: any) => ({ ...f, prepSeconds: e.target.value }))} /></div><div className="form-group"><label className="form-label">Thời gian ghi âm / làm bài giây</label><input type="number" className="form-input" value={form.responseSeconds || form.sectionSeconds} onChange={e => setForm((f: any) => ({ ...f, responseSeconds: e.target.value, sectionSeconds: rule.section ? e.target.value : f.sectionSeconds }))} /></div><div className="form-group"><label className="form-label">Tối thiểu số từ</label><input type="number" className="form-input" value={form.minWords} onChange={e => setForm((f: any) => ({ ...f, minWords: e.target.value }))} /></div><div className="form-group"><label className="form-label">Từ khóa bắt buộc</label><input className="form-input" value={form.metadata?.keywords || ''} onChange={e => setForm((f: any) => ({ ...f, metadata: { ...f.metadata, keywords: e.target.value } }))} placeholder="VD: offer, discount" /></div></div>}

    {form.formatCode === 'VSTEP_4_SKILLS' && form.skill === 'Speaking' && <div className="grid-2"><div className="form-group"><label className="form-label">3 giải pháp gợi ý / ý chính</label><textarea className="form-textarea" value={form.metadata?.solutions || ''} onChange={e => setForm((f: any) => ({ ...f, metadata: { ...f.metadata, solutions: e.target.value } }))} placeholder="Mỗi dòng một giải pháp hoặc ý chính" /></div><div className="form-group"><label className="form-label">Câu hỏi phụ follow-up</label><textarea className="form-textarea" value={form.metadata?.followUpQuestions || ''} onChange={e => setForm((f: any) => ({ ...f, metadata: { ...f.metadata, followUpQuestions: e.target.value } }))} placeholder="Nhập 3-4 câu hỏi phụ sau phần thuyết trình" /></div></div>}

    {isObjective && <div className="form-group"><label className="form-label">Đáp án {rule.hideText && <span style={{ color: '#64748b' }}>(text không hiển thị cho học viên)</span>}</label>{form.options.map((o: any, idx: number) => <div key={o.optionLabel} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}><b style={{ width: 20 }}>{o.optionLabel}</b><input className="form-input" disabled={rule.hideText} value={o.optionText} placeholder={rule.hideText ? 'Ẩn trên màn hình thi' : `Đáp án ${o.optionLabel}`} onChange={e => setOption(idx, { optionText: e.target.value })} /><label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}><input type="radio" name="correct" checked={o.isCorrect} onChange={() => setOption(idx, { isCorrect: true })} /> Đúng</label></div>)}</div>}
    <div className="grid-2"><div className="form-group"><label className="form-label">Chủ đề</label><input className="form-input" value={form.topic} onChange={e => setForm((f: any) => ({ ...f, topic: e.target.value }))} /></div><div className="form-group"><label className="form-label">Trạng thái</label><select className="form-select" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="active">Hoạt động</option><option value="inactive">Tạm ẩn</option></select></div></div>
    <div className="form-group"><label className="form-label">Giải thích / ghi chú chấm</label><textarea className="form-textarea" value={form.explanation} onChange={e => setForm((f: any) => ({ ...f, explanation: e.target.value }))} /></div>
  </Modal>;
}

function ExamQuestionBankPanel() {
  const { user } = useAuth();
  const canDelete = user?.roles?.includes('admin');
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formatCode, setFormatCode] = useState('TOEIC_LR');
  const [skill, setSkill] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const load = useCallback(async () => { setLoading(true); try { const res = await examQuestionsApi.getAll({ search, formatCode, skill, limit: 200 }); setRows(res.data.questions || []); setTotal(res.data.total || 0); } finally { setLoading(false); } }, [search, formatCode, skill]);
  useEffect(() => { load(); }, [load]);
  const edit = async (q: any) => { const res = await examQuestionsApi.getById(q.id); setEditing(res.data); };
  const del = async () => { await examQuestionsApi.delete(deleting.id); toast.success('Đã xoá câu hỏi'); setDeleting(null); load(); };
  const stat = useMemo(() => rows.reduce((acc: any, q: any) => { acc[q.skill] = (acc[q.skill] || 0) + 1; return acc; }, {}), [rows]);
  return <div>
    <div className="page-header flex items-center justify-between"><div><h1 className="page-title">Ngân hàng câu hỏi thi thử</h1><p className="page-subtitle">Form nhập liệu TOEIC và VSTEP; hỗ trợ audio/hình ảnh, nhóm câu, split-screen Reading, word count Writing, microphone và countdown Speaking.</p></div><button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15}/> Thêm câu hỏi</button></div>
    <div className="stats-grid"><div className="stat-card"><div><div className="stat-value">{total}</div><div className="stat-label">TỔNG CÂU</div></div><BookOpen color="var(--primary)" /></div><div className="stat-card"><div><div className="stat-value">{stat.Listening || 0}</div><div className="stat-label">LISTENING</div></div><Headphones color="var(--primary)" /></div><div className="stat-card"><div><div className="stat-value">{stat.Speaking || 0}</div><div className="stat-label">SPEAKING</div></div><Mic color="var(--primary)" /></div><div className="stat-card"><div><div className="stat-value">{stat.Writing || 0}</div><div className="stat-label">WRITING</div></div><PenLine color="var(--primary)" /></div></div>
    <div className="filter-bar"><div className="search-input"><Search className="search-icon" size={14}/><input className="form-input" placeholder="Tìm câu hỏi, topic, group..." value={search} onChange={e => setSearch(e.target.value)} /></div><select className="form-select" style={{ width: 230 }} value={formatCode} onChange={e => setFormatCode(e.target.value)}>{FORMAT_OPTIONS.map(f => <option key={f.code} value={f.code}>{f.label}</option>)}</select><select className="form-select" style={{ width: 150 }} value={skill} onChange={e => setSkill(e.target.value)}><option value="">Tất cả kỹ năng</option><option>Listening</option><option>Reading</option><option>Speaking</option><option>Writing</option></select></div>
    {loading ? <Loading /> : <div className="table-container"><table><thead><tr><th>Câu hỏi</th><th>Format</th><th>Kỹ năng</th><th>Part</th><th>Media/Timer</th><th>Trạng thái</th><th></th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7}><EmptyState /></td></tr> : rows.map(q => <tr key={q.id}><td><b>{q.question_text || q.topic || q.group_key || 'Câu hỏi không hiển thị text'}</b><div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{q.topic || (q.group_key ? 'Có nội dung/audio chung' : '')}</div></td><td><Badge variant={q.format_code === 'TOEIC_4_SKILLS' ? 'purple' : 'blue'}>{q.format_code || 'TOEIC_LR'}</Badge></td><td>{q.skill}</td><td>{q.part}</td><td style={{ fontSize: 12 }}>{q.audio_url ? 'Audio ' : ''}{q.image_url ? 'Ảnh ' : ''}{q.prep_seconds ? `Prep ${q.prep_seconds}s ` : ''}{q.response_seconds ? `Record ${q.response_seconds}s` : ''}</td><td><StatusBadge status={q.status} /></td><td><div style={{ display: 'flex', gap: 6 }}><button className="btn btn-secondary btn-sm" onClick={() => edit(q)}><Pencil size={12}/> Sửa</button>{canDelete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(q)}><Trash2 size={12}/> Xoá</button>}</div></td></tr>)}</tbody></table></div>}
    {showAdd && <QuestionForm onClose={() => setShowAdd(false)} onSuccess={load} />}{editing && <QuestionForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}{deleting && <ConfirmDialog message="Xoá câu hỏi này?" onCancel={() => setDeleting(null)} onConfirm={del} />}
  </div>;
}

// ============ HOMEWORK QUESTION BANK ============

const HW_QUESTION_TYPES = [
  { value: 'true_false', label: 'Đúng / Sai' },
  { value: 'multiple_choice_4', label: 'Trắc nghiệm 4 đáp án' },
  { value: 'essay', label: 'Tự luận' },
];

function emptyHwBankForm(type = 'multiple_choice_4') {
  return {
    questionType: type,
    questionText: '',
    helpText: '',
    score: 1,
    category: '',
    correctAnswer: type === 'true_false' ? 'true' : type === 'multiple_choice_4' ? 'A' : '',
    options: type === 'multiple_choice_4'
      ? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]
      : [],
    // Tham số IRT (Item Response Theory) — mặc định theo xác suất đoán mò tự nhiên của từng dạng câu hỏi:
    // trắc nghiệm 4 đáp án ~25%, đúng/sai ~50%, tự luận không đoán mò được nên = 0.
    irtA: 1,
    irtB: 0,
    irtC: type === 'multiple_choice_4' ? 0.25 : type === 'true_false' ? 0.5 : 0,
  };
}

function HomeworkBankQuestionForm({ initial, onClose, onSuccess }: { initial?: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<any>(() => initial ? {
    questionType: initial.questionType || 'multiple_choice_4',
    questionText: initial.questionText || '',
    helpText: initial.helpText || '',
    score: initial.score || 1,
    category: initial.category || '',
    correctAnswer: initial.correctAnswer || '',
    options: Array.isArray(initial.options) && initial.options.length
      ? initial.options
      : emptyHwBankForm(initial.questionType).options,
    // initial.irtA có thể là null (câu hỏi cũ trước migration, hoặc chưa từng hiệu chỉnh) -> dùng mặc định trung tính.
    irtA: initial.irtA != null ? initial.irtA : 1,
    irtB: initial.irtB != null ? initial.irtB : 0,
    irtC: initial.irtC != null ? initial.irtC : (initial.questionType === 'true_false' ? 0.5 : 0.25),
  } : emptyHwBankForm());
  const [saving, setSaving] = useState(false);

  const changeType = (type: string) => setForm(emptyHwBankForm(type));
  const setOption = (index: number, text: string) => setForm((prev: any) => ({
    ...prev,
    options: prev.options.map((o: any, i: number) => i === index ? { ...o, text } : o),
  }));

  const submit = async () => {
    if (!form.questionText.trim()) return toast.error('Vui lòng nhập nội dung câu hỏi');
    setSaving(true);
    try {
      if (initial) await homeworkQuestionBankApi.update(initial.id, form);
      else await homeworkQuestionBankApi.create(form);
      toast.success('Đã lưu câu hỏi vào ngân hàng');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không lưu được câu hỏi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Sửa câu hỏi' : 'Thêm câu hỏi vào ngân hàng'}
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu câu hỏi'}</button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Dạng câu hỏi</label>
            <select className="form-select" value={form.questionType} onChange={(e) => changeType(e.target.value)}>
              {HW_QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Điểm gợi ý</label>
            <input type="number" className="form-input" value={form.score} onChange={(e) => setForm((prev: any) => ({ ...prev, score: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nội dung câu hỏi</label>
          <textarea className="form-textarea" rows={3} value={form.questionText} onChange={(e) => setForm((prev: any) => ({ ...prev, questionText: e.target.value }))} placeholder="Nhập câu hỏi" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Ghi chú / gợi ý</label>
            <input className="form-input" value={form.helpText} onChange={(e) => setForm((prev: any) => ({ ...prev, helpText: e.target.value }))} placeholder="Không bắt buộc" />
          </div>
          <div className="form-group">
            <label className="form-label">Chủ đề / Nhãn phân loại</label>
            <input className="form-input" value={form.category} onChange={(e) => setForm((prev: any) => ({ ...prev, category: e.target.value }))} placeholder="VD: Unit 3, Ngữ pháp, Từ vựng..." />
          </div>
        </div>

        {form.questionType !== 'essay' && (
          <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Tham số IRT (dùng cho thi thích ứng)</div>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label" title="Mức độ câu hỏi phân biệt rõ học sinh giỏi/yếu. Thường 0.5–2.5, càng cao càng phân biệt rõ.">
                  Độ phân biệt (a)
                </label>
                <input
                  type="number" step="0.05" min="0" className="form-input"
                  value={form.irtA}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, irtA: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" title="Mức năng lực cần có để có 50% cơ hội trả lời đúng. Âm = câu dễ, dương = câu khó. Thường -3 đến 3.">
                  Độ khó (b)
                </label>
                <input
                  type="number" step="0.1" className="form-input"
                  value={form.irtB}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, irtB: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" title="Xác suất trả lời đúng do đoán mò ngẫu nhiên. VD trắc nghiệm 4 đáp án ≈ 0.25, đúng/sai ≈ 0.5.">
                  Đoán mò (c)
                </label>
                <input
                  type="number" step="0.05" min="0" max="1" className="form-input"
                  value={form.irtC}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, irtC: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
              Chưa chắc chắn về giá trị? Cứ để mặc định — hệ thống sẽ tự động hiệu chỉnh dần dựa trên kết quả làm bài thực tế của học sinh.
            </div>
          </div>
        )}

        {form.questionType === 'multiple_choice_4' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {form.options.map((option: any, index: number) => (
              <div key={option.label} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: 8, alignItems: 'center' }}>
                <b>{option.label}</b>
                <input className="form-input" value={option.text} onChange={(e) => setOption(index, e.target.value)} placeholder={`Đáp án ${option.label}`} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="radio" name="hw-bank-correct" checked={form.correctAnswer === option.label} onChange={() => setForm((prev: any) => ({ ...prev, correctAnswer: option.label }))} />
                  Đúng
                </label>
              </div>
            ))}
          </div>
        )}

        {form.questionType === 'true_false' && (
          <div className="form-group">
            <label className="form-label">Đáp án đúng</label>
            <select className="form-select" value={form.correctAnswer} onChange={(e) => setForm((prev: any) => ({ ...prev, correctAnswer: e.target.value }))}>
              <option value="true">Đúng</option>
              <option value="false">Sai</option>
            </select>
          </div>
        )}

        {form.questionType === 'essay' && (
          <div className="alert alert-info">Câu tự luận không cần đáp án đúng — giáo viên sẽ chấm thủ công khi dùng trong bài tập.</div>
        )}
      </div>
    </Modal>
  );
}

function HomeworkQuestionBankPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [category, setCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await homeworkQuestionBankApi.getAll({ search, questionType, category, limit: 200 });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      setCategories(res.data.categories || []);
    } finally {
      setLoading(false);
    }
  }, [search, questionType, category]);
  useEffect(() => { load(); }, [load]);

  const del = async () => {
    await homeworkQuestionBankApi.delete(deleting.id);
    toast.success('Đã xoá câu hỏi khỏi ngân hàng');
    setDeleting(null);
    load();
  };

  const stat = useMemo(() => rows.reduce((acc: any, q: any) => { acc[q.questionType] = (acc[q.questionType] || 0) + 1; return acc; }, {}), [rows]);

  const typeLabel = (type: string) => HW_QUESTION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Ngân hàng câu hỏi bài tập về nhà</h1>
          <p className="page-subtitle">Soạn câu hỏi 1 lần, dùng lại cho nhiều bài tập/nhiều lớp khác nhau — không cần gõ lại mỗi lần tạo bài mới.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Thêm câu hỏi</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><div className="stat-value">{total}</div><div className="stat-label">TỔNG CÂU</div></div><ClipboardList color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{stat.multiple_choice_4 || 0}</div><div className="stat-label">TRẮC NGHIỆM</div></div><BookOpen color="var(--primary)" /></div>
        <div className="stat-card"><div><div className="stat-value">{stat.true_false || 0}</div><div className="stat-label">ĐÚNG/SAI</div></div><CheckSquareIcon /></div>
        <div className="stat-card"><div><div className="stat-value">{stat.essay || 0}</div><div className="stat-label">TỰ LUẬN</div></div><PenLine color="var(--primary)" /></div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search className="search-icon" size={14} />
          <input className="form-input" placeholder="Tìm câu hỏi, chủ đề..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 220 }} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
          <option value="">Tất cả dạng câu hỏi</option>
          {HW_QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="form-select" style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tất cả chủ đề</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Câu hỏi</th><th>Dạng</th><th>Chủ đề</th><th>Điểm</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={5}><EmptyState message="Ngân hàng chưa có câu hỏi nào" /></td></tr> : rows.map((q) => (
                <tr key={q.id}>
                  <td><b>{q.questionText}</b>{q.helpText && <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{q.helpText}</div>}</td>
                  <td><Badge variant="purple">{typeLabel(q.questionType)}</Badge></td>
                  <td>{q.category ? <Badge variant="blue">{q.category}</Badge> : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td>{q.score}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing(q)}><Pencil size={12} /> Sửa</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleting(q)}><Trash2 size={12} /> Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <HomeworkBankQuestionForm onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editing && <HomeworkBankQuestionForm initial={editing} onClose={() => setEditing(null)} onSuccess={load} />}
      {deleting && <ConfirmDialog message="Xoá câu hỏi này khỏi ngân hàng?" onCancel={() => setDeleting(null)} onConfirm={del} />}
    </div>
  );
}

function CheckSquareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

// ============ WRAPPER WITH TABS ============

export default function QuestionBankPage() {
  const [tab, setTab] = useState('exam');
  return (
    <div>
      <Tabs
        tabs={[
          { id: 'exam', label: 'Ngân hàng thi thử', icon: <Headphones size={14} /> },
          { id: 'homework', label: 'Ngân hàng bài tập về nhà', icon: <FolderOpen size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'exam' ? <ExamQuestionBankPanel /> : <HomeworkQuestionBankPanel />}
      </div>
    </div>
  );
}