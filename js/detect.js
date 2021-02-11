// Inject the iframe to retrieve camera sources
var iframe = document.createElement('iframe');
iframe.style.display = "none";
iframe.src = chrome.extension.getURL('./html/sources.html');
iframe.allow = "camera";
document.body && document.body.appendChild(iframe);

var iframe = document.createElement('iframe');
iframe.style.display = "none";
iframe.src = chrome.extension.getURL('./html/audiosources.html');
iframe.allow = "microphone";
document.body && document.body.appendChild(iframe);
