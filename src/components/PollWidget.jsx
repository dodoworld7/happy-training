import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import './PollWidget.css';

export default function PollWidget({ roomId, user }) {
  const [activePoll, setActivePoll] = useState(null);
  const [voting, setVoting] = useState(false);

  // 활성 투표 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'polls');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // isActive가 true인 투표들 중 가장 최근 것 선택
      const activeList = list.filter(p => p.isActive);
      if (activeList.length > 0) {
        // createdAt 기준 정렬 (최신 순)
        activeList.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
          return timeB - timeA;
        });
        setActivePoll(activeList[0]);
      } else {
        setActivePoll(null);
      }
    }, (err) => {
      console.error('PollWidget 구독 오류:', err);
    });
    return unsub;
  }, [roomId]);

  if (!activePoll) return null;

  const votes = activePoll.votes || {}; // { sessionId: optionIndex }
  const totalVotes = Object.keys(votes).length;
  const myVote = user?.sessionId ? votes[user.sessionId] : undefined;
  const hasVoted = myVote !== undefined;

  // 옵션별 득표 계산
  const counts = (activePoll.options || []).map((_, idx) => {
    return Object.values(votes).filter(v => v === idx).length;
  });

  const handleVote = async (optionIdx) => {
    if (!user?.sessionId || voting) return;
    setVoting(true);
    try {
      const pollRef = doc(db, 'rooms', roomId, 'polls', activePoll.id);
      await updateDoc(pollRef, {
        [`votes.${user.sessionId}`]: optionIdx,
      });
    } catch (err) {
      console.error(err);
    }
    setVoting(false);
  };

  return (
    <div className="poll-widget-bar animate-pop">
      <div className="poll-widget-card">
        <div className="poll-widget-header">
          <div className="flex items-center gap-2">
            <span className="badge badge-warning">📊 실시간 투표 진행 중</span>
            <span className="text-xs text-muted">{totalVotes}명 참여</span>
          </div>
        </div>

        <h3 className="poll-widget-question">{activePoll.question}</h3>

        <div className="poll-options-list">
          {activePoll.options.map((opt, idx) => {
            const count = counts[idx];
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = myVote === idx;

            return (
              <button
                key={idx}
                className={`poll-option-btn ${isSelected ? 'poll-option-btn--selected' : ''}`}
                onClick={() => handleVote(idx)}
                disabled={voting}
              >
                {/* 실시간 득표율 프로그레스 바 */}
                <div
                  className="poll-option-bar"
                  style={{ width: `${percent}%` }}
                />
                <div className="poll-option-content">
                  <span className="poll-option-text">
                    {opt} {isSelected && '✓'}
                  </span>
                  <span className="poll-option-stat">
                    {percent}% ({count}표)
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
