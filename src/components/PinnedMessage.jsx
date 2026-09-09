import './PinnedMessage.css';

export default function PinnedMessage({ message }) {
  if (!message) return null;
  return (
    <div className="pinned-bar animate-slide-in">
      <span className="pinned-bar__icon">📌</span>
      <span className="pinned-bar__text">{message}</span>
    </div>
  );
}
