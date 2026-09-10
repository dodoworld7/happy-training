import './PinnedMessage.css';

export default function PinnedMessage({ message, onClick }) {
  if (!message) return null;
  return (
    <div
      className="pinned-bar animate-slide-in"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? '클릭하여 공지사항 전체 보기' : undefined}
    >
      <span className="pinned-bar__icon">📌</span>
      <span className="pinned-bar__text">{message}</span>
      {onClick && <span className="pinned-bar__more">자세히 보기 &gt;</span>}
    </div>
  );
}
