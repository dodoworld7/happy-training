import { useEffect } from 'react';
import './LinkPopup.css';

export default function LinkPopup({ link, onClose }) {
  // 10초 후 자동 닫기
  useEffect(() => {
    const timer = setTimeout(onClose, 10000);
    return () => clearTimeout(timer);
  }, [link, onClose]);

  return (
    <div className="link-popup-wrap animate-pop">
      <div className="link-popup">
        <div className="link-popup__header">
          <span className="link-popup__icon">🔗</span>
          <div>
            <div className="link-popup__label">운영자가 링크를 공유했습니다!</div>
            <div className="link-popup__time">방금 전</div>
          </div>
          <button className="link-popup__close" onClick={onClose}>✕</button>
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-popup__url"
          onClick={onClose}
        >
          {link.title || link.url}
        </a>
        <div className="link-popup__actions">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            onClick={onClose}
          >
            바로 열기 →
          </a>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            나중에
          </button>
        </div>
        {/* 자동 닫기 프로그레스 바 */}
        <div className="link-popup__progress" />
      </div>
    </div>
  );
}
