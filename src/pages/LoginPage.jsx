import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, setDoc, serverTimestamp, collection, query, where, getDocs
} from 'firebase/firestore';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: 코드입력, 2: 별명입력

  // 연수 코드로 방 찾기
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      // rooms 컬렉션에서 code가 일치하는 방 찾기
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('code', '==', code.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        // 관리자 코드인지도 확인
        const adminQ = query(roomsRef, where('adminCode', '==', code.trim()));
        const adminSnap = await getDocs(adminQ);
        if (adminSnap.empty) {
          setError('잘못된 연수 코드입니다. 다시 확인해 주세요.');
          setLoading(false);
          return;
        }
        // 관리자 코드 일치
        const roomData = adminSnap.docs[0];
        sessionStorage.setItem('happyUser', JSON.stringify({
          roomId: roomData.id,
          isAdmin: true,
          name: '운영자',
          org: '',
          sessionId: 'admin_' + Date.now(),
        }));
        navigate(`/admin/${roomData.id}`);
        return;
      }

      // 참가자 코드 일치
      const roomDoc = snap.docs[0];
      const roomData = roomDoc.data();

      if (!roomData.isActive) {
        setError('현재 진행 중인 연수가 아닙니다.');
        setLoading(false);
        return;
      }

      // 방 정보 임시 저장
      sessionStorage.setItem('pendingRoom', JSON.stringify({ roomId: roomDoc.id, ...roomData }));
      setStep(2);
    } catch (err) {
      setError('오류가 발생했습니다: ' + err.message);
    }
    setLoading(false);
  };

  // 별명(닉네임) 입력 후 입장
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const pendingRoom = JSON.parse(sessionStorage.getItem('pendingRoom') || '{}');
      const { roomId } = pendingRoom;
      const sessionId = name.trim() + '_' + Date.now();

      // 참가자 기록
      await setDoc(doc(db, 'rooms', roomId, 'participants', sessionId), {
        name: name.trim(),
        org: '',
        joinedAt: serverTimestamp(),
        isOnline: true,
        sessionId,
      });

      // 세션 저장
      sessionStorage.setItem('happyUser', JSON.stringify({
        roomId,
        isAdmin: false,
        name: name.trim(),
        org: '',
        sessionId,
      }));

      navigate(`/room/${roomId}`);
    } catch (err) {
      setError('입장 중 오류가 발생했습니다: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      {/* 배경 장식 */}
      <div className="login-bg__orb login-bg__orb--1" />
      <div className="login-bg__orb login-bg__orb--2" />
      <div className="login-bg__orb login-bg__orb--3" />

      <div className="login-container animate-pop">
        {/* 로고/헤더 */}
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo__icon">🎓</span>
          </div>
          <h1 className="login-title">링크데이(토크콘서트)</h1>
          <p className="login-subtitle">연수 참가 입장 코드를 입력해 주세요</p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="login-steps">
          <div className={`login-step ${step >= 1 ? 'active' : ''}`}>
            <span className="login-step__num">1</span>
            <span className="login-step__label">코드 확인</span>
          </div>
          <div className="login-step__line" />
          <div className={`login-step ${step >= 2 ? 'active' : ''}`}>
            <span className="login-step__num">2</span>
            <span className="login-step__label">별명 설정</span>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="login-error animate-fade-in">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* STEP 1: 코드 입력 */}
        {step === 1 && (
          <form className="login-form" onSubmit={handleCodeSubmit}>
            <div className="form-group">
              <label className="label">연수 입장 코드</label>
              <input
                id="code-input"
                className="input input-code"
                type="text"
                placeholder="운영자에게 받은 코드를 입력하세요"
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              id="code-submit-btn"
              className="btn btn-primary btn-lg btn-full"
              type="submit"
              disabled={loading || !code.trim()}
            >
              {loading ? <span className="spinner" /> : '코드 확인'}
            </button>
          </form>
        )}

        {/* STEP 2: 별명(닉네임) 입력 */}
        {step === 2 && (
          <form className="login-form" onSubmit={handleJoin}>
            <div className="form-group">
              <label className="label">사용할 별명(닉네임) <span className="required">*</span></label>
              <input
                id="name-input"
                className="input"
                type="text"
                placeholder="예: 행복한선생님, 열정쌤"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>

            <button
              id="join-btn"
              className="btn btn-primary btn-lg btn-full"
              type="submit"
              disabled={loading || !name.trim()}
            >
              {loading ? <span className="spinner" /> : '입장하기 🚀'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => { setStep(1); setError(''); }}
            >
              ← 코드 다시 입력
            </button>
          </form>
        )}

        {/* 하단 안내 */}
        <p className="login-footer-text">
          연수 코드를 모르신다면 운영자에게 문의하세요.
        </p>
      </div>
      <footer className="brand-footer">made by 김도현</footer>
    </div>
  );
}
