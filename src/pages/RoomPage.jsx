import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, doc, onSnapshot as onDocSnapshot, limit, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import PinnedMessage from '../components/PinnedMessage';
import ChatPanel from '../components/ChatPanel';
import ParticipantList from '../components/ParticipantList';
import LinkPopup from '../components/LinkPopup';
import PollWidget from '../components/PollWidget';
import QuestionPanel from '../components/QuestionPanel';
import WordCloudPanel from '../components/WordCloudPanel';
import './RoomPage.css';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [links, setLinks] = useState([]);
  const [latestLink, setLatestLink] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');

  // 세션 확인
  useEffect(() => {
    const stored = sessionStorage.getItem('happyUser');
    if (!stored) { navigate('/'); return; }
    const userData = JSON.parse(stored);
    if (userData.roomId !== roomId) { navigate('/'); return; }
    if (userData.isAdmin) { navigate(`/admin/${roomId}`); return; }
    setUser(userData);
  }, [roomId, navigate]);

  // 창 닫기 도우미 함수
  const closeWindowOrNavigate = () => {
    sessionStorage.clear();
    try {
      window.close();
    } catch (e) {}
    setTimeout(() => {
      try {
        window.location.href = 'about:blank';
      } catch (e) {
        navigate('/');
      }
    }, 300);
  };

  // 방 정보 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    let initialLoad = true;
    let lastResetTime = null;
    const unsub = onDocSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setRoomInfo(data);
        setLoading(false);

        // 방 전체 초기화 감지
        if (data.resetAt) {
          const resetTime = data.resetAt.toDate ? data.resetAt.toDate().getTime() : new Date(data.resetAt).getTime();
          if (!initialLoad && lastResetTime !== null && resetTime > lastResetTime) {
            alert('🚨 연수 방이 전체 초기화되어 화면이 종료됩니다.');
            closeWindowOrNavigate();
            return;
          }
          lastResetTime = resetTime;
        }
        initialLoad = false;
      }
    });
    return unsub;
  }, [roomId]);

  // 메시지 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, 'rooms', roomId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(200)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [roomId]);

  // 참가자 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, 'rooms', roomId, 'participants'),
      orderBy('joinedAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [roomId]);

  // 링크 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, 'rooms', roomId, 'links'),
      orderBy('sentAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const linkList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLinks(linkList);
      // 새 링크 팝업 표시 (가장 최신 링크 감지)
      if (linkList.length > 0) {
        const newest = linkList[0];
        // serverTimestamp()가 아직 null일 수 있으므로 fallback을 현재시간으로 설정
        const sentAt = newest.sentAt?.toDate?.() || (newest.sentAt ? new Date(newest.sentAt) : new Date());
        const diff = Date.now() - sentAt.getTime();
        // 1분 이내 전송된 링크이거나 시간차가 근소할 때 팝업 표시
        if (isNaN(diff) || Math.abs(diff) < 60000) {
          setLatestLink(newest);
        }
      }
    });
    return unsub;
  }, [roomId]);

  // 온라인 상태 및 하트비트 관리 (입장 시 온라인, 주기적 lastSeen, 탭/창 종료 시 오프라인)
  useEffect(() => {
    const stored = sessionStorage.getItem('happyUser');
    if (!stored || !roomId) return;
    const { sessionId } = JSON.parse(stored);
    const participantRef = doc(db, 'rooms', roomId, 'participants', sessionId);

    // 1. 입장 시 온라인 & 하트비트 갱신
    updateDoc(participantRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    }).catch(console.error);

    // 2. 3분 주기 하트비트 (180,000ms)
    const heartbeatTimer = setInterval(() => {
      updateDoc(participantRef, {
        isOnline: true,
        lastSeen: serverTimestamp()
      }).catch(() => {});
    }, 180000);

    // 3. 창/탭 종료 및 화면 비활성화 감지
    const handleOff = () => {
      try {
        updateDoc(participantRef, { isOnline: false }).catch(() => {});
      } catch (e) {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleOff();
      } else if (document.visibilityState === 'visible') {
        updateDoc(participantRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleOff);
    window.addEventListener('pagehide', handleOff);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleOff);
      window.removeEventListener('pagehide', handleOff);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateDoc(participantRef, { isOnline: false }).catch(() => {});
    };
  }, [roomId]);

  // 본인 참가자 상태 실시간 구독 (퇴장 처리 감지용 및 창 닫기)
  useEffect(() => {
    if (!roomId || !user?.sessionId) return;
    const myParticipantRef = doc(db, 'rooms', roomId, 'participants', user.sessionId);
    const unsub = onSnapshot(myParticipantRef, (snap) => {
      if (!snap.exists()) {
        alert('ℹ️ 연수가 초기화되었거나 접속이 종료되어 화면이 닫힙니다.');
        closeWindowOrNavigate();
        return;
      }
      const data = snap.data();
      if (data.isKicked) {
        alert('ℹ️ 운영자에 의해 퇴장 처리되어 화면이 닫힙니다.');
        closeWindowOrNavigate();
      }
    });
    return unsub;
  }, [roomId, user]);

  // 스스로 로그아웃 (퇴장)
  const handleLogout = async () => {
    if (!window.confirm('연수 방에서 퇴장하시겠습니까?')) return;
    try {
      if (user?.sessionId) {
        const participantRef = doc(db, 'rooms', roomId, 'participants', user.sessionId);
        await deleteDoc(participantRef);
      }
    } catch (err) {
      console.error(err);
    }
    sessionStorage.clear();
    navigate('/');
  };

  if (loading || !user || !roomInfo) {
    return (
      <div className="room-loading">
        <div className="spinner" />
        <p>연수 방에 입장 중...</p>
      </div>
    );
  }

  const displayTitle = (!roomInfo.title || roomInfo.title === '해피연수') ? '링크데이(토크콘서트)' : roomInfo.title.replace(/해피연수/g, '링크데이(토크콘서트)');

  const onlineParticipantsCount = participants.filter((p) => {
    if (p.isOnline === false || p.isKicked) return false;
    if (p.lastSeen) {
      const lastSeenTime = p.lastSeen.toDate ? p.lastSeen.toDate().getTime() : (typeof p.lastSeen === 'number' ? p.lastSeen : new Date(p.lastSeen).getTime());
      if (Date.now() - lastSeenTime > 210000) return false;
    }
    return true;
  }).length;

  return (
    <div className="room-layout">
      {/* 링크 팝업 */}
      {latestLink && (
        <LinkPopup link={latestLink} onClose={() => setLatestLink(null)} />
      )}

      {/* 헤더 */}
      <header className="room-header">
        <div className="room-header__left">
          <div className="room-logo">🎓</div>
          <div>
            <h1 className="room-title">{displayTitle}</h1>
            <div className="header-author-tag">made by 김도현</div>
            <p className="room-subtitle text-xs text-muted">
              <span className="online-dot" /> {onlineParticipantsCount}명 참가 중
            </p>
          </div>
        </div>
        <div className="room-header__right">
          <span className="badge badge-success hide-mobile">🔴 LIVE</span>
          <button
            className="btn btn-ghost btn-sm hide-desktop"
            onClick={() => setShowSidebar(!showSidebar)}
            title="참가자 목록"
          >
            👥
          </button>
          <div className="room-user-badge">
            <div className="avatar avatar-sm">{user.name[0]}</div>
            <span className="text-sm hide-mobile">{user.name}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="연수 방 퇴장"
          >
            🚪<span className="hide-mobile"> 퇴장</span>
          </button>
        </div>
      </header>

      {/* 고정 공지 */}
      {roomInfo.pinnedMessage && (
        <PinnedMessage message={roomInfo.pinnedMessage} />
      )}

      {/* 진행 중인 실시간 투표 위젯 */}
      <PollWidget roomId={roomId} user={user} />

      {/* 탭 네비게이션 (채팅 vs 질문함 vs 워드클라우드) */}
      <div className="room-subtabs">
        <button
          className={`room-subtab ${activeTab === 'chat' ? 'room-subtab--active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 실시간 채팅
        </button>
        <button
          className={`room-subtab ${activeTab === 'question' ? 'room-subtab--active' : ''}`}
          onClick={() => setActiveTab('question')}
        >
          🙋‍♂️ 익명 질문함
        </button>
        <button
          className={`room-subtab ${activeTab === 'wordcloud' ? 'room-subtab--active' : ''}`}
          onClick={() => setActiveTab('wordcloud')}
        >
          ☁️ 워드 클라우드
        </button>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="room-body">
        {activeTab === 'chat' && (
          <ChatPanel
            roomId={roomId}
            messages={messages}
            links={links}
            user={user}
          />
        )}
        {activeTab === 'question' && (
          <QuestionPanel
            roomId={roomId}
            user={user}
          />
        )}
        {activeTab === 'wordcloud' && (
          <WordCloudPanel
            roomId={roomId}
            user={user}
          />
        )}

        {/* 사이드바 (참가자 목록) */}
        <aside className={`room-sidebar ${showSidebar ? 'room-sidebar--open' : ''}`}>
          <ParticipantList participants={participants} currentUser={user} />
        </aside>

        {/* 모바일 사이드바 오버레이 */}
        {showSidebar && (
          <div
            className="room-sidebar-overlay hide-desktop"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>

      {/* 푸터 서명 */}
      <footer className="room-footer" style={{ textAlign: 'center', padding: '1rem 0 1.5rem 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem', fontWeight: '500' }}>
        made by 남부교육지원청
      </footer>
    </div>
  );
}
