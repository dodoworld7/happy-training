import './ParticipantList.css';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function ParticipantList({ participants, currentUser }) {
  // 현재 접속 중이고 퇴장당하지 않은 참가자만 표시
  const activeParticipants = participants.filter(p => p.isOnline !== false && !p.isKicked);
  const onlineCount = activeParticipants.length;

  return (
    <div className="participant-list">
      {/* 헤더 */}
      <div className="participant-header">
        <span className="section-title">참가자</span>
        <span className="badge badge-success">
          <span className="online-dot" style={{width:6,height:6}} />
          {onlineCount}명
        </span>
      </div>

      {/* 목록 */}
      <div className="participant-items scroll-y">
        {activeParticipants.map((p, idx) => (
          <div
            key={p.id || idx}
            className={`participant-item animate-slide-in ${p.sessionId === currentUser?.sessionId ? 'participant-item--me' : ''}`}
            style={{ animationDelay: `${idx * 0.03}s` }}
          >
            <div className="avatar avatar-sm">
              {p.name?.[0] || '?'}
            </div>
            <div className="participant-info">
              <div className="participant-name">
                {p.name}
                {p.sessionId === currentUser?.sessionId && (
                  <span className="participant-me-badge">나</span>
                )}
              </div>
              {p.org && (
                <div className="participant-org">{p.org}</div>
              )}
              <div className="participant-time">
                {formatTime(p.joinedAt)} 입장
              </div>
            </div>
            <span
              className="participant-status"
              style={{ background: p.isOnline !== false ? 'var(--color-success)' : 'var(--color-text-subtle)' }}
            />
          </div>
        ))}

        {participants.length === 0 && (
          <div className="participant-empty">
            <p>아직 참가자가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
