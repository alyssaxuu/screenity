import React from "react";
import { render } from "react-dom";
import Content from "./Content";

// Check if screenity-ui already exists, if so, remove it
const existingRoot = document.getElementById("screenity-ui");
if (existingRoot) {
  document.body.removeChild(existingRoot);
}



// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.type === "GET_COMPANY_ID") {
//         const COMPANY_ID = localStorage.getItem("COMPANY_ID");
//         const ACCESS_TOKEN = localStorage.getItem("ACCESS_TOKEN");
//         const SELLER_ID = localStorage.getItem("SELLER_ID");
//     sendResponse({ data: {COMPANY_ID,ACCESS_TOKEN,SELLER_ID} });
//   }else{

//   }
//   return true;
// });


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_COMPANY_ID") {
    const COMPANY_ID = localStorage.getItem("COMPANY_ID");
    const ACCESS_TOKEN = localStorage.getItem("ACCESS_TOKEN");
    const SELLER_ID = localStorage.getItem("SELLER_ID");

    // ✅ Check if any value is missing
    if (!COMPANY_ID || !ACCESS_TOKEN || !SELLER_ID) {
      // Redirect to login/setup page
      window.location.href = "https://devapp.demokraft.ai/";
    }else{
    sendResponse({ data: { COMPANY_ID, ACCESS_TOKEN, SELLER_ID } });

    } 
  }
  return true;
});


const root = document.createElement("div");
root.id = "screenity-ui";
document.body.appendChild(root);
render(<Content />, root);
