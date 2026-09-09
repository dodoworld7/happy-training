import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import './ChatPanel.css';

const EMOJI_REACTIONS = ['👍', '🙌', '❓', '💡', '😊'];
const LINK_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function isLinkMessage(text) {
  return LINK_REGEX.test(text);
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function renderMessageText(text) {
  const parts = text.split(LINK_REGEX);
  const links = text.match(LINK_REGEX) || [];
  const elements = [];
  parts.forEach((part, i) => {
    if (part) elements.push(<span key={`t${i}`}>{part}</span>);
    if (links[i]) {
      elements.push(
        <a key={`l${i}`} href={links[i]} target="_blank" rel="noopener noreferrer" className="chat-link">
          🔗 {links[i]}
        </a>
      );
    }
  });
  return elements;
}

function MessageItem({ msg, currentUser, roomId }) {
  const isMe = msg.name === currentUser.name;
  const [showReactions, setShowReactions] = useState(false);

  const handleReaction = async (emoji) => {
    const reactions = msg.reactions || {};
    const current = reactions[emoji] || 0;
    await updateDoc(doc(db, 'rooms', roomId, 'messages', msg.id), {
      [`reactions.${emoji}`]: current + 1,
    });
    setShowReactions(false);
  };

  return (
    <div className={`msg-row ${isMe ? 'msg-row--me' : ''}`}>
      {!isMe && (
        <div className="avatar avatar-sm">{msg.name[0]}</div>
      )}
      <div className="msg-content">
        {!isMe && <span className="msg-author">{msg.name}</span>}
        <div className="msg-bubble-wrap">
          <div className={`msg-bubble ${isMe ? 'msg-bubble--me' : ''} ${msg.isSystem ? 'msg-bubble--system' : ''}`}>
            {renderMessageText(msg.text)}
          </div>
          <button
            className="msg-reaction-btn"
            onClick={() => setShowReactions(!showReactions)}
            title="리액션 추가"
          >
            😊
          </button>
        </div>
        {/* 리액션 카운트 */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="msg-reactions">
            {Object.entries(msg.reactions).map(([emoji, count]) =>
              count > 0 ? (
                <span key={emoji} className="reaction-chip">
                  {emoji} {count}
                </span>
              ) : null
            )}
          </div>
        )}
        <span className="msg-time">{formatTime(msg.timestamp)}</span>
        {/* 리액션 선택 */}
        {showReactions && (
          <div className="reaction-picker animate-pop">
            {EMOJI_REACTIONS.map(e => (
              <button key={e} className="reaction-picker__btn" onClick={() => handleReaction(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ roomId, messages, links, user }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // 새 메시지 오면 스크롤 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        name: user.name,
        org: user.org,
        text: trimmed,
        timestamp: serverTimestamp(),
        pinned: false,
        reactions: {},
      });
      setText('');
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  // 최근 링크 히스토리 (상위 5개)
  const recentLinks = links.slice(0, 5);

  return (
    <div className="chat-panel">
      {/* 링크 히스토리 (최근 링크가 있을 때만) */}
      {recentLinks.length > 0 && (
        <div className="chat-links-bar">
          <span className="section-title">📎 최근 공유 링크</span>
          <div className="chat-links-list">
            {recentLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <span className="link-card__icon">🔗</span>
                <span className="link-card__url">{link.title || link.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="chat-messages scroll-y">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span style={{fontSize: '2rem'}}>💬</span>
            <p>아직 채팅이 없습니다.<br />첫 메시지를 보내보세요!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUser={user}
            roomId={roomId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <form className="chat-input-bar" onSubmit={sendMessage}>
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="chat-textarea"
          placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          id="chat-send-btn"
          className="btn btn-primary chat-send-btn"
          type="submit"
          disabled={!text.trim() || sending}
        >
          {sending ? <span className="spinner" style={{width:16,height:16,borderWidth:2}} /> : '전송 ↑'}
        </button>
      </form>
    </div>
  );
}
