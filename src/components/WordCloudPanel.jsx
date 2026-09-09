import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import './WordCloudPanel.css';

// 아름다운 파스텔/그라디언트 색상 팔레트
const COLOR_PALETTES = [
  { bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #ec4899, #f43f5e)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #14b8a6, #06b6d4)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff' },
  { bg: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#ffffff' },
];

export default function WordCloudPanel({ roomId, user }) {
  const [activeWordCloud, setActiveWordCloud] = useState(null);
  const [inputWord, setInputWord] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 활성 워드클라우드 주제 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'wordclouds');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeList = list.filter(w => w.isActive);
      if (activeList.length > 0) {
        // 최신순 정렬
        activeList.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
          return timeB - timeA;
        });
        setActiveWordCloud(activeList[0]);
      } else {
        setActiveWordCloud(null);
      }
    }, (err) => {
      console.error('워드클라우드 구독 오류:', err);
    });
    return unsub;
  }, [roomId]);

  if (!activeWordCloud) {
    return (
      <div className="wordcloud-panel">
        <div className="wordcloud-canvas-card">
          <div className="wordcloud-empty">
            <span className="wordcloud-empty__icon">☁️</span>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
              현재 진행 중인 워드 클라우드 주제가 없습니다.
            </h3>
            <p className="text-sm text-muted">
              운영자가 새로운 워드 클라우드 주제를 개설하면 이곳에 즉시 표시됩니다!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const responses = activeWordCloud.responses || {}; // { sessionId: { word, name } }
  const myResponse = user?.sessionId ? responses[user.sessionId] : null;

  // 단어별 빈도수 집계
  const wordFrequencyMap = {};
  Object.values(responses).forEach(res => {
    if (!res || !res.word) return;
    const cleanWord = res.word.trim();
    if (cleanWord) {
      wordFrequencyMap[cleanWord] = (wordFrequencyMap[cleanWord] || 0) + 1;
    }
  });

  // 배열로 변환 및 빈도순 정렬
  const wordList = Object.entries(wordFrequencyMap).map(([text, count]) => ({
    text,
    count
  })).sort((a, b) => b.count - a.count);

  const maxCount = wordList.length > 0 ? wordList[0].count : 1;

  // 답변 제출 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    const word = inputWord.trim();
    if (!word || !user?.sessionId || submitting) return;

    setSubmitting(true);
    try {
      const wcRef = doc(db, 'rooms', roomId, 'wordclouds', activeWordCloud.id);
      await updateDoc(wcRef, {
        [`responses.${user.sessionId}`]: {
          word,
          name: user.name || '참가자',
          submittedAt: new Date().toISOString(),
        }
      });
      setInputWord('');
    } catch (err) {
      alert('제출 오류: ' + err.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="wordcloud-panel">
      {/* 질문 및 제출 폼 카드 */}
      <div className="wordcloud-form-card">
        <div className="wordcloud-question-badge">
          <span>☁️ 실시간 워드 클라우드</span>
        </div>
        <h2 className="wordcloud-question-title">{activeWordCloud.question}</h2>

        <form onSubmit={handleSubmit} className="wordcloud-input-row">
          <input
            className="input"
            placeholder={myResponse ? `내 제출 단어: "${myResponse.word}" (다시 입력 시 수정됨)` : "한 마디 또는 단어로 자유롭게 입력하세요..."}
            value={inputWord}
            onChange={e => setInputWord(e.target.value)}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting || !inputWord.trim()}
          >
            {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : (myResponse ? '수정 제출' : '단어 제출')}
          </button>
        </form>
      </div>

      {/* 워드 클라우드 실시간 시각화 캔버스 */}
      <div className="wordcloud-canvas-card">
        <div className="wordcloud-canvas-header">
          <span className="font-bold text-sm text-muted">
            ✨ 실시간 참여 {Object.keys(responses).length}명 / 단어 {wordList.length}개
          </span>
          {myResponse && (
            <span className="badge badge-success text-xs">
              ✓ 내 단어: "{myResponse.word}"
            </span>
          )}
        </div>

        {wordList.length === 0 ? (
          <div className="wordcloud-empty">
            <span className="wordcloud-empty__icon">💬</span>
            <p>아직 제출된 단어가 없습니다.<br />위의 입력창에 첫 단어를 남겨주세요!</p>
          </div>
        ) : (
          <div className="wordcloud-cloud-container">
            {wordList.map((item, idx) => {
              // 빈도수에 따른 폰트 크기 계산 (1.1rem ~ 3.2rem)
              const ratio = item.count / maxCount;
              const fontSize = `${(1.1 + ratio * 2.1).toFixed(2)}rem`;
              const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];
              const isMyWord = myResponse?.word === item.text;

              return (
                <div
                  key={idx}
                  className="wordcloud-tag animate-pop"
                  style={{
                    fontSize,
                    background: palette.bg,
                    color: palette.color,
                    boxShadow: isMyWord ? '0 0 0 3px #10b981, 0 8px 20px rgba(16, 185, 129, 0.4)' : undefined,
                  }}
                >
                  <span>{item.text}</span>
                  <span className="wordcloud-tag__count">{item.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
