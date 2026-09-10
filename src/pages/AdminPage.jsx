import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  deleteDoc, serverTimestamp, onSnapshot as onDocSnapshot, getDocs, limit
} from 'firebase/firestore';
import './AdminPage.css';

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [links, setLinks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [polls, setPolls] = useState([]);
  const [wordclouds, setWordclouds] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);

  // 투표 생성 폼 상태
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['매우 잘 이해됨', '보통임', '어려움']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  // 워드클라우드 주제 폼 상태
  const [wcQuestion, setWcQuestion] = useState('');
  const [creatingWc, setCreatingWc] = useState(false);

  // 링크 전송 폼
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [sendingLink, setSendingLink] = useState(false);

  // 공지 핀 폼
  const [pinText, setPinText] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // 관리자 채팅 폼 상태
  const [adminChatText, setAdminChatText] = useState('');
  const [sendingAdminChat, setSendingAdminChat] = useState(false);

  // 세션 확인
  useEffect(() => {
    const stored = sessionStorage.getItem('happyUser');
    if (!stored) { navigate('/'); return; }
    const userData = JSON.parse(stored);
    if (!userData.isAdmin) { navigate(`/room/${roomId}`); return; }
    setUser(userData);
  }, [roomId, navigate]);

  // 방 정보 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const unsub = onDocSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setRoomInfo(data);
        setPinText(data.pinnedMessage || '');
        setLoading(false);
      }
    });
    return unsub;
  }, [roomId]);

  // 참가자 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'rooms', roomId, 'participants'), orderBy('joinedAt', 'asc'));
    return onSnapshot(q, snap => setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [roomId]);

  // 메시지 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'asc'), limit(200));
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [roomId]);

  // 링크 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'rooms', roomId, 'links'), orderBy('sentAt', 'desc'), limit(30));
    return onSnapshot(q, snap => setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [roomId]);

  // 익명 질문 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'questions');
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
        return timeB - timeA;
      });
      setQuestions(list);
    }, (err) => {
      console.error('질문 수신 오류:', err);
    });
  }, [roomId]);

  // 투표 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'polls');
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
        return timeB - timeA;
      });
      setPolls(list);
    }, (err) => {
      console.error('투표 수신 오류:', err);
    });
  }, [roomId]);

  // 워드클라우드 실시간 구독
  useEffect(() => {
    if (!roomId) return;
    const q = collection(db, 'rooms', roomId, 'wordclouds');
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
        return timeB - timeA;
      });
      setWordclouds(list);
    }, (err) => {
      console.error('워드클라우드 수신 오류:', err);
    });
  }, [roomId]);

  // 새 워드클라우드 만들기
  const handleCreateWc = async (e) => {
    e.preventDefault();
    if (!wcQuestion.trim()) {
      alert('워드 클라우드 주제 질문을 입력해주세요.');
      return;
    }
    setCreatingWc(true);
    try {
      // 기존 진행 중인 워드클라우드들 비활성화
      const activeWcs = wordclouds.filter(w => w.isActive);
      for (const w of activeWcs) {
        await updateDoc(doc(db, 'rooms', roomId, 'wordclouds', w.id), { isActive: false });
      }

      await addDoc(collection(db, 'rooms', roomId, 'wordclouds'), {
        question: wcQuestion.trim(),
        responses: {},
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setWcQuestion('');
      alert('☁️ 새 워드 클라우드 주제가 시작되었습니다!\n참가자 화면 "워드 클라우드" 탭에 표시됩니다.');
    } catch (err) {
      alert('생성 오류: ' + err.message);
    }
    setCreatingWc(false);
  };

  // 워드클라우드 종료
  const handleEndWc = async (wcId) => {
    if (!window.confirm('이 워드 클라우드 작성을 마감하시겠습니까?')) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'wordclouds', wcId), { isActive: false });
      alert('⏹ 마감되었습니다.');
    } catch (err) {
      alert('마감 오류: ' + err.message);
    }
  };

  // 워드클라우드 삭제
  const handleDeleteWc = async (wcId) => {
    if (!window.confirm('이 워드 클라우드를 완전 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'wordclouds', wcId));
      alert('🗑 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 새 투표 만들기
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) {
      alert('질문 내용과 보기를 모두 입력해주세요.');
      return;
    }
    setCreatingPoll(true);
    try {
      // 기존 진행 중인 투표들 비활성화
      const activePolls = polls.filter(p => p.isActive);
      for (const p of activePolls) {
        await updateDoc(doc(db, 'rooms', roomId, 'polls', p.id), { isActive: false });
      }

      await addDoc(collection(db, 'rooms', roomId, 'polls'), {
        question: pollQuestion.trim(),
        options: pollOptions.map(o => o.trim()),
        votes: {},
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setPollQuestion('');
      setPollOptions(['매우 잘 이해됨', '보통임', '어려움']);
      alert('🚀 새 실시간 투표가 시작되었습니다!\n모든 참가자 화면 상단에 투표 바가 표시됩니다.');
    } catch (err) {
      alert('투표 생성 오류: ' + err.message);
    }
    setCreatingPoll(false);
  };

  // 투표 종료하기
  const handleEndPoll = async (pollId) => {
    if (!window.confirm('이 투표를 마감하시겠습니까?\n참가자 화면에서 투표 바가 사라집니다.')) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'polls', pollId), { isActive: false });
      alert('⏹ 투표가 마감되었습니다.');
    } catch (err) {
      alert('투표 마감 오류: ' + err.message);
    }
  };

  // 투표 삭제하기
  const handleDeletePoll = async (pollId) => {
    if (!window.confirm('이 투표 기록을 완전히 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'polls', pollId));
      alert('🗑 투표가 삭제되었습니다.');
    } catch (err) {
      alert('투표 삭제 오류: ' + err.message);
    }
  };

  // 질문 답변 토글
  const handleToggleAnswerQuestion = async (qId, currentStatus) => {
    await updateDoc(doc(db, 'rooms', roomId, 'questions', qId), {
      isAnswered: !currentStatus
    });
  };

  // 질문 삭제
  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'rooms', roomId, 'questions', qId));
  };

  // 링크 전송
  const handleSendLink = async (e) => {
    e.preventDefault();
    let rawUrl = linkUrl.trim();
    if (!rawUrl) return;

    // http:// 또는 https:// 가 없는 경우 자동으로 https:// 붙여주기
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
    }

    setSendingLink(true);
    try {
      const displayTitle = linkTitle.trim() || rawUrl;
      await addDoc(collection(db, 'rooms', roomId, 'links'), {
        url: rawUrl,
        title: displayTitle,
        sentAt: serverTimestamp(),
      });
      // 채팅에도 자동 게시
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        name: '운영자',
        org: '운영자',
        text: `📎 링크 공유: ${displayTitle}\n${rawUrl}`,
        timestamp: serverTimestamp(),
        pinned: false,
        reactions: {},
        isSystem: true,
      });
      setLinkUrl('');
      setLinkTitle('');
      alert('✅ 모든 참가자에게 링크가 전송되었습니다!');
    } catch (err) {
      alert('전송 오류: ' + err.message);
    }
    setSendingLink(false);
  };

  // 공지 핀 저장
  const handleSavePin = async (e) => {
    e.preventDefault();
    setSavingPin(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), { pinnedMessage: pinText.trim() });
    } catch (err) {
      alert('저장 오류: ' + err.message);
    }
    setSavingPin(false);
  };

  // 공지 핀 해제
  const handleClearPin = async () => {
    await updateDoc(doc(db, 'rooms', roomId), { pinnedMessage: '' });
    setPinText('');
  };

  // 링크 삭제
  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('이 공유 링크를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'links', linkId));
      alert('🗑 링크가 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 전체 채팅 모두 지우기
  const handleClearAllMessages = async () => {
    if (!window.confirm('🚨 정말 모든 채팅 메시지를 지우시겠습니까?\n이 작업은 복구할 수 없습니다.')) return;
    try {
      const deletePromises = messages.map(m => deleteDoc(doc(db, 'rooms', roomId, 'messages', m.id)));
      await Promise.all(deletePromises);
      alert('🧹 모든 채팅 메시지가 깨끗하게 지워졌습니다.');
    } catch (err) {
      alert('전체 지우기 오류: ' + err.message);
    }
  };

  // 전체 참가자 이력 지우기
  const handleClearAllParticipants = async () => {
    if (!window.confirm('🚨 모든 참가자 접속 이력을 초기화하고 참가자들을 퇴장시키겠습니까?')) return;
    try {
      // 방 문서에 resetAt 기록 (참가자 클라이언트 화면 닫기용)
      await updateDoc(doc(db, 'rooms', roomId), { resetAt: serverTimestamp() });

      // 모든 참가자에게 퇴장 신호 전달 후 삭제
      const kickPromises = participants.map(p => updateDoc(doc(db, 'rooms', roomId, 'participants', p.id), { isKicked: true, isOnline: false }));
      await Promise.all(kickPromises);

      const deletePromises = participants.map(p => deleteDoc(doc(db, 'rooms', roomId, 'participants', p.id)));
      await Promise.all(deletePromises);
      alert('🧹 참가자 목록이 초기화되었으며 접속 중인 참가자가 퇴장 및 화면 종료 처리되었습니다.');
    } catch (err) {
      alert('초기화 오류: ' + err.message);
    }
  };

  // 전체 투표 지우기
  const handleClearAllPolls = async () => {
    if (!window.confirm('🚨 모든 투표 이력을 삭제하시겠습니까?')) return;
    try {
      const deletePromises = polls.map(p => deleteDoc(doc(db, 'rooms', roomId, 'polls', p.id)));
      await Promise.all(deletePromises);
      alert('🧹 모든 투표 이력이 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 전체 워드클라우드 지우기
  const handleClearAllWordClouds = async () => {
    if (!window.confirm('🚨 모든 워드 클라우드 이력을 삭제하시겠습니까?')) return;
    try {
      const deletePromises = wordclouds.map(w => deleteDoc(doc(db, 'rooms', roomId, 'wordclouds', w.id)));
      await Promise.all(deletePromises);
      alert('🧹 모든 워드 클라우드가 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 전체 링크 지우기
  const handleClearAllLinks = async () => {
    if (!window.confirm('🚨 모든 전송 링크 목록을 삭제하시겠습니까?')) return;
    try {
      const deletePromises = links.map(l => deleteDoc(doc(db, 'rooms', roomId, 'links', l.id)));
      await Promise.all(deletePromises);
      alert('🧹 모든 링크가 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 전체 질문 지우기
  const handleClearAllQuestions = async () => {
    if (!window.confirm('🚨 모든 익명 질문을 삭제하시겠습니까?')) return;
    try {
      const deletePromises = questions.map(q => deleteDoc(doc(db, 'rooms', roomId, 'questions', q.id)));
      await Promise.all(deletePromises);
      alert('🧹 모든 질문이 삭제되었습니다.');
    } catch (err) {
      alert('삭제 오류: ' + err.message);
    }
  };

  // 연수 전체 데이터 일괄 초기화 (모든 데이터 원클릭 전면 삭제)
  const handleClearEntireRoomData = async () => {
    const confirmMsg = `🚨 [경고] 해당 연수 방의 모든 기록을 완벽하게 초기화하고 접속 참가자를 퇴장시키겠습니까?\n\n- 참가자 접속 이력 (${participants.length}명)\n- 채팅 메시지 (${messages.length}개)\n- 실시간 투표 (${polls.length}개)\n- 워드 클라우드 (${wordclouds.length}개)\n- 공유 링크 (${links.length}개)\n- 익명 질문 (${questions.length}개)\n- 고정 공지\n\n이 작업은 수행 후 절대로 복구할 수 없습니다.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. 방 문서 resetAt 및 공지 고정 해제
      await updateDoc(doc(db, 'rooms', roomId), { pinnedMessage: '', resetAt: serverTimestamp() });

      // 2. 모든 접속 참가자에게 퇴장 처리 신호 전송
      const kickPromises = participants.map(p => 
        updateDoc(doc(db, 'rooms', roomId, 'participants', p.id), { isKicked: true, isOnline: false })
      );
      await Promise.all(kickPromises);

      // 3. 모든 서브 컬렉션 문서 일괄 삭제
      const pDeletes = participants.map(p => deleteDoc(doc(db, 'rooms', roomId, 'participants', p.id)));
      const mDeletes = messages.map(m => deleteDoc(doc(db, 'rooms', roomId, 'messages', m.id)));
      const polDeletes = polls.map(po => deleteDoc(doc(db, 'rooms', roomId, 'polls', po.id)));
      const wcDeletes = wordclouds.map(w => deleteDoc(doc(db, 'rooms', roomId, 'wordclouds', w.id)));
      const lDeletes = links.map(l => deleteDoc(doc(db, 'rooms', roomId, 'links', l.id)));
      const qDeletes = questions.map(q => deleteDoc(doc(db, 'rooms', roomId, 'questions', q.id)));

      await Promise.all([
        ...pDeletes, ...mDeletes, ...polDeletes, ...wcDeletes, ...lDeletes, ...qDeletes
      ]);

      alert('🧹 해당 연수의 모든 기록이 초기화되었으며, 접속 중인 참가자의 화면이 정상적으로 닫힙니다!');
    } catch (err) {
      alert('전체 초기화 오류: ' + err.message);
    }
  };

  // 관리자 실시간 채팅 전송
  const handleSendAdminChat = async (e) => {
    e.preventDefault();
    const trimmed = adminChatText.trim();
    if (!trimmed || sendingAdminChat) return;

    setSendingAdminChat(true);
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        name: user?.name || '운영자',
        org: '관리자',
        text: trimmed,
        timestamp: serverTimestamp(),
        pinned: false,
        reactions: {},
        isAdmin: true,
      });
      setAdminChatText('');
    } catch (err) {
      alert('채팅 전송 오류: ' + err.message);
    }
    setSendingAdminChat(false);
  };

  // 메시지 삭제
  const handleDeleteMsg = async (msgId) => {
    if (!window.confirm('이 메시지를 삭제할까요?')) return;
    await deleteDoc(doc(db, 'rooms', roomId, 'messages', msgId));
  };

  // 참가자 퇴장 처리
  const handleKickParticipant = async (pItem) => {
    if (!window.confirm(`'${pItem.name}' 참가자를 퇴장 처리하시겠습니까?`)) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'participants', pItem.id), {
        isKicked: true,
        isOnline: false,
      });
      alert(`'${pItem.name}' 님이 퇴장 처리되었습니다.`);
    } catch (err) {
      alert('퇴장 처리 오류: ' + err.message);
    }
  };

  // CSV 다운로드
  const handleCsvDownload = () => {
    const rows = [
      ['별명(닉네임)', '입장시각', '온라인'],
      ...participants.map(p => [
        p.name || '',
        formatDateTime(p.joinedAt),
        p.isOnline !== false ? '온라인' : '오프라인',
      ])
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `참가자목록_${roomId}_${new Date().toLocaleDateString('ko-KR')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !user || !roomInfo) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>관리자 대시보드 로딩 중...</p>
      </div>
    );
  }

  // 현재 접속 인원 및 유저 판단 (isOnline !== false && !isKicked & lastSeen 하트비트 감지)
  const checkIsOnline = (p) => {
    if (p.isOnline === false || p.isKicked) return false;
    if (p.lastSeen) {
      const lastSeenTime = p.lastSeen.toDate ? p.lastSeen.toDate().getTime() : (typeof p.lastSeen === 'number' ? p.lastSeen : new Date(p.lastSeen).getTime());
      if (Date.now() - lastSeenTime > 210000) return false;
    }
    return true;
  };
  const onlineCount = participants.filter(p => checkIsOnline(p)).length;

  const displayTitle = (!roomInfo.title || roomInfo.title === '해피연수') ? '링크데이(토크콘서트)' : roomInfo.title.replace(/해피연수/g, '링크데이(토크콘서트)');

  return (
    <div className="admin-layout">
      {/* 헤더 */}
      <header className="admin-header">
        <div className="admin-header__left">
          <div className="room-logo">🎓</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="admin-title">{displayTitle}</h1>
              <span className="badge badge-warning">관리자</span>
            </div>
            <div className="header-author-tag">made by 김도현</div>
          </div>
        </div>
        <div className="admin-header__right flex items-center gap-3">
          <div className="admin-stat">
            <span className="admin-stat__num">{onlineCount}</span>
            <span className="admin-stat__label">현재 접속</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__num">{participants.length}</span>
            <span className="admin-stat__label">총 입장</span>
          </div>
          <button
            className="btn btn-danger btn-sm"
            style={{ fontWeight: 800, padding: '8px 14px', borderRadius: '8px' }}
            onClick={handleClearEntireRoomData}
            title="이 연수의 모든 데이터(참가자, 채팅, 투표, 질문, 워드클라우드, 링크, 공지)를 초기화합니다"
          >
            🚨 연수 전체 초기화
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              sessionStorage.clear();
              navigate('/');
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="admin-tabs">
        {[
          { id: 'attendance', label: '📋 참가자 현황', count: onlineCount },
          { id: 'pin', label: '📌 공지 관리', count: null },
          { id: 'chat', label: '💬 채팅 관리', count: messages.length },
          { id: 'poll', label: '📊 실시간 투표', count: polls.filter(p => p.isActive).length ? 'ON' : null },
          { id: 'wordcloud', label: '☁️ 워드 클라우드', count: wordclouds.filter(w => w.isActive).length ? 'ON' : null },
          { id: 'link', label: '🔗 링크 전송', count: links.length },
          { id: 'question', label: '🙋‍♂️ 익명 질문 관리', count: questions.filter(q => !q.isAnswered).length },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`admin-tab ${activeTab === tab.id ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="admin-tab__count">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="admin-content scroll-y">

        {/* 참가자 현황 탭 */}
        {activeTab === 'attendance' && (() => {
          const activeParticipants = participants.filter(p => checkIsOnline(p));

          return (
            <div className="admin-section animate-fade-in">
              <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-section-title">참가자 현황 ({activeParticipants.length}명)</h2>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={handleCsvDownload}>
                    📥 CSV 다운로드
                  </button>
                  {participants.length > 0 && (
                    <button className="btn btn-danger btn-sm" onClick={handleClearAllParticipants}>
                      🧹 참가자 전체 초기화
                    </button>
                  )}
                </div>
              </div>
              <div className="attendance-grid">
                {activeParticipants.map((p, idx) => (
                  <div key={p.id || idx} className="attendance-card animate-slide-in"
                    style={{ animationDelay: `${idx * 0.04}s` }}>
                    <div className="attendance-card__top">
                      <div className="avatar">{p.name?.[0] || '?'}</div>
                      <div className="attendance-card__info">
                        <div className="attendance-card__name">{p.name}</div>
                      </div>
                      <span className="badge badge-success">🟢 온라인</span>
                    </div>
                    <div className="attendance-card__time flex justify-between items-center" style={{ marginTop: 'var(--space-2)' }}>
                      <span>⏰ {formatDateTime(p.joinedAt)} 입장</span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleKickParticipant(p)}
                      >
                        🚪 퇴장 처리
                      </button>
                    </div>
                  </div>
                ))}
                {activeParticipants.length === 0 && (
                  <div className="admin-empty">현재 접속 중인 참가자가 없습니다.</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 실시간 투표 탭 */}
        {activeTab === 'poll' && (
          <div className="admin-section animate-fade-in">
            <h2 className="admin-section-title">실시간 투표 생성 및 관리</h2>
            
            {/* 새 투표 만들기 카테고리 */}
            <div className="admin-card">
              <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>새 투표 만들기</h3>
              <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="label">투표 질문</label>
                  <input
                    className="input"
                    placeholder="예: 오늘 다룬 실습 내용이 어느 정도 이해되셨나요?"
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">보기 항목 설정</label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <input
                        className="input"
                        placeholder={`보기 ${idx + 1}`}
                        value={opt}
                        onChange={e => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      style={{ marginTop: 'var(--space-1)', alignSelf: 'flex-start' }}
                    >
                      + 보기 추가
                    </button>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={creatingPoll || !pollQuestion.trim()}
                >
                  {creatingPoll ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '🚀 실시간 투표 시작하기'}
                </button>
              </form>
            </div>

            {/* 투표 목록 및 현황 */}
            {polls.length > 0 && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 className="section-title">투표 이력 및 현황</h3>
                  <button className="btn btn-danger btn-sm" onClick={handleClearAllPolls}>
                    🧹 전체 투표 이력 모두 지우기
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {polls.map(p => {
                    const votes = p.votes || {};
                    const total = Object.keys(votes).length;

                    return (
                      <div key={p.id} className="admin-card admin-history-card" style={{ borderColor: p.isActive ? 'var(--color-primary-light)' : 'var(--color-border)', backgroundColor: p.isActive ? '#f8faff' : '#ffffff' }}>
                        <div className="admin-history-card__top">
                          <div className="admin-history-card__status">
                            <span className={`badge ${p.isActive ? 'badge-success' : 'badge-warning'}`}>
                              {p.isActive ? '🔴 진행 중 (화면 노출)' : '⚪ 마감됨'}
                            </span>
                            <span className="participant-count-badge">({total}표 투표됨)</span>
                          </div>
                          <h4 className="admin-history-card__title">{p.question}</h4>
                          <div className="admin-history-card__actions">
                            {p.isActive && (
                              <button className="btn btn-warning btn-sm" onClick={() => handleEndPoll(p.id)}>
                                ⏹ 투표 종료 (화면 내리기)
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeletePoll(p.id)}>
                              🗑 완전 삭제
                            </button>
                          </div>
                        </div>

                        {/* 결과 디스플레이 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {p.options.map((opt, idx) => {
                            const count = Object.values(votes).filter(v => v === idx).length;
                            const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                            return (
                              <div key={idx} style={{ background: '#f8f9ff', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                                  <span className="font-semibold">{opt}</span>
                                  <span className="text-xs text-muted">{percent}% ({count}표)</span>
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${percent}%`, background: 'var(--gradient-primary)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 워드 클라우드 관리 탭 */}
        {activeTab === 'wordcloud' && (
          <div className="admin-section animate-fade-in">
            <h2 className="admin-section-title">☁️ 실시간 워드 클라우드 관리</h2>

            {/* 새 워드 클라우드 만들기 */}
            <div className="admin-card">
              <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>새 워드 클라우드 주제 만들기</h3>
              <form onSubmit={handleCreateWc} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <input
                    className="input"
                    placeholder="예: 오늘 연수를 한 단어로 표현한다면?"
                    value={wcQuestion}
                    onChange={e => setWcQuestion(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={creatingWc || !wcQuestion.trim()}
                >
                  {creatingWc ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '☁️ 워드 클라우드 주제 시작하기'}
                </button>
              </form>
            </div>

            {/* 워드 클라우드 이력 및 실시간 현황 */}
            {wordclouds.length > 0 && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 className="section-title">워드 클라우드 이력 및 현황</h3>
                  <button className="btn btn-danger btn-sm" onClick={handleClearAllWordClouds}>
                    🧹 전체 워드 클라우드 모두 지우기
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {wordclouds.map(w => {
                    const responses = w.responses || {};
                    const totalRes = Object.keys(responses).length;

                    // 단어 집계
                    const freqMap = {};
                    Object.values(responses).forEach(res => {
                      if (!res || !res.word) return;
                      const word = res.word.trim();
                      if (word) freqMap[word] = (freqMap[word] || 0) + 1;
                    });
                    const topWords = Object.entries(freqMap)
                      .map(([text, count]) => ({ text, count }))
                      .sort((a, b) => b.count - a.count);

                    return (
                      <div key={w.id} className="admin-card admin-history-card" style={{ borderColor: w.isActive ? 'var(--color-primary-light)' : 'var(--color-border)', backgroundColor: w.isActive ? '#f8faff' : '#ffffff' }}>
                        <div className="admin-history-card__top">
                          <div className="admin-history-card__status">
                            <span className={`badge ${w.isActive ? 'badge-success' : 'badge-warning'}`}>
                              {w.isActive ? '🔴 진행 중 (화면 노출)' : '⚪ 마감됨'}
                            </span>
                            <span className="participant-count-badge">({totalRes}명 참여)</span>
                          </div>
                          <h4 className="admin-history-card__title">{w.question}</h4>
                          <div className="admin-history-card__actions">
                            {w.isActive && (
                              <button className="btn btn-warning btn-sm" onClick={() => handleEndWc(w.id)}>
                                ⏹ 작성 마감
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWc(w.id)}>
                              🗑 완전 삭제
                            </button>
                          </div>
                        </div>

                        {/* 제출 단어 순위 요약 */}
                        {topWords.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'var(--space-2)' }}>
                            {topWords.map((item, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: idx === 0 ? 'var(--gradient-primary)' : '#e0e7ff',
                                  color: idx === 0 ? '#ffffff' : '#3730a3',
                                  padding: '4px 10px',
                                  borderRadius: '16px',
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                }}
                              >
                                {item.text} ({item.count}회)
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted">아직 제출된 단어가 없습니다.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 익명 질문 관리 탭 */}
        {activeTab === 'question' && (
          <div className="admin-section animate-fade-in">
            <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="admin-section-title">익명 질문 관리 ({questions.length}개)</h2>
              {questions.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleClearAllQuestions}>
                  🧹 전체 질문 모두 지우기
                </button>
              )}
            </div>
            <div className="admin-chat-list">
              {questions.map((q) => (
                <div key={q.id} className={`admin-chat-item ${q.isAnswered ? 'question-item--answered' : ''}`}>
                  <div className="admin-chat-item__body">
                    <div className="admin-chat-item__header">
                      <span className="badge badge-primary">익명 교사</span>
                      <span className="text-xs text-muted">👍 공감 {q.likes?.length || 0}개</span>
                      {q.isAnswered && <span className="badge badge-success">✓ 답변 완료</span>}
                    </div>
                    <div className="admin-chat-item__text" style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                      {q.text}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className={`btn btn-sm ${q.isAnswered ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => handleToggleAnswerQuestion(q.id, q.isAnswered)}
                    >
                      {q.isAnswered ? '답변 취소' : '✓ 답변 완료 마킹'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => handleDeleteQuestion(q.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="admin-empty">아직 등록된 질문이 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {/* 링크 전송 탭 */}
        {activeTab === 'link' && (
          <div className="admin-section animate-fade-in">
            <h2 className="admin-section-title">링크 전송</h2>
            <div className="admin-card">
              <p className="text-sm text-muted" style={{marginBottom:'var(--space-4)'}}>
                링크를 전송하면 모든 참가자 화면에 팝업으로 즉시 알림이 전달됩니다.
              </p>
              <form className="link-send-form" onSubmit={handleSendLink}>
                <div className="form-group">
                  <label className="label">링크 제목 <span className="optional">(선택)</span></label>
                  <input
                    id="link-title-input"
                    className="input"
                    placeholder="예: 오늘 실습 자료"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label">URL <span className="required">*</span></label>
                  <input
                    id="link-url-input"
                    className="input"
                    type="url"
                    placeholder="https://"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    required
                  />
                </div>
                <button
                  id="link-send-btn"
                  className="btn btn-primary"
                  type="submit"
                  disabled={sendingLink || !linkUrl.trim()}
                >
                  {sendingLink ? <span className="spinner" style={{width:16,height:16,borderWidth:2}} /> : '📤 전체 참가자에게 전송'}
                </button>
              </form>
            </div>

            {/* 전송 이력 */}
            {links.length > 0 && (
              <div style={{marginTop:'var(--space-6)'}}>
                <div className="flex justify-between items-center" style={{marginBottom:'var(--space-4)'}}>
                  <h3 className="section-title">전송 이력</h3>
                  <button className="btn btn-danger btn-sm" onClick={handleClearAllLinks}>
                    🧹 전체 전송 링크 모두 지우기
                  </button>
                </div>
                <div className="link-history">
                  {links.map(link => (
                    <div key={link.id} className="link-history-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
                        <span className="link-history-item__icon">🔗</span>
                        <div className="link-history-item__body" style={{ minWidth: 0, flex: 1 }}>
                          <div className="link-history-item__title">{link.title || link.url}</div>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-history-item__url">
                            {link.url}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="link-history-item__time text-xs text-muted">
                          {formatTime(link.sentAt)}
                        </span>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteLink(link.id)}
                          title="링크 삭제"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 공지 관리 탭 */}
        {activeTab === 'pin' && (
          <div className="admin-section animate-fade-in">
            <h2 className="admin-section-title">공지 고정 관리</h2>
            <div className="admin-card">
              <p className="text-sm text-muted" style={{marginBottom:'var(--space-4)'}}>
                입력한 공지는 모든 참가자 화면 상단에 실시간으로 표시됩니다.
              </p>
              <form className="pin-form" onSubmit={handleSavePin}>
                <div className="form-group">
                  <label className="label">고정 공지 내용</label>
                  <textarea
                    id="pin-input"
                    className="input"
                    placeholder="모든 참가자에게 보여줄 공지를 입력하세요..."
                    value={pinText}
                    onChange={e => setPinText(e.target.value)}
                    rows={3}
                    style={{resize:'vertical'}}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    id="pin-save-btn"
                    className="btn btn-primary"
                    type="submit"
                    disabled={savingPin}
                  >
                    {savingPin ? <span className="spinner" style={{width:16,height:16,borderWidth:2}} /> : '📌 공지 고정하기'}
                  </button>
                  {roomInfo.pinnedMessage && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleClearPin}
                    >
                      공지 해제
                    </button>
                  )}
                </div>
              </form>
            </div>
            {roomInfo.pinnedMessage && (
              <div className="admin-card" style={{marginTop:'var(--space-4)', borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.06)'}}>
                <p className="text-xs text-muted" style={{marginBottom:'var(--space-2)'}}>현재 표시 중인 공지</p>
                <p style={{color:'#fcd34d', fontSize:'var(--font-size-sm)', lineHeight:1.6}}>
                  📌 {roomInfo.pinnedMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 채팅 참가 및 관리 탭 */}
        {activeTab === 'chat' && (
          <div className="admin-section animate-fade-in">
            <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="admin-section-title">💬 실시간 채팅 참가 및 관리</h2>
                <span className="text-xs text-muted">총 {messages.length}개 메시지</span>
              </div>
              {messages.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleClearAllMessages}
                  style={{ fontWeight: 700 }}
                >
                  🧹 전체 채팅 모두 지우기
                </button>
              )}
            </div>

            {/* 관리자 메시지 전송 카테고리 */}
            <div className="admin-card" style={{ marginBottom: 'var(--space-5)' }}>
              <h3 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>💬 운영자 메시지 보내기 (채팅 참가)</h3>
              <form onSubmit={handleSendAdminChat} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  className="input"
                  placeholder="참가자들에게 전달할 메시지를 입력하세요... (Enter 전송)"
                  value={adminChatText}
                  onChange={e => setAdminChatText(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={sendingAdminChat || !adminChatText.trim()}
                  style={{ minWidth: '95px' }}
                >
                  {sendingAdminChat ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '전송 💬'}
                </button>
              </form>
            </div>

            {/* 채팅 리스트 및 삭제 기능 */}
            <div className="admin-chat-list">
              {messages.slice().reverse().map((msg) => (
                <div key={msg.id} className="admin-chat-item">
                  <div className="avatar avatar-sm">{msg.name?.[0] || '?'}</div>
                  <div className="admin-chat-item__body">
                    <div className="admin-chat-item__header">
                      <span className="admin-chat-item__author">
                        {msg.name} {msg.isAdmin && <span className="badge badge-warning text-xs" style={{ marginLeft: 4 }}>관리자</span>}
                      </span>
                      <span className="text-xs text-muted">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="admin-chat-item__text">{msg.text}</div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => handleDeleteMsg(msg.id)}
                    title="메시지 삭제"
                  >
                    🗑
                  </button>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="admin-empty">채팅 내역이 없습니다. 첫 메시지를 전송해 참가자들과 대화해보세요!</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 푸터 서명 */}
      <footer className="admin-footer" style={{ textAlign: 'center', padding: '1rem 0 1.5rem 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem', fontWeight: '500' }}>
        made by 남부교육지원청
      </footer>
    </div>
  );
}
