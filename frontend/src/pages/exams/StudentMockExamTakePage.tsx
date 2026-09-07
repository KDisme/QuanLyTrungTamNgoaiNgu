import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Camera, CheckCircle2, Headphones, Mic, Pause, Play, RotateCcw, Save, Send, Square } from 'lucide-react';
import { mockExamsApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Badge, EmptyState, Loading } from '../../components/common';

type PageMode = 'mock' | 'practice';
type RecordingState = {
  status: 'idle' | 'recording' | 'ready' | 'uploading';
  blob?: Blob;
  url?: string;
  durationSeconds?: number;
  error?: string;
};
type AudioState = { currentTime: number; duration: number; ended: boolean; playing: boolean; hasStarted: boolean };
type SpeakingFlowState = { sectionKey: string; phase: 'prep' | 'recording' | 'done'; remaining: number; total: number; autoStarted: boolean };
type PreflightStatus = 'avatar' | 'sound' | 'ready';

const SKILL_ORDER = ['Listening', 'Reading', 'Writing', 'Speaking'];
// Thời gian mặc định VSTEP nếu server không cung cấp (fallback)
const VSTEP_DEFAULT_SKILL_SECONDS: Record<string, number> = {
  Listening: 40 * 60,
  Reading: 60 * 60,
  Writing: 60 * 60,
  Speaking: 12 * 60,
};

const isSpeakingQuestion = (q: any) => {
  const type = String(q.question_type || q.questionType || '').toLowerCase();
  return q.skill === 'Speaking' || type.startsWith('speaking_') || type.includes('speaking');
};
const isWritingQuestion = (q: any) => {
  const type = String(q.question_type || q.questionType || '').toLowerCase();
  return q.skill === 'Writing' || type.startsWith('writing_') || type.includes('essay') || type.includes('email');
};
const isListeningQuestion = (q: any) => q.skill === 'Listening';
const isVstepFormat = (exam: any) => String(exam?.format_code || '').toUpperCase().startsWith('VSTEP');
const formatSeconds = (value?: number) => {
  const total = Math.max(0, Math.floor(value || 0));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
const getPartLabel = (part?: string) => String(part || 'Part 1').replace(/^part\s*/i, 'Part ');
const getSectionKey = (q: any) => `${q.skill || 'General'}__${getPartLabel(q.part)}`;
const getMedia = (value: any) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value;
};
const getQuestionAudioUrl = (q: any) => {
  const groupMedia = getMedia(q.group_media || q.groupMedia);
  const media = getMedia(q.media);
  return q.audio_url || q.audioUrl || media.audioUrl || groupMedia.audioUrl || groupMedia.audio || '';
};
const getSectionAudioUrl = (section: any) => (section?.questions || []).map(getQuestionAudioUrl).find(Boolean) || '';
const getAudioKey = (q: any) => `q-${q.id}-${getQuestionAudioUrl(q)}`;
const getSectionAudioKey = (exam: any, section: any) => `section-${exam?.id || 'exam'}-${section?.key || 'part'}-${getSectionAudioUrl(section)}`;
const getSpeakingAudioKey = (exam: any, section: any) => `speaking-${exam?.id || 'exam'}-${section?.key || 'part'}-${getSectionAudioUrl(section)}`;
const getSpeakingPartNo = (section: any) => Number(String(section?.part || '').match(/\d+/)?.[0] || 1);
const getSpeakingTiming = (section: any) => {
  const partNo = getSpeakingPartNo(section);
  const first = section?.questions?.[0] || {};
  const displayConfig = getMedia(first.display_config || first.displayConfig);
  const prep = Number(first.prep_seconds ?? first.prepSeconds ?? displayConfig.prepSeconds ?? (partNo === 1 ? 0 : 60));
  const response = Number(first.response_seconds ?? first.responseSeconds ?? first.section_seconds ?? first.sectionSeconds ?? displayConfig.responseSeconds ?? displayConfig.sectionSeconds ?? (partNo === 3 ? 240 : 180));
  return { prepSeconds: Math.max(0, prep || 0), responseSeconds: Math.max(1, response || (partNo === 3 ? 240 : 180)) };
};
const getGroupContent = (q: any) => {
  const direct = q.group_content || q.groupContent || q.question_group || q.questionGroup || '';
  if (direct) return direct;
  const passages = getMedia(q.passages || q.group_passages || q.groupPassages);
  if (Array.isArray(passages) && passages.length) {
    const first = passages[0];
    if (typeof first === 'string') return first;
    return first?.content || first?.text || '';
  }
  return '';
};
const isTechnicalGroupContent = (value: any) => {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^(SEED_|VSTEP_|TOEIC_)[A-Z0-9_ -]*$/i.test(text) || /^GROUP[_ -]?\d+$/i.test(text);
};
const getVisibleGroupContent = (q: any) => {
  const content = getGroupContent(q);
  return isTechnicalGroupContent(content) ? '' : content;
};
const getVstepListeningIntro = (section: any) => {
  const first = section?.questions?.[0] || {};
  return getVisibleGroupContent(first) || `You will listen to the recording for this part and answer the questions below. The recording will be played ONCE only. While listening, you may take notes and choose the correct answer.\n\n${section?.part || 'PART'}\nRead the questions carefully before pressing Play.`;
};
const isPrimarySpeakingQuestion = (q: any, allQuestions: any[]) => {
  if (!isSpeakingQuestion(q)) return false;
  const key = `${q.skill || 'Speaking'}__${getPartLabel(q.part)}`;
  const first = allQuestions
    .filter((item: any) => isSpeakingQuestion(item) && `${item.skill || 'Speaking'}__${getPartLabel(item.part)}` === key)
    .sort((a: any, b: any) => Number(a.sequence_no || a.sequenceNo || a.id) - Number(b.sequence_no || b.sequenceNo || b.id))[0];
  return Number(first?.id) === Number(q.id);
};
// #7: For VSTEP, only the primary question per Part carries the shared recording.
// For TOEIC Speaking, each question has its own independent recording.
const isSpeakingQuestionForRecordingGroup = (q: any, allQuestions: any[], isVstepExam: boolean) => {
  if (!isSpeakingQuestion(q)) return false;
  if (isVstepExam) return isPrimarySpeakingQuestion(q, allQuestions); // VSTEP: one recording per Part
  return true; // TOEIC: each speaking question has its own recording
};
const getAnswerableQuestions = (allQuestions: any[], isVstepExam: boolean) =>
  allQuestions.filter((q: any) => !isSpeakingQuestion(q) || isSpeakingQuestionForRecordingGroup(q, allQuestions, isVstepExam));
const getSkillIndex = (skill: string) => SKILL_ORDER.indexOf(skill);
const getAnsweredQuestionIds = (answers: Record<number, any>, recordings: Record<number, RecordingState>) => {
  const ids = new Set<number>();
  Object.values(answers).forEach((a: any) => {
    if (a?.questionId && (a?.selectedOptionId || a?.answerText || a?.recordingUrl || a?.durationSeconds)) ids.add(Number(a.questionId));
  });
  Object.entries(recordings).forEach(([questionId, rec]) => { if (rec?.blob) ids.add(Number(questionId)); });
  return ids;
};

function StrictAudioPlayer({ src, audioKey, state, updateState, registerAudio }: {
  src: string;
  audioKey: string;
  state: AudioState;
  updateState: (key: string, patch: Partial<AudioState>) => void;
  registerAudio: (key: string, el: HTMLAudioElement | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    registerAudio(audioKey, el);
    if (state.currentTime > 0 && Math.abs(el.currentTime - state.currentTime) > 0.5) el.currentTime = state.currentTime;
    return () => registerAudio(audioKey, null);
  }, [audioKey, registerAudio]);

  const play = async () => {
    const el = audioRef.current;
    if (!el || state.ended) return;
    try {
      if (state.currentTime > 0 && Math.abs(el.currentTime - state.currentTime) > 0.5) el.currentTime = state.currentTime;
      await el.play();
      updateState(audioKey, { playing: true, hasStarted: true });
    } catch {
      toast.error('Trình duyệt chưa cho phép phát audio. Hãy bấm lại nút phát.');
    }
  };

  const progress = state.duration ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
  const buttonText = state.ended ? 'Đã nghe xong' : state.playing ? 'Đang phát...' : state.hasStarted ? 'Tiếp tục nghe' : 'Phát audio';

  return (
    <div className="exam-strict-audio">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        controls={false}
        onLoadedMetadata={e => updateState(audioKey, { duration: e.currentTarget.duration || 0 })}
        onTimeUpdate={e => updateState(audioKey, { currentTime: e.currentTarget.currentTime || 0, duration: e.currentTarget.duration || state.duration })}
        onPause={e => updateState(audioKey, { playing: false, currentTime: e.currentTarget.currentTime || 0 })}
        onEnded={e => updateState(audioKey, { playing: false, ended: true, currentTime: e.currentTarget.duration || state.currentTime, duration: e.currentTarget.duration || state.duration })}
      />
      <button type="button" className="btn btn-primary btn-sm" onClick={play} disabled={state.playing || state.ended}>
        <Play size={13} /> {buttonText}
      </button>
      <div className="exam-audio-bar" aria-label="audio progress"><span style={{ width: `${progress}%` }} /></div>
      <b>{formatSeconds(state.currentTime)} / {formatSeconds(state.duration)}</b>
      <span className="exam-audio-note">Thi thử: không dừng/tua. Chuyển part sẽ dừng tại giây hiện tại.</span>
    </div>
  );
}

export default function StudentMockExamTakePage({ mode = 'mock' }: { mode?: PageMode }) {
  const { tenantSlug, id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const targetSlug = tenantSlug || user?.tenant_slug || 'english-ocean';

  const goToMockExamsList = () => {
    navigate(`/${targetSlug}/student/mock-exams`, { replace: true });
  };

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [recordings, setRecordings] = useState<Record<number, RecordingState>>({});
  const [audioStates, setAudioStates] = useState<Record<string, AudioState>>({});
  const [started, setStarted] = useState(mode === 'practice');
  const [preflightStatus, setPreflightStatus] = useState<PreflightStatus>('avatar');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeSectionKey, setActiveSectionKey] = useState('');
  const [unlockedSkillIndex, setUnlockedSkillIndex] = useState(0);
  const [skillRemainingSeconds, setSkillRemainingSeconds] = useState<number | null>(null);
  const [speakingIntroSeconds, setSpeakingIntroSeconds] = useState<number | null>(null);
  const [speakingFlow, setSpeakingFlow] = useState<SpeakingFlowState | null>(null);
  const [autoSpeakingAudioKeys, setAutoSpeakingAudioKeys] = useState<Record<string, boolean>>({});
  const [micTest, setMicTest] = useState<RecordingState>({ status: 'idle' });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingQuestionRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingIntroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingFlowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingsRef = useRef<Record<number, RecordingState>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSaveRef = useRef('');
  const submittedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await mockExamsApi.getById(Number(id));
        if (mounted) setExam(res.data);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Không tải được kỳ thi');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => { recordingsRef.current = recordings; }, [recordings]);
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (examTimerRef.current) clearInterval(examTimerRef.current);
      if (speakingIntroTimerRef.current) clearInterval(speakingIntroTimerRef.current);
      if (speakingFlowTimerRef.current) clearInterval(speakingFlowTimerRef.current);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      Object.values(audioRefs.current).forEach(el => el.pause());
      Object.values(recordingsRef.current).forEach(item => { if (item.url) URL.revokeObjectURL(item.url); });
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      if (micTest.url) URL.revokeObjectURL(micTest.url);
    };
  }, []);

  const questions = useMemo(() => exam?.questions || [], [exam]);
  const studentRow = useMemo(() => exam?.students?.[0], [exam]);
  const isVstep = isVstepFormat(exam);
  // #12: Read oneWayNavigation from exam settings instead of hard-coding VSTEP
  const examSettings = useMemo(() => {
    const raw = exam?.exam_set_settings || exam?.settings || {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw || {};
  }, [exam]);
  const isOneWay = examSettings.oneWayNavigation === true;
  const answerableQuestions = useMemo(() => getAnswerableQuestions(questions, isVstep), [questions, isVstep]);
  const canSubmit = mode === 'mock' && exam?.status === 'active' && studentRow && !['submitted','graded'].includes(studentRow.status);
  const isPractice = mode === 'practice';

  useEffect(() => {
    if (!studentRow?.answers?.length) return;
    const restored: Record<number, any> = {};
    studentRow.answers.forEach((a: any) => {
      restored[Number(a.question_id || a.questionId)] = {
        questionId: Number(a.question_id || a.questionId),
        selectedOptionId: a.selected_option_id || a.selectedOptionId || null,
        answerText: a.answer_text || a.answerText || '',
        recordingUrl: a.recording_url || a.recordingUrl || '',
        durationSeconds: a.duration_seconds || a.durationSeconds || null,
        wordCount: a.word_count || a.wordCount || null,
        charCount: a.char_count || a.charCount || null,
      };
    });
    setAnswers(prev => ({ ...restored, ...prev }));
  }, [studentRow?.latest_attempt_id]);


  const sections = useMemo(() => {
    const map = new Map<string, any>();
    questions.forEach((q: any) => {
      const key = getSectionKey(q);
      if (!map.has(key)) map.set(key, { key, skill: q.skill || 'General', part: getPartLabel(q.part), questions: [] as any[] });
      map.get(key).questions.push(q);
    });
    return Array.from(map.values()).sort((a: any, b: any) => {
      const skillA = getSkillIndex(a.skill);
      const skillB = getSkillIndex(b.skill);
      if (skillA !== skillB) return (skillA < 0 ? 99 : skillA) - (skillB < 0 ? 99 : skillB);
      const partA = Number(String(a.part).match(/\d+/)?.[0] || 0);
      const partB = Number(String(b.part).match(/\d+/)?.[0] || 0);
      return partA - partB;
    });
  }, [questions]);

  useEffect(() => {
    if (!activeSectionKey && sections.length) setActiveSectionKey(sections[0].key);
  }, [sections, activeSectionKey]);

  const activeSection = sections.find((s: any) => s.key === activeSectionKey) || sections[0];
  const activeSkill = activeSection?.skill || '';
  const activeSkillIndex = getSkillIndex(activeSkill);
  const isVstepListeningSection = isVstep && activeSkill === 'Listening';
  const usePartLevelListeningAudio = isVstepListeningSection;
  const activeSectionAudioUrl = usePartLevelListeningAudio ? getSectionAudioUrl(activeSection) : '';
  const activeSectionAudioKey = usePartLevelListeningAudio ? getSectionAudioKey(exam, activeSection) : '';
  const activeSectionAudioState = audioStates[activeSectionAudioKey] || { currentTime: 0, duration: 0, ended: false, playing: false, hasStarted: false };
  const isSpeakingSection = isVstep && activeSkill === 'Speaking';
  const activeSpeakingQuestion = isSpeakingSection ? activeSection?.questions?.[0] : null;
  const activeSpeakingAudioUrl = isSpeakingSection ? getSectionAudioUrl(activeSection) : '';
  const activeSpeakingAudioKey = isSpeakingSection ? getSpeakingAudioKey(exam, activeSection) : '';
  const activeSpeakingTiming = isSpeakingSection ? getSpeakingTiming(activeSection) : { prepSeconds: 0, responseSeconds: 0 };
  const answeredIds = useMemo(() => getAnsweredQuestionIds(answers, recordings), [answers, recordings]);
  // #18: answeredCount uses answerableQuestions as both numerator and denominator for consistency
  const answeredCount = answerableQuestions.filter((q: any) => answeredIds.has(Number(q.id))).length;
  const sampleAudioUrl = useMemo(() => {
    const listeningSection = sections.find((s: any) => s.skill === 'Listening');
    return getSectionAudioUrl(listeningSection) || questions.map(getQuestionAudioUrl).find(Boolean) || '';
  }, [sections, questions]);

  const getSkillSeconds = (skill: string) => {
    if (isVstep) {
      // Ưu tiên lấy từ exam settings (server), fallback về default nếu không có
      const examSettings = exam?.exam_set_settings || exam?.settings || {};
      const skillKey = `${skill.toLowerCase()}Seconds`;
      if (examSettings[skillKey]) return Number(examSettings[skillKey]);
      // Fallback: tính từ duration_minutes nếu không phải VSTEP chuẩn
      return VSTEP_DEFAULT_SKILL_SECONDS[skill] || Math.max(1, Number(exam?.duration_minutes || 0) * 60);
    }
    return Math.max(1, Number(exam?.duration_minutes || 0) * 60);
  };

  const pauseAllAudio = () => {
    Object.entries(audioRefs.current).forEach(([key, el]) => {
      if (!el.paused) {
        updateAudioState(key, { currentTime: el.currentTime || 0, duration: el.duration || 0, playing: false });
        el.pause();
      }
    });
  };
  const registerAudio = (key: string, el: HTMLAudioElement | null) => {
    if (el) audioRefs.current[key] = el;
    else delete audioRefs.current[key];
  };
  const updateAudioState = (key: string, patch: Partial<AudioState>) => {
    const defaultAudioState: AudioState = { currentTime: 0, duration: 0, ended: false, playing: false, hasStarted: false };
    setAudioStates(prev => ({ ...prev, [key]: { ...defaultAudioState, ...(prev[key] || {}), ...patch } }));
  };

  const findFirstSectionBySkillIndex = (index: number) => sections.find((s: any) => getSkillIndex(s.skill) === index);
  const getUnansweredInSkill = (skill: string) => answerableQuestions.filter((q: any) => q.skill === skill && !answeredIds.has(Number(q.id))).length;
  const goToSkillIndex = (targetIndex: number) => {
    const section = findFirstSectionBySkillIndex(targetIndex);
    if (!section) return false;
    pauseAllAudio();
    setUnlockedSkillIndex(Math.max(unlockedSkillIndex, targetIndex));
    setActiveSectionKey(section.key);
    setSkillRemainingSeconds(getSkillSeconds(section.skill));
    if (section.skill === 'Speaking' && mode === 'mock' && isOneWay) setSpeakingIntroSeconds(60);
    return true;
  };

  const switchSection = (key: string) => {
    let target = sections.find((s: any) => s.key === key);
    if (!target) return;
    if (isOneWay && activeSkill === 'Speaking' && target.skill === 'Speaking' && target.key !== activeSectionKey) {
      toast.error('Phần Speaking tự động chuyển câu khi hết thời gian. Bạn không thể bấm chuyển Part thủ công.');
      return;
    }
    if (isOneWay && target.skill === 'Speaking' && activeSkill !== 'Speaking') {
      target = sections.find((s: any) => s.skill === 'Speaking') || target;
    }
    const targetSkillIndex = getSkillIndex(target.skill);
    if (isPractice || targetSkillIndex === activeSkillIndex) {
      pauseAllAudio();
      setActiveSectionKey(target.key);
      return;
    }
    if (isOneWay) {
      if (targetSkillIndex < unlockedSkillIndex) {
        toast.error('Bạn đã chuyển sang kỹ năng mới nên không thể quay lại kỹ năng trước đó.');
        return;
      }
      if (targetSkillIndex > unlockedSkillIndex + 1) {
        toast.error('Bài thi cần làm theo thứ tự tuần tự giữa các kỹ năng.');
        return;
      }
      const missing = getUnansweredInSkill(activeSkill);
      const warning = missing > 0 ? `\n\nBạn còn ${missing} câu trong kỹ năng ${activeSkill} chưa trả lời.` : '';
      const ok = window.confirm(`Bạn có chắc chắn muốn chuyển sang kỹ năng ${target.skill}?${warning}\n\nSau khi chuyển kỹ năng, bạn không thể quay lại kỹ năng trước đó.`);
      if (!ok) return;
      pauseAllAudio();
      setUnlockedSkillIndex(targetSkillIndex);
      setActiveSectionKey(target.key);
      setSkillRemainingSeconds(getSkillSeconds(target.skill));
      if (target.skill === 'Speaking') setSpeakingIntroSeconds(60);
      return;
    }
    pauseAllAudio();
    setActiveSectionKey(target.key);
  };

  const startExam = async () => {
    if (mode !== 'mock') return;
    if (!canSubmit) return toast.error('Kỳ thi chưa mở hoặc bạn không thể làm bài');
    let serverRemaining: number | null = null;
    try {
      if (studentRow?.id) {
        const res = await mockExamsApi.start(studentRow.id);
        serverRemaining = typeof res.data?.remaining_seconds === 'number' ? res.data.remaining_seconds : null;
      }
    } catch (err: any) {
      return toast.error(err.response?.data?.message || 'Không thể bắt đầu bài thi');
    }
    submittedRef.current = false;
    setStarted(true);
    setUnlockedSkillIndex(0);
    const first = sections[0];
    if (first) {
      setActiveSectionKey(first.key);
      const firstSkillTime = getSkillSeconds(first.skill);
      const initialRemaining = isVstep
        ? (serverRemaining !== null ? Math.min(serverRemaining, firstSkillTime) : firstSkillTime)
        : (serverRemaining !== null ? serverRemaining : firstSkillTime);
      setSkillRemainingSeconds(initialRemaining);
    }
  };

  useEffect(() => {
    if (mode !== 'mock' || !started || skillRemainingSeconds === null) return;
    if (examTimerRef.current) clearInterval(examTimerRef.current);
    examTimerRef.current = setInterval(() => {
      setSkillRemainingSeconds(prev => {
        if (prev === null) return prev;
        if (prev <= 1) {
          if (examTimerRef.current) clearInterval(examTimerRef.current);
          const nextIndex = unlockedSkillIndex + 1;
          const hasNext = !!findFirstSectionBySkillIndex(nextIndex);
          if (hasNext) {
            setTimeout(() => {
              toast.error(`Đã hết thời gian ${activeSkill}. Hệ thống chuyển sang kỹ năng tiếp theo.`);
              goToSkillIndex(nextIndex);
            }, 0);
          } else {
            toast.error('Đã hết thời gian làm bài. Hãy nộp bài.');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (examTimerRef.current) clearInterval(examTimerRef.current); };
  }, [started, mode, activeSkill, unlockedSkillIndex, sections.length]);

  useEffect(() => {
    if (speakingIntroSeconds === null) return;
    if (speakingIntroTimerRef.current) clearInterval(speakingIntroTimerRef.current);
    speakingIntroTimerRef.current = setInterval(() => {
      setSpeakingIntroSeconds(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (speakingIntroTimerRef.current) clearInterval(speakingIntroTimerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (speakingIntroTimerRef.current) clearInterval(speakingIntroTimerRef.current); };
  }, [speakingIntroSeconds !== null]);


  const getNextSpeakingSection = (sectionKey: string) => {
    const speakingSections = sections.filter((s: any) => s.skill === 'Speaking');
    const currentIndex = speakingSections.findIndex((s: any) => s.key === sectionKey);
    return currentIndex >= 0 ? speakingSections[currentIndex + 1] : null;
  };

  const finishSpeakingSection = (sectionKey: string) => {
    const next = getNextSpeakingSection(sectionKey);
    if (next) {
      pauseAllAudio();
      setActiveSectionKey(next.key);
      toast.success(`${next.part}: hệ thống chuyển câu hỏi mới và bắt đầu 60 giây chuẩn bị.`);
    } else {
      pauseAllAudio();
      toast.success('Đã hoàn thành phần Speaking. Bạn có thể nộp bài.');
    }
  };

  const playAutoSpeakingAudio = async (audioKey: string) => {
    const el = audioRefs.current[audioKey];
    if (!el) return;
    try {
      await el.play();
      updateAudioState(audioKey, { playing: true, hasStarted: true });
    } catch {
      toast.error('Trình duyệt chưa cho tự động phát audio. Bạn có thể bấm Play để nghe câu hỏi.');
    }
  };

  useEffect(() => {
    if (!isSpeakingSection || isPractice || speakingIntroSeconds !== null || !activeSection?.key) return;
    const timing = getSpeakingTiming(activeSection);
    const phase = timing.prepSeconds > 0 ? 'prep' : 'recording';
    const total = timing.prepSeconds > 0 ? timing.prepSeconds : timing.responseSeconds;
    setSpeakingFlow({ sectionKey: activeSection.key, phase, remaining: total, total, autoStarted: false });
    if (activeSpeakingAudioKey) {
      setAutoSpeakingAudioKeys(prev => ({ ...prev, [activeSpeakingAudioKey]: true }));
      setTimeout(() => playAutoSpeakingAudio(activeSpeakingAudioKey), 250);
    }
  }, [activeSectionKey, isSpeakingSection, isPractice, speakingIntroSeconds]);

  useEffect(() => {
    if (!speakingFlow || !isSpeakingSection || isPractice || speakingIntroSeconds !== null) return;
    if (speakingFlowTimerRef.current) clearInterval(speakingFlowTimerRef.current);
    speakingFlowTimerRef.current = setInterval(() => {
      setSpeakingFlow(prev => {
        if (!prev) return prev;
        if (prev.remaining <= 1) {
          if (prev.phase === 'prep') {
            return { sectionKey: prev.sectionKey, phase: 'recording', remaining: activeSpeakingTiming.responseSeconds, total: activeSpeakingTiming.responseSeconds, autoStarted: false };
          }
          if (prev.phase === 'recording') {
            setTimeout(() => {
              if (recordingQuestionRef.current) stopRecording();
              finishSpeakingSection(prev.sectionKey);
            }, 0);
            return { ...prev, phase: 'done', remaining: 0, autoStarted: true };
          }
          return prev;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => { if (speakingFlowTimerRef.current) clearInterval(speakingFlowTimerRef.current); };
  }, [speakingFlow?.sectionKey, speakingFlow?.phase, isSpeakingSection, isPractice, speakingIntroSeconds, activeSpeakingTiming.responseSeconds]);

  useEffect(() => {
    if (!speakingFlow || speakingFlow.phase !== 'recording' || speakingFlow.autoStarted || !activeSpeakingQuestion?.id || isPractice || speakingIntroSeconds !== null) return;
    setSpeakingFlow(prev => prev ? { ...prev, autoStarted: true } : prev);
    setTimeout(() => startRecording(activeSpeakingQuestion.id), 150);
  }, [speakingFlow?.sectionKey, speakingFlow?.phase, speakingFlow?.autoStarted, activeSpeakingQuestion?.id, isPractice, speakingIntroSeconds]);

  const setSelectedOption = (questionId: number, selectedOptionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), questionId, selectedOptionId } }));
  };
  const setTextAnswer = (questionId: number, answerText: string) => {
    const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), questionId, answerText, wordCount, charCount: answerText.length } }));
  };
  const stopCurrentStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const startMicTest = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Trình duyệt không hỗ trợ ghi âm');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (micTest.url) URL.revokeObjectURL(micTest.url);
        setMicTest({ status: 'ready', blob, url: URL.createObjectURL(blob), durationSeconds });
        recorderRef.current = null;
        stopCurrentStream();
      };
      recorder.start();
      setMicTest({ status: 'recording', durationSeconds: 0 });
    } catch (err: any) {
      toast.error('Không thể mở microphone. Vui lòng cấp quyền micro cho trình duyệt.');
      setMicTest({ status: 'idle', error: err?.message || 'Microphone error' });
      stopCurrentStream();
    }
  };
  const stopMicTest = () => { if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); };

  const startRecording = async (questionId: number) => {
    if ((!canSubmit && !isPractice) || submitting) return;
    if (recordingQuestionRef.current && recordingQuestionRef.current !== questionId) {
      toast.error('Bạn đang ghi âm câu khác. Hãy dừng ghi âm trước.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge và cho phép microphone.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      recordingQuestionRef.current = questionId;
      recordingStartedAtRef.current = Date.now();
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const oldUrl = recordingsRef.current[questionId]?.url;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        const url = URL.createObjectURL(blob);
        setRecordings(prev => ({ ...prev, [questionId]: { status: 'ready', blob, url, durationSeconds } }));
        setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), questionId, durationSeconds, metadata: { ...(prev[questionId]?.metadata || {}), answerType: 'audio', mimeType: blob.type } } }));
        recordingQuestionRef.current = null;
        recorderRef.current = null;
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        stopCurrentStream();
      };
      recorder.start();
      toast.success('Bắt đầu ghi âm. Bạn hãy nói rõ ràng vào micro.');
      setRecordings(prev => ({ ...prev, [questionId]: { status: 'recording', durationSeconds: 0 } }));
      recordingTimerRef.current = setInterval(() => {
        const seconds = Math.max(0, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        setRecordings(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || { status: 'recording' }), status: 'recording', durationSeconds: seconds } }));
      }, 500);
    } catch (err: any) {
      stopCurrentStream();
      recordingQuestionRef.current = null;
      toast.error('Không thể mở microphone. Vui lòng cấp quyền ghi âm cho trình duyệt.');
      setRecordings(prev => ({ ...prev, [questionId]: { status: 'idle', error: err?.message || 'Microphone error' } }));
    }
  };
  const stopRecording = () => { if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); };
  const resetRecording = (questionId: number) => {
    const oldUrl = recordings[questionId]?.url;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    setRecordings(prev => { const next = { ...prev }; delete next[questionId]; return next; });
    setAnswers(prev => { const next = { ...prev }; delete next[questionId]; return next; });
  };

  useEffect(() => {
    if (mode !== 'mock' || !started || !studentRow?.id || submitting) return;
    const savable = Object.values(answers).filter((a: any) => a?.questionId && (a.selectedOptionId || a.answerText));
    const signature = JSON.stringify(savable.map((a: any) => ({ q: a.questionId, o: a.selectedOptionId || null, t: a.answerText || '', wc: a.wordCount || 0 })));
    if (!savable.length || signature === lastAutoSaveRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const latest = Object.values(answers).filter((a: any) => a?.questionId && (a.selectedOptionId || a.answerText));
        if (!latest.length) return;
        await mockExamsApi.saveAnswers(studentRow.id, latest as object[]);
        lastAutoSaveRef.current = JSON.stringify(latest.map((a: any) => ({ q: a.questionId, o: a.selectedOptionId || null, t: a.answerText || '', wc: a.wordCount || 0 })));
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Tự động lưu đáp án chưa thành công');
      }
    }, 700);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [answers, mode, started, studentRow?.id, submitting]);

  const handleExit = () => {
    pauseAllAudio();
    if (window.confirm('Bạn có chắc muốn rời khỏi bài thi? Bài làm hiện tại đã được tự động lưu tạm.')) {
      goToMockExamsList();
    }
  };

  const buildPayload = async () => {
    if (!studentRow?.id) throw new Error('Không tìm thấy phiếu thi của bạn');
    const payload: any[] = [];
    const speakingQuestions = isVstep
      ? questions.filter((q: any) => isSpeakingQuestion(q) && isPrimarySpeakingQuestion(q, questions))
      : questions.filter((q: any) => isSpeakingQuestion(q));
    for (const q of speakingQuestions) {
      const rec = recordings[q.id];
      if (!rec?.blob) continue;
      setRecordings(prev => ({ ...prev, [q.id]: { ...prev[q.id], status: 'uploading' } }));
      const res = await mockExamsApi.uploadRecording(studentRow.id, rec.blob);
      payload.push({
        questionId: q.id,
        recordingUrl: res.data.url,
        durationSeconds: rec.durationSeconds || answers[q.id]?.durationSeconds || 0,
        metadata: { ...(answers[q.id]?.metadata || {}), answerType: 'audio', mimeType: rec.blob.type, originalName: res.data.originalName },
      });
      setRecordings(prev => ({ ...prev, [q.id]: { ...prev[q.id], status: 'ready' } }));
    }
    Object.values(answers).forEach((a: any) => {
      if (!a?.questionId) return;
      const question = questions.find((q: any) => q.id === a.questionId);
      if (question && isSpeakingQuestion(question)) return;
      payload.push(a);
    });
    return payload;
  };

  const submit = async () => {
    if (!studentRow?.id) return toast.error('Không tìm thấy phiếu thi của bạn');
    if (!canSubmit) return toast.error('Kỳ thi chưa mở hoặc bạn không thể nộp bài');
    if (recordingQuestionRef.current) return toast.error('Bạn đang ghi âm. Hãy dừng ghi âm trước khi nộp bài.');
    const missing = answerableQuestions.filter((q: any) => !answeredIds.has(Number(q.id))).length;
    const okMissing = missing ? window.confirm(`Bạn còn ${missing} câu/bài chưa hoàn thành. Bạn vẫn muốn nộp bài?`) : true;
    if (!okMissing) return;
    const ok = window.confirm('Bạn chắc chắn muốn nộp bài? Sau khi nộp, hệ thống sẽ ghi nhận lần làm bài này.');
    if (!ok) return;
    pauseAllAudio();
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      if (!payload.length) {
        toast.error('Bạn chưa chọn/nhập/ghi âm câu trả lời nào');
        return;
      }
      await mockExamsApi.submit(studentRow.id, payload);
      submittedRef.current = true;
      setJustSubmitted(true);
      toast.success('Nộp bài thi thành công!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không nộp được bài');
    } finally {
      setSubmitting(false);
    }
  };


  const renderSpeakingFlow = () => {
    const q = activeSpeakingQuestion;
    if (!q) return <EmptyState message="Chưa có câu hỏi Speaking" />;
    const partNo = getSpeakingPartNo(activeSection);
    const rec = recordings[q.id] || { status: 'idle' as const };
    const audioState = audioStates[activeSpeakingAudioKey] || { currentTime: 0, duration: 0, ended: false, playing: false, hasStarted: false };
    const phase = speakingFlow?.phase || (activeSpeakingTiming.prepSeconds > 0 ? 'prep' : 'recording');
    const groupContent = getGroupContent(q);
    const questionTexts = activeSection.questions.map((item: any) => item.question_text || item.topic).filter(Boolean);
    const phaseTitle = phase === 'prep' ? 'THỜI GIAN CHUẨN BỊ' : phase === 'recording' ? 'BÀI NÓI ĐANG ĐƯỢC THU ÂM TRỰC TIẾP' : 'ĐÃ HOÀN THÀNH CÂU HỎI';
    const phaseNote = phase === 'prep'
      ? 'Mic đang tắt. Audio câu hỏi có thể phát song song với thời gian chuẩn bị; bạn có thể bấm dừng/phát lại audio hướng dẫn.'
      : phase === 'recording'
        ? 'Vui lòng để ý sóng âm để điều chỉnh micro thu âm.'
        : 'Hệ thống sẽ tự chuyển sang câu hỏi tiếp theo hoặc bạn có thể nộp bài nếu đã hết Speaking.';

    return (
      <section className="speaking-flow-layout">
        <div className="speaking-task-panel">
          <h3>Question {partNo}: {activeSection.part.replace('Speaking ', '')}</h3>
          {activeSpeakingAudioUrl && (
            <div className="speaking-audio-card">
              <audio
                controls
                src={activeSpeakingAudioUrl}
                autoPlay={!!autoSpeakingAudioKeys[activeSpeakingAudioKey]}
                onLoadedMetadata={e => updateAudioState(activeSpeakingAudioKey, { duration: e.currentTarget.duration || 0 })}
                onPlay={e => updateAudioState(activeSpeakingAudioKey, { playing: true, hasStarted: true, duration: e.currentTarget.duration || audioState.duration })}
                onPause={e => updateAudioState(activeSpeakingAudioKey, { playing: false, currentTime: e.currentTarget.currentTime || 0 })}
                onTimeUpdate={e => updateAudioState(activeSpeakingAudioKey, { currentTime: e.currentTarget.currentTime || 0, duration: e.currentTarget.duration || audioState.duration })}
                onEnded={e => updateAudioState(activeSpeakingAudioKey, { playing: false, ended: true, currentTime: e.currentTarget.duration || audioState.currentTime })}
                ref={el => registerAudio(activeSpeakingAudioKey, el)}
              />
              <span>{formatSeconds(audioState.currentTime)} / {formatSeconds(audioState.duration)}</span>
            </div>
          )}
          <p className="speaking-note-red">* Vui lòng bấm Play nếu tệp âm thanh câu hỏi không tự động chạy. Bạn có thể dừng/phát audio câu hỏi trong thời gian chuẩn bị. *</p>
          {groupContent && <div className="speaking-content-block">{groupContent}</div>}
          {q.image_url && <img src={q.image_url} alt="speaking prompt" className="exam-question-image" />}
          <div className="speaking-question-list">
            {questionTexts.length ? questionTexts.map((text: string, index: number) => <p key={index}>{text}</p>) : <p>{q.question_text || 'Nội dung câu hỏi Speaking'}</p>}
          </div>
        </div>
        <aside className={`speaking-status-panel ${phase === 'recording' ? 'recording' : phase === 'prep' ? 'preparing' : 'done'}`}>
          <div className={`wave ${phase === 'recording' ? 'recording' : ''}`}><span /><span /><span /><span /><span /><span /><span /></div>
          <h2>{phaseTitle}</h2>
          <div className="speaking-big-timer">{formatSeconds(speakingFlow?.remaining ?? activeSpeakingTiming.responseSeconds)}</div>
          <p>{phaseNote}</p>
          <Badge variant={rec.status === 'recording' ? 'red' : rec.status === 'ready' ? 'green' : 'gray'}>
            {rec.status === 'recording' ? `Đang ghi âm ${formatSeconds(rec.durationSeconds)}` : rec.status === 'ready' ? `Đã ghi âm ${formatSeconds(rec.durationSeconds)}` : phase === 'prep' ? 'Mic đang tắt' : 'Chưa có bản ghi'}
          </Badge>
          {isPractice && <div className="exam-actions-row"><button className="btn btn-primary btn-sm" onClick={() => startRecording(q.id)}><Mic size={13}/> Bắt đầu ghi âm</button></div>}
          {rec.url && <audio controls src={rec.url} />}
        </aside>
      </section>
    );
  };

  const renderQuestion = (q: any, sectionIndex: number, hideGroup = false, suppressAudio = false) => {
    const globalIndex = questions.findIndex((item: any) => item.id === q.id) + 1;
    const options = q.options || [];
    const speaking = isSpeakingQuestion(q);
    const writing = isWritingQuestion(q);
    const rec = recordings[q.id] || { status: 'idle' as const };
    const audioUrl = getQuestionAudioUrl(q);
    const showQuestionAudio = audioUrl && !usePartLevelListeningAudio && !suppressAudio;
    const audioKey = getAudioKey(q);
    const audioState = audioStates[audioKey] || { currentTime: 0, duration: 0, ended: false, playing: false, hasStarted: false };
    const displayConfig = getMedia(q.display_config || q.displayConfig);
    const showOptionText = displayConfig.showOptionText !== false;
    const minWords = Number(q.min_words || q.minWords || 0);

    return (
      <section key={q.id} className="exam-question">
        <div className="exam-question-head">
          <Badge variant="gray">Question {globalIndex || sectionIndex + 1}</Badge>
          <Badge variant={q.skill === 'Listening' ? 'blue' : q.skill === 'Reading' ? 'green' : q.skill === 'Speaking' ? 'purple' : 'orange'}>{q.skill}</Badge>
          {speaking && q.prep_seconds ? <Badge variant="gray">Chuẩn bị {q.prep_seconds}s</Badge> : null}
          {speaking && q.response_seconds ? <Badge variant="blue">Trả lời {q.response_seconds}s</Badge> : null}
          {writing && minWords ? <Badge variant="orange">Tối thiểu {minWords} từ</Badge> : null}
        </div>
        {!hideGroup && getVisibleGroupContent(q) && <div className="exam-group-content">{getVisibleGroupContent(q)}</div>}
        {q.image_url && <img src={q.image_url} alt="question" className="exam-question-image" />}
        {showQuestionAudio && (isListeningQuestion(q) && !isPractice ? (
          <StrictAudioPlayer src={audioUrl} audioKey={audioKey} state={audioState} updateState={updateAudioState} registerAudio={registerAudio} />
        ) : (
          <div className="exam-normal-audio"><audio controls src={audioUrl} /></div>
        ))}
        <div className="exam-question-text">{q.question_text || q.topic || 'Chọn đáp án đúng'}</div>
        {speaking ? (
          <div className="exam-speaking-box">
            <div className="speaking-warning">Chỉ nói khi đã bấm <b>Bắt đầu ghi âm</b>. Hệ thống hiển thị dải âm thanh để bạn kiểm tra âm lượng.</div>
            <div className={`wave ${rec.status === 'recording' ? 'recording' : ''}`}><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="exam-actions-row">
              <Badge variant={rec.status === 'recording' ? 'red' : rec.status === 'ready' ? 'green' : 'gray'}>
                {rec.status === 'recording' ? `Đang ghi âm ${formatSeconds(rec.durationSeconds)}` : rec.status === 'uploading' ? 'Đang upload...' : rec.status === 'ready' ? `Đã ghi âm ${formatSeconds(rec.durationSeconds)}` : 'Chưa ghi âm'}
              </Badge>
              {rec.status !== 'recording' ? (
                <button className="btn btn-primary btn-sm" type="button" onClick={() => startRecording(q.id)} disabled={(!canSubmit && !isPractice) || submitting || rec.status === 'uploading'}>
                  <Mic size={13} /> {rec.status === 'ready' ? 'Ghi lại' : 'Bắt đầu ghi âm'}
                </button>
              ) : (
                <button className="btn btn-danger btn-sm" type="button" onClick={stopRecording}><Square size={13} /> Dừng ghi âm</button>
              )}
              {rec.status === 'ready' && <button className="btn btn-secondary btn-sm" type="button" onClick={() => resetRecording(q.id)} disabled={submitting}><RotateCcw size={13} /> Xoá bản ghi</button>}
            </div>
            {rec.url && <div className="exam-normal-audio"><audio controls src={rec.url} /></div>}
            {rec.error && <div className="text-danger-small">{rec.error}</div>}
          </div>
        ) : writing ? (
          <div className="exam-writing-wrap">
            <textarea className="form-textarea" rows={12} placeholder="Nhập bài viết của bạn..." value={answers[q.id]?.answerText || ''} onChange={e => setTextAnswer(q.id, e.target.value)} disabled={(!canSubmit && !isPractice) || submitting} />
            <div className="word-count">Word count: {answers[q.id]?.wordCount || 0}{minWords ? ` / tối thiểu ${minWords}` : ''}</div>
          </div>
        ) : (
          <div className="exam-options">
            {options.map((opt: any) => (
              <label key={opt.id} className="exam-option">
                <input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.selectedOptionId === opt.id} onChange={() => setSelectedOption(q.id, opt.id)} disabled={(!canSubmit && !isPractice) || submitting} />
                <span><b>{opt.optionLabel || opt.option_label}.</b>{showOptionText ? ` ${opt.optionText || opt.option_text}` : ''}</span>
              </label>
            ))}
          </div>
        )}
      </section>
    );
  };

  const hasGroupedQuestionSection = (section: any) => {
    if (!section || section.skill === 'Reading' || section.skill === 'Speaking') return false;
    if (isVstep && section.skill === 'Listening') return false;
    const counts = new Map<string, number>();
    (section.questions || []).forEach((q: any) => {
      const key = q.group_key || q.groupKey;
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.values()).some(count => count > 1);
  };

  const renderGroupedQuestions = (section: any) => {
    const groups = new Map<string, any[]>();
    (section.questions || []).forEach((q: any) => {
      const key = q.group_key || q.groupKey || `single-${q.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(q);
    });
    return Array.from(groups.entries()).map(([key, items], groupIndex) => {
      const first = items[0];
      const groupAudio = getQuestionAudioUrl(first);
      const audioKey = `group-${key}-${groupAudio}`;
      const audioState = audioStates[audioKey] || { currentTime: 0, duration: 0, ended: false, playing: false, hasStarted: false };
      const groupContent = getVisibleGroupContent(first);
      return (
        <section key={key} className="exam-question-group-card">
          <div className="exam-question-head"><Badge variant="gray">Nhóm {groupIndex + 1}</Badge><b>{first.part}</b></div>
          {groupContent && <div className="exam-group-content">{groupContent}</div>}
          {groupAudio && (isPractice ? <div className="exam-normal-audio"><audio controls src={groupAudio} /></div> : <StrictAudioPlayer src={groupAudio} audioKey={audioKey} state={audioState} updateState={updateAudioState} registerAudio={registerAudio} />)}
          {items.map((q: any, index: number) => renderQuestion(q, index, true, true))}
        </section>
      );
    });
  };

  if (loading) return <Loading />;
  if (!exam) return <EmptyState message="Không tìm thấy kỳ thi" />;

  const isAlreadySubmitted = studentRow && ['submitted', 'graded'].includes(studentRow.status);
  const isFinished = isAlreadySubmitted || justSubmitted;

  if (isFinished) {
    return (
      <div className="vstep-exam-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
        <style>{PAGE_STYLE}</style>
        <div style={{ maxWidth: 540, width: '100%', background: '#fff', borderRadius: 24, padding: '40px 32px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)', border: '1px solid #e2e8f0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={44} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Nộp bài thi thành công!</h2>
          <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            Hệ thống đã ghi nhận đầy đủ bài làm của bạn cho kỳ thi <b>{exam.title}</b>.
            {isVstep ? ' Phần trắc nghiệm (Nghe & Đọc) đã được chấm tự động. Phần Viết và Nói đang chờ giáo viên chấm điểm.' : ' Toàn bộ bài làm trắc nghiệm đã được ghi nhận.'}
          </p>

          <div style={{ background: '#f1f5f9', borderRadius: 16, padding: '16px 20px', marginBottom: 28, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Trạng thái</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                {studentRow?.status === 'graded' ? 'Đã chấm điểm' : 'Đã nộp bài'}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1' }} />
            <div>
              <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Câu đã làm</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {answeredCount}/{answerableQuestions.length}
              </div>
            </div>
            {studentRow?.objective_score !== undefined && studentRow?.objective_score !== null && (
              <>
                <div style={{ borderLeft: '1px solid #cbd5e1' }} />
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Điểm trắc nghiệm</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                    {studentRow.objective_score}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 20px', fontSize: 15, justifyContent: 'center' }}
              onClick={goToMockExamsList}
            >
              Xem danh sách kỳ thi & kết quả
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px 20px', fontSize: 15, justifyContent: 'center' }}
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  goToMockExamsList();
                }
              }}
            >
              Đóng cửa sổ bài thi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'mock' && !started) {
    return (
      <div className="vstep-exam-page">
        <style>{PAGE_STYLE}</style>
        <div className="exam-start-card preflight-card">
          <button className="btn btn-secondary btn-sm" onClick={goToMockExamsList}><ArrowLeft size={12} /> Quay lại</button>
          <h1>{exam.title}</h1>
          <p>{exam.exam_set_title} • VSTEP: Nghe → Đọc → Viết → Nói</p>
          <div className="preflight-steps">
            <button className={`preflight-step ${preflightStatus === 'avatar' ? 'active' : ''}`} onClick={() => setPreflightStatus('avatar')}>1. Kiểm tra camera</button>
            <button className={`preflight-step ${preflightStatus === 'sound' ? 'active' : ''}`} onClick={() => setPreflightStatus('sound')}>2. Kiểm tra âm thanh</button>
            <button className={`preflight-step ${preflightStatus === 'ready' ? 'active' : ''}`} onClick={() => setPreflightStatus('ready')}>3. Nhận đề</button>
          </div>
          {preflightStatus === 'avatar' && (
            <div className="preflight-panel">
              <Camera size={42} />
              {/* #17: Renamed from 'Chụp ảnh xác nhận danh tính' to 'Kiểm tra camera' — avatar is not uploaded to server */}
              <h2>Kiểm tra camera</h2>
              <p>Bấm chụp ảnh để kiểm tra camera hoạt động tốt trước khi vào thi. Ảnh không được lưu lên hệ thống.</p>
              <input type="file" accept="image/*" capture="user" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (avatarUrl) URL.revokeObjectURL(avatarUrl);
                setAvatarUrl(URL.createObjectURL(file));
              }} />
              {avatarUrl && <img src={avatarUrl} alt="camera-preview" className="avatar-preview" />}
              <button className="btn btn-primary" onClick={() => setPreflightStatus('sound')} disabled={!avatarUrl}>Tiếp tục kiểm tra âm thanh</button>
            </div>
          )}
          {preflightStatus === 'sound' && (
            <div className="preflight-panel">
              <Headphones size={42} />
              <h2>Kiểm tra tai nghe và microphone</h2>
              <p>Nghe audio mẫu, sau đó nói to rõ vào micro và nghe lại bản thu.</p>
              {sampleAudioUrl ? <audio controls src={sampleAudioUrl} /> : <div className="alert alert-warning">Chưa có audio mẫu trong bộ đề.</div>}
              <div className="mic-test-box">
                {micTest.status !== 'recording' ? <button className="btn btn-primary" onClick={startMicTest}><Mic size={14} /> Thu âm test micro</button> : <button className="btn btn-danger" onClick={stopMicTest}><Square size={14} /> Dừng thu</button>}
                {micTest.url && <audio controls src={micTest.url} />}
              </div>
              <button className="btn btn-primary" onClick={() => setPreflightStatus('ready')} disabled={!micTest.url}>Tôi đã nghe lại và micro ổn định</button>
            </div>
          )}
          {preflightStatus === 'ready' && (
            <div className="preflight-panel">
              <CheckCircle2 size={42} />
              <h2>Sẵn sàng nhận đề</h2>
              <div className="exam-start-grid">
                <div><b>Listening</b><span>3 part, mỗi part 1 audio. Được đọc câu hỏi trước rồi tự bấm Play. Không dừng/tua trong thi thử.</span></div>
                <div><b>Reading</b><span>4 part, mỗi part 1 bài đọc và 10 câu. Được chuyển qua lại giữa các part Reading.</span></div>
                <div><b>Writing & Speaking</b><span>Writing có đếm từ. Speaking có 60 giây kiểm tra/chuẩn bị trước khi ghi âm.</span></div>
              </div>
              {exam.status !== 'active' && <div className="alert alert-warning">Kỳ thi chưa ở trạng thái đang mở.</div>}
              <button className="btn btn-primary" onClick={startExam} disabled={!canSubmit}><Play size={15} /> Nhận đề</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isReadingSplit = isVstep && activeSkill === 'Reading';
  const readingPassage = isReadingSplit ? getGroupContent(activeSection?.questions?.[0] || {}) : '';

  return (
    <div className="vstep-exam-page">
      <style>{PAGE_STYLE}</style>
      <div className="exam-topbar">
        <div className="exam-top-left">
          <button className="btn btn-secondary btn-sm" onClick={handleExit}><ArrowLeft size={12} /> {isPractice ? 'Thoát luyện thi' : 'Thoát'}</button>
          <b>{studentRow?.full_name || 'Học viên'}</b>
        </div>
        <div className="exam-timer">{isPractice ? 'Luyện thi' : isSpeakingSection && speakingFlow ? formatSeconds(speakingFlow.remaining) : formatSeconds(skillRemainingSeconds ?? getSkillSeconds(activeSkill))}</div>
        <div className="exam-top-right">
          {/* #18: answeredCount/answerableQuestions.length for correct denominator */}
          <span>Đã trả lời: {answeredCount}/{answerableQuestions.length}</span>
          {!isPractice && <button className="btn btn-primary" onClick={submit} disabled={!canSubmit || submitting}><Send size={14} /> {submitting ? 'Đang nộp...' : 'Nộp bài'}</button>}
        </div>
      </div>

      {exam.status !== 'active' && !isPractice && <div className="alert alert-warning exam-alert">Kỳ thi chưa ở trạng thái đang mở, bạn chỉ có thể xem thông tin.</div>}

      <main className="exam-shell">
        {!activeSection ? <EmptyState message="Bộ đề chưa có câu hỏi" /> : (
          <>
            <div className="exam-section-title">
              <Badge variant={activeSkill === 'Listening' ? 'blue' : activeSkill === 'Reading' ? 'green' : activeSkill === 'Speaking' ? 'purple' : 'orange'}>{activeSkill}</Badge>
              <h2>{activeSection.part}</h2>
              <span>{activeSection.questions.length} câu</span>
              {isPractice && <Badge variant="green"><Save size={12} /> Luyện thi: audio phát thủ công, nghe lại nhiều lần</Badge>}
            </div>

            {activeSkill === 'Reading' && !isPractice && <div className="alert alert-info">Reading có 4 Part. Bạn được chuyển qua lại tự do trong Reading. Khi chuyển sang Writing, hệ thống sẽ cảnh báo nếu còn câu chưa trả lời.</div>}

            {isVstepListeningSection ? (
              <div className="vstep-listening-paper">
                <div className="vstep-listening-instruction">{getVstepListeningIntro(activeSection)}</div>
                {activeSectionAudioUrl ? (isPractice ? (
                  <div className="exam-part-audio vstep-listening-audio"><audio controls src={activeSectionAudioUrl} /></div>
                ) : (
                  <div className="exam-part-audio vstep-listening-audio"><StrictAudioPlayer src={activeSectionAudioUrl} audioKey={activeSectionAudioKey} state={activeSectionAudioState} updateState={updateAudioState} registerAudio={registerAudio} /></div>
                )) : <div className="alert alert-warning">Part này chưa có audio chung. Vui lòng upload audio trong form quản lý câu hỏi.</div>}
                {!isPractice && <p className="vstep-listening-note">*Nhấn Play để bắt đầu bài nghe. Khi đã bắt đầu, không thể tạm dừng. Thí sinh chỉ được nghe một lần.</p>}
                <div className="vstep-listening-questions">
                  {activeSection.questions.map((q: any, index: number) => renderQuestion(q, index, true, true))}
                </div>
              </div>
            ) : activeSkill === 'Speaking' && speakingIntroSeconds !== null && !isPractice ? (
              <div className="speaking-intro-card">
                <Mic size={48} />
                <h2>Kiểm tra âm thanh trước phần Speaking</h2>
                <p>Hệ thống sẽ hiển thị câu hỏi sau <b>{speakingIntroSeconds} giây</b>. Chỉ nói khi có thông báo bắt đầu ghi âm.</p>
                <div className="wave recording"><span /><span /><span /><span /><span /><span /><span /></div>
                <button className="btn btn-primary" onClick={() => setSpeakingIntroSeconds(null)}>Tôi đã sẵn sàng</button>
              </div>
            ) : isSpeakingSection && !isPractice ? (
              renderSpeakingFlow()
            ) : isReadingSplit ? (
              <div className="reading-split">
                <aside className="reading-passage">
                  <h3>{activeSection.part} - Bài đọc</h3>
                  <div>{readingPassage || 'Chưa có nội dung bài đọc cho part này.'}</div>
                </aside>
                <section className="reading-questions">
                  {activeSection.questions.map((q: any, index: number) => renderQuestion(q, index, true))}
                </section>
              </div>
            ) : hasGroupedQuestionSection(activeSection) ? (
              renderGroupedQuestions(activeSection)
            ) : (
              activeSection.questions.map((q: any, index: number) => renderQuestion(q, index))
            )}
          </>
        )}
      </main>

      <nav className="exam-bottom-nav">
        {SKILL_ORDER.map(skill => {
          const skillSections = sections.filter((s: any) => s.skill === skill);
          if (!skillSections.length) return null;
          const skillIndex = getSkillIndex(skill);
          const disabledSkill = mode === 'mock' && isVstep && skillIndex < unlockedSkillIndex;
          const futureSkill = mode === 'mock' && isVstep && skillIndex > unlockedSkillIndex + 1;
          return <div key={skill} className={`exam-skill-group ${disabledSkill ? 'locked' : ''}`}>
            {skillSections.map((section: any, sectionIndex: number) => {
              const speakingManualLocked = mode === 'mock' && isVstep && skill === 'Speaking' && (activeSkill === 'Speaking' ? section.key !== activeSectionKey : sectionIndex > 0);
              return <button
                key={section.key}
                type="button"
                className={`exam-part-btn ${section.key === activeSectionKey ? 'active' : ''}`}
                onClick={() => switchSection(section.key)}
                disabled={futureSkill || disabledSkill || speakingManualLocked}
                title={speakingManualLocked ? 'Speaking sẽ tự động chuyển Part khi hết thời gian' : undefined}
              >{section.part.replace(`${skill} `, '')}</button>;
            })}
            <span className="exam-skill-label">{skill} - {isVstep && VSTEP_DEFAULT_SKILL_SECONDS[skill] ? Math.round(VSTEP_DEFAULT_SKILL_SECONDS[skill] / 60) : skillSections.reduce((sum: number, s: any) => sum + s.questions.length, 0)}</span>
          </div>;
        })}
        {!isPractice && <button className="btn btn-primary" onClick={submit} disabled={!canSubmit || submitting}><Send size={14} /> Nộp bài</button>}
      </nav>
    </div>
  );
}

const PAGE_STYLE = `
.vstep-exam-page{min-height:calc(100vh - 40px);padding-bottom:82px;background:#f8fbff;color:#0f2440;}
.exam-topbar{position:sticky;top:0;z-index:20;background:#eef4fb;border-bottom:1px solid #e3edf8;padding:10px 18px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;}
.exam-top-left,.exam-top-right,.exam-actions-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}.exam-top-right{justify-self:end;}
.exam-timer{background:#2f80ed;color:#fff;font-weight:800;border-radius:7px;padding:7px 16px;font-size:18px;letter-spacing:1px;}
.exam-shell{max-width:1180px;margin:0 auto;padding:28px 18px;}
.vstep-listening-paper{max-width:960px;margin:0 auto 30px;}.vstep-listening-instruction{white-space:pre-wrap;line-height:1.55;font-style:italic;color:#10233f;margin-bottom:14px;}.vstep-listening-note{font-style:italic;color:#334155;margin:4px 0 14px;}.vstep-listening-questions .exam-question{padding:8px 0 12px;border-bottom:0;}.vstep-listening-questions .exam-question-head{display:none;}.vstep-listening-questions .exam-question-text{font-weight:800;margin:10px 0 6px;}.vstep-listening-questions .exam-options{gap:4px;}.vstep-listening-questions .exam-option{border:0;background:transparent;padding:3px 0;border-radius:0;}.vstep-listening-audio{border:0;background:transparent;padding:0;margin:12px 0 6px;max-width:900px;}.vstep-listening-audio .exam-audio-note{display:none;}.exam-alert{max-width:1180px;margin:16px auto;}
.exam-section-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}.exam-section-title h2{margin:0;}
.exam-question{border-bottom:1px solid #e5edf7;padding:16px 0;}.exam-question-group-card{background:#fff;border:1px solid #dbe7f5;border-radius:16px;padding:14px 16px;margin:14px 0;}.exam-question-head{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;}
.exam-question-text{font-weight:700;margin:10px 0;white-space:pre-wrap;line-height:1.55;}.exam-group-content{white-space:pre-wrap;margin-bottom:12px;line-height:1.65;color:#24364b;background:#fff;border-left:4px solid #2f80ed;padding:14px;border-radius:10px;}
.exam-question-image{max-width:520px;width:100%;border-radius:10px;margin-bottom:10px;}.exam-normal-audio{margin:10px 0;}.exam-normal-audio audio{max-width:100%;}
.exam-options{display:grid;gap:8px;max-width:760px;}.exam-option{display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid #d8e4f2;border-radius:10px;background:#fff;}.exam-option:hover{border-color:#9fc5ff;}
.exam-part-audio{border:1px solid #d6e6fb;background:#fff;border-radius:14px;padding:12px 14px;margin:10px 0 16px;display:grid;gap:8px;max-width:980px;}
.exam-strict-audio{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#f8fafc;color:#0f172a;border-radius:999px;padding:8px 12px;margin:10px 0 12px;max-width:920px;border:1px solid #e2e8f0;}
.exam-strict-audio .btn{background:#2563eb;border-color:#2563eb;color:#fff;border-radius:999px;padding:6px 14px;font-weight:700;}
.exam-strict-audio .btn:disabled{opacity:.7;}
.exam-audio-bar{height:8px;min-width:260px;flex:1;background:#e2e8f0;border-radius:999px;overflow:hidden;}
.exam-audio-bar span{display:block;height:100%;background:#2563eb;}
.exam-audio-note{font-size:12px;color:#64748b;display:block;width:100%;font-style:italic;margin-left:4px;}
.reading-split{display:grid;grid-template-columns:minmax(320px,1fr) minmax(360px,1fr);gap:20px;align-items:start;}.reading-passage{position:sticky;top:74px;max-height:calc(100vh - 160px);overflow:auto;border:1px solid #d9e6f7;background:#fff;border-radius:16px;padding:18px;line-height:1.7;white-space:pre-wrap;}.reading-passage h3{margin-top:0;}.reading-questions{background:#fff;border:1px solid #e5edf7;border-radius:16px;padding:4px 16px;}
.exam-writing-wrap textarea{min-height:260px;}.word-count{text-align:right;color:#64748b;margin-top:6px;}.exam-speaking-box{border:1px solid #d9e5f2;border-radius:14px;padding:14px;background:#f8fafc;max-width:850px;}.speaking-warning{font-size:13px;color:#475569;margin-bottom:10px;}.text-danger-small{color:var(--danger);margin-top:8px;font-size:13px;}
.wave{height:44px;display:flex;align-items:center;gap:5px;margin:10px 0;}.wave span{display:block;width:8px;height:10px;border-radius:999px;background:#94a3b8;}.wave.recording span{animation:wavePulse .9s infinite ease-in-out;background:#2f80ed;}.wave.recording span:nth-child(2){animation-delay:.1s}.wave.recording span:nth-child(3){animation-delay:.2s}.wave.recording span:nth-child(4){animation-delay:.3s}.wave.recording span:nth-child(5){animation-delay:.2s}.wave.recording span:nth-child(6){animation-delay:.1s}@keyframes wavePulse{0%,100%{height:10px}50%{height:36px}}
.speaking-intro-card{text-align:center;border:1px solid #d9e6f7;background:#fff;border-radius:18px;padding:36px;max-width:720px;margin:30px auto;}
.exam-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#eaf3ff;border-top:1px solid #d6e6fb;padding:8px 12px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}.exam-skill-group{display:flex;align-items:center;gap:5px;}.exam-skill-group.locked{opacity:.55;}.exam-skill-label{background:#2f80ed;color:white;border-radius:6px;padding:6px 10px;font-weight:700;font-size:12px;}.exam-part-btn{border:1px solid #b9d5fb;background:#d9ebff;color:#1f5faf;border-radius:7px;padding:7px 11px;font-weight:700;}.exam-part-btn.active{background:#facc15;color:#111827;border-color:#f59e0b;}.exam-part-btn:disabled{cursor:not-allowed;opacity:.6;}
.exam-start-card{max-width:980px;margin:55px auto;background:#fff;border:1px solid #e5edf7;border-radius:18px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.06);text-align:center;}.exam-start-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:22px 0;text-align:left;}.exam-start-grid div{border:1px solid #e5edf7;border-radius:14px;padding:16px;background:#f8fbff;display:grid;gap:8px;}
.preflight-steps{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0;}.preflight-step{border:1px solid #cfe1f7;background:#f8fbff;border-radius:999px;padding:9px 14px;font-weight:800;color:#245a9c;}.preflight-step.active{background:#2f80ed;color:#fff;}.preflight-panel{border:1px solid #e5edf7;border-radius:18px;background:#f8fbff;padding:22px;display:grid;gap:14px;justify-items:center;}.avatar-preview{width:160px;height:160px;object-fit:cover;border-radius:20px;border:3px solid #dbeafe;}.mic-test-box{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}

.speaking-flow-layout{display:grid;grid-template-columns:minmax(420px,1.15fr) minmax(320px,.85fr);gap:24px;align-items:start;}.speaking-task-panel{background:#fff;border:1px solid #e5edf7;border-radius:18px;padding:20px;line-height:1.55;}.speaking-task-panel h3{margin-top:0;font-size:20px;}.speaking-audio-card{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#f1f5f9;border-radius:999px;padding:8px 12px;margin:12px 0;}.speaking-audio-card audio{max-width:620px;width:100%;}.speaking-note-red{color:#ef4444;font-style:italic;}.speaking-content-block{white-space:pre-wrap;margin:14px 0;padding:14px;border-left:4px solid #2f80ed;background:#f8fbff;border-radius:12px;}.speaking-question-list p{margin:7px 0;white-space:pre-wrap;}.speaking-status-panel{position:sticky;top:86px;border-radius:18px;padding:22px;text-align:center;border:1px solid #e5edf7;background:#fff;}.speaking-status-panel.recording{background:#fff1f2;border-color:#fecdd3;color:#991b1b;}.speaking-status-panel.preparing{background:#fff7ed;border-color:#fed7aa;color:#9a3412;}.speaking-status-panel.done{background:#ecfdf5;border-color:#bbf7d0;color:#166534;}.speaking-status-panel h2{font-size:21px;margin:8px 0;text-transform:uppercase;}.speaking-big-timer{display:inline-block;background:#2f80ed;color:white;border-radius:9px;padding:8px 18px;font-size:26px;font-weight:900;letter-spacing:1px;margin:8px 0 12px;}.speaking-status-panel.recording .speaking-big-timer{background:#ef4444;}.speaking-status-panel.preparing .speaking-big-timer{background:#f59e0b;}
@media(max-width:900px){.exam-topbar{grid-template-columns:1fr}.exam-top-right{justify-self:start}.exam-start-grid{grid-template-columns:1fr}.reading-split{grid-template-columns:1fr}.speaking-flow-layout{grid-template-columns:1fr}.speaking-status-panel{position:relative;top:0}.reading-passage{position:relative;top:0;max-height:none}.exam-audio-bar{min-width:150px}.exam-bottom-nav{justify-content:flex-start;overflow:auto;max-height:132px}.exam-shell{padding-bottom:132px}}
`;
