import React, { useState } from "react";
import { Send, Image, MoreVertical, Search, Edit, User, Smile, Reply } from "lucide-react";
import "./message.css";

const Home = () => {
  const [messages] = useState([
    { id: 1, text: "Chào bạn, dự án Blackjack thế nào rồi?", isMe: false, time: "9:41 AM" },
    { id: 2, text: "Đang code phần UI Message mới, nhìn khác bọt luôn 😄", isMe: true, time: "9:42 AM" },
    { id: 3, text: "Ui vibe xịn đó. Có plan realtime không?", isMe: false, time: "9:43 AM" },
    { id: 4, text: "Có chứ, SignalR vào là cháy 🚀", isMe: true, time: "9:44 AM" },
  ]);

  return (
    <div className="messenger-x">
      {/* LEFT */}
      <aside className="x-side">
        <div className="x-side-header">
          <div className="x-title">Messages</div>
          <button className="x-iconbtn" title="New message">
            <Edit size={18} />
          </button>
        </div>

        <div className="x-search">
          <div className="x-searchbar">
            <Search size={16} />
            <input placeholder="Search Direct Messages" />
          </div>
        </div>

        <div className="x-list">
          {[1, 2, 3, 4, 5].map((item) => (
            <button key={item} className={`x-conv ${item === 1 ? "active" : ""}`}>
              <div className="x-avatar">
                <User size={18} />
                {item === 1 && <div className="x-online" />}
              </div>

              <div className="x-conv-main">
                <div className="x-row">
                  <div className="x-name">dinhntan</div>
                  <div className="x-time">26/02</div>
                </div>

                <div className="x-row" style={{ marginTop: 4 }}>
                  <div className="x-last">Check this new UI out, it looks clean!</div>
                  {item === 1 && <div className="x-badge">2</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* RIGHT */}
      <main className="x-chat">
        <header className="x-chat-header">
          <div className="x-user">
            <div className="x-avatar">
              <User size={18} />
              <div className="x-online" />
            </div>
            <div>
              <div className="x-user-name">dinhntan</div>
              <div className="x-user-sub">Active now • End-to-end encrypted</div>
            </div>
          </div>

          <button className="x-iconbtn" title="More">
            <MoreVertical size={18} />
          </button>
        </header>

        <section className="x-feed">
          {messages.map((msg) => (
            <div key={msg.id} className={`x-msg ${msg.isMe ? "me" : "them"}`}>
              {!msg.isMe && (
                <div className="x-avatar" style={{ width: 34, height: 34 }}>
                  <User size={16} />
                </div>
              )}

              <div className="x-msg-body">
                <div className="x-bubble">
                  {msg.text}

                  <div className="x-actions-zone">
                    <div className="x-actions">
                      <button className="x-mini" title="React"><Smile size={14} /></button>
                      <button className="x-mini" title="Reply"><Reply size={14} /></button>
                    </div>
                  </div>
                </div>

                <div className="x-meta">
                  <span>{msg.time}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        <footer className="x-footer">
          <div className="x-compose">
            <button className="x-iconbtn" title="Attach">
              <Image size={18} />
            </button>

            <input className="x-input" placeholder="Start a new message" />

            <button className="x-send" title="Send">
              <Send size={18} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Home;