const TOEIC_LR_BLUEPRINT = [
  { skill: 'Listening', part: 'Part 1', questionType: 'single_choice', count: 6, options: ['A','B','C','D'], showQuestionText: false, showOptionText: false, requiresImage: true, requiresAudio: true, transitionSeconds: 2 },
  { skill: 'Listening', part: 'Part 2', questionType: 'audio_choice', count: 25, options: ['A','B','C'], showQuestionText: false, showOptionText: false, requiresAudio: true, transitionSeconds: 5 },
  { skill: 'Listening', part: 'Part 3', questionType: 'group_choice', count: 39, questionsPerGroup: 3, options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, requiresAudio: true, optionalImage: true, transitionSeconds: 8 },
  { skill: 'Listening', part: 'Part 4', questionType: 'group_choice', count: 30, questionsPerGroup: 3, options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, requiresAudio: true, optionalImage: true, transitionSeconds: 8 },
  { skill: 'Reading', part: 'Part 5', questionType: 'single_choice', count: 30, options: ['A','B','C','D'], showQuestionText: true, showOptionText: true },
  { skill: 'Reading', part: 'Part 6', questionType: 'group_choice', count: 16, questionsPerGroup: 4, options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, richTextGroup: true },
  { skill: 'Reading', part: 'Part 7', questionType: 'group_choice', count: 54, minQuestionsPerGroup: 2, maxQuestionsPerGroup: 5, options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, splitScreen: true, passagesMin: 1, passagesMax: 3 },
];

const TOEIC_SW_BLUEPRINT = [
  { skill: 'Speaking', part: 'Question 1-2', questionType: 'speaking_read_aloud', count: 2, prepSeconds: 45, responseSeconds: 45, inputMode: 'text' },
  { skill: 'Speaking', part: 'Question 3-4', questionType: 'speaking_describe_picture', count: 2, prepSeconds: 45, responseSeconds: 30, inputMode: 'image' },
  { skill: 'Speaking', part: 'Question 5-6', questionType: 'speaking_answer_question', count: 2, prepSeconds: 3, responseSeconds: 15, inputMode: 'text_audio' },
  { skill: 'Speaking', part: 'Question 7', questionType: 'speaking_answer_question', count: 1, prepSeconds: 3, responseSeconds: 30, inputMode: 'text_audio' },
  { skill: 'Speaking', part: 'Question 8-9', questionType: 'speaking_info_question', count: 2, prepSeconds: 3, responseSeconds: 15, groupPreviewSeconds: 45, inputMode: 'group_audio' },
  { skill: 'Speaking', part: 'Question 10', questionType: 'speaking_info_question', count: 1, prepSeconds: 3, responseSeconds: 30, groupPreviewSeconds: 45, inputMode: 'group_audio' },
  { skill: 'Speaking', part: 'Question 11', questionType: 'speaking_opinion', count: 1, prepSeconds: 30, responseSeconds: 60, inputMode: 'text' },
  { skill: 'Writing', part: 'Question 1-5', questionType: 'writing_picture_sentence', count: 5, sectionSeconds: 480, inputMode: 'picture_keywords', requiresImage: true, requiredKeywords: 2, minSentences: 1, score: 1 },
  { skill: 'Writing', part: 'Question 6-7', questionType: 'writing_email_response', count: 2, sectionSeconds: 1200, inputMode: 'email', score: 1 },
  { skill: 'Writing', part: 'Question 8', questionType: 'writing_essay', count: 1, sectionSeconds: 1800, minWords: 300, inputMode: 'essay', score: 1 },
];

const TOEIC_4_SKILLS_BLUEPRINT = [...TOEIC_LR_BLUEPRINT, ...TOEIC_SW_BLUEPRINT];

const VSTEP_BLUEPRINT = [
  { skill: 'Listening', part: 'Listening Part 1', questionType: 'group_choice', count: 8, questionsPerPart: 8, questionsPerGroup: 8, audioScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, requiresAudio: true, partAudio: true, audioDurationHint: 'một audio chung cho cả Part 1', sectionSeconds: 2400 },
  { skill: 'Listening', part: 'Listening Part 2', questionType: 'group_choice', count: 12, questionsPerPart: 12, questionsPerGroup: 12, audioScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, requiresAudio: true, partAudio: true, audioDurationHint: 'một audio chung cho cả Part 2', sectionSeconds: 2400 },
  { skill: 'Listening', part: 'Listening Part 3', questionType: 'group_choice', count: 15, questionsPerPart: 15, questionsPerGroup: 15, audioScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, requiresAudio: true, partAudio: true, audioDurationHint: 'một audio chung cho cả Part 3', sectionSeconds: 2400 },
  { skill: 'Reading', part: 'Reading Part 1', questionType: 'group_choice', count: 10, questionsPerGroup: 10, readingScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, richTextGroup: true, splitScreen: true, passagesMin: 1, passagesMax: 1, passageWordsHint: 500, sectionSeconds: 3600 },
  { skill: 'Reading', part: 'Reading Part 2', questionType: 'group_choice', count: 10, questionsPerGroup: 10, readingScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, richTextGroup: true, splitScreen: true, passagesMin: 1, passagesMax: 1, passageWordsHint: 500, sectionSeconds: 3600 },
  { skill: 'Reading', part: 'Reading Part 3', questionType: 'group_choice', count: 10, questionsPerGroup: 10, readingScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, richTextGroup: true, splitScreen: true, passagesMin: 1, passagesMax: 1, passageWordsHint: 500, sectionSeconds: 3600 },
  { skill: 'Reading', part: 'Reading Part 4', questionType: 'group_choice', count: 10, questionsPerGroup: 10, readingScope: 'part', options: ['A','B','C','D'], showQuestionText: true, showOptionText: true, richTextGroup: true, splitScreen: true, passagesMin: 1, passagesMax: 1, passageWordsHint: 500, sectionSeconds: 3600 },
  { skill: 'Writing', part: 'Writing Task 1', questionType: 'writing_email_letter', count: 1, sectionSeconds: 1200, minWords: 120, inputMode: 'email_letter', score: 10, scoreWeight: 1/3 },
  { skill: 'Writing', part: 'Writing Task 2', questionType: 'writing_essay', count: 1, sectionSeconds: 2400, minWords: 250, inputMode: 'academic_social_essay', score: 10, scoreWeight: 2/3 },
  { skill: 'Speaking', part: 'Speaking Part 1', questionType: 'speaking_social_interaction', count: 1, topics: 2, questionsPerTopic: 3, inputMode: 'text_audio', responseMode: 'continuous_recording', sectionSeconds: 180, score: 10 },
  { skill: 'Speaking', part: 'Speaking Part 2', questionType: 'speaking_solution_discussion', count: 1, prepSeconds: 60, responseSeconds: 180, totalSeconds: 240, inputMode: 'situation_solutions', score: 10 },
  { skill: 'Speaking', part: 'Speaking Part 3', questionType: 'speaking_topic_development', count: 1, prepSeconds: 60, responseSeconds: 240, totalSeconds: 300, inputMode: 'mindmap_followup', requiresImage: true, followUpQuestionsMin: 3, followUpQuestionsMax: 4, score: 10 },
];

const EXAM_FORMATS = {
  TOEIC_LR: {
    code: 'TOEIC_LR',
    label: 'TOEIC hai kỹ năng',
    description: 'Nghe - Đọc: 120 phút; Listening 45 phút / 100 câu, Reading 75 phút / 100 câu.',
    examType: 'TOEIC',
    skills: ['Listening', 'Reading'],
    durationMinutes: 120,
    totalQuestions: 200,
    writingTasks: 0,
    blueprint: TOEIC_LR_BLUEPRINT,
  },
  TOEIC_4_SKILLS: {
    code: 'TOEIC_4_SKILLS',
    label: 'TOEIC bốn kỹ năng',
    description: 'Nghe - Đọc - Nói - Viết: 200 phút; Listening 45 phút / 100 câu, Reading 75 phút / 100 câu, Speaking 20 phút / 11 câu, Writing 60 phút / 8 câu.',
    examType: 'TOEIC',
    skills: ['Listening', 'Reading', 'Speaking', 'Writing'],
    durationMinutes: 200,
    totalQuestions: 219,
    writingTasks: 8,
    blueprint: TOEIC_4_SKILLS_BLUEPRINT,
  },
  // Alias để dữ liệu cũ không lỗi. UI mới không dùng option này nữa.
  VSTEP_4_SKILLS: {
    code: 'VSTEP_4_SKILLS',
    label: 'VSTEP bốn kỹ năng',
    description: 'VSTEP 4 kỹ năng: Listening khoảng 40 phút / 35 câu, Reading 60 phút / 40 câu, Writing 60 phút / 2 bài, Speaking 12 phút / 3 phần. Chấm độc lập 4 kỹ năng thang 10, Overall là trung bình làm tròn 0.5.',
    examType: 'VSTEP',
    skills: ['Listening', 'Reading', 'Writing', 'Speaking'],
    durationMinutes: 172,
    totalQuestions: 80,
    writingTasks: 2,
    speakingTasks: 3,
    scoring: { mode: 'independent_4_skills', skillScale: 10, overall: 'average_round_0_5' },
    settings: {
      oneWayNavigation: true,
      listeningSeconds: 2400,
      readingSeconds: 3600,
      writingSeconds: 3600,
      speakingSeconds: 720,
    },
    blueprint: VSTEP_BLUEPRINT,
  },
  TOEIC_SW: {
    code: 'TOEIC_SW',
    label: 'TOEIC Speaking & Writing (legacy)',
    description: 'Alias cũ, nên chuyển sang TOEIC bốn kỹ năng nếu tạo bộ đề mới.',
    examType: 'TOEIC',
    skills: ['Speaking', 'Writing'],
    durationMinutes: 80,
    totalQuestions: 19,
    writingTasks: 8,
    blueprint: TOEIC_SW_BLUEPRINT,
  },
};

function normalizeFormatCode(formatCode = 'TOEIC_LR') {
  if (formatCode === 'TOEIC_2_SKILLS') return 'TOEIC_LR';
  if (formatCode === 'TOEIC_4' || formatCode === 'TOEIC_FULL') return 'TOEIC_4_SKILLS';
  if (formatCode === 'VSTEP' || formatCode === 'VSTEP_FULL') return 'VSTEP_4_SKILLS';
  return formatCode;
}

function getFormat(formatCode = 'TOEIC_LR') {
  const code = normalizeFormatCode(formatCode);
  return EXAM_FORMATS[code] || EXAM_FORMATS.TOEIC_LR;
}

function getBlueprintRule(formatCode, skill, part) {
  return getFormat(formatCode).blueprint.find(item => item.skill === skill && item.part === part) || null;
}

module.exports = { TOEIC_LR_BLUEPRINT, TOEIC_SW_BLUEPRINT, TOEIC_4_SKILLS_BLUEPRINT, VSTEP_BLUEPRINT, EXAM_FORMATS, getFormat, getBlueprintRule, normalizeFormatCode };
