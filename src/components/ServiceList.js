import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";

export default function ChatPage({ currentUserId }) {
  const [activeTab, setActiveTab] = useState("userInitiated");
  const [userChats, setUserChats] = useState([]);
  const [otherChats, setOtherChats] = useState([]);

  // Listen for chats initiated by user
  useEffect(() => {
    if (!currentUserId) return;
    const q = query(
      collection(db, "chats"),
      where("initiatorId", "==", currentUserId),
      where("initiatorBlocked", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUserChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUserId]);

  // Listen for chats initiated by others to current user
  useEffect(() => {
    if (!currentUserId) return;
    const q = query(
      collection(db, "chats"),
      where("recipientId", "==", currentUserId),
      where("recipientBlocked", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setOtherChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUserId]);

  // Block a chat
  async function blockChat(chatId, isInitiator) {
    const chatDoc = doc(db, "chats", chatId);
    const upd = isInitiator ? { initiatorBlocked: true } : { recipientBlocked: true };
    await updateDoc(chatDoc, upd);
  }

  // Delete a chat (soft delete)
  async function deleteChat(chatId, isInitiator) {
    const chatDoc = doc(db, "chats", chatId);
    const upd = isInitiator ? { deletedByInitiator: true } : { deletedByRecipient: true };
    await updateDoc(chatDoc, upd);
  }

  // Rename a chat
  async function renameChat(chatId, newTitle) {
    const chatDoc = doc(db, "chats", chatId);
    await updateDoc(chatDoc, { chatTitle: newTitle });
  }

  // Render chat list for tab
  function ChatList({ chats, isUserInitiated }) {
    if (!chats.length) return <div>No chats.</div>;
    return (
      <ul>
        {chats.map(chat => {
          const otherUserId = isUserInitiated ? chat.recipientId : chat.initiatorId;
          // May fetch user profile for display
          return (
            <li key={chat.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              <div>
                <strong>{chat.chatTitle || "Untitled chat"}</strong>
                <p>{chat.lastMessage}</p>
                <small>{chat.lastMessageTimestamp?.toDate().toLocaleString()}</small>
              </div>
              <div>
                <button onClick={() => blockChat(chat.id, isUserInitiated)}>Block</button>
                <button onClick={() => deleteChat(chat.id, isUserInitiated)}>Delete</button>
                {/* Implement rename UI to get input and call renameChat */}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <button onClick={() => setActiveTab("userInitiated")} style={{ fontWeight: activeTab==="userInitiated" ? "bold" : "normal" }}>My Chats</button>
        <button onClick={() => setActiveTab("otherInitiated")} style={{ fontWeight: activeTab==="otherInitiated" ? "bold" : "normal" }}>Others' Chats</button>
      </div>
      {activeTab === "userInitiated" ? <ChatList chats={userChats} isUserInitiated={true} /> : <ChatList chats={otherChats} isUserInitiated={false} />}
    </div>
  );
}