import { useEffect } from 'react';
import './NoticePopup.css';

export default function NoticePopup({ message, onClose }) {
  // 15초 후 자동 닫기
  useEffect(() => {
    const timer = setTimeout(onClose, 15000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="notice-popup-backdrop" onClick={onClose}>
      <div className="notice-popup-modal animate-pop" onClick={e => e.stopPropagation()}>
        <div className="notice-popup-header">
          <div className="notice-popup-title-wrap">
            <span className="notice-popup-icon">📢</span>
            <div>
              <h3 className="notice-popup-title">운영자 공지사항</h3>
              <span className="notice-popup-subtitle">전체 참가자 필독 안내</span>
            </div>
          </div>
          <button
            type="button"
            className="notice-popup-close-btn"
            onClick={onClose}
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="notice-popup-body">
          <div className="notice-popup-content">
            {message.split('\n').map((line, idx) => (
              <p key={idx} className="notice-popup-line">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>

        <div className="notice-popup-footer">
          <button
            type="button"
            className="btn btn-primary notice-popup-confirm-btn"
            onClick={onClose}
          >
            확인했습니다
          </button>
        </div>

        {/* 15초 자동 닫힘 진행바 */}
        <div className="notice-popup-progress" />
      </div>
    </div>
  );
}
