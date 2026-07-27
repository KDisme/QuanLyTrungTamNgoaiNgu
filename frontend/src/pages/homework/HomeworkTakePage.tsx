import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EmptyState, Loading } from '../../components/common';
import { useHomeworkTake } from './take/hooks/useHomeworkTake';
import PasswordGate from './take/components/PasswordGate';
import TimeUpScreen from './take/components/TimeUpScreen';
import HomeworkTakeHero from './take/components/HomeworkTakeHero';
import ScoreSummaryCard from './take/components/ScoreSummaryCard';
import QuestionCard from './take/components/QuestionCard';
import SubmitBar from './take/components/SubmitBar';

export default function HomeworkTakePage() {
  const navigate = useNavigate();
  const {
    detail,
    loading,
    saving,
    answers,
    results,
    needsPassword,
    passwordError,
    passwordInput,
    setPasswordInput,
    setPasswordError,
    verifying,
    timeUp,
    secondsLeft,
    draftStatus,
    lastDraftSavedTime,
    unlock,
    saveDraft,
    setAnswer,
    submit,
    questions,
    myStatus,
    canEdit,
    isLocked,
    canRevealAnswers,
    canRevealScore,
    scoreSummary,
    totalQuestions,
    answeredCount,
    completionRate,
  } = useHomeworkTake();

  if (timeUp) return <TimeUpScreen />;
  if (needsPassword) {
    return (
      <PasswordGate
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        setPasswordError={setPasswordError}
        passwordError={passwordError}
        verifying={verifying}
        unlock={unlock}
      />
    );
  }

  if (loading) return <Loading />;
  if (!detail) return <EmptyState message="Không tìm thấy bài tập" />;

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 1120, margin: '0 auto', paddingBottom: 88 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Quay lại</button>
      </div>

      <HomeworkTakeHero
        detail={detail}
        isLocked={isLocked}
        completionRate={completionRate}
        secondsLeft={secondsLeft}
        canEdit={canEdit}
        canRevealAnswers={canRevealAnswers}
        totalQuestions={totalQuestions}
      />

      {scoreSummary && (
        <ScoreSummaryCard
          scoreSummary={scoreSummary}
          myStatus={myStatus}
          detail={detail}
          canRevealScore={canRevealScore}
          canRevealAnswers={canRevealAnswers}
        />
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {questions.length === 0 ? (
          <EmptyState message="Bài tập này chưa có câu hỏi" />
        ) : (
          questions.map((question: any, index: number) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              current={answers[Number(question.id)]}
              result={results[Number(question.id)]}
              isLocked={isLocked}
              canRevealAnswers={canRevealAnswers}
              myStatus={myStatus}
              setAnswer={setAnswer}
            />
          ))
        )}
      </div>

      {canEdit && questions.length > 0 && (
        <SubmitBar
          lastDraftSavedTime={lastDraftSavedTime}
          draftStatus={draftStatus}
          saving={saving}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          onSaveDraft={() => saveDraft(false)}
          onSubmit={() => submit()}
        />
      )}
    </div>
  );
}