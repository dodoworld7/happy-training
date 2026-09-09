import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import './QuestionPanel.css';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function QuestionPanel({ roomId, user }) {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 질문 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'questions');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // 공감수(likeCount) 내림차순, 동일할 경우 최신순 정렬
      list.sort((a, b) => {
        const likesDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
        if (likesDiff !== 0) return likesDiff;
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
        return timeB - timeA;
      });
      setQuestions(list);
    });
    return unsub;
  }, [roomId]);

  // 질문 등록
  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = newQuestion.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'rooms', roomId, 'questions'), {
        text,
        createdAt: serverTimestamp(),
        likes: [],
        isAnswered: false,
      });
      setNewQuestion('');
    } catch (err) {
      alert('질문 등록 오류: ' + err.message);
    }
    setSubmitting(false);
  };

  // 공감/좋아요 토글
  const handleLikeToggle = async (qItem) => {
    if (!user?.sessionId) return;
    const likes = qItem.likes || [];
    const hasLiked = likes.includes(user.sessionId);
    const qRef = doc(db, 'rooms', roomId, 'questions', qItem.id);

    try {
      if (hasLiked) {
        await updateDoc(qRef, { likes: arrayRemove(user.sessionId) });
      } else {
        await updateDoc(qRef, { likes: arrayUnion(user.sessionId) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="question-panel">
      {/* 질문 입력 폼 */}
      <form className="question-form-card" onSubmit={handleSubmit}>
        <div className="question-form-header">
          <span className="question-form-title">🙋‍♂️ 익명 질문 남기기</span>
          <span className="text-xs text-muted">이름 없이 자유롭게 질문해보세요!</span>
        </div>
        <div className="question-input-row">
          <input
            className="input"
            placeholder="발표 내용이나 실습 관련 궁금한 점을 입력하세요..."
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting || !newQuestion.trim()}
          >
            {submitting ? <span className="spinner" style={{width:16,height:16}} /> : '질문 등록'}
          </button>
        </div>
      </form>

      {/* 질문 목록 */}
      <div className="question-list scroll-y">
        {questions.length === 0 && (
          <div className="question-empty">
            <span style={{ fontSize: '2rem' }}>💡</span>
            <p>아직 등록된 질문이 없습니다.<br />첫 질문의 주인공이 되어보세요!</p>
          </div>
        )}

        {questions.map((q) => {
          const likesCount = q.likes?.length || 0;
          const hasLiked = user?.sessionId && q.likes?.includes(user.sessionId);

          return (
            <div
              key={q.id}
              className={`question-item animate-fade-in ${q.isAnswered ? 'question-item--answered' : ''}`}
            >
              <div className="question-item__body">
                <div className="question-item__header">
                  <span className="badge badge-primary">익명 교사</span>
                  {q.isAnswered && <span className="badge badge-success">✓ 답변 완료</span>}
                  <span className="question-item__time">{formatTime(q.createdAt)}</span>
                </div>
                <div className="question-item__text">{q.text}</div>
              </div>

              {/* 공감 버튼 */}
              <button
                className={`question-like-btn ${hasLiked ? 'question-like-btn--active' : ''}`}
                onClick={() => handleLikeToggle(q)}
                title="이 질문에 공감"
              >
                <span className="question-like-btn__icon">👍</span>
                <span className="question-like-btn__count">{likesCount}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
