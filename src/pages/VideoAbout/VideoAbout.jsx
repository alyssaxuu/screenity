import React, { useContext, useEffect, useState } from 'react'
import * as Dialog from "@radix-ui/react-dialog";
import { contentStateContext } from '../Content/context/ContentState';

export default function VideoAbout(props) {
      const [contentState, setContentState] = useContext(contentStateContext);
const [open, setOpen] = useState(false);

const [description, setDescription] = useState("");
useEffect(()=>{
    if(contentState?.VideoAbout==true)
setOpen(contentState?.VideoAbout)
},[contentState?.VideoAbout])
const handleSubmit = (e) => {
    e.preventDefault(); // prevent default close if button inside form
    if (!description.trim()) {
      return;
    }
    chrome.storage.local.set({ videoDescription: description }, () => {
      setOpen(false);
      contentState.startStreaming();
      });
  };
  return (
 
       <Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Overlay
    style={{
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      position: "fixed",
      inset: 0,
      zIndex: 999,
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
    }}
  />
  <Dialog.Content
    style={{
      backgroundColor: "white",
      borderRadius: "6px",
      boxShadow: "0 10px 15px rgba(0,0,0,0.3)",
      padding: "20px",
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      minWidth: "300px",
      zIndex: 1000,
    }}
    onPointerDownOutside={(e) => e.preventDefault()} // 🚫 Prevent outside click close
    onInteractOutside={(e) => e.preventDefault()}   // 🚫 Prevent outside interaction close
  >
    <label
      htmlFor="videoDescription"
      style={{
        display: "block",
        marginBottom: "15px",
        fontSize: "14px",
      }}
    >
      Can you tell us what is this video about?
    </label>

    <textarea
      id="videoDescription"
      rows={4}
      placeholder="Write your description here..."
      style={{
        width: "calc(100% - 16px)",
        padding: "8px",
        fontSize: "14px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        resize: "vertical",
      }}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
    />

    <Dialog.Close asChild>
      <button
        style={{
          marginTop: "15px",
          padding: "8px 16px",
          backgroundColor: "#ff9800",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
        onClick={handleSubmit}
      >
        Submit
      </button>
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>

    
  )
}
