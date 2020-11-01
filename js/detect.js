// Inject the iframe to retrieve camera sources
var iframe = document.createElement('iframe');
iframe.style.display = "none";
iframe.src = chrome.extension.getURL('./html/sources.html');
iframe.allow = "camera;microphone";
document.body.appendChild(iframe);