(()=>{var e={1583:(e,t,n)=>{"use strict";var r=n(7294),a=n(7418),o=n(3840);
/** @license React v17.0.2
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */function s(e){for(var t="https://reactjs.org/docs/error-decoder.html?invariant="+e,n=1;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}if(!r)throw Error(s(227));var i=new Set,u={};function l(e,t){c(e,t),c(e+"Capture",t)}function c(e,t){for(u[e]=t,e=0;e<t.length;e++)i.add(t[e])}var p=!("undefined"==typeof window||void 0===window.document||void 0===window.document.createElement),d=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,f=Object.prototype.hasOwnProperty,h={},m={};function g(e,t,n,r,a,o,s){this.acceptsBooleans=2===t||3===t||4===t,this.attributeName=r,this.attributeNamespace=a,this.mustUseProperty=n,this.propertyName=e,this.type=t,this.sanitizeURL=o,this.removeEmptyString=s}var y={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach((function(e){y[e]=new g(e,0,!1,e,null,!1,!1)})),[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach((function(e){var t=e[0];y[t]=new g(t,1,!1,e[1],null,!1,!1)})),["contentEditable","draggable","spellCheck","value"].forEach((function(e){y[e]=new g(e,2,!1,e.toLowerCase(),null,!1,!1)})),["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach((function(e){y[e]=new g(e,2,!1,e,null,!1,!1)})),"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach((function(e){y[e]=new g(e,3,!1,e.toLowerCase(),null,!1,!1)})),["checked","multiple","muted","selected"].forEach((function(e){y[e]=new g(e,3,!0,e,null,!1,!1)})),["capture","download"].forEach((function(e){y[e]=new g(e,4,!1,e,null,!1,!1)})),["cols","rows","size","span"].forEach((function(e){y[e]=new g(e,6,!1,e,null,!1,!1)})),["rowSpan","start"].forEach((function(e){y[e]=new g(e,5,!1,e.toLowerCase(),null,!1,!1)}));var b=/[\-:]([a-z])/g;function v(e){return e[1].toUpperCase()}function w(e,t,n,r){var a=y.hasOwnProperty(t)?y[t]:null;(null!==a?0===a.type:!r&&(2<t.length&&("o"===t[0]||"O"===t[0])&&("n"===t[1]||"N"===t[1])))||(function(e,t,n,r){if(null==t||function(e,t,n,r){if(null!==n&&0===n.type)return!1;switch(typeof t){case"function":case"symbol":return!0;case"boolean":return!r&&(null!==n?!n.acceptsBooleans:"data-"!==(e=e.toLowerCase().slice(0,5))&&"aria-"!==e);default:return!1}}(e,t,n,r))return!0;if(r)return!1;if(null!==n)switch(n.type){case 3:return!t;case 4:return!1===t;case 5:return isNaN(t);case 6:return isNaN(t)||1>t}return!1}(t,n,a,r)&&(n=null),r||null===a?function(e){return!!f.call(m,e)||!f.call(h,e)&&(d.test(e)?m[e]=!0:(h[e]=!0,!1))}(t)&&(null===n?e.removeAttribute(t):e.setAttribute(t,""+n)):a.mustUseProperty?e[a.propertyName]=null===n?3!==a.type&&"":n:(t=a.attributeName,r=a.attributeNamespace,null===n?e.removeAttribute(t):(n=3===(a=a.type)||4===a&&!0===n?"":""+n,r?e.setAttributeNS(r,t,n):e.setAttribute(t,n))))}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach((function(e){var t=e.replace(b,v);y[t]=new g(t,1,!1,e,null,!1,!1)})),"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach((function(e){var t=e.replace(b,v);y[t]=new g(t,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)})),["xml:base","xml:lang","xml:space"].forEach((function(e){var t=e.replace(b,v);y[t]=new g(t,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)})),["tabIndex","crossOrigin"].forEach((function(e){y[e]=new g(e,1,!1,e.toLowerCase(),null,!1,!1)})),y.xlinkHref=new g("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1),["src","href","action","formAction"].forEach((function(e){y[e]=new g(e,1,!1,e.toLowerCase(),null,!0,!0)}));var x=r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,k=60103,S=60106,E=60107,N=60108,T=60114,_=60109,A=60110,I=60112,M=60113,O=60120,D=60115,C=60116,$=60121,R=60128,F=60129,P=60130,L=60131;if("function"==typeof Symbol&&Symbol.for){var z=Symbol.for;k=z("react.element"),S=z("react.portal"),E=z("react.fragment"),N=z("react.strict_mode"),T=z("react.profiler"),_=z("react.provider"),A=z("react.context"),I=z("react.forward_ref"),M=z("react.suspense"),O=z("react.suspense_list"),D=z("react.memo"),C=z("react.lazy"),$=z("react.block"),z("react.scope"),R=z("react.opaque.id"),F=z("react.debug_trace_mode"),P=z("react.offscreen"),L=z("react.legacy_hidden")}var B,V="function"==typeof Symbol&&Symbol.iterator;function U(e){return null===e||"object"!=typeof e?null:"function"==typeof(e=V&&e[V]||e["@@iterator"])?e:null}function j(e){if(void 0===B)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);B=t&&t[1]||""}return"\n"+B+e}var W=!1;function H(e,t){if(!e||W)return"";W=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(t)if(t=function(){throw Error()},Object.defineProperty(t.prototype,"props",{set:function(){throw Error()}}),"object"==typeof Reflect&&Reflect.construct){try{Reflect.construct(t,[])}catch(e){var r=e}Reflect.construct(e,[],t)}else{try{t.call()}catch(e){r=e}e.call(t.prototype)}else{try{throw Error()}catch(e){r=e}e()}}catch(e){if(e&&r&&"string"==typeof e.stack){for(var a=e.stack.split("\n"),o=r.stack.split("\n"),s=a.length-1,i=o.length-1;1<=s&&0<=i&&a[s]!==o[i];)i--;for(;1<=s&&0<=i;s--,i--)if(a[s]!==o[i]){if(1!==s||1!==i)do{if(s--,0>--i||a[s]!==o[i])return"\n"+a[s].replace(" at new "," at ")}while(1<=s&&0<=i);break}}}finally{W=!1,Error.prepareStackTrace=n}return(e=e?e.displayName||e.name:"")?j(e):""}function q(e){switch(e.tag){case 5:return j(e.type);case 16:return j("Lazy");case 13:return j("Suspense");case 19:return j("SuspenseList");case 0:case 2:case 15:return e=H(e.type,!1);case 11:return e=H(e.type.render,!1);case 22:return e=H(e.type._render,!1);case 1:return e=H(e.type,!0);default:return""}}function G(e){if(null==e)return null;if("function"==typeof e)return e.displayName||e.name||null;if("string"==typeof e)return e;switch(e){case E:return"Fragment";case S:return"Portal";case T:return"Profiler";case N:return"StrictMode";case M:return"Suspense";case O:return"SuspenseList"}if("object"==typeof e)switch(e.$$typeof){case A:return(e.displayName||"Context")+".Consumer";case _:return(e._context.displayName||"Context")+".Provider";case I:var t=e.render;return t=t.displayName||t.name||"",e.displayName||(""!==t?"ForwardRef("+t+")":"ForwardRef");case D:return G(e.type);case $:return G(e._render);case C:t=e._payload,e=e._init;try{return G(e(t))}catch(e){}}return null}function K(e){switch(typeof e){case"boolean":case"number":case"object":case"string":case"undefined":return e;default:return""}}function Q(e){var t=e.type;return(e=e.nodeName)&&"input"===e.toLowerCase()&&("checkbox"===t||"radio"===t)}function Y(e){e._valueTracker||(e._valueTracker=function(e){var t=Q(e)?"checked":"value",n=Object.getOwnPropertyDescriptor(e.constructor.prototype,t),r=""+e[t];if(!e.hasOwnProperty(t)&&void 0!==n&&"function"==typeof n.get&&"function"==typeof n.set){var a=n.get,o=n.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return a.call(this)},set:function(e){r=""+e,o.call(this,e)}}),Object.defineProperty(e,t,{enumerable:n.enumerable}),{getValue:function(){return r},setValue:function(e){r=""+e},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}(e))}function X(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r="";return e&&(r=Q(e)?e.checked?"true":"false":e.value),(e=r)!==n&&(t.setValue(e),!0)}function Z(e){if(void 0===(e=e||("undefined"!=typeof document?document:void 0)))return null;try{return e.activeElement||e.body}catch(t){return e.body}}function J(e,t){var n=t.checked;return a({},t,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:null!=n?n:e._wrapperState.initialChecked})}function ee(e,t){var n=null==t.defaultValue?"":t.defaultValue,r=null!=t.checked?t.checked:t.defaultChecked;n=K(null!=t.value?t.value:n),e._wrapperState={initialChecked:r,initialValue:n,controlled:"checkbox"===t.type||"radio"===t.type?null!=t.checked:null!=t.value}}function te(e,t){null!=(t=t.checked)&&w(e,"checked",t,!1)}function ne(e,t){te(e,t);var n=K(t.value),r=t.type;if(null!=n)"number"===r?(0===n&&""===e.value||e.value!=n)&&(e.value=""+n):e.value!==""+n&&(e.value=""+n);else if("submit"===r||"reset"===r)return void e.removeAttribute("value");t.hasOwnProperty("value")?ae(e,t.type,n):t.hasOwnProperty("defaultValue")&&ae(e,t.type,K(t.defaultValue)),null==t.checked&&null!=t.defaultChecked&&(e.defaultChecked=!!t.defaultChecked)}function re(e,t,n){if(t.hasOwnProperty("value")||t.hasOwnProperty("defaultValue")){var r=t.type;if(!("submit"!==r&&"reset"!==r||void 0!==t.value&&null!==t.value))return;t=""+e._wrapperState.initialValue,n||t===e.value||(e.value=t),e.defaultValue=t}""!==(n=e.name)&&(e.name=""),e.defaultChecked=!!e._wrapperState.initialChecked,""!==n&&(e.name=n)}function ae(e,t,n){"number"===t&&Z(e.ownerDocument)===e||(null==n?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+n&&(e.defaultValue=""+n))}function oe(e,t){return e=a({children:void 0},t),(t=function(e){var t="";return r.Children.forEach(e,(function(e){null!=e&&(t+=e)})),t}(t.children))&&(e.children=t),e}function se(e,t,n,r){if(e=e.options,t){t={};for(var a=0;a<n.length;a++)t["$"+n[a]]=!0;for(n=0;n<e.length;n++)a=t.hasOwnProperty("$"+e[n].value),e[n].selected!==a&&(e[n].selected=a),a&&r&&(e[n].defaultSelected=!0)}else{for(n=""+K(n),t=null,a=0;a<e.length;a++){if(e[a].value===n)return e[a].selected=!0,void(r&&(e[a].defaultSelected=!0));null!==t||e[a].disabled||(t=e[a])}null!==t&&(t.selected=!0)}}function ie(e,t){if(null!=t.dangerouslySetInnerHTML)throw Error(s(91));return a({},t,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function ue(e,t){var n=t.value;if(null==n){if(n=t.children,t=t.defaultValue,null!=n){if(null!=t)throw Error(s(92));if(Array.isArray(n)){if(!(1>=n.length))throw Error(s(93));n=n[0]}t=n}null==t&&(t=""),n=t}e._wrapperState={initialValue:K(n)}}function le(e,t){var n=K(t.value),r=K(t.defaultValue);null!=n&&((n=""+n)!==e.value&&(e.value=n),null==t.defaultValue&&e.defaultValue!==n&&(e.defaultValue=n)),null!=r&&(e.defaultValue=""+r)}function ce(e){var t=e.textContent;t===e._wrapperState.initialValue&&""!==t&&null!==t&&(e.value=t)}var pe={html:"http://www.w3.org/1999/xhtml",mathml:"http://www.w3.org/1998/Math/MathML",svg:"http://www.w3.org/2000/svg"};function de(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function fe(e,t){return null==e||"http://www.w3.org/1999/xhtml"===e?de(t):"http://www.w3.org/2000/svg"===e&&"foreignObject"===t?"http://www.w3.org/1999/xhtml":e}var he,me,ge=(me=function(e,t){if(e.namespaceURI!==pe.svg||"innerHTML"in e)e.innerHTML=t;else{for((he=he||document.createElement("div")).innerHTML="<svg>"+t.valueOf().toString()+"</svg>",t=he.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;t.firstChild;)e.appendChild(t.firstChild)}},"undefined"!=typeof MSApp&&MSApp.execUnsafeLocalFunction?function(e,t,n,r){MSApp.execUnsafeLocalFunction((function(){return me(e,t)}))}:me);function ye(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&3===n.nodeType)return void(n.nodeValue=t)}e.textContent=t}var be={animationIterationCount:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},ve=["Webkit","ms","Moz","O"];function we(e,t,n){return null==t||"boolean"==typeof t||""===t?"":n||"number"!=typeof t||0===t||be.hasOwnProperty(e)&&be[e]?(""+t).trim():t+"px"}function xe(e,t){for(var n in e=e.style,t)if(t.hasOwnProperty(n)){var r=0===n.indexOf("--"),a=we(n,t[n],r);"float"===n&&(n="cssFloat"),r?e.setProperty(n,a):e[n]=a}}Object.keys(be).forEach((function(e){ve.forEach((function(t){t=t+e.charAt(0).toUpperCase()+e.substring(1),be[t]=be[e]}))}));var ke=a({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function Se(e,t){if(t){if(ke[e]&&(null!=t.children||null!=t.dangerouslySetInnerHTML))throw Error(s(137,e));if(null!=t.dangerouslySetInnerHTML){if(null!=t.children)throw Error(s(60));if("object"!=typeof t.dangerouslySetInnerHTML||!("__html"in t.dangerouslySetInnerHTML))throw Error(s(61))}if(null!=t.style&&"object"!=typeof t.style)throw Error(s(62))}}function Ee(e,t){if(-1===e.indexOf("-"))return"string"==typeof t.is;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}function Ne(e){return(e=e.target||e.srcElement||window).correspondingUseElement&&(e=e.correspondingUseElement),3===e.nodeType?e.parentNode:e}var Te=null,_e=null,Ae=null;function Ie(e){if(e=na(e)){if("function"!=typeof Te)throw Error(s(280));var t=e.stateNode;t&&(t=aa(t),Te(e.stateNode,e.type,t))}}function Me(e){_e?Ae?Ae.push(e):Ae=[e]:_e=e}function Oe(){if(_e){var e=_e,t=Ae;if(Ae=_e=null,Ie(e),t)for(e=0;e<t.length;e++)Ie(t[e])}}function De(e,t){return e(t)}function Ce(e,t,n,r,a){return e(t,n,r,a)}function $e(){}var Re=De,Fe=!1,Pe=!1;function Le(){null===_e&&null===Ae||($e(),Oe())}function ze(e,t){var n=e.stateNode;if(null===n)return null;var r=aa(n);if(null===r)return null;n=r[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(r=!("button"===(e=e.type)||"input"===e||"select"===e||"textarea"===e)),e=!r;break e;default:e=!1}if(e)return null;if(n&&"function"!=typeof n)throw Error(s(231,t,typeof n));return n}var Be=!1;if(p)try{var Ve={};Object.defineProperty(Ve,"passive",{get:function(){Be=!0}}),window.addEventListener("test",Ve,Ve),window.removeEventListener("test",Ve,Ve)}catch(me){Be=!1}function Ue(e,t,n,r,a,o,s,i,u){var l=Array.prototype.slice.call(arguments,3);try{t.apply(n,l)}catch(e){this.onError(e)}}var je=!1,We=null,He=!1,qe=null,Ge={onError:function(e){je=!0,We=e}};function Ke(e,t,n,r,a,o,s,i,u){je=!1,We=null,Ue.apply(Ge,arguments)}function Qe(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do{0!=(1026&(t=e).flags)&&(n=t.return),e=t.return}while(e)}return 3===t.tag?n:null}function Ye(e){if(13===e.tag){var t=e.memoizedState;if(null===t&&(null!==(e=e.alternate)&&(t=e.memoizedState)),null!==t)return t.dehydrated}return null}function Xe(e){if(Qe(e)!==e)throw Error(s(188))}function Ze(e){if(e=function(e){var t=e.alternate;if(!t){if(null===(t=Qe(e)))throw Error(s(188));return t!==e?null:e}for(var n=e,r=t;;){var a=n.return;if(null===a)break;var o=a.alternate;if(null===o){if(null!==(r=a.return)){n=r;continue}break}if(a.child===o.child){for(o=a.child;o;){if(o===n)return Xe(a),e;if(o===r)return Xe(a),t;o=o.sibling}throw Error(s(188))}if(n.return!==r.return)n=a,r=o;else{for(var i=!1,u=a.child;u;){if(u===n){i=!0,n=a,r=o;break}if(u===r){i=!0,r=a,n=o;break}u=u.sibling}if(!i){for(u=o.child;u;){if(u===n){i=!0,n=o,r=a;break}if(u===r){i=!0,r=o,n=a;break}u=u.sibling}if(!i)throw Error(s(189))}}if(n.alternate!==r)throw Error(s(190))}if(3!==n.tag)throw Error(s(188));return n.stateNode.current===n?e:t}(e),!e)return null;for(var t=e;;){if(5===t.tag||6===t.tag)return t;if(t.child)t.child.return=t,t=t.child;else{if(t===e)break;for(;!t.sibling;){if(!t.return||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}}return null}function Je(e,t){for(var n=e.alternate;null!==t;){if(t===e||t===n)return!0;t=t.return}return!1}var et,tt,nt,rt,at=!1,ot=[],st=null,it=null,ut=null,lt=new Map,ct=new Map,pt=[],dt="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function ft(e,t,n,r,a){return{blockedOn:e,domEventName:t,eventSystemFlags:16|n,nativeEvent:a,targetContainers:[r]}}function ht(e,t){switch(e){case"focusin":case"focusout":st=null;break;case"dragenter":case"dragleave":it=null;break;case"mouseover":case"mouseout":ut=null;break;case"pointerover":case"pointerout":lt.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":ct.delete(t.pointerId)}}function mt(e,t,n,r,a,o){return null===e||e.nativeEvent!==o?(e=ft(t,n,r,a,o),null!==t&&(null!==(t=na(t))&&tt(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,null!==a&&-1===t.indexOf(a)&&t.push(a),e)}function gt(e){var t=ta(e.target);if(null!==t){var n=Qe(t);if(null!==n)if(13===(t=n.tag)){if(null!==(t=Ye(n)))return e.blockedOn=t,void rt(e.lanePriority,(function(){o.unstable_runWithPriority(e.priority,(function(){nt(n)}))}))}else if(3===t&&n.stateNode.hydrate)return void(e.blockedOn=3===n.tag?n.stateNode.containerInfo:null)}e.blockedOn=null}function yt(e){if(null!==e.blockedOn)return!1;for(var t=e.targetContainers;0<t.length;){var n=Zt(e.domEventName,e.eventSystemFlags,t[0],e.nativeEvent);if(null!==n)return null!==(t=na(n))&&tt(t),e.blockedOn=n,!1;t.shift()}return!0}function bt(e,t,n){yt(e)&&n.delete(t)}function vt(){for(at=!1;0<ot.length;){var e=ot[0];if(null!==e.blockedOn){null!==(e=na(e.blockedOn))&&et(e);break}for(var t=e.targetContainers;0<t.length;){var n=Zt(e.domEventName,e.eventSystemFlags,t[0],e.nativeEvent);if(null!==n){e.blockedOn=n;break}t.shift()}null===e.blockedOn&&ot.shift()}null!==st&&yt(st)&&(st=null),null!==it&&yt(it)&&(it=null),null!==ut&&yt(ut)&&(ut=null),lt.forEach(bt),ct.forEach(bt)}function wt(e,t){e.blockedOn===t&&(e.blockedOn=null,at||(at=!0,o.unstable_scheduleCallback(o.unstable_NormalPriority,vt)))}function xt(e){function t(t){return wt(t,e)}if(0<ot.length){wt(ot[0],e);for(var n=1;n<ot.length;n++){var r=ot[n];r.blockedOn===e&&(r.blockedOn=null)}}for(null!==st&&wt(st,e),null!==it&&wt(it,e),null!==ut&&wt(ut,e),lt.forEach(t),ct.forEach(t),n=0;n<pt.length;n++)(r=pt[n]).blockedOn===e&&(r.blockedOn=null);for(;0<pt.length&&null===(n=pt[0]).blockedOn;)gt(n),null===n.blockedOn&&pt.shift()}function kt(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var St={animationend:kt("Animation","AnimationEnd"),animationiteration:kt("Animation","AnimationIteration"),animationstart:kt("Animation","AnimationStart"),transitionend:kt("Transition","TransitionEnd")},Et={},Nt={};function Tt(e){if(Et[e])return Et[e];if(!St[e])return e;var t,n=St[e];for(t in n)if(n.hasOwnProperty(t)&&t in Nt)return Et[e]=n[t];return e}p&&(Nt=document.createElement("div").style,"AnimationEvent"in window||(delete St.animationend.animation,delete St.animationiteration.animation,delete St.animationstart.animation),"TransitionEvent"in window||delete St.transitionend.transition);var _t=Tt("animationend"),At=Tt("animationiteration"),It=Tt("animationstart"),Mt=Tt("transitionend"),Ot=new Map,Dt=new Map,Ct=["abort","abort",_t,"animationEnd",At,"animationIteration",It,"animationStart","canplay","canPlay","canplaythrough","canPlayThrough","durationchange","durationChange","emptied","emptied","encrypted","encrypted","ended","ended","error","error","gotpointercapture","gotPointerCapture","load","load","loadeddata","loadedData","loadedmetadata","loadedMetadata","loadstart","loadStart","lostpointercapture","lostPointerCapture","playing","playing","progress","progress","seeking","seeking","stalled","stalled","suspend","suspend","timeupdate","timeUpdate",Mt,"transitionEnd","waiting","waiting"];function $t(e,t){for(var n=0;n<e.length;n+=2){var r=e[n],a=e[n+1];a="on"+(a[0].toUpperCase()+a.slice(1)),Dt.set(r,t),Ot.set(r,a),l(a,[r])}}(0,o.unstable_now)();var Rt=8;function Ft(e){if(0!=(1&e))return Rt=15,1;if(0!=(2&e))return Rt=14,2;if(0!=(4&e))return Rt=13,4;var t=24&e;return 0!==t?(Rt=12,t):0!=(32&e)?(Rt=11,32):0!==(t=192&e)?(Rt=10,t):0!=(256&e)?(Rt=9,256):0!==(t=3584&e)?(Rt=8,t):0!=(4096&e)?(Rt=7,4096):0!==(t=4186112&e)?(Rt=6,t):0!==(t=62914560&e)?(Rt=5,t):67108864&e?(Rt=4,67108864):0!=(134217728&e)?(Rt=3,134217728):0!==(t=805306368&e)?(Rt=2,t):0!=(1073741824&e)?(Rt=1,1073741824):(Rt=8,e)}function Pt(e,t){var n=e.pendingLanes;if(0===n)return Rt=0;var r=0,a=0,o=e.expiredLanes,s=e.suspendedLanes,i=e.pingedLanes;if(0!==o)r=o,a=Rt=15;else if(0!==(o=134217727&n)){var u=o&~s;0!==u?(r=Ft(u),a=Rt):0!==(i&=o)&&(r=Ft(i),a=Rt)}else 0!==(o=n&~s)?(r=Ft(o),a=Rt):0!==i&&(r=Ft(i),a=Rt);if(0===r)return 0;if(r=n&((0>(r=31-jt(r))?0:1<<r)<<1)-1,0!==t&&t!==r&&0==(t&s)){if(Ft(t),a<=Rt)return t;Rt=a}if(0!==(t=e.entangledLanes))for(e=e.entanglements,t&=r;0<t;)a=1<<(n=31-jt(t)),r|=e[n],t&=~a;return r}function Lt(e){return 0!==(e=-1073741825&e.pendingLanes)?e:1073741824&e?1073741824:0}function zt(e,t){switch(e){case 15:return 1;case 14:return 2;case 12:return 0===(e=Bt(24&~t))?zt(10,t):e;case 10:return 0===(e=Bt(192&~t))?zt(8,t):e;case 8:return 0===(e=Bt(3584&~t))&&(0===(e=Bt(4186112&~t))&&(e=512)),e;case 2:return 0===(t=Bt(805306368&~t))&&(t=268435456),t}throw Error(s(358,e))}function Bt(e){return e&-e}function Vt(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function Ut(e,t,n){e.pendingLanes|=t;var r=t-1;e.suspendedLanes&=r,e.pingedLanes&=r,(e=e.eventTimes)[t=31-jt(t)]=n}var jt=Math.clz32?Math.clz32:function(e){return 0===e?32:31-(Wt(e)/Ht|0)|0},Wt=Math.log,Ht=Math.LN2;var qt=o.unstable_UserBlockingPriority,Gt=o.unstable_runWithPriority,Kt=!0;function Qt(e,t,n,r){Fe||$e();var a=Xt,o=Fe;Fe=!0;try{Ce(a,e,t,n,r)}finally{(Fe=o)||Le()}}function Yt(e,t,n,r){Gt(qt,Xt.bind(null,e,t,n,r))}function Xt(e,t,n,r){var a;if(Kt)if((a=0==(4&t))&&0<ot.length&&-1<dt.indexOf(e))e=ft(null,e,t,n,r),ot.push(e);else{var o=Zt(e,t,n,r);if(null===o)a&&ht(e,r);else{if(a){if(-1<dt.indexOf(e))return e=ft(o,e,t,n,r),void ot.push(e);if(function(e,t,n,r,a){switch(t){case"focusin":return st=mt(st,e,t,n,r,a),!0;case"dragenter":return it=mt(it,e,t,n,r,a),!0;case"mouseover":return ut=mt(ut,e,t,n,r,a),!0;case"pointerover":var o=a.pointerId;return lt.set(o,mt(lt.get(o)||null,e,t,n,r,a)),!0;case"gotpointercapture":return o=a.pointerId,ct.set(o,mt(ct.get(o)||null,e,t,n,r,a)),!0}return!1}(o,e,t,n,r))return;ht(e,r)}$r(e,t,r,null,n)}}}function Zt(e,t,n,r){var a=Ne(r);if(null!==(a=ta(a))){var o=Qe(a);if(null===o)a=null;else{var s=o.tag;if(13===s){if(null!==(a=Ye(o)))return a;a=null}else if(3===s){if(o.stateNode.hydrate)return 3===o.tag?o.stateNode.containerInfo:null;a=null}else o!==a&&(a=null)}}return $r(e,t,r,a,n),null}var Jt=null,en=null,tn=null;function nn(){if(tn)return tn;var e,t,n=en,r=n.length,a="value"in Jt?Jt.value:Jt.textContent,o=a.length;for(e=0;e<r&&n[e]===a[e];e++);var s=r-e;for(t=1;t<=s&&n[r-t]===a[o-t];t++);return tn=a.slice(e,1<t?1-t:void 0)}function rn(e){var t=e.keyCode;return"charCode"in e?0===(e=e.charCode)&&13===t&&(e=13):e=t,10===e&&(e=13),32<=e||13===e?e:0}function an(){return!0}function on(){return!1}function sn(e){function t(t,n,r,a,o){for(var s in this._reactName=t,this._targetInst=r,this.type=n,this.nativeEvent=a,this.target=o,this.currentTarget=null,e)e.hasOwnProperty(s)&&(t=e[s],this[s]=t?t(a):a[s]);return this.isDefaultPrevented=(null!=a.defaultPrevented?a.defaultPrevented:!1===a.returnValue)?an:on,this.isPropagationStopped=on,this}return a(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():"unknown"!=typeof e.returnValue&&(e.returnValue=!1),this.isDefaultPrevented=an)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():"unknown"!=typeof e.cancelBubble&&(e.cancelBubble=!0),this.isPropagationStopped=an)},persist:function(){},isPersistent:an}),t}var un,ln,cn,pn={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},dn=sn(pn),fn=a({},pn,{view:0,detail:0}),hn=sn(fn),mn=a({},fn,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:_n,button:0,buttons:0,relatedTarget:function(e){return void 0===e.relatedTarget?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==cn&&(cn&&"mousemove"===e.type?(un=e.screenX-cn.screenX,ln=e.screenY-cn.screenY):ln=un=0,cn=e),un)},movementY:function(e){return"movementY"in e?e.movementY:ln}}),gn=sn(mn),yn=sn(a({},mn,{dataTransfer:0})),bn=sn(a({},fn,{relatedTarget:0})),vn=sn(a({},pn,{animationName:0,elapsedTime:0,pseudoElement:0})),wn=a({},pn,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),xn=sn(wn),kn=sn(a({},pn,{data:0})),Sn={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},En={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Nn={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Tn(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):!!(e=Nn[e])&&!!t[e]}function _n(){return Tn}var An=a({},fn,{key:function(e){if(e.key){var t=Sn[e.key]||e.key;if("Unidentified"!==t)return t}return"keypress"===e.type?13===(e=rn(e))?"Enter":String.fromCharCode(e):"keydown"===e.type||"keyup"===e.type?En[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:_n,charCode:function(e){return"keypress"===e.type?rn(e):0},keyCode:function(e){return"keydown"===e.type||"keyup"===e.type?e.keyCode:0},which:function(e){return"keypress"===e.type?rn(e):"keydown"===e.type||"keyup"===e.type?e.keyCode:0}}),In=sn(An),Mn=sn(a({},mn,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0})),On=sn(a({},fn,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:_n})),Dn=sn(a({},pn,{propertyName:0,elapsedTime:0,pseudoElement:0})),Cn=a({},mn,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),$n=sn(Cn),Rn=[9,13,27,32],Fn=p&&"CompositionEvent"in window,Pn=null;p&&"documentMode"in document&&(Pn=document.documentMode);var Ln=p&&"TextEvent"in window&&!Pn,zn=p&&(!Fn||Pn&&8<Pn&&11>=Pn),Bn=String.fromCharCode(32),Vn=!1;function Un(e,t){switch(e){case"keyup":return-1!==Rn.indexOf(t.keyCode);case"keydown":return 229!==t.keyCode;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function jn(e){return"object"==typeof(e=e.detail)&&"data"in e?e.data:null}var Wn=!1;var Hn={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function qn(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return"input"===t?!!Hn[e.type]:"textarea"===t}function Gn(e,t,n,r){Me(r),0<(t=Fr(t,"onChange")).length&&(n=new dn("onChange","change",null,n,r),e.push({event:n,listeners:t}))}var Kn=null,Qn=null;function Yn(e){Ar(e,0)}function Xn(e){if(X(ra(e)))return e}function Zn(e,t){if("change"===e)return t}var Jn=!1;if(p){var er;if(p){var tr="oninput"in document;if(!tr){var nr=document.createElement("div");nr.setAttribute("oninput","return;"),tr="function"==typeof nr.oninput}er=tr}else er=!1;Jn=er&&(!document.documentMode||9<document.documentMode)}function rr(){Kn&&(Kn.detachEvent("onpropertychange",ar),Qn=Kn=null)}function ar(e){if("value"===e.propertyName&&Xn(Qn)){var t=[];if(Gn(t,Qn,e,Ne(e)),e=Yn,Fe)e(t);else{Fe=!0;try{De(e,t)}finally{Fe=!1,Le()}}}}function or(e,t,n){"focusin"===e?(rr(),Qn=n,(Kn=t).attachEvent("onpropertychange",ar)):"focusout"===e&&rr()}function sr(e){if("selectionchange"===e||"keyup"===e||"keydown"===e)return Xn(Qn)}function ir(e,t){if("click"===e)return Xn(t)}function ur(e,t){if("input"===e||"change"===e)return Xn(t)}var lr="function"==typeof Object.is?Object.is:function(e,t){return e===t&&(0!==e||1/e==1/t)||e!=e&&t!=t},cr=Object.prototype.hasOwnProperty;function pr(e,t){if(lr(e,t))return!0;if("object"!=typeof e||null===e||"object"!=typeof t||null===t)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++)if(!cr.call(t,n[r])||!lr(e[n[r]],t[n[r]]))return!1;return!0}function dr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function fr(e,t){var n,r=dr(e);for(e=0;r;){if(3===r.nodeType){if(n=e+r.textContent.length,e<=t&&n>=t)return{node:r,offset:t-e};e=n}e:{for(;r;){if(r.nextSibling){r=r.nextSibling;break e}r=r.parentNode}r=void 0}r=dr(r)}}function hr(e,t){return!(!e||!t)&&(e===t||(!e||3!==e.nodeType)&&(t&&3===t.nodeType?hr(e,t.parentNode):"contains"in e?e.contains(t):!!e.compareDocumentPosition&&!!(16&e.compareDocumentPosition(t))))}function mr(){for(var e=window,t=Z();t instanceof e.HTMLIFrameElement;){try{var n="string"==typeof t.contentWindow.location.href}catch(e){n=!1}if(!n)break;t=Z((e=t.contentWindow).document)}return t}function gr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&("input"===t&&("text"===e.type||"search"===e.type||"tel"===e.type||"url"===e.type||"password"===e.type)||"textarea"===t||"true"===e.contentEditable)}var yr=p&&"documentMode"in document&&11>=document.documentMode,br=null,vr=null,wr=null,xr=!1;function kr(e,t,n){var r=n.window===n?n.document:9===n.nodeType?n:n.ownerDocument;xr||null==br||br!==Z(r)||("selectionStart"in(r=br)&&gr(r)?r={start:r.selectionStart,end:r.selectionEnd}:r={anchorNode:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection()).anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset},wr&&pr(wr,r)||(wr=r,0<(r=Fr(vr,"onSelect")).length&&(t=new dn("onSelect","select",null,t,n),e.push({event:t,listeners:r}),t.target=br)))}$t("cancel cancel click click close close contextmenu contextMenu copy copy cut cut auxclick auxClick dblclick doubleClick dragend dragEnd dragstart dragStart drop drop focusin focus focusout blur input input invalid invalid keydown keyDown keypress keyPress keyup keyUp mousedown mouseDown mouseup mouseUp paste paste pause pause play play pointercancel pointerCancel pointerdown pointerDown pointerup pointerUp ratechange rateChange reset reset seeked seeked submit submit touchcancel touchCancel touchend touchEnd touchstart touchStart volumechange volumeChange".split(" "),0),$t("drag drag dragenter dragEnter dragexit dragExit dragleave dragLeave dragover dragOver mousemove mouseMove mouseout mouseOut mouseover mouseOver pointermove pointerMove pointerout pointerOut pointerover pointerOver scroll scroll toggle toggle touchmove touchMove wheel wheel".split(" "),1),$t(Ct,2);for(var Sr="change selectionchange textInput compositionstart compositionend compositionupdate".split(" "),Er=0;Er<Sr.length;Er++)Dt.set(Sr[Er],0);c("onMouseEnter",["mouseout","mouseover"]),c("onMouseLeave",["mouseout","mouseover"]),c("onPointerEnter",["pointerout","pointerover"]),c("onPointerLeave",["pointerout","pointerover"]),l("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),l("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),l("onBeforeInput",["compositionend","keypress","textInput","paste"]),l("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),l("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),l("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Nr="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Tr=new Set("cancel close invalid load scroll toggle".split(" ").concat(Nr));function _r(e,t,n){var r=e.type||"unknown-event";e.currentTarget=n,function(e,t,n,r,a,o,i,u,l){if(Ke.apply(this,arguments),je){if(!je)throw Error(s(198));var c=We;je=!1,We=null,He||(He=!0,qe=c)}}(r,t,void 0,e),e.currentTarget=null}function Ar(e,t){t=0!=(4&t);for(var n=0;n<e.length;n++){var r=e[n],a=r.event;r=r.listeners;e:{var o=void 0;if(t)for(var s=r.length-1;0<=s;s--){var i=r[s],u=i.instance,l=i.currentTarget;if(i=i.listener,u!==o&&a.isPropagationStopped())break e;_r(a,i,l),o=u}else for(s=0;s<r.length;s++){if(u=(i=r[s]).instance,l=i.currentTarget,i=i.listener,u!==o&&a.isPropagationStopped())break e;_r(a,i,l),o=u}}}if(He)throw e=qe,He=!1,qe=null,e}function Ir(e,t){var n=oa(t),r=e+"__bubble";n.has(r)||(Cr(t,e,2,!1),n.add(r))}var Mr="_reactListening"+Math.random().toString(36).slice(2);function Or(e){e[Mr]||(e[Mr]=!0,i.forEach((function(t){Tr.has(t)||Dr(t,!1,e,null),Dr(t,!0,e,null)})))}function Dr(e,t,n,r){var a=4<arguments.length&&void 0!==arguments[4]?arguments[4]:0,o=n;if("selectionchange"===e&&9!==n.nodeType&&(o=n.ownerDocument),null!==r&&!t&&Tr.has(e)){if("scroll"!==e)return;a|=2,o=r}var s=oa(o),i=e+"__"+(t?"capture":"bubble");s.has(i)||(t&&(a|=4),Cr(o,e,a,t),s.add(i))}function Cr(e,t,n,r){var a=Dt.get(t);switch(void 0===a?2:a){case 0:a=Qt;break;case 1:a=Yt;break;default:a=Xt}n=a.bind(null,t,n,e),a=void 0,!Be||"touchstart"!==t&&"touchmove"!==t&&"wheel"!==t||(a=!0),r?void 0!==a?e.addEventListener(t,n,{capture:!0,passive:a}):e.addEventListener(t,n,!0):void 0!==a?e.addEventListener(t,n,{passive:a}):e.addEventListener(t,n,!1)}function $r(e,t,n,r,a){var o=r;if(0==(1&t)&&0==(2&t)&&null!==r)e:for(;;){if(null===r)return;var s=r.tag;if(3===s||4===s){var i=r.stateNode.containerInfo;if(i===a||8===i.nodeType&&i.parentNode===a)break;if(4===s)for(s=r.return;null!==s;){var u=s.tag;if((3===u||4===u)&&((u=s.stateNode.containerInfo)===a||8===u.nodeType&&u.parentNode===a))return;s=s.return}for(;null!==i;){if(null===(s=ta(i)))return;if(5===(u=s.tag)||6===u){r=o=s;continue e}i=i.parentNode}}r=r.return}!function(e,t,n){if(Pe)return e(t,n);Pe=!0;try{return Re(e,t,n)}finally{Pe=!1,Le()}}((function(){var r=o,a=Ne(n),s=[];e:{var i=Ot.get(e);if(void 0!==i){var u=dn,l=e;switch(e){case"keypress":if(0===rn(n))break e;case"keydown":case"keyup":u=In;break;case"focusin":l="focus",u=bn;break;case"focusout":l="blur",u=bn;break;case"beforeblur":case"afterblur":u=bn;break;case"click":if(2===n.button)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":u=gn;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":u=yn;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":u=On;break;case _t:case At:case It:u=vn;break;case Mt:u=Dn;break;case"scroll":u=hn;break;case"wheel":u=$n;break;case"copy":case"cut":case"paste":u=xn;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":u=Mn}var c=0!=(4&t),p=!c&&"scroll"===e,d=c?null!==i?i+"Capture":null:i;c=[];for(var f,h=r;null!==h;){var m=(f=h).stateNode;if(5===f.tag&&null!==m&&(f=m,null!==d&&(null!=(m=ze(h,d))&&c.push(Rr(h,m,f)))),p)break;h=h.return}0<c.length&&(i=new u(i,l,null,n,a),s.push({event:i,listeners:c}))}}if(0==(7&t)){if(u="mouseout"===e||"pointerout"===e,(!(i="mouseover"===e||"pointerover"===e)||0!=(16&t)||!(l=n.relatedTarget||n.fromElement)||!ta(l)&&!l[Jr])&&(u||i)&&(i=a.window===a?a:(i=a.ownerDocument)?i.defaultView||i.parentWindow:window,u?(u=r,null!==(l=(l=n.relatedTarget||n.toElement)?ta(l):null)&&(l!==(p=Qe(l))||5!==l.tag&&6!==l.tag)&&(l=null)):(u=null,l=r),u!==l)){if(c=gn,m="onMouseLeave",d="onMouseEnter",h="mouse","pointerout"!==e&&"pointerover"!==e||(c=Mn,m="onPointerLeave",d="onPointerEnter",h="pointer"),p=null==u?i:ra(u),f=null==l?i:ra(l),(i=new c(m,h+"leave",u,n,a)).target=p,i.relatedTarget=f,m=null,ta(a)===r&&((c=new c(d,h+"enter",l,n,a)).target=f,c.relatedTarget=p,m=c),p=m,u&&l)e:{for(d=l,h=0,f=c=u;f;f=Pr(f))h++;for(f=0,m=d;m;m=Pr(m))f++;for(;0<h-f;)c=Pr(c),h--;for(;0<f-h;)d=Pr(d),f--;for(;h--;){if(c===d||null!==d&&c===d.alternate)break e;c=Pr(c),d=Pr(d)}c=null}else c=null;null!==u&&Lr(s,i,u,c,!1),null!==l&&null!==p&&Lr(s,p,l,c,!0)}if("select"===(u=(i=r?ra(r):window).nodeName&&i.nodeName.toLowerCase())||"input"===u&&"file"===i.type)var g=Zn;else if(qn(i))if(Jn)g=ur;else{g=sr;var y=or}else(u=i.nodeName)&&"input"===u.toLowerCase()&&("checkbox"===i.type||"radio"===i.type)&&(g=ir);switch(g&&(g=g(e,r))?Gn(s,g,n,a):(y&&y(e,i,r),"focusout"===e&&(y=i._wrapperState)&&y.controlled&&"number"===i.type&&ae(i,"number",i.value)),y=r?ra(r):window,e){case"focusin":(qn(y)||"true"===y.contentEditable)&&(br=y,vr=r,wr=null);break;case"focusout":wr=vr=br=null;break;case"mousedown":xr=!0;break;case"contextmenu":case"mouseup":case"dragend":xr=!1,kr(s,n,a);break;case"selectionchange":if(yr)break;case"keydown":case"keyup":kr(s,n,a)}var b;if(Fn)e:{switch(e){case"compositionstart":var v="onCompositionStart";break e;case"compositionend":v="onCompositionEnd";break e;case"compositionupdate":v="onCompositionUpdate";break e}v=void 0}else Wn?Un(e,n)&&(v="onCompositionEnd"):"keydown"===e&&229===n.keyCode&&(v="onCompositionStart");v&&(zn&&"ko"!==n.locale&&(Wn||"onCompositionStart"!==v?"onCompositionEnd"===v&&Wn&&(b=nn()):(en="value"in(Jt=a)?Jt.value:Jt.textContent,Wn=!0)),0<(y=Fr(r,v)).length&&(v=new kn(v,e,null,n,a),s.push({event:v,listeners:y}),b?v.data=b:null!==(b=jn(n))&&(v.data=b))),(b=Ln?function(e,t){switch(e){case"compositionend":return jn(t);case"keypress":return 32!==t.which?null:(Vn=!0,Bn);case"textInput":return(e=t.data)===Bn&&Vn?null:e;default:return null}}(e,n):function(e,t){if(Wn)return"compositionend"===e||!Fn&&Un(e,t)?(e=nn(),tn=en=Jt=null,Wn=!1,e):null;switch(e){case"paste":default:return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return zn&&"ko"!==t.locale?null:t.data}}(e,n))&&(0<(r=Fr(r,"onBeforeInput")).length&&(a=new kn("onBeforeInput","beforeinput",null,n,a),s.push({event:a,listeners:r}),a.data=b))}Ar(s,t)}))}function Rr(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Fr(e,t){for(var n=t+"Capture",r=[];null!==e;){var a=e,o=a.stateNode;5===a.tag&&null!==o&&(a=o,null!=(o=ze(e,n))&&r.unshift(Rr(e,o,a)),null!=(o=ze(e,t))&&r.push(Rr(e,o,a))),e=e.return}return r}function Pr(e){if(null===e)return null;do{e=e.return}while(e&&5!==e.tag);return e||null}function Lr(e,t,n,r,a){for(var o=t._reactName,s=[];null!==n&&n!==r;){var i=n,u=i.alternate,l=i.stateNode;if(null!==u&&u===r)break;5===i.tag&&null!==l&&(i=l,a?null!=(u=ze(n,o))&&s.unshift(Rr(n,u,i)):a||null!=(u=ze(n,o))&&s.push(Rr(n,u,i))),n=n.return}0!==s.length&&e.push({event:t,listeners:s})}function zr(){}var Br=null,Vr=null;function Ur(e,t){switch(e){case"button":case"input":case"select":case"textarea":return!!t.autoFocus}return!1}function jr(e,t){return"textarea"===e||"option"===e||"noscript"===e||"string"==typeof t.children||"number"==typeof t.children||"object"==typeof t.dangerouslySetInnerHTML&&null!==t.dangerouslySetInnerHTML&&null!=t.dangerouslySetInnerHTML.__html}var Wr="function"==typeof setTimeout?setTimeout:void 0,Hr="function"==typeof clearTimeout?clearTimeout:void 0;function qr(e){1===e.nodeType?e.textContent="":9===e.nodeType&&(null!=(e=e.body)&&(e.textContent=""))}function Gr(e){for(;null!=e;e=e.nextSibling){var t=e.nodeType;if(1===t||3===t)break}return e}function Kr(e){e=e.previousSibling;for(var t=0;e;){if(8===e.nodeType){var n=e.data;if("$"===n||"$!"===n||"$?"===n){if(0===t)return e;t--}else"/$"===n&&t++}e=e.previousSibling}return null}var Qr=0;var Yr=Math.random().toString(36).slice(2),Xr="__reactFiber$"+Yr,Zr="__reactProps$"+Yr,Jr="__reactContainer$"+Yr,ea="__reactEvents$"+Yr;function ta(e){var t=e[Xr];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Jr]||n[Xr]){if(n=t.alternate,null!==t.child||null!==n&&null!==n.child)for(e=Kr(e);null!==e;){if(n=e[Xr])return n;e=Kr(e)}return t}n=(e=n).parentNode}return null}function na(e){return!(e=e[Xr]||e[Jr])||5!==e.tag&&6!==e.tag&&13!==e.tag&&3!==e.tag?null:e}function ra(e){if(5===e.tag||6===e.tag)return e.stateNode;throw Error(s(33))}function aa(e){return e[Zr]||null}function oa(e){var t=e[ea];return void 0===t&&(t=e[ea]=new Set),t}var sa=[],ia=-1;function ua(e){return{current:e}}function la(e){0>ia||(e.current=sa[ia],sa[ia]=null,ia--)}function ca(e,t){ia++,sa[ia]=e.current,e.current=t}var pa={},da=ua(pa),fa=ua(!1),ha=pa;function ma(e,t){var n=e.type.contextTypes;if(!n)return pa;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===t)return r.__reactInternalMemoizedMaskedChildContext;var a,o={};for(a in n)o[a]=t[a];return r&&((e=e.stateNode).__reactInternalMemoizedUnmaskedChildContext=t,e.__reactInternalMemoizedMaskedChildContext=o),o}function ga(e){return null!=(e=e.childContextTypes)}function ya(){la(fa),la(da)}function ba(e,t,n){if(da.current!==pa)throw Error(s(168));ca(da,t),ca(fa,n)}function va(e,t,n){var r=e.stateNode;if(e=t.childContextTypes,"function"!=typeof r.getChildContext)return n;for(var o in r=r.getChildContext())if(!(o in e))throw Error(s(108,G(t)||"Unknown",o));return a({},n,r)}function wa(e){return e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||pa,ha=da.current,ca(da,e),ca(fa,fa.current),!0}function xa(e,t,n){var r=e.stateNode;if(!r)throw Error(s(169));n?(e=va(e,t,ha),r.__reactInternalMemoizedMergedChildContext=e,la(fa),la(da),ca(da,e)):la(fa),ca(fa,n)}var ka=null,Sa=null,Ea=o.unstable_runWithPriority,Na=o.unstable_scheduleCallback,Ta=o.unstable_cancelCallback,_a=o.unstable_shouldYield,Aa=o.unstable_requestPaint,Ia=o.unstable_now,Ma=o.unstable_getCurrentPriorityLevel,Oa=o.unstable_ImmediatePriority,Da=o.unstable_UserBlockingPriority,Ca=o.unstable_NormalPriority,$a=o.unstable_LowPriority,Ra=o.unstable_IdlePriority,Fa={},Pa=void 0!==Aa?Aa:function(){},La=null,za=null,Ba=!1,Va=Ia(),Ua=1e4>Va?Ia:function(){return Ia()-Va};function ja(){switch(Ma()){case Oa:return 99;case Da:return 98;case Ca:return 97;case $a:return 96;case Ra:return 95;default:throw Error(s(332))}}function Wa(e){switch(e){case 99:return Oa;case 98:return Da;case 97:return Ca;case 96:return $a;case 95:return Ra;default:throw Error(s(332))}}function Ha(e,t){return e=Wa(e),Ea(e,t)}function qa(e,t,n){return e=Wa(e),Na(e,t,n)}function Ga(){if(null!==za){var e=za;za=null,Ta(e)}Ka()}function Ka(){if(!Ba&&null!==La){Ba=!0;var e=0;try{var t=La;Ha(99,(function(){for(;e<t.length;e++){var n=t[e];do{n=n(!0)}while(null!==n)}})),La=null}catch(t){throw null!==La&&(La=La.slice(e+1)),Na(Oa,Ga),t}finally{Ba=!1}}}var Qa=x.ReactCurrentBatchConfig;function Ya(e,t){if(e&&e.defaultProps){for(var n in t=a({},t),e=e.defaultProps)void 0===t[n]&&(t[n]=e[n]);return t}return t}var Xa=ua(null),Za=null,Ja=null,eo=null;function to(){eo=Ja=Za=null}function no(e){var t=Xa.current;la(Xa),e.type._context._currentValue=t}function ro(e,t){for(;null!==e;){var n=e.alternate;if((e.childLanes&t)===t){if(null===n||(n.childLanes&t)===t)break;n.childLanes|=t}else e.childLanes|=t,null!==n&&(n.childLanes|=t);e=e.return}}function ao(e,t){Za=e,eo=Ja=null,null!==(e=e.dependencies)&&null!==e.firstContext&&(0!=(e.lanes&t)&&(Fs=!0),e.firstContext=null)}function oo(e,t){if(eo!==e&&!1!==t&&0!==t)if("number"==typeof t&&1073741823!==t||(eo=e,t=1073741823),t={context:e,observedBits:t,next:null},null===Ja){if(null===Za)throw Error(s(308));Ja=t,Za.dependencies={lanes:0,firstContext:t,responders:null}}else Ja=Ja.next=t;return e._currentValue}var so=!1;function io(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null},effects:null}}function uo(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function lo(e,t){return{eventTime:e,lane:t,tag:0,payload:null,callback:null,next:null}}function co(e,t){if(null!==(e=e.updateQueue)){var n=(e=e.shared).pending;null===n?t.next=t:(t.next=n.next,n.next=t),e.pending=t}}function po(e,t){var n=e.updateQueue,r=e.alternate;if(null!==r&&n===(r=r.updateQueue)){var a=null,o=null;if(null!==(n=n.firstBaseUpdate)){do{var s={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};null===o?a=o=s:o=o.next=s,n=n.next}while(null!==n);null===o?a=o=t:o=o.next=t}else a=o=t;return n={baseState:r.baseState,firstBaseUpdate:a,lastBaseUpdate:o,shared:r.shared,effects:r.effects},void(e.updateQueue=n)}null===(e=n.lastBaseUpdate)?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}function fo(e,t,n,r){var o=e.updateQueue;so=!1;var s=o.firstBaseUpdate,i=o.lastBaseUpdate,u=o.shared.pending;if(null!==u){o.shared.pending=null;var l=u,c=l.next;l.next=null,null===i?s=c:i.next=c,i=l;var p=e.alternate;if(null!==p){var d=(p=p.updateQueue).lastBaseUpdate;d!==i&&(null===d?p.firstBaseUpdate=c:d.next=c,p.lastBaseUpdate=l)}}if(null!==s){for(d=o.baseState,i=0,p=c=l=null;;){u=s.lane;var f=s.eventTime;if((r&u)===u){null!==p&&(p=p.next={eventTime:f,lane:0,tag:s.tag,payload:s.payload,callback:s.callback,next:null});e:{var h=e,m=s;switch(u=t,f=n,m.tag){case 1:if("function"==typeof(h=m.payload)){d=h.call(f,d,u);break e}d=h;break e;case 3:h.flags=-4097&h.flags|64;case 0:if(null==(u="function"==typeof(h=m.payload)?h.call(f,d,u):h))break e;d=a({},d,u);break e;case 2:so=!0}}null!==s.callback&&(e.flags|=32,null===(u=o.effects)?o.effects=[s]:u.push(s))}else f={eventTime:f,lane:u,tag:s.tag,payload:s.payload,callback:s.callback,next:null},null===p?(c=p=f,l=d):p=p.next=f,i|=u;if(null===(s=s.next)){if(null===(u=o.shared.pending))break;s=u.next,u.next=null,o.lastBaseUpdate=u,o.shared.pending=null}}null===p&&(l=d),o.baseState=l,o.firstBaseUpdate=c,o.lastBaseUpdate=p,Vi|=i,e.lanes=i,e.memoizedState=d}}function ho(e,t,n){if(e=t.effects,t.effects=null,null!==e)for(t=0;t<e.length;t++){var r=e[t],a=r.callback;if(null!==a){if(r.callback=null,r=n,"function"!=typeof a)throw Error(s(191,a));a.call(r)}}}var mo=(new r.Component).refs;function go(e,t,n,r){n=null==(n=n(r,t=e.memoizedState))?t:a({},t,n),e.memoizedState=n,0===e.lanes&&(e.updateQueue.baseState=n)}var yo={isMounted:function(e){return!!(e=e._reactInternals)&&Qe(e)===e},enqueueSetState:function(e,t,n){e=e._reactInternals;var r=du(),a=fu(e),o=lo(r,a);o.payload=t,null!=n&&(o.callback=n),co(e,o),hu(e,a,r)},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=du(),a=fu(e),o=lo(r,a);o.tag=1,o.payload=t,null!=n&&(o.callback=n),co(e,o),hu(e,a,r)},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=du(),r=fu(e),a=lo(n,r);a.tag=2,null!=t&&(a.callback=t),co(e,a),hu(e,r,n)}};function bo(e,t,n,r,a,o,s){return"function"==typeof(e=e.stateNode).shouldComponentUpdate?e.shouldComponentUpdate(r,o,s):!t.prototype||!t.prototype.isPureReactComponent||(!pr(n,r)||!pr(a,o))}function vo(e,t,n){var r=!1,a=pa,o=t.contextType;return"object"==typeof o&&null!==o?o=oo(o):(a=ga(t)?ha:da.current,o=(r=null!=(r=t.contextTypes))?ma(e,a):pa),t=new t(n,o),e.memoizedState=null!==t.state&&void 0!==t.state?t.state:null,t.updater=yo,e.stateNode=t,t._reactInternals=e,r&&((e=e.stateNode).__reactInternalMemoizedUnmaskedChildContext=a,e.__reactInternalMemoizedMaskedChildContext=o),t}function wo(e,t,n,r){e=t.state,"function"==typeof t.componentWillReceiveProps&&t.componentWillReceiveProps(n,r),"function"==typeof t.UNSAFE_componentWillReceiveProps&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&yo.enqueueReplaceState(t,t.state,null)}function xo(e,t,n,r){var a=e.stateNode;a.props=n,a.state=e.memoizedState,a.refs=mo,io(e);var o=t.contextType;"object"==typeof o&&null!==o?a.context=oo(o):(o=ga(t)?ha:da.current,a.context=ma(e,o)),fo(e,n,a,r),a.state=e.memoizedState,"function"==typeof(o=t.getDerivedStateFromProps)&&(go(e,t,o,n),a.state=e.memoizedState),"function"==typeof t.getDerivedStateFromProps||"function"==typeof a.getSnapshotBeforeUpdate||"function"!=typeof a.UNSAFE_componentWillMount&&"function"!=typeof a.componentWillMount||(t=a.state,"function"==typeof a.componentWillMount&&a.componentWillMount(),"function"==typeof a.UNSAFE_componentWillMount&&a.UNSAFE_componentWillMount(),t!==a.state&&yo.enqueueReplaceState(a,a.state,null),fo(e,n,a,r),a.state=e.memoizedState),"function"==typeof a.componentDidMount&&(e.flags|=4)}var ko=Array.isArray;function So(e,t,n){if(null!==(e=n.ref)&&"function"!=typeof e&&"object"!=typeof e){if(n._owner){if(n=n._owner){if(1!==n.tag)throw Error(s(309));var r=n.stateNode}if(!r)throw Error(s(147,e));var a=""+e;return null!==t&&null!==t.ref&&"function"==typeof t.ref&&t.ref._stringRef===a?t.ref:(t=function(e){var t=r.refs;t===mo&&(t=r.refs={}),null===e?delete t[a]:t[a]=e},t._stringRef=a,t)}if("string"!=typeof e)throw Error(s(284));if(!n._owner)throw Error(s(290,e))}return e}function Eo(e,t){if("textarea"!==e.type)throw Error(s(31,"[object Object]"===Object.prototype.toString.call(t)?"object with keys {"+Object.keys(t).join(", ")+"}":t))}function No(e){function t(t,n){if(e){var r=t.lastEffect;null!==r?(r.nextEffect=n,t.lastEffect=n):t.firstEffect=t.lastEffect=n,n.nextEffect=null,n.flags=8}}function n(n,r){if(!e)return null;for(;null!==r;)t(n,r),r=r.sibling;return null}function r(e,t){for(e=new Map;null!==t;)null!==t.key?e.set(t.key,t):e.set(t.index,t),t=t.sibling;return e}function a(e,t){return(e=qu(e,t)).index=0,e.sibling=null,e}function o(t,n,r){return t.index=r,e?null!==(r=t.alternate)?(r=r.index)<n?(t.flags=2,n):r:(t.flags=2,n):n}function i(t){return e&&null===t.alternate&&(t.flags=2),t}function u(e,t,n,r){return null===t||6!==t.tag?((t=Yu(n,e.mode,r)).return=e,t):((t=a(t,n)).return=e,t)}function l(e,t,n,r){return null!==t&&t.elementType===n.type?((r=a(t,n.props)).ref=So(e,t,n),r.return=e,r):((r=Gu(n.type,n.key,n.props,null,e.mode,r)).ref=So(e,t,n),r.return=e,r)}function c(e,t,n,r){return null===t||4!==t.tag||t.stateNode.containerInfo!==n.containerInfo||t.stateNode.implementation!==n.implementation?((t=Xu(n,e.mode,r)).return=e,t):((t=a(t,n.children||[])).return=e,t)}function p(e,t,n,r,o){return null===t||7!==t.tag?((t=Ku(n,e.mode,r,o)).return=e,t):((t=a(t,n)).return=e,t)}function d(e,t,n){if("string"==typeof t||"number"==typeof t)return(t=Yu(""+t,e.mode,n)).return=e,t;if("object"==typeof t&&null!==t){switch(t.$$typeof){case k:return(n=Gu(t.type,t.key,t.props,null,e.mode,n)).ref=So(e,null,t),n.return=e,n;case S:return(t=Xu(t,e.mode,n)).return=e,t}if(ko(t)||U(t))return(t=Ku(t,e.mode,n,null)).return=e,t;Eo(e,t)}return null}function f(e,t,n,r){var a=null!==t?t.key:null;if("string"==typeof n||"number"==typeof n)return null!==a?null:u(e,t,""+n,r);if("object"==typeof n&&null!==n){switch(n.$$typeof){case k:return n.key===a?n.type===E?p(e,t,n.props.children,r,a):l(e,t,n,r):null;case S:return n.key===a?c(e,t,n,r):null}if(ko(n)||U(n))return null!==a?null:p(e,t,n,r,null);Eo(e,n)}return null}function h(e,t,n,r,a){if("string"==typeof r||"number"==typeof r)return u(t,e=e.get(n)||null,""+r,a);if("object"==typeof r&&null!==r){switch(r.$$typeof){case k:return e=e.get(null===r.key?n:r.key)||null,r.type===E?p(t,e,r.props.children,a,r.key):l(t,e,r,a);case S:return c(t,e=e.get(null===r.key?n:r.key)||null,r,a)}if(ko(r)||U(r))return p(t,e=e.get(n)||null,r,a,null);Eo(t,r)}return null}function m(a,s,i,u){for(var l=null,c=null,p=s,m=s=0,g=null;null!==p&&m<i.length;m++){p.index>m?(g=p,p=null):g=p.sibling;var y=f(a,p,i[m],u);if(null===y){null===p&&(p=g);break}e&&p&&null===y.alternate&&t(a,p),s=o(y,s,m),null===c?l=y:c.sibling=y,c=y,p=g}if(m===i.length)return n(a,p),l;if(null===p){for(;m<i.length;m++)null!==(p=d(a,i[m],u))&&(s=o(p,s,m),null===c?l=p:c.sibling=p,c=p);return l}for(p=r(a,p);m<i.length;m++)null!==(g=h(p,a,m,i[m],u))&&(e&&null!==g.alternate&&p.delete(null===g.key?m:g.key),s=o(g,s,m),null===c?l=g:c.sibling=g,c=g);return e&&p.forEach((function(e){return t(a,e)})),l}function g(a,i,u,l){var c=U(u);if("function"!=typeof c)throw Error(s(150));if(null==(u=c.call(u)))throw Error(s(151));for(var p=c=null,m=i,g=i=0,y=null,b=u.next();null!==m&&!b.done;g++,b=u.next()){m.index>g?(y=m,m=null):y=m.sibling;var v=f(a,m,b.value,l);if(null===v){null===m&&(m=y);break}e&&m&&null===v.alternate&&t(a,m),i=o(v,i,g),null===p?c=v:p.sibling=v,p=v,m=y}if(b.done)return n(a,m),c;if(null===m){for(;!b.done;g++,b=u.next())null!==(b=d(a,b.value,l))&&(i=o(b,i,g),null===p?c=b:p.sibling=b,p=b);return c}for(m=r(a,m);!b.done;g++,b=u.next())null!==(b=h(m,a,g,b.value,l))&&(e&&null!==b.alternate&&m.delete(null===b.key?g:b.key),i=o(b,i,g),null===p?c=b:p.sibling=b,p=b);return e&&m.forEach((function(e){return t(a,e)})),c}return function(e,r,o,u){var l="object"==typeof o&&null!==o&&o.type===E&&null===o.key;l&&(o=o.props.children);var c="object"==typeof o&&null!==o;if(c)switch(o.$$typeof){case k:e:{for(c=o.key,l=r;null!==l;){if(l.key===c){if(7===l.tag){if(o.type===E){n(e,l.sibling),(r=a(l,o.props.children)).return=e,e=r;break e}}else if(l.elementType===o.type){n(e,l.sibling),(r=a(l,o.props)).ref=So(e,l,o),r.return=e,e=r;break e}n(e,l);break}t(e,l),l=l.sibling}o.type===E?((r=Ku(o.props.children,e.mode,u,o.key)).return=e,e=r):((u=Gu(o.type,o.key,o.props,null,e.mode,u)).ref=So(e,r,o),u.return=e,e=u)}return i(e);case S:e:{for(l=o.key;null!==r;){if(r.key===l){if(4===r.tag&&r.stateNode.containerInfo===o.containerInfo&&r.stateNode.implementation===o.implementation){n(e,r.sibling),(r=a(r,o.children||[])).return=e,e=r;break e}n(e,r);break}t(e,r),r=r.sibling}(r=Xu(o,e.mode,u)).return=e,e=r}return i(e)}if("string"==typeof o||"number"==typeof o)return o=""+o,null!==r&&6===r.tag?(n(e,r.sibling),(r=a(r,o)).return=e,e=r):(n(e,r),(r=Yu(o,e.mode,u)).return=e,e=r),i(e);if(ko(o))return m(e,r,o,u);if(U(o))return g(e,r,o,u);if(c&&Eo(e,o),void 0===o&&!l)switch(e.tag){case 1:case 22:case 0:case 11:case 15:throw Error(s(152,G(e.type)||"Component"))}return n(e,r)}}var To=No(!0),_o=No(!1),Ao={},Io=ua(Ao),Mo=ua(Ao),Oo=ua(Ao);function Do(e){if(e===Ao)throw Error(s(174));return e}function Co(e,t){switch(ca(Oo,t),ca(Mo,e),ca(Io,Ao),e=t.nodeType){case 9:case 11:t=(t=t.documentElement)?t.namespaceURI:fe(null,"");break;default:t=fe(t=(e=8===e?t.parentNode:t).namespaceURI||null,e=e.tagName)}la(Io),ca(Io,t)}function $o(){la(Io),la(Mo),la(Oo)}function Ro(e){Do(Oo.current);var t=Do(Io.current),n=fe(t,e.type);t!==n&&(ca(Mo,e),ca(Io,n))}function Fo(e){Mo.current===e&&(la(Io),la(Mo))}var Po=ua(0);function Lo(e){for(var t=e;null!==t;){if(13===t.tag){var n=t.memoizedState;if(null!==n&&(null===(n=n.dehydrated)||"$?"===n.data||"$!"===n.data))return t}else if(19===t.tag&&void 0!==t.memoizedProps.revealOrder){if(0!=(64&t.flags))return t}else if(null!==t.child){t.child.return=t,t=t.child;continue}if(t===e)break;for(;null===t.sibling;){if(null===t.return||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var zo=null,Bo=null,Vo=!1;function Uo(e,t){var n=Wu(5,null,null,0);n.elementType="DELETED",n.type="DELETED",n.stateNode=t,n.return=e,n.flags=8,null!==e.lastEffect?(e.lastEffect.nextEffect=n,e.lastEffect=n):e.firstEffect=e.lastEffect=n}function jo(e,t){switch(e.tag){case 5:var n=e.type;return null!==(t=1!==t.nodeType||n.toLowerCase()!==t.nodeName.toLowerCase()?null:t)&&(e.stateNode=t,!0);case 6:return null!==(t=""===e.pendingProps||3!==t.nodeType?null:t)&&(e.stateNode=t,!0);default:return!1}}function Wo(e){if(Vo){var t=Bo;if(t){var n=t;if(!jo(e,t)){if(!(t=Gr(n.nextSibling))||!jo(e,t))return e.flags=-1025&e.flags|2,Vo=!1,void(zo=e);Uo(zo,n)}zo=e,Bo=Gr(t.firstChild)}else e.flags=-1025&e.flags|2,Vo=!1,zo=e}}function Ho(e){for(e=e.return;null!==e&&5!==e.tag&&3!==e.tag&&13!==e.tag;)e=e.return;zo=e}function qo(e){if(e!==zo)return!1;if(!Vo)return Ho(e),Vo=!0,!1;var t=e.type;if(5!==e.tag||"head"!==t&&"body"!==t&&!jr(t,e.memoizedProps))for(t=Bo;t;)Uo(e,t),t=Gr(t.nextSibling);if(Ho(e),13===e.tag){if(!(e=null!==(e=e.memoizedState)?e.dehydrated:null))throw Error(s(317));e:{for(e=e.nextSibling,t=0;e;){if(8===e.nodeType){var n=e.data;if("/$"===n){if(0===t){Bo=Gr(e.nextSibling);break e}t--}else"$"!==n&&"$!"!==n&&"$?"!==n||t++}e=e.nextSibling}Bo=null}}else Bo=zo?Gr(e.stateNode.nextSibling):null;return!0}function Go(){Bo=zo=null,Vo=!1}var Ko=[];function Qo(){for(var e=0;e<Ko.length;e++)Ko[e]._workInProgressVersionPrimary=null;Ko.length=0}var Yo=x.ReactCurrentDispatcher,Xo=x.ReactCurrentBatchConfig,Zo=0,Jo=null,es=null,ts=null,ns=!1,rs=!1;function as(){throw Error(s(321))}function os(e,t){if(null===t)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!lr(e[n],t[n]))return!1;return!0}function ss(e,t,n,r,a,o){if(Zo=o,Jo=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Yo.current=null===e||null===e.memoizedState?Ds:Cs,e=n(r,a),rs){o=0;do{if(rs=!1,!(25>o))throw Error(s(301));o+=1,ts=es=null,t.updateQueue=null,Yo.current=$s,e=n(r,a)}while(rs)}if(Yo.current=Os,t=null!==es&&null!==es.next,Zo=0,ts=es=Jo=null,ns=!1,t)throw Error(s(300));return e}function is(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return null===ts?Jo.memoizedState=ts=e:ts=ts.next=e,ts}function us(){if(null===es){var e=Jo.alternate;e=null!==e?e.memoizedState:null}else e=es.next;var t=null===ts?Jo.memoizedState:ts.next;if(null!==t)ts=t,es=e;else{if(null===e)throw Error(s(310));e={memoizedState:(es=e).memoizedState,baseState:es.baseState,baseQueue:es.baseQueue,queue:es.queue,next:null},null===ts?Jo.memoizedState=ts=e:ts=ts.next=e}return ts}function ls(e,t){return"function"==typeof t?t(e):t}function cs(e){var t=us(),n=t.queue;if(null===n)throw Error(s(311));n.lastRenderedReducer=e;var r=es,a=r.baseQueue,o=n.pending;if(null!==o){if(null!==a){var i=a.next;a.next=o.next,o.next=i}r.baseQueue=a=o,n.pending=null}if(null!==a){a=a.next,r=r.baseState;var u=i=o=null,l=a;do{var c=l.lane;if((Zo&c)===c)null!==u&&(u=u.next={lane:0,action:l.action,eagerReducer:l.eagerReducer,eagerState:l.eagerState,next:null}),r=l.eagerReducer===e?l.eagerState:e(r,l.action);else{var p={lane:c,action:l.action,eagerReducer:l.eagerReducer,eagerState:l.eagerState,next:null};null===u?(i=u=p,o=r):u=u.next=p,Jo.lanes|=c,Vi|=c}l=l.next}while(null!==l&&l!==a);null===u?o=r:u.next=i,lr(r,t.memoizedState)||(Fs=!0),t.memoizedState=r,t.baseState=o,t.baseQueue=u,n.lastRenderedState=r}return[t.memoizedState,n.dispatch]}function ps(e){var t=us(),n=t.queue;if(null===n)throw Error(s(311));n.lastRenderedReducer=e;var r=n.dispatch,a=n.pending,o=t.memoizedState;if(null!==a){n.pending=null;var i=a=a.next;do{o=e(o,i.action),i=i.next}while(i!==a);lr(o,t.memoizedState)||(Fs=!0),t.memoizedState=o,null===t.baseQueue&&(t.baseState=o),n.lastRenderedState=o}return[o,r]}function ds(e,t,n){var r=t._getVersion;r=r(t._source);var a=t._workInProgressVersionPrimary;if(null!==a?e=a===r:(e=e.mutableReadLanes,(e=(Zo&e)===e)&&(t._workInProgressVersionPrimary=r,Ko.push(t))),e)return n(t._source);throw Ko.push(t),Error(s(350))}function fs(e,t,n,r){var a=Ci;if(null===a)throw Error(s(349));var o=t._getVersion,i=o(t._source),u=Yo.current,l=u.useState((function(){return ds(a,t,n)})),c=l[1],p=l[0];l=ts;var d=e.memoizedState,f=d.refs,h=f.getSnapshot,m=d.source;d=d.subscribe;var g=Jo;return e.memoizedState={refs:f,source:t,subscribe:r},u.useEffect((function(){f.getSnapshot=n,f.setSnapshot=c;var e=o(t._source);if(!lr(i,e)){e=n(t._source),lr(p,e)||(c(e),e=fu(g),a.mutableReadLanes|=e&a.pendingLanes),e=a.mutableReadLanes,a.entangledLanes|=e;for(var r=a.entanglements,s=e;0<s;){var u=31-jt(s),l=1<<u;r[u]|=e,s&=~l}}}),[n,t,r]),u.useEffect((function(){return r(t._source,(function(){var e=f.getSnapshot,n=f.setSnapshot;try{n(e(t._source));var r=fu(g);a.mutableReadLanes|=r&a.pendingLanes}catch(e){n((function(){throw e}))}}))}),[t,r]),lr(h,n)&&lr(m,t)&&lr(d,r)||((e={pending:null,dispatch:null,lastRenderedReducer:ls,lastRenderedState:p}).dispatch=c=Ms.bind(null,Jo,e),l.queue=e,l.baseQueue=null,p=ds(a,t,n),l.memoizedState=l.baseState=p),p}function hs(e,t,n){return fs(us(),e,t,n)}function ms(e){var t=is();return"function"==typeof e&&(e=e()),t.memoizedState=t.baseState=e,e=(e=t.queue={pending:null,dispatch:null,lastRenderedReducer:ls,lastRenderedState:e}).dispatch=Ms.bind(null,Jo,e),[t.memoizedState,e]}function gs(e,t,n,r){return e={tag:e,create:t,destroy:n,deps:r,next:null},null===(t=Jo.updateQueue)?(t={lastEffect:null},Jo.updateQueue=t,t.lastEffect=e.next=e):null===(n=t.lastEffect)?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e),e}function ys(e){return e={current:e},is().memoizedState=e}function bs(){return us().memoizedState}function vs(e,t,n,r){var a=is();Jo.flags|=e,a.memoizedState=gs(1|t,n,void 0,void 0===r?null:r)}function ws(e,t,n,r){var a=us();r=void 0===r?null:r;var o=void 0;if(null!==es){var s=es.memoizedState;if(o=s.destroy,null!==r&&os(r,s.deps))return void gs(t,n,o,r)}Jo.flags|=e,a.memoizedState=gs(1|t,n,o,r)}function xs(e,t){return vs(516,4,e,t)}function ks(e,t){return ws(516,4,e,t)}function Ss(e,t){return ws(4,2,e,t)}function Es(e,t){return"function"==typeof t?(e=e(),t(e),function(){t(null)}):null!=t?(e=e(),t.current=e,function(){t.current=null}):void 0}function Ns(e,t,n){return n=null!=n?n.concat([e]):null,ws(4,2,Es.bind(null,t,e),n)}function Ts(){}function _s(e,t){var n=us();t=void 0===t?null:t;var r=n.memoizedState;return null!==r&&null!==t&&os(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function As(e,t){var n=us();t=void 0===t?null:t;var r=n.memoizedState;return null!==r&&null!==t&&os(t,r[1])?r[0]:(e=e(),n.memoizedState=[e,t],e)}function Is(e,t){var n=ja();Ha(98>n?98:n,(function(){e(!0)})),Ha(97<n?97:n,(function(){var n=Xo.transition;Xo.transition=1;try{e(!1),t()}finally{Xo.transition=n}}))}function Ms(e,t,n){var r=du(),a=fu(e),o={lane:a,action:n,eagerReducer:null,eagerState:null,next:null},s=t.pending;if(null===s?o.next=o:(o.next=s.next,s.next=o),t.pending=o,s=e.alternate,e===Jo||null!==s&&s===Jo)rs=ns=!0;else{if(0===e.lanes&&(null===s||0===s.lanes)&&null!==(s=t.lastRenderedReducer))try{var i=t.lastRenderedState,u=s(i,n);if(o.eagerReducer=s,o.eagerState=u,lr(u,i))return}catch(e){}hu(e,a,r)}}var Os={readContext:oo,useCallback:as,useContext:as,useEffect:as,useImperativeHandle:as,useLayoutEffect:as,useMemo:as,useReducer:as,useRef:as,useState:as,useDebugValue:as,useDeferredValue:as,useTransition:as,useMutableSource:as,useOpaqueIdentifier:as,unstable_isNewReconciler:!1},Ds={readContext:oo,useCallback:function(e,t){return is().memoizedState=[e,void 0===t?null:t],e},useContext:oo,useEffect:xs,useImperativeHandle:function(e,t,n){return n=null!=n?n.concat([e]):null,vs(4,2,Es.bind(null,t,e),n)},useLayoutEffect:function(e,t){return vs(4,2,e,t)},useMemo:function(e,t){var n=is();return t=void 0===t?null:t,e=e(),n.memoizedState=[e,t],e},useReducer:function(e,t,n){var r=is();return t=void 0!==n?n(t):t,r.memoizedState=r.baseState=t,e=(e=r.queue={pending:null,dispatch:null,lastRenderedReducer:e,lastRenderedState:t}).dispatch=Ms.bind(null,Jo,e),[r.memoizedState,e]},useRef:ys,useState:ms,useDebugValue:Ts,useDeferredValue:function(e){var t=ms(e),n=t[0],r=t[1];return xs((function(){var t=Xo.transition;Xo.transition=1;try{r(e)}finally{Xo.transition=t}}),[e]),n},useTransition:function(){var e=ms(!1),t=e[0];return ys(e=Is.bind(null,e[1])),[e,t]},useMutableSource:function(e,t,n){var r=is();return r.memoizedState={refs:{getSnapshot:t,setSnapshot:null},source:e,subscribe:n},fs(r,e,t,n)},useOpaqueIdentifier:function(){if(Vo){var e=!1,t=function(e){return{$$typeof:R,toString:e,valueOf:e}}((function(){throw e||(e=!0,n("r:"+(Qr++).toString(36))),Error(s(355))})),n=ms(t)[1];return 0==(2&Jo.mode)&&(Jo.flags|=516,gs(5,(function(){n("r:"+(Qr++).toString(36))}),void 0,null)),t}return ms(t="r:"+(Qr++).toString(36)),t},unstable_isNewReconciler:!1},Cs={readContext:oo,useCallback:_s,useContext:oo,useEffect:ks,useImperativeHandle:Ns,useLayoutEffect:Ss,useMemo:As,useReducer:cs,useRef:bs,useState:function(){return cs(ls)},useDebugValue:Ts,useDeferredValue:function(e){var t=cs(ls),n=t[0],r=t[1];return ks((function(){var t=Xo.transition;Xo.transition=1;try{r(e)}finally{Xo.transition=t}}),[e]),n},useTransition:function(){var e=cs(ls)[0];return[bs().current,e]},useMutableSource:hs,useOpaqueIdentifier:function(){return cs(ls)[0]},unstable_isNewReconciler:!1},$s={readContext:oo,useCallback:_s,useContext:oo,useEffect:ks,useImperativeHandle:Ns,useLayoutEffect:Ss,useMemo:As,useReducer:ps,useRef:bs,useState:function(){return ps(ls)},useDebugValue:Ts,useDeferredValue:function(e){var t=ps(ls),n=t[0],r=t[1];return ks((function(){var t=Xo.transition;Xo.transition=1;try{r(e)}finally{Xo.transition=t}}),[e]),n},useTransition:function(){var e=ps(ls)[0];return[bs().current,e]},useMutableSource:hs,useOpaqueIdentifier:function(){return ps(ls)[0]},unstable_isNewReconciler:!1},Rs=x.ReactCurrentOwner,Fs=!1;function Ps(e,t,n,r){t.child=null===e?_o(t,null,n,r):To(t,e.child,n,r)}function Ls(e,t,n,r,a){n=n.render;var o=t.ref;return ao(t,a),r=ss(e,t,n,r,o,a),null===e||Fs?(t.flags|=1,Ps(e,t,r,a),t.child):(t.updateQueue=e.updateQueue,t.flags&=-517,e.lanes&=~a,oi(e,t,a))}function zs(e,t,n,r,a,o){if(null===e){var s=n.type;return"function"!=typeof s||Hu(s)||void 0!==s.defaultProps||null!==n.compare||void 0!==n.defaultProps?((e=Gu(n.type,null,r,t,t.mode,o)).ref=t.ref,e.return=t,t.child=e):(t.tag=15,t.type=s,Bs(e,t,s,r,a,o))}return s=e.child,0==(a&o)&&(a=s.memoizedProps,(n=null!==(n=n.compare)?n:pr)(a,r)&&e.ref===t.ref)?oi(e,t,o):(t.flags|=1,(e=qu(s,r)).ref=t.ref,e.return=t,t.child=e)}function Bs(e,t,n,r,a,o){if(null!==e&&pr(e.memoizedProps,r)&&e.ref===t.ref){if(Fs=!1,0==(o&a))return t.lanes=e.lanes,oi(e,t,o);0!=(16384&e.flags)&&(Fs=!0)}return js(e,t,n,r,o)}function Vs(e,t,n){var r=t.pendingProps,a=r.children,o=null!==e?e.memoizedState:null;if("hidden"===r.mode||"unstable-defer-without-hiding"===r.mode)if(0==(4&t.mode))t.memoizedState={baseLanes:0},ku(t,n);else{if(0==(1073741824&n))return e=null!==o?o.baseLanes|n:n,t.lanes=t.childLanes=1073741824,t.memoizedState={baseLanes:e},ku(t,e),null;t.memoizedState={baseLanes:0},ku(t,null!==o?o.baseLanes:n)}else null!==o?(r=o.baseLanes|n,t.memoizedState=null):r=n,ku(t,r);return Ps(e,t,a,n),t.child}function Us(e,t){var n=t.ref;(null===e&&null!==n||null!==e&&e.ref!==n)&&(t.flags|=128)}function js(e,t,n,r,a){var o=ga(n)?ha:da.current;return o=ma(t,o),ao(t,a),n=ss(e,t,n,r,o,a),null===e||Fs?(t.flags|=1,Ps(e,t,n,a),t.child):(t.updateQueue=e.updateQueue,t.flags&=-517,e.lanes&=~a,oi(e,t,a))}function Ws(e,t,n,r,a){if(ga(n)){var o=!0;wa(t)}else o=!1;if(ao(t,a),null===t.stateNode)null!==e&&(e.alternate=null,t.alternate=null,t.flags|=2),vo(t,n,r),xo(t,n,r,a),r=!0;else if(null===e){var s=t.stateNode,i=t.memoizedProps;s.props=i;var u=s.context,l=n.contextType;"object"==typeof l&&null!==l?l=oo(l):l=ma(t,l=ga(n)?ha:da.current);var c=n.getDerivedStateFromProps,p="function"==typeof c||"function"==typeof s.getSnapshotBeforeUpdate;p||"function"!=typeof s.UNSAFE_componentWillReceiveProps&&"function"!=typeof s.componentWillReceiveProps||(i!==r||u!==l)&&wo(t,s,r,l),so=!1;var d=t.memoizedState;s.state=d,fo(t,r,s,a),u=t.memoizedState,i!==r||d!==u||fa.current||so?("function"==typeof c&&(go(t,n,c,r),u=t.memoizedState),(i=so||bo(t,n,i,r,d,u,l))?(p||"function"!=typeof s.UNSAFE_componentWillMount&&"function"!=typeof s.componentWillMount||("function"==typeof s.componentWillMount&&s.componentWillMount(),"function"==typeof s.UNSAFE_componentWillMount&&s.UNSAFE_componentWillMount()),"function"==typeof s.componentDidMount&&(t.flags|=4)):("function"==typeof s.componentDidMount&&(t.flags|=4),t.memoizedProps=r,t.memoizedState=u),s.props=r,s.state=u,s.context=l,r=i):("function"==typeof s.componentDidMount&&(t.flags|=4),r=!1)}else{s=t.stateNode,uo(e,t),i=t.memoizedProps,l=t.type===t.elementType?i:Ya(t.type,i),s.props=l,p=t.pendingProps,d=s.context,"object"==typeof(u=n.contextType)&&null!==u?u=oo(u):u=ma(t,u=ga(n)?ha:da.current);var f=n.getDerivedStateFromProps;(c="function"==typeof f||"function"==typeof s.getSnapshotBeforeUpdate)||"function"!=typeof s.UNSAFE_componentWillReceiveProps&&"function"!=typeof s.componentWillReceiveProps||(i!==p||d!==u)&&wo(t,s,r,u),so=!1,d=t.memoizedState,s.state=d,fo(t,r,s,a);var h=t.memoizedState;i!==p||d!==h||fa.current||so?("function"==typeof f&&(go(t,n,f,r),h=t.memoizedState),(l=so||bo(t,n,l,r,d,h,u))?(c||"function"!=typeof s.UNSAFE_componentWillUpdate&&"function"!=typeof s.componentWillUpdate||("function"==typeof s.componentWillUpdate&&s.componentWillUpdate(r,h,u),"function"==typeof s.UNSAFE_componentWillUpdate&&s.UNSAFE_componentWillUpdate(r,h,u)),"function"==typeof s.componentDidUpdate&&(t.flags|=4),"function"==typeof s.getSnapshotBeforeUpdate&&(t.flags|=256)):("function"!=typeof s.componentDidUpdate||i===e.memoizedProps&&d===e.memoizedState||(t.flags|=4),"function"!=typeof s.getSnapshotBeforeUpdate||i===e.memoizedProps&&d===e.memoizedState||(t.flags|=256),t.memoizedProps=r,t.memoizedState=h),s.props=r,s.state=h,s.context=u,r=l):("function"!=typeof s.componentDidUpdate||i===e.memoizedProps&&d===e.memoizedState||(t.flags|=4),"function"!=typeof s.getSnapshotBeforeUpdate||i===e.memoizedProps&&d===e.memoizedState||(t.flags|=256),r=!1)}return Hs(e,t,n,r,o,a)}function Hs(e,t,n,r,a,o){Us(e,t);var s=0!=(64&t.flags);if(!r&&!s)return a&&xa(t,n,!1),oi(e,t,o);r=t.stateNode,Rs.current=t;var i=s&&"function"!=typeof n.getDerivedStateFromError?null:r.render();return t.flags|=1,null!==e&&s?(t.child=To(t,e.child,null,o),t.child=To(t,null,i,o)):Ps(e,t,i,o),t.memoizedState=r.state,a&&xa(t,n,!0),t.child}function qs(e){var t=e.stateNode;t.pendingContext?ba(0,t.pendingContext,t.pendingContext!==t.context):t.context&&ba(0,t.context,!1),Co(e,t.containerInfo)}var Gs,Ks,Qs,Ys,Xs={dehydrated:null,retryLane:0};function Zs(e,t,n){var r,a=t.pendingProps,o=Po.current,s=!1;return(r=0!=(64&t.flags))||(r=(null===e||null!==e.memoizedState)&&0!=(2&o)),r?(s=!0,t.flags&=-65):null!==e&&null===e.memoizedState||void 0===a.fallback||!0===a.unstable_avoidThisFallback||(o|=1),ca(Po,1&o),null===e?(void 0!==a.fallback&&Wo(t),e=a.children,o=a.fallback,s?(e=Js(t,e,o,n),t.child.memoizedState={baseLanes:n},t.memoizedState=Xs,e):"number"==typeof a.unstable_expectedLoadTime?(e=Js(t,e,o,n),t.child.memoizedState={baseLanes:n},t.memoizedState=Xs,t.lanes=33554432,e):((n=Qu({mode:"visible",children:e},t.mode,n,null)).return=t,t.child=n)):(e.memoizedState,s?(a=ti(e,t,a.children,a.fallback,n),s=t.child,o=e.child.memoizedState,s.memoizedState=null===o?{baseLanes:n}:{baseLanes:o.baseLanes|n},s.childLanes=e.childLanes&~n,t.memoizedState=Xs,a):(n=ei(e,t,a.children,n),t.memoizedState=null,n))}function Js(e,t,n,r){var a=e.mode,o=e.child;return t={mode:"hidden",children:t},0==(2&a)&&null!==o?(o.childLanes=0,o.pendingProps=t):o=Qu(t,a,0,null),n=Ku(n,a,r,null),o.return=e,n.return=e,o.sibling=n,e.child=o,n}function ei(e,t,n,r){var a=e.child;return e=a.sibling,n=qu(a,{mode:"visible",children:n}),0==(2&t.mode)&&(n.lanes=r),n.return=t,n.sibling=null,null!==e&&(e.nextEffect=null,e.flags=8,t.firstEffect=t.lastEffect=e),t.child=n}function ti(e,t,n,r,a){var o=t.mode,s=e.child;e=s.sibling;var i={mode:"hidden",children:n};return 0==(2&o)&&t.child!==s?((n=t.child).childLanes=0,n.pendingProps=i,null!==(s=n.lastEffect)?(t.firstEffect=n.firstEffect,t.lastEffect=s,s.nextEffect=null):t.firstEffect=t.lastEffect=null):n=qu(s,i),null!==e?r=qu(e,r):(r=Ku(r,o,a,null)).flags|=2,r.return=t,n.return=t,n.sibling=r,t.child=n,r}function ni(e,t){e.lanes|=t;var n=e.alternate;null!==n&&(n.lanes|=t),ro(e.return,t)}function ri(e,t,n,r,a,o){var s=e.memoizedState;null===s?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:a,lastEffect:o}:(s.isBackwards=t,s.rendering=null,s.renderingStartTime=0,s.last=r,s.tail=n,s.tailMode=a,s.lastEffect=o)}function ai(e,t,n){var r=t.pendingProps,a=r.revealOrder,o=r.tail;if(Ps(e,t,r.children,n),0!=(2&(r=Po.current)))r=1&r|2,t.flags|=64;else{if(null!==e&&0!=(64&e.flags))e:for(e=t.child;null!==e;){if(13===e.tag)null!==e.memoizedState&&ni(e,n);else if(19===e.tag)ni(e,n);else if(null!==e.child){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;null===e.sibling;){if(null===e.return||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}r&=1}if(ca(Po,r),0==(2&t.mode))t.memoizedState=null;else switch(a){case"forwards":for(n=t.child,a=null;null!==n;)null!==(e=n.alternate)&&null===Lo(e)&&(a=n),n=n.sibling;null===(n=a)?(a=t.child,t.child=null):(a=n.sibling,n.sibling=null),ri(t,!1,a,n,o,t.lastEffect);break;case"backwards":for(n=null,a=t.child,t.child=null;null!==a;){if(null!==(e=a.alternate)&&null===Lo(e)){t.child=a;break}e=a.sibling,a.sibling=n,n=a,a=e}ri(t,!0,n,null,o,t.lastEffect);break;case"together":ri(t,!1,null,null,void 0,t.lastEffect);break;default:t.memoizedState=null}return t.child}function oi(e,t,n){if(null!==e&&(t.dependencies=e.dependencies),Vi|=t.lanes,0!=(n&t.childLanes)){if(null!==e&&t.child!==e.child)throw Error(s(153));if(null!==t.child){for(n=qu(e=t.child,e.pendingProps),t.child=n,n.return=t;null!==e.sibling;)e=e.sibling,(n=n.sibling=qu(e,e.pendingProps)).return=t;n.sibling=null}return t.child}return null}function si(e,t){if(!Vo)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;null!==t;)null!==t.alternate&&(n=t),t=t.sibling;null===n?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var r=null;null!==n;)null!==n.alternate&&(r=n),n=n.sibling;null===r?t||null===e.tail?e.tail=null:e.tail.sibling=null:r.sibling=null}}function ii(e,t,n){var r=t.pendingProps;switch(t.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return null;case 1:case 17:return ga(t.type)&&ya(),null;case 3:return $o(),la(fa),la(da),Qo(),(r=t.stateNode).pendingContext&&(r.context=r.pendingContext,r.pendingContext=null),null!==e&&null!==e.child||(qo(t)?t.flags|=4:r.hydrate||(t.flags|=256)),Ks(t),null;case 5:Fo(t);var o=Do(Oo.current);if(n=t.type,null!==e&&null!=t.stateNode)Qs(e,t,n,r,o),e.ref!==t.ref&&(t.flags|=128);else{if(!r){if(null===t.stateNode)throw Error(s(166));return null}if(e=Do(Io.current),qo(t)){r=t.stateNode,n=t.type;var i=t.memoizedProps;switch(r[Xr]=t,r[Zr]=i,n){case"dialog":Ir("cancel",r),Ir("close",r);break;case"iframe":case"object":case"embed":Ir("load",r);break;case"video":case"audio":for(e=0;e<Nr.length;e++)Ir(Nr[e],r);break;case"source":Ir("error",r);break;case"img":case"image":case"link":Ir("error",r),Ir("load",r);break;case"details":Ir("toggle",r);break;case"input":ee(r,i),Ir("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!i.multiple},Ir("invalid",r);break;case"textarea":ue(r,i),Ir("invalid",r)}for(var l in Se(n,i),e=null,i)i.hasOwnProperty(l)&&(o=i[l],"children"===l?"string"==typeof o?r.textContent!==o&&(e=["children",o]):"number"==typeof o&&r.textContent!==""+o&&(e=["children",""+o]):u.hasOwnProperty(l)&&null!=o&&"onScroll"===l&&Ir("scroll",r));switch(n){case"input":Y(r),re(r,i,!0);break;case"textarea":Y(r),ce(r);break;case"select":case"option":break;default:"function"==typeof i.onClick&&(r.onclick=zr)}r=e,t.updateQueue=r,null!==r&&(t.flags|=4)}else{switch(l=9===o.nodeType?o:o.ownerDocument,e===pe.html&&(e=de(n)),e===pe.html?"script"===n?((e=l.createElement("div")).innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):"string"==typeof r.is?e=l.createElement(n,{is:r.is}):(e=l.createElement(n),"select"===n&&(l=e,r.multiple?l.multiple=!0:r.size&&(l.size=r.size))):e=l.createElementNS(e,n),e[Xr]=t,e[Zr]=r,Gs(e,t,!1,!1),t.stateNode=e,l=Ee(n,r),n){case"dialog":Ir("cancel",e),Ir("close",e),o=r;break;case"iframe":case"object":case"embed":Ir("load",e),o=r;break;case"video":case"audio":for(o=0;o<Nr.length;o++)Ir(Nr[o],e);o=r;break;case"source":Ir("error",e),o=r;break;case"img":case"image":case"link":Ir("error",e),Ir("load",e),o=r;break;case"details":Ir("toggle",e),o=r;break;case"input":ee(e,r),o=J(e,r),Ir("invalid",e);break;case"option":o=oe(e,r);break;case"select":e._wrapperState={wasMultiple:!!r.multiple},o=a({},r,{value:void 0}),Ir("invalid",e);break;case"textarea":ue(e,r),o=ie(e,r),Ir("invalid",e);break;default:o=r}Se(n,o);var c=o;for(i in c)if(c.hasOwnProperty(i)){var p=c[i];"style"===i?xe(e,p):"dangerouslySetInnerHTML"===i?null!=(p=p?p.__html:void 0)&&ge(e,p):"children"===i?"string"==typeof p?("textarea"!==n||""!==p)&&ye(e,p):"number"==typeof p&&ye(e,""+p):"suppressContentEditableWarning"!==i&&"suppressHydrationWarning"!==i&&"autoFocus"!==i&&(u.hasOwnProperty(i)?null!=p&&"onScroll"===i&&Ir("scroll",e):null!=p&&w(e,i,p,l))}switch(n){case"input":Y(e),re(e,r,!1);break;case"textarea":Y(e),ce(e);break;case"option":null!=r.value&&e.setAttribute("value",""+K(r.value));break;case"select":e.multiple=!!r.multiple,null!=(i=r.value)?se(e,!!r.multiple,i,!1):null!=r.defaultValue&&se(e,!!r.multiple,r.defaultValue,!0);break;default:"function"==typeof o.onClick&&(e.onclick=zr)}Ur(n,r)&&(t.flags|=4)}null!==t.ref&&(t.flags|=128)}return null;case 6:if(e&&null!=t.stateNode)Ys(e,t,e.memoizedProps,r);else{if("string"!=typeof r&&null===t.stateNode)throw Error(s(166));n=Do(Oo.current),Do(Io.current),qo(t)?(r=t.stateNode,n=t.memoizedProps,r[Xr]=t,r.nodeValue!==n&&(t.flags|=4)):((r=(9===n.nodeType?n:n.ownerDocument).createTextNode(r))[Xr]=t,t.stateNode=r)}return null;case 13:return la(Po),r=t.memoizedState,0!=(64&t.flags)?(t.lanes=n,t):(r=null!==r,n=!1,null===e?void 0!==t.memoizedProps.fallback&&qo(t):n=null!==e.memoizedState,r&&!n&&0!=(2&t.mode)&&(null===e&&!0!==t.memoizedProps.unstable_avoidThisFallback||0!=(1&Po.current)?0===Li&&(Li=3):(0!==Li&&3!==Li||(Li=4),null===Ci||0==(134217727&Vi)&&0==(134217727&Ui)||bu(Ci,Ri))),(r||n)&&(t.flags|=4),null);case 4:return $o(),Ks(t),null===e&&Or(t.stateNode.containerInfo),null;case 10:return no(t),null;case 19:if(la(Po),null===(r=t.memoizedState))return null;if(i=0!=(64&t.flags),null===(l=r.rendering))if(i)si(r,!1);else{if(0!==Li||null!==e&&0!=(64&e.flags))for(e=t.child;null!==e;){if(null!==(l=Lo(e))){for(t.flags|=64,si(r,!1),null!==(i=l.updateQueue)&&(t.updateQueue=i,t.flags|=4),null===r.lastEffect&&(t.firstEffect=null),t.lastEffect=r.lastEffect,r=n,n=t.child;null!==n;)e=r,(i=n).flags&=2,i.nextEffect=null,i.firstEffect=null,i.lastEffect=null,null===(l=i.alternate)?(i.childLanes=0,i.lanes=e,i.child=null,i.memoizedProps=null,i.memoizedState=null,i.updateQueue=null,i.dependencies=null,i.stateNode=null):(i.childLanes=l.childLanes,i.lanes=l.lanes,i.child=l.child,i.memoizedProps=l.memoizedProps,i.memoizedState=l.memoizedState,i.updateQueue=l.updateQueue,i.type=l.type,e=l.dependencies,i.dependencies=null===e?null:{lanes:e.lanes,firstContext:e.firstContext}),n=n.sibling;return ca(Po,1&Po.current|2),t.child}e=e.sibling}null!==r.tail&&Ua()>qi&&(t.flags|=64,i=!0,si(r,!1),t.lanes=33554432)}else{if(!i)if(null!==(e=Lo(l))){if(t.flags|=64,i=!0,null!==(n=e.updateQueue)&&(t.updateQueue=n,t.flags|=4),si(r,!0),null===r.tail&&"hidden"===r.tailMode&&!l.alternate&&!Vo)return null!==(t=t.lastEffect=r.lastEffect)&&(t.nextEffect=null),null}else 2*Ua()-r.renderingStartTime>qi&&1073741824!==n&&(t.flags|=64,i=!0,si(r,!1),t.lanes=33554432);r.isBackwards?(l.sibling=t.child,t.child=l):(null!==(n=r.last)?n.sibling=l:t.child=l,r.last=l)}return null!==r.tail?(n=r.tail,r.rendering=n,r.tail=n.sibling,r.lastEffect=t.lastEffect,r.renderingStartTime=Ua(),n.sibling=null,t=Po.current,ca(Po,i?1&t|2:1&t),n):null;case 23:case 24:return Su(),null!==e&&null!==e.memoizedState!=(null!==t.memoizedState)&&"unstable-defer-without-hiding"!==r.mode&&(t.flags|=4),null}throw Error(s(156,t.tag))}function ui(e){switch(e.tag){case 1:ga(e.type)&&ya();var t=e.flags;return 4096&t?(e.flags=-4097&t|64,e):null;case 3:if($o(),la(fa),la(da),Qo(),0!=(64&(t=e.flags)))throw Error(s(285));return e.flags=-4097&t|64,e;case 5:return Fo(e),null;case 13:return la(Po),4096&(t=e.flags)?(e.flags=-4097&t|64,e):null;case 19:return la(Po),null;case 4:return $o(),null;case 10:return no(e),null;case 23:case 24:return Su(),null;default:return null}}function li(e,t){try{var n="",r=t;do{n+=q(r),r=r.return}while(r);var a=n}catch(e){a="\nError generating stack: "+e.message+"\n"+e.stack}return{value:e,source:t,stack:a}}function ci(e,t){try{console.error(t.value)}catch(e){setTimeout((function(){throw e}))}}Gs=function(e,t){for(var n=t.child;null!==n;){if(5===n.tag||6===n.tag)e.appendChild(n.stateNode);else if(4!==n.tag&&null!==n.child){n.child.return=n,n=n.child;continue}if(n===t)break;for(;null===n.sibling;){if(null===n.return||n.return===t)return;n=n.return}n.sibling.return=n.return,n=n.sibling}},Ks=function(){},Qs=function(e,t,n,r){var o=e.memoizedProps;if(o!==r){e=t.stateNode,Do(Io.current);var s,i=null;switch(n){case"input":o=J(e,o),r=J(e,r),i=[];break;case"option":o=oe(e,o),r=oe(e,r),i=[];break;case"select":o=a({},o,{value:void 0}),r=a({},r,{value:void 0}),i=[];break;case"textarea":o=ie(e,o),r=ie(e,r),i=[];break;default:"function"!=typeof o.onClick&&"function"==typeof r.onClick&&(e.onclick=zr)}for(p in Se(n,r),n=null,o)if(!r.hasOwnProperty(p)&&o.hasOwnProperty(p)&&null!=o[p])if("style"===p){var l=o[p];for(s in l)l.hasOwnProperty(s)&&(n||(n={}),n[s]="")}else"dangerouslySetInnerHTML"!==p&&"children"!==p&&"suppressContentEditableWarning"!==p&&"suppressHydrationWarning"!==p&&"autoFocus"!==p&&(u.hasOwnProperty(p)?i||(i=[]):(i=i||[]).push(p,null));for(p in r){var c=r[p];if(l=null!=o?o[p]:void 0,r.hasOwnProperty(p)&&c!==l&&(null!=c||null!=l))if("style"===p)if(l){for(s in l)!l.hasOwnProperty(s)||c&&c.hasOwnProperty(s)||(n||(n={}),n[s]="");for(s in c)c.hasOwnProperty(s)&&l[s]!==c[s]&&(n||(n={}),n[s]=c[s])}else n||(i||(i=[]),i.push(p,n)),n=c;else"dangerouslySetInnerHTML"===p?(c=c?c.__html:void 0,l=l?l.__html:void 0,null!=c&&l!==c&&(i=i||[]).push(p,c)):"children"===p?"string"!=typeof c&&"number"!=typeof c||(i=i||[]).push(p,""+c):"suppressContentEditableWarning"!==p&&"suppressHydrationWarning"!==p&&(u.hasOwnProperty(p)?(null!=c&&"onScroll"===p&&Ir("scroll",e),i||l===c||(i=[])):"object"==typeof c&&null!==c&&c.$$typeof===R?c.toString():(i=i||[]).push(p,c))}n&&(i=i||[]).push("style",n);var p=i;(t.updateQueue=p)&&(t.flags|=4)}},Ys=function(e,t,n,r){n!==r&&(t.flags|=4)};var pi="function"==typeof WeakMap?WeakMap:Map;function di(e,t,n){(n=lo(-1,n)).tag=3,n.payload={element:null};var r=t.value;return n.callback=function(){Yi||(Yi=!0,Xi=r),ci(0,t)},n}function fi(e,t,n){(n=lo(-1,n)).tag=3;var r=e.type.getDerivedStateFromError;if("function"==typeof r){var a=t.value;n.payload=function(){return ci(0,t),r(a)}}var o=e.stateNode;return null!==o&&"function"==typeof o.componentDidCatch&&(n.callback=function(){"function"!=typeof r&&(null===Zi?Zi=new Set([this]):Zi.add(this),ci(0,t));var e=t.stack;this.componentDidCatch(t.value,{componentStack:null!==e?e:""})}),n}var hi="function"==typeof WeakSet?WeakSet:Set;function mi(e){var t=e.ref;if(null!==t)if("function"==typeof t)try{t(null)}catch(t){Bu(e,t)}else t.current=null}function gi(e,t){switch(t.tag){case 0:case 11:case 15:case 22:case 5:case 6:case 4:case 17:return;case 1:if(256&t.flags&&null!==e){var n=e.memoizedProps,r=e.memoizedState;t=(e=t.stateNode).getSnapshotBeforeUpdate(t.elementType===t.type?n:Ya(t.type,n),r),e.__reactInternalSnapshotBeforeUpdate=t}return;case 3:return void(256&t.flags&&qr(t.stateNode.containerInfo))}throw Error(s(163))}function yi(e,t,n){switch(n.tag){case 0:case 11:case 15:case 22:if(null!==(t=null!==(t=n.updateQueue)?t.lastEffect:null)){e=t=t.next;do{if(3==(3&e.tag)){var r=e.create;e.destroy=r()}e=e.next}while(e!==t)}if(null!==(t=null!==(t=n.updateQueue)?t.lastEffect:null)){e=t=t.next;do{var a=e;r=a.next,0!=(4&(a=a.tag))&&0!=(1&a)&&(Pu(n,e),Fu(n,e)),e=r}while(e!==t)}return;case 1:return e=n.stateNode,4&n.flags&&(null===t?e.componentDidMount():(r=n.elementType===n.type?t.memoizedProps:Ya(n.type,t.memoizedProps),e.componentDidUpdate(r,t.memoizedState,e.__reactInternalSnapshotBeforeUpdate))),void(null!==(t=n.updateQueue)&&ho(n,t,e));case 3:if(null!==(t=n.updateQueue)){if(e=null,null!==n.child)switch(n.child.tag){case 5:case 1:e=n.child.stateNode}ho(n,t,e)}return;case 5:return e=n.stateNode,void(null===t&&4&n.flags&&Ur(n.type,n.memoizedProps)&&e.focus());case 6:case 4:case 12:case 19:case 17:case 20:case 21:case 23:case 24:return;case 13:return void(null===n.memoizedState&&(n=n.alternate,null!==n&&(n=n.memoizedState,null!==n&&(n=n.dehydrated,null!==n&&xt(n)))))}throw Error(s(163))}function bi(e,t){for(var n=e;;){if(5===n.tag){var r=n.stateNode;if(t)"function"==typeof(r=r.style).setProperty?r.setProperty("display","none","important"):r.display="none";else{r=n.stateNode;var a=n.memoizedProps.style;a=null!=a&&a.hasOwnProperty("display")?a.display:null,r.style.display=we("display",a)}}else if(6===n.tag)n.stateNode.nodeValue=t?"":n.memoizedProps;else if((23!==n.tag&&24!==n.tag||null===n.memoizedState||n===e)&&null!==n.child){n.child.return=n,n=n.child;continue}if(n===e)break;for(;null===n.sibling;){if(null===n.return||n.return===e)return;n=n.return}n.sibling.return=n.return,n=n.sibling}}function vi(e,t){if(Sa&&"function"==typeof Sa.onCommitFiberUnmount)try{Sa.onCommitFiberUnmount(ka,t)}catch(e){}switch(t.tag){case 0:case 11:case 14:case 15:case 22:if(null!==(e=t.updateQueue)&&null!==(e=e.lastEffect)){var n=e=e.next;do{var r=n,a=r.destroy;if(r=r.tag,void 0!==a)if(0!=(4&r))Pu(t,n);else{r=t;try{a()}catch(e){Bu(r,e)}}n=n.next}while(n!==e)}break;case 1:if(mi(t),"function"==typeof(e=t.stateNode).componentWillUnmount)try{e.props=t.memoizedProps,e.state=t.memoizedState,e.componentWillUnmount()}catch(e){Bu(t,e)}break;case 5:mi(t);break;case 4:Ni(e,t)}}function wi(e){e.alternate=null,e.child=null,e.dependencies=null,e.firstEffect=null,e.lastEffect=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.return=null,e.updateQueue=null}function xi(e){return 5===e.tag||3===e.tag||4===e.tag}function ki(e){e:{for(var t=e.return;null!==t;){if(xi(t))break e;t=t.return}throw Error(s(160))}var n=t;switch(t=n.stateNode,n.tag){case 5:var r=!1;break;case 3:case 4:t=t.containerInfo,r=!0;break;default:throw Error(s(161))}16&n.flags&&(ye(t,""),n.flags&=-17);e:t:for(n=e;;){for(;null===n.sibling;){if(null===n.return||xi(n.return)){n=null;break e}n=n.return}for(n.sibling.return=n.return,n=n.sibling;5!==n.tag&&6!==n.tag&&18!==n.tag;){if(2&n.flags)continue t;if(null===n.child||4===n.tag)continue t;n.child.return=n,n=n.child}if(!(2&n.flags)){n=n.stateNode;break e}}r?Si(e,n,t):Ei(e,n,t)}function Si(e,t,n){var r=e.tag,a=5===r||6===r;if(a)e=a?e.stateNode:e.stateNode.instance,t?8===n.nodeType?n.parentNode.insertBefore(e,t):n.insertBefore(e,t):(8===n.nodeType?(t=n.parentNode).insertBefore(e,n):(t=n).appendChild(e),null!=(n=n._reactRootContainer)||null!==t.onclick||(t.onclick=zr));else if(4!==r&&null!==(e=e.child))for(Si(e,t,n),e=e.sibling;null!==e;)Si(e,t,n),e=e.sibling}function Ei(e,t,n){var r=e.tag,a=5===r||6===r;if(a)e=a?e.stateNode:e.stateNode.instance,t?n.insertBefore(e,t):n.appendChild(e);else if(4!==r&&null!==(e=e.child))for(Ei(e,t,n),e=e.sibling;null!==e;)Ei(e,t,n),e=e.sibling}function Ni(e,t){for(var n,r,a=t,o=!1;;){if(!o){o=a.return;e:for(;;){if(null===o)throw Error(s(160));switch(n=o.stateNode,o.tag){case 5:r=!1;break e;case 3:case 4:n=n.containerInfo,r=!0;break e}o=o.return}o=!0}if(5===a.tag||6===a.tag){e:for(var i=e,u=a,l=u;;)if(vi(i,l),null!==l.child&&4!==l.tag)l.child.return=l,l=l.child;else{if(l===u)break e;for(;null===l.sibling;){if(null===l.return||l.return===u)break e;l=l.return}l.sibling.return=l.return,l=l.sibling}r?(i=n,u=a.stateNode,8===i.nodeType?i.parentNode.removeChild(u):i.removeChild(u)):n.removeChild(a.stateNode)}else if(4===a.tag){if(null!==a.child){n=a.stateNode.containerInfo,r=!0,a.child.return=a,a=a.child;continue}}else if(vi(e,a),null!==a.child){a.child.return=a,a=a.child;continue}if(a===t)break;for(;null===a.sibling;){if(null===a.return||a.return===t)return;4===(a=a.return).tag&&(o=!1)}a.sibling.return=a.return,a=a.sibling}}function Ti(e,t){switch(t.tag){case 0:case 11:case 14:case 15:case 22:var n=t.updateQueue;if(null!==(n=null!==n?n.lastEffect:null)){var r=n=n.next;do{3==(3&r.tag)&&(e=r.destroy,r.destroy=void 0,void 0!==e&&e()),r=r.next}while(r!==n)}return;case 1:case 12:case 17:return;case 5:if(null!=(n=t.stateNode)){r=t.memoizedProps;var a=null!==e?e.memoizedProps:r;e=t.type;var o=t.updateQueue;if(t.updateQueue=null,null!==o){for(n[Zr]=r,"input"===e&&"radio"===r.type&&null!=r.name&&te(n,r),Ee(e,a),t=Ee(e,r),a=0;a<o.length;a+=2){var i=o[a],u=o[a+1];"style"===i?xe(n,u):"dangerouslySetInnerHTML"===i?ge(n,u):"children"===i?ye(n,u):w(n,i,u,t)}switch(e){case"input":ne(n,r);break;case"textarea":le(n,r);break;case"select":e=n._wrapperState.wasMultiple,n._wrapperState.wasMultiple=!!r.multiple,null!=(o=r.value)?se(n,!!r.multiple,o,!1):e!==!!r.multiple&&(null!=r.defaultValue?se(n,!!r.multiple,r.defaultValue,!0):se(n,!!r.multiple,r.multiple?[]:"",!1))}}}return;case 6:if(null===t.stateNode)throw Error(s(162));return void(t.stateNode.nodeValue=t.memoizedProps);case 3:return void((n=t.stateNode).hydrate&&(n.hydrate=!1,xt(n.containerInfo)));case 13:return null!==t.memoizedState&&(Hi=Ua(),bi(t.child,!0)),void _i(t);case 19:return void _i(t);case 23:case 24:return void bi(t,null!==t.memoizedState)}throw Error(s(163))}function _i(e){var t=e.updateQueue;if(null!==t){e.updateQueue=null;var n=e.stateNode;null===n&&(n=e.stateNode=new hi),t.forEach((function(t){var r=Uu.bind(null,e,t);n.has(t)||(n.add(t),t.then(r,r))}))}}function Ai(e,t){return null!==e&&(null===(e=e.memoizedState)||null!==e.dehydrated)&&(null!==(t=t.memoizedState)&&null===t.dehydrated)}var Ii=Math.ceil,Mi=x.ReactCurrentDispatcher,Oi=x.ReactCurrentOwner,Di=0,Ci=null,$i=null,Ri=0,Fi=0,Pi=ua(0),Li=0,zi=null,Bi=0,Vi=0,Ui=0,ji=0,Wi=null,Hi=0,qi=1/0;function Gi(){qi=Ua()+500}var Ki,Qi=null,Yi=!1,Xi=null,Zi=null,Ji=!1,eu=null,tu=90,nu=[],ru=[],au=null,ou=0,su=null,iu=-1,uu=0,lu=0,cu=null,pu=!1;function du(){return 0!=(48&Di)?Ua():-1!==iu?iu:iu=Ua()}function fu(e){if(0==(2&(e=e.mode)))return 1;if(0==(4&e))return 99===ja()?1:2;if(0===uu&&(uu=Bi),0!==Qa.transition){0!==lu&&(lu=null!==Wi?Wi.pendingLanes:0),e=uu;var t=4186112&~lu;return 0===(t&=-t)&&(0===(t=(e=4186112&~e)&-e)&&(t=8192)),t}return e=ja(),0!=(4&Di)&&98===e?e=zt(12,uu):e=zt(e=function(e){switch(e){case 99:return 15;case 98:return 10;case 97:case 96:return 8;case 95:return 2;default:return 0}}(e),uu),e}function hu(e,t,n){if(50<ou)throw ou=0,su=null,Error(s(185));if(null===(e=mu(e,t)))return null;Ut(e,t,n),e===Ci&&(Ui|=t,4===Li&&bu(e,Ri));var r=ja();1===t?0!=(8&Di)&&0==(48&Di)?vu(e):(gu(e,n),0===Di&&(Gi(),Ga())):(0==(4&Di)||98!==r&&99!==r||(null===au?au=new Set([e]):au.add(e)),gu(e,n)),Wi=e}function mu(e,t){e.lanes|=t;var n=e.alternate;for(null!==n&&(n.lanes|=t),n=e,e=e.return;null!==e;)e.childLanes|=t,null!==(n=e.alternate)&&(n.childLanes|=t),n=e,e=e.return;return 3===n.tag?n.stateNode:null}function gu(e,t){for(var n=e.callbackNode,r=e.suspendedLanes,a=e.pingedLanes,o=e.expirationTimes,i=e.pendingLanes;0<i;){var u=31-jt(i),l=1<<u,c=o[u];if(-1===c){if(0==(l&r)||0!=(l&a)){c=t,Ft(l);var p=Rt;o[u]=10<=p?c+250:6<=p?c+5e3:-1}}else c<=t&&(e.expiredLanes|=l);i&=~l}if(r=Pt(e,e===Ci?Ri:0),t=Rt,0===r)null!==n&&(n!==Fa&&Ta(n),e.callbackNode=null,e.callbackPriority=0);else{if(null!==n){if(e.callbackPriority===t)return;n!==Fa&&Ta(n)}15===t?(n=vu.bind(null,e),null===La?(La=[n],za=Na(Oa,Ka)):La.push(n),n=Fa):14===t?n=qa(99,vu.bind(null,e)):(n=function(e){switch(e){case 15:case 14:return 99;case 13:case 12:case 11:case 10:return 98;case 9:case 8:case 7:case 6:case 4:case 5:return 97;case 3:case 2:case 1:return 95;case 0:return 90;default:throw Error(s(358,e))}}(t),n=qa(n,yu.bind(null,e))),e.callbackPriority=t,e.callbackNode=n}}function yu(e){if(iu=-1,lu=uu=0,0!=(48&Di))throw Error(s(327));var t=e.callbackNode;if(Ru()&&e.callbackNode!==t)return null;var n=Pt(e,e===Ci?Ri:0);if(0===n)return null;var r=n,a=Di;Di|=16;var o=Tu();for(Ci===e&&Ri===r||(Gi(),Eu(e,r));;)try{Iu();break}catch(t){Nu(e,t)}if(to(),Mi.current=o,Di=a,null!==$i?r=0:(Ci=null,Ri=0,r=Li),0!=(Bi&Ui))Eu(e,0);else if(0!==r){if(2===r&&(Di|=64,e.hydrate&&(e.hydrate=!1,qr(e.containerInfo)),0!==(n=Lt(e))&&(r=_u(e,n))),1===r)throw t=zi,Eu(e,0),bu(e,n),gu(e,Ua()),t;switch(e.finishedWork=e.current.alternate,e.finishedLanes=n,r){case 0:case 1:throw Error(s(345));case 2:case 5:Du(e);break;case 3:if(bu(e,n),(62914560&n)===n&&10<(r=Hi+500-Ua())){if(0!==Pt(e,0))break;if(((a=e.suspendedLanes)&n)!==n){du(),e.pingedLanes|=e.suspendedLanes&a;break}e.timeoutHandle=Wr(Du.bind(null,e),r);break}Du(e);break;case 4:if(bu(e,n),(4186112&n)===n)break;for(r=e.eventTimes,a=-1;0<n;){var i=31-jt(n);o=1<<i,(i=r[i])>a&&(a=i),n&=~o}if(n=a,10<(n=(120>(n=Ua()-n)?120:480>n?480:1080>n?1080:1920>n?1920:3e3>n?3e3:4320>n?4320:1960*Ii(n/1960))-n)){e.timeoutHandle=Wr(Du.bind(null,e),n);break}Du(e);break;default:throw Error(s(329))}}return gu(e,Ua()),e.callbackNode===t?yu.bind(null,e):null}function bu(e,t){for(t&=~ji,t&=~Ui,e.suspendedLanes|=t,e.pingedLanes&=~t,e=e.expirationTimes;0<t;){var n=31-jt(t),r=1<<n;e[n]=-1,t&=~r}}function vu(e){if(0!=(48&Di))throw Error(s(327));if(Ru(),e===Ci&&0!=(e.expiredLanes&Ri)){var t=Ri,n=_u(e,t);0!=(Bi&Ui)&&(n=_u(e,t=Pt(e,t)))}else n=_u(e,t=Pt(e,0));if(0!==e.tag&&2===n&&(Di|=64,e.hydrate&&(e.hydrate=!1,qr(e.containerInfo)),0!==(t=Lt(e))&&(n=_u(e,t))),1===n)throw n=zi,Eu(e,0),bu(e,t),gu(e,Ua()),n;return e.finishedWork=e.current.alternate,e.finishedLanes=t,Du(e),gu(e,Ua()),null}function wu(e,t){var n=Di;Di|=1;try{return e(t)}finally{0===(Di=n)&&(Gi(),Ga())}}function xu(e,t){var n=Di;Di&=-2,Di|=8;try{return e(t)}finally{0===(Di=n)&&(Gi(),Ga())}}function ku(e,t){ca(Pi,Fi),Fi|=t,Bi|=t}function Su(){Fi=Pi.current,la(Pi)}function Eu(e,t){e.finishedWork=null,e.finishedLanes=0;var n=e.timeoutHandle;if(-1!==n&&(e.timeoutHandle=-1,Hr(n)),null!==$i)for(n=$i.return;null!==n;){var r=n;switch(r.tag){case 1:null!=(r=r.type.childContextTypes)&&ya();break;case 3:$o(),la(fa),la(da),Qo();break;case 5:Fo(r);break;case 4:$o();break;case 13:case 19:la(Po);break;case 10:no(r);break;case 23:case 24:Su()}n=n.return}Ci=e,$i=qu(e.current,null),Ri=Fi=Bi=t,Li=0,zi=null,ji=Ui=Vi=0}function Nu(e,t){for(;;){var n=$i;try{if(to(),Yo.current=Os,ns){for(var r=Jo.memoizedState;null!==r;){var a=r.queue;null!==a&&(a.pending=null),r=r.next}ns=!1}if(Zo=0,ts=es=Jo=null,rs=!1,Oi.current=null,null===n||null===n.return){Li=1,zi=t,$i=null;break}e:{var o=e,s=n.return,i=n,u=t;if(t=Ri,i.flags|=2048,i.firstEffect=i.lastEffect=null,null!==u&&"object"==typeof u&&"function"==typeof u.then){var l=u;if(0==(2&i.mode)){var c=i.alternate;c?(i.updateQueue=c.updateQueue,i.memoizedState=c.memoizedState,i.lanes=c.lanes):(i.updateQueue=null,i.memoizedState=null)}var p=0!=(1&Po.current),d=s;do{var f;if(f=13===d.tag){var h=d.memoizedState;if(null!==h)f=null!==h.dehydrated;else{var m=d.memoizedProps;f=void 0!==m.fallback&&(!0!==m.unstable_avoidThisFallback||!p)}}if(f){var g=d.updateQueue;if(null===g){var y=new Set;y.add(l),d.updateQueue=y}else g.add(l);if(0==(2&d.mode)){if(d.flags|=64,i.flags|=16384,i.flags&=-2981,1===i.tag)if(null===i.alternate)i.tag=17;else{var b=lo(-1,1);b.tag=2,co(i,b)}i.lanes|=1;break e}u=void 0,i=t;var v=o.pingCache;if(null===v?(v=o.pingCache=new pi,u=new Set,v.set(l,u)):void 0===(u=v.get(l))&&(u=new Set,v.set(l,u)),!u.has(i)){u.add(i);var w=Vu.bind(null,o,l,i);l.then(w,w)}d.flags|=4096,d.lanes=t;break e}d=d.return}while(null!==d);u=Error((G(i.type)||"A React component")+" suspended while rendering, but no fallback UI was specified.\n\nAdd a <Suspense fallback=...> component higher in the tree to provide a loading indicator or placeholder to display.")}5!==Li&&(Li=2),u=li(u,i),d=s;do{switch(d.tag){case 3:o=u,d.flags|=4096,t&=-t,d.lanes|=t,po(d,di(0,o,t));break e;case 1:o=u;var x=d.type,k=d.stateNode;if(0==(64&d.flags)&&("function"==typeof x.getDerivedStateFromError||null!==k&&"function"==typeof k.componentDidCatch&&(null===Zi||!Zi.has(k)))){d.flags|=4096,t&=-t,d.lanes|=t,po(d,fi(d,o,t));break e}}d=d.return}while(null!==d)}Ou(n)}catch(e){t=e,$i===n&&null!==n&&($i=n=n.return);continue}break}}function Tu(){var e=Mi.current;return Mi.current=Os,null===e?Os:e}function _u(e,t){var n=Di;Di|=16;var r=Tu();for(Ci===e&&Ri===t||Eu(e,t);;)try{Au();break}catch(t){Nu(e,t)}if(to(),Di=n,Mi.current=r,null!==$i)throw Error(s(261));return Ci=null,Ri=0,Li}function Au(){for(;null!==$i;)Mu($i)}function Iu(){for(;null!==$i&&!_a();)Mu($i)}function Mu(e){var t=Ki(e.alternate,e,Fi);e.memoizedProps=e.pendingProps,null===t?Ou(e):$i=t,Oi.current=null}function Ou(e){var t=e;do{var n=t.alternate;if(e=t.return,0==(2048&t.flags)){if(null!==(n=ii(n,t,Fi)))return void($i=n);if(24!==(n=t).tag&&23!==n.tag||null===n.memoizedState||0!=(1073741824&Fi)||0==(4&n.mode)){for(var r=0,a=n.child;null!==a;)r|=a.lanes|a.childLanes,a=a.sibling;n.childLanes=r}null!==e&&0==(2048&e.flags)&&(null===e.firstEffect&&(e.firstEffect=t.firstEffect),null!==t.lastEffect&&(null!==e.lastEffect&&(e.lastEffect.nextEffect=t.firstEffect),e.lastEffect=t.lastEffect),1<t.flags&&(null!==e.lastEffect?e.lastEffect.nextEffect=t:e.firstEffect=t,e.lastEffect=t))}else{if(null!==(n=ui(t)))return n.flags&=2047,void($i=n);null!==e&&(e.firstEffect=e.lastEffect=null,e.flags|=2048)}if(null!==(t=t.sibling))return void($i=t);$i=t=e}while(null!==t);0===Li&&(Li=5)}function Du(e){var t=ja();return Ha(99,Cu.bind(null,e,t)),null}function Cu(e,t){do{Ru()}while(null!==eu);if(0!=(48&Di))throw Error(s(327));var n=e.finishedWork;if(null===n)return null;if(e.finishedWork=null,e.finishedLanes=0,n===e.current)throw Error(s(177));e.callbackNode=null;var r=n.lanes|n.childLanes,a=r,o=e.pendingLanes&~a;e.pendingLanes=a,e.suspendedLanes=0,e.pingedLanes=0,e.expiredLanes&=a,e.mutableReadLanes&=a,e.entangledLanes&=a,a=e.entanglements;for(var i=e.eventTimes,u=e.expirationTimes;0<o;){var l=31-jt(o),c=1<<l;a[l]=0,i[l]=-1,u[l]=-1,o&=~c}if(null!==au&&0==(24&r)&&au.has(e)&&au.delete(e),e===Ci&&($i=Ci=null,Ri=0),1<n.flags?null!==n.lastEffect?(n.lastEffect.nextEffect=n,r=n.firstEffect):r=n:r=n.firstEffect,null!==r){if(a=Di,Di|=32,Oi.current=null,Br=Kt,gr(i=mr())){if("selectionStart"in i)u={start:i.selectionStart,end:i.selectionEnd};else e:if(u=(u=i.ownerDocument)&&u.defaultView||window,(c=u.getSelection&&u.getSelection())&&0!==c.rangeCount){u=c.anchorNode,o=c.anchorOffset,l=c.focusNode,c=c.focusOffset;try{u.nodeType,l.nodeType}catch(e){u=null;break e}var p=0,d=-1,f=-1,h=0,m=0,g=i,y=null;t:for(;;){for(var b;g!==u||0!==o&&3!==g.nodeType||(d=p+o),g!==l||0!==c&&3!==g.nodeType||(f=p+c),3===g.nodeType&&(p+=g.nodeValue.length),null!==(b=g.firstChild);)y=g,g=b;for(;;){if(g===i)break t;if(y===u&&++h===o&&(d=p),y===l&&++m===c&&(f=p),null!==(b=g.nextSibling))break;y=(g=y).parentNode}g=b}u=-1===d||-1===f?null:{start:d,end:f}}else u=null;u=u||{start:0,end:0}}else u=null;Vr={focusedElem:i,selectionRange:u},Kt=!1,cu=null,pu=!1,Qi=r;do{try{$u()}catch(e){if(null===Qi)throw Error(s(330));Bu(Qi,e),Qi=Qi.nextEffect}}while(null!==Qi);cu=null,Qi=r;do{try{for(i=e;null!==Qi;){var v=Qi.flags;if(16&v&&ye(Qi.stateNode,""),128&v){var w=Qi.alternate;if(null!==w){var x=w.ref;null!==x&&("function"==typeof x?x(null):x.current=null)}}switch(1038&v){case 2:ki(Qi),Qi.flags&=-3;break;case 6:ki(Qi),Qi.flags&=-3,Ti(Qi.alternate,Qi);break;case 1024:Qi.flags&=-1025;break;case 1028:Qi.flags&=-1025,Ti(Qi.alternate,Qi);break;case 4:Ti(Qi.alternate,Qi);break;case 8:Ni(i,u=Qi);var k=u.alternate;wi(u),null!==k&&wi(k)}Qi=Qi.nextEffect}}catch(e){if(null===Qi)throw Error(s(330));Bu(Qi,e),Qi=Qi.nextEffect}}while(null!==Qi);if(x=Vr,w=mr(),v=x.focusedElem,i=x.selectionRange,w!==v&&v&&v.ownerDocument&&hr(v.ownerDocument.documentElement,v)){null!==i&&gr(v)&&(w=i.start,void 0===(x=i.end)&&(x=w),"selectionStart"in v?(v.selectionStart=w,v.selectionEnd=Math.min(x,v.value.length)):(x=(w=v.ownerDocument||document)&&w.defaultView||window).getSelection&&(x=x.getSelection(),u=v.textContent.length,k=Math.min(i.start,u),i=void 0===i.end?k:Math.min(i.end,u),!x.extend&&k>i&&(u=i,i=k,k=u),u=fr(v,k),o=fr(v,i),u&&o&&(1!==x.rangeCount||x.anchorNode!==u.node||x.anchorOffset!==u.offset||x.focusNode!==o.node||x.focusOffset!==o.offset)&&((w=w.createRange()).setStart(u.node,u.offset),x.removeAllRanges(),k>i?(x.addRange(w),x.extend(o.node,o.offset)):(w.setEnd(o.node,o.offset),x.addRange(w))))),w=[];for(x=v;x=x.parentNode;)1===x.nodeType&&w.push({element:x,left:x.scrollLeft,top:x.scrollTop});for("function"==typeof v.focus&&v.focus(),v=0;v<w.length;v++)(x=w[v]).element.scrollLeft=x.left,x.element.scrollTop=x.top}Kt=!!Br,Vr=Br=null,e.current=n,Qi=r;do{try{for(v=e;null!==Qi;){var S=Qi.flags;if(36&S&&yi(v,Qi.alternate,Qi),128&S){w=void 0;var E=Qi.ref;if(null!==E){var N=Qi.stateNode;Qi.tag,w=N,"function"==typeof E?E(w):E.current=w}}Qi=Qi.nextEffect}}catch(e){if(null===Qi)throw Error(s(330));Bu(Qi,e),Qi=Qi.nextEffect}}while(null!==Qi);Qi=null,Pa(),Di=a}else e.current=n;if(Ji)Ji=!1,eu=e,tu=t;else for(Qi=r;null!==Qi;)t=Qi.nextEffect,Qi.nextEffect=null,8&Qi.flags&&((S=Qi).sibling=null,S.stateNode=null),Qi=t;if(0===(r=e.pendingLanes)&&(Zi=null),1===r?e===su?ou++:(ou=0,su=e):ou=0,n=n.stateNode,Sa&&"function"==typeof Sa.onCommitFiberRoot)try{Sa.onCommitFiberRoot(ka,n,void 0,64==(64&n.current.flags))}catch(e){}if(gu(e,Ua()),Yi)throw Yi=!1,e=Xi,Xi=null,e;return 0!=(8&Di)||Ga(),null}function $u(){for(;null!==Qi;){var e=Qi.alternate;pu||null===cu||(0!=(8&Qi.flags)?Je(Qi,cu)&&(pu=!0):13===Qi.tag&&Ai(e,Qi)&&Je(Qi,cu)&&(pu=!0));var t=Qi.flags;0!=(256&t)&&gi(e,Qi),0==(512&t)||Ji||(Ji=!0,qa(97,(function(){return Ru(),null}))),Qi=Qi.nextEffect}}function Ru(){if(90!==tu){var e=97<tu?97:tu;return tu=90,Ha(e,Lu)}return!1}function Fu(e,t){nu.push(t,e),Ji||(Ji=!0,qa(97,(function(){return Ru(),null})))}function Pu(e,t){ru.push(t,e),Ji||(Ji=!0,qa(97,(function(){return Ru(),null})))}function Lu(){if(null===eu)return!1;var e=eu;if(eu=null,0!=(48&Di))throw Error(s(331));var t=Di;Di|=32;var n=ru;ru=[];for(var r=0;r<n.length;r+=2){var a=n[r],o=n[r+1],i=a.destroy;if(a.destroy=void 0,"function"==typeof i)try{i()}catch(e){if(null===o)throw Error(s(330));Bu(o,e)}}for(n=nu,nu=[],r=0;r<n.length;r+=2){a=n[r],o=n[r+1];try{var u=a.create;a.destroy=u()}catch(e){if(null===o)throw Error(s(330));Bu(o,e)}}for(u=e.current.firstEffect;null!==u;)e=u.nextEffect,u.nextEffect=null,8&u.flags&&(u.sibling=null,u.stateNode=null),u=e;return Di=t,Ga(),!0}function zu(e,t,n){co(e,t=di(0,t=li(n,t),1)),t=du(),null!==(e=mu(e,1))&&(Ut(e,1,t),gu(e,t))}function Bu(e,t){if(3===e.tag)zu(e,e,t);else for(var n=e.return;null!==n;){if(3===n.tag){zu(n,e,t);break}if(1===n.tag){var r=n.stateNode;if("function"==typeof n.type.getDerivedStateFromError||"function"==typeof r.componentDidCatch&&(null===Zi||!Zi.has(r))){var a=fi(n,e=li(t,e),1);if(co(n,a),a=du(),null!==(n=mu(n,1)))Ut(n,1,a),gu(n,a);else if("function"==typeof r.componentDidCatch&&(null===Zi||!Zi.has(r)))try{r.componentDidCatch(t,e)}catch(e){}break}}n=n.return}}function Vu(e,t,n){var r=e.pingCache;null!==r&&r.delete(t),t=du(),e.pingedLanes|=e.suspendedLanes&n,Ci===e&&(Ri&n)===n&&(4===Li||3===Li&&(62914560&Ri)===Ri&&500>Ua()-Hi?Eu(e,0):ji|=n),gu(e,t)}function Uu(e,t){var n=e.stateNode;null!==n&&n.delete(t),0===(t=0)&&(0==(2&(t=e.mode))?t=1:0==(4&t)?t=99===ja()?1:2:(0===uu&&(uu=Bi),0===(t=Bt(62914560&~uu))&&(t=4194304))),n=du(),null!==(e=mu(e,t))&&(Ut(e,t,n),gu(e,n))}function ju(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.flags=0,this.lastEffect=this.firstEffect=this.nextEffect=null,this.childLanes=this.lanes=0,this.alternate=null}function Wu(e,t,n,r){return new ju(e,t,n,r)}function Hu(e){return!(!(e=e.prototype)||!e.isReactComponent)}function qu(e,t){var n=e.alternate;return null===n?((n=Wu(e.tag,t,e.key,e.mode)).elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.nextEffect=null,n.firstEffect=null,n.lastEffect=null),n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=null===t?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n}function Gu(e,t,n,r,a,o){var i=2;if(r=e,"function"==typeof e)Hu(e)&&(i=1);else if("string"==typeof e)i=5;else e:switch(e){case E:return Ku(n.children,a,o,t);case F:i=8,a|=16;break;case N:i=8,a|=1;break;case T:return(e=Wu(12,n,t,8|a)).elementType=T,e.type=T,e.lanes=o,e;case M:return(e=Wu(13,n,t,a)).type=M,e.elementType=M,e.lanes=o,e;case O:return(e=Wu(19,n,t,a)).elementType=O,e.lanes=o,e;case P:return Qu(n,a,o,t);case L:return(e=Wu(24,n,t,a)).elementType=L,e.lanes=o,e;default:if("object"==typeof e&&null!==e)switch(e.$$typeof){case _:i=10;break e;case A:i=9;break e;case I:i=11;break e;case D:i=14;break e;case C:i=16,r=null;break e;case $:i=22;break e}throw Error(s(130,null==e?e:typeof e,""))}return(t=Wu(i,n,t,a)).elementType=e,t.type=r,t.lanes=o,t}function Ku(e,t,n,r){return(e=Wu(7,e,r,t)).lanes=n,e}function Qu(e,t,n,r){return(e=Wu(23,e,r,t)).elementType=P,e.lanes=n,e}function Yu(e,t,n){return(e=Wu(6,e,null,t)).lanes=n,e}function Xu(e,t,n){return(t=Wu(4,null!==e.children?e.children:[],e.key,t)).lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}function Zu(e,t,n){this.tag=t,this.containerInfo=e,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.pendingContext=this.context=null,this.hydrate=n,this.callbackNode=null,this.callbackPriority=0,this.eventTimes=Vt(0),this.expirationTimes=Vt(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Vt(0),this.mutableSourceEagerHydrationData=null}function Ju(e,t,n,r){var a=t.current,o=du(),i=fu(a);e:if(n){t:{if(Qe(n=n._reactInternals)!==n||1!==n.tag)throw Error(s(170));var u=n;do{switch(u.tag){case 3:u=u.stateNode.context;break t;case 1:if(ga(u.type)){u=u.stateNode.__reactInternalMemoizedMergedChildContext;break t}}u=u.return}while(null!==u);throw Error(s(171))}if(1===n.tag){var l=n.type;if(ga(l)){n=va(n,l,u);break e}}n=u}else n=pa;return null===t.context?t.context=n:t.pendingContext=n,(t=lo(o,i)).payload={element:e},null!==(r=void 0===r?null:r)&&(t.callback=r),co(a,t),hu(a,i,o),i}function el(e){return(e=e.current).child?(e.child.tag,e.child.stateNode):null}function tl(e,t){if(null!==(e=e.memoizedState)&&null!==e.dehydrated){var n=e.retryLane;e.retryLane=0!==n&&n<t?n:t}}function nl(e,t){tl(e,t),(e=e.alternate)&&tl(e,t)}function rl(e,t,n){var r=null!=n&&null!=n.hydrationOptions&&n.hydrationOptions.mutableSources||null;if(n=new Zu(e,t,null!=n&&!0===n.hydrate),t=Wu(3,null,null,2===t?7:1===t?3:0),n.current=t,t.stateNode=n,io(t),e[Jr]=n.current,Or(8===e.nodeType?e.parentNode:e),r)for(e=0;e<r.length;e++){var a=(t=r[e])._getVersion;a=a(t._source),null==n.mutableSourceEagerHydrationData?n.mutableSourceEagerHydrationData=[t,a]:n.mutableSourceEagerHydrationData.push(t,a)}this._internalRoot=n}function al(e){return!(!e||1!==e.nodeType&&9!==e.nodeType&&11!==e.nodeType&&(8!==e.nodeType||" react-mount-point-unstable "!==e.nodeValue))}function ol(e,t,n,r,a){var o=n._reactRootContainer;if(o){var s=o._internalRoot;if("function"==typeof a){var i=a;a=function(){var e=el(s);i.call(e)}}Ju(t,s,e,a)}else{if(o=n._reactRootContainer=function(e,t){if(t||(t=!(!(t=e?9===e.nodeType?e.documentElement:e.firstChild:null)||1!==t.nodeType||!t.hasAttribute("data-reactroot"))),!t)for(var n;n=e.lastChild;)e.removeChild(n);return new rl(e,0,t?{hydrate:!0}:void 0)}(n,r),s=o._internalRoot,"function"==typeof a){var u=a;a=function(){var e=el(s);u.call(e)}}xu((function(){Ju(t,s,e,a)}))}return el(s)}function sl(e,t){var n=2<arguments.length&&void 0!==arguments[2]?arguments[2]:null;if(!al(t))throw Error(s(200));return function(e,t,n){var r=3<arguments.length&&void 0!==arguments[3]?arguments[3]:null;return{$$typeof:S,key:null==r?null:""+r,children:e,containerInfo:t,implementation:n}}(e,t,null,n)}Ki=function(e,t,n){var r=t.lanes;if(null!==e)if(e.memoizedProps!==t.pendingProps||fa.current)Fs=!0;else{if(0==(n&r)){switch(Fs=!1,t.tag){case 3:qs(t),Go();break;case 5:Ro(t);break;case 1:ga(t.type)&&wa(t);break;case 4:Co(t,t.stateNode.containerInfo);break;case 10:r=t.memoizedProps.value;var a=t.type._context;ca(Xa,a._currentValue),a._currentValue=r;break;case 13:if(null!==t.memoizedState)return 0!=(n&t.child.childLanes)?Zs(e,t,n):(ca(Po,1&Po.current),null!==(t=oi(e,t,n))?t.sibling:null);ca(Po,1&Po.current);break;case 19:if(r=0!=(n&t.childLanes),0!=(64&e.flags)){if(r)return ai(e,t,n);t.flags|=64}if(null!==(a=t.memoizedState)&&(a.rendering=null,a.tail=null,a.lastEffect=null),ca(Po,Po.current),r)break;return null;case 23:case 24:return t.lanes=0,Vs(e,t,n)}return oi(e,t,n)}Fs=0!=(16384&e.flags)}else Fs=!1;switch(t.lanes=0,t.tag){case 2:if(r=t.type,null!==e&&(e.alternate=null,t.alternate=null,t.flags|=2),e=t.pendingProps,a=ma(t,da.current),ao(t,n),a=ss(null,t,r,e,a,n),t.flags|=1,"object"==typeof a&&null!==a&&"function"==typeof a.render&&void 0===a.$$typeof){if(t.tag=1,t.memoizedState=null,t.updateQueue=null,ga(r)){var o=!0;wa(t)}else o=!1;t.memoizedState=null!==a.state&&void 0!==a.state?a.state:null,io(t);var i=r.getDerivedStateFromProps;"function"==typeof i&&go(t,r,i,e),a.updater=yo,t.stateNode=a,a._reactInternals=t,xo(t,r,e,n),t=Hs(null,t,r,!0,o,n)}else t.tag=0,Ps(null,t,a,n),t=t.child;return t;case 16:a=t.elementType;e:{switch(null!==e&&(e.alternate=null,t.alternate=null,t.flags|=2),e=t.pendingProps,a=(o=a._init)(a._payload),t.type=a,o=t.tag=function(e){if("function"==typeof e)return Hu(e)?1:0;if(null!=e){if((e=e.$$typeof)===I)return 11;if(e===D)return 14}return 2}(a),e=Ya(a,e),o){case 0:t=js(null,t,a,e,n);break e;case 1:t=Ws(null,t,a,e,n);break e;case 11:t=Ls(null,t,a,e,n);break e;case 14:t=zs(null,t,a,Ya(a.type,e),r,n);break e}throw Error(s(306,a,""))}return t;case 0:return r=t.type,a=t.pendingProps,js(e,t,r,a=t.elementType===r?a:Ya(r,a),n);case 1:return r=t.type,a=t.pendingProps,Ws(e,t,r,a=t.elementType===r?a:Ya(r,a),n);case 3:if(qs(t),r=t.updateQueue,null===e||null===r)throw Error(s(282));if(r=t.pendingProps,a=null!==(a=t.memoizedState)?a.element:null,uo(e,t),fo(t,r,null,n),(r=t.memoizedState.element)===a)Go(),t=oi(e,t,n);else{if((o=(a=t.stateNode).hydrate)&&(Bo=Gr(t.stateNode.containerInfo.firstChild),zo=t,o=Vo=!0),o){if(null!=(e=a.mutableSourceEagerHydrationData))for(a=0;a<e.length;a+=2)(o=e[a])._workInProgressVersionPrimary=e[a+1],Ko.push(o);for(n=_o(t,null,r,n),t.child=n;n;)n.flags=-3&n.flags|1024,n=n.sibling}else Ps(e,t,r,n),Go();t=t.child}return t;case 5:return Ro(t),null===e&&Wo(t),r=t.type,a=t.pendingProps,o=null!==e?e.memoizedProps:null,i=a.children,jr(r,a)?i=null:null!==o&&jr(r,o)&&(t.flags|=16),Us(e,t),Ps(e,t,i,n),t.child;case 6:return null===e&&Wo(t),null;case 13:return Zs(e,t,n);case 4:return Co(t,t.stateNode.containerInfo),r=t.pendingProps,null===e?t.child=To(t,null,r,n):Ps(e,t,r,n),t.child;case 11:return r=t.type,a=t.pendingProps,Ls(e,t,r,a=t.elementType===r?a:Ya(r,a),n);case 7:return Ps(e,t,t.pendingProps,n),t.child;case 8:case 12:return Ps(e,t,t.pendingProps.children,n),t.child;case 10:e:{r=t.type._context,a=t.pendingProps,i=t.memoizedProps,o=a.value;var u=t.type._context;if(ca(Xa,u._currentValue),u._currentValue=o,null!==i)if(u=i.value,0===(o=lr(u,o)?0:0|("function"==typeof r._calculateChangedBits?r._calculateChangedBits(u,o):1073741823))){if(i.children===a.children&&!fa.current){t=oi(e,t,n);break e}}else for(null!==(u=t.child)&&(u.return=t);null!==u;){var l=u.dependencies;if(null!==l){i=u.child;for(var c=l.firstContext;null!==c;){if(c.context===r&&0!=(c.observedBits&o)){1===u.tag&&((c=lo(-1,n&-n)).tag=2,co(u,c)),u.lanes|=n,null!==(c=u.alternate)&&(c.lanes|=n),ro(u.return,n),l.lanes|=n;break}c=c.next}}else i=10===u.tag&&u.type===t.type?null:u.child;if(null!==i)i.return=u;else for(i=u;null!==i;){if(i===t){i=null;break}if(null!==(u=i.sibling)){u.return=i.return,i=u;break}i=i.return}u=i}Ps(e,t,a.children,n),t=t.child}return t;case 9:return a=t.type,r=(o=t.pendingProps).children,ao(t,n),r=r(a=oo(a,o.unstable_observedBits)),t.flags|=1,Ps(e,t,r,n),t.child;case 14:return o=Ya(a=t.type,t.pendingProps),zs(e,t,a,o=Ya(a.type,o),r,n);case 15:return Bs(e,t,t.type,t.pendingProps,r,n);case 17:return r=t.type,a=t.pendingProps,a=t.elementType===r?a:Ya(r,a),null!==e&&(e.alternate=null,t.alternate=null,t.flags|=2),t.tag=1,ga(r)?(e=!0,wa(t)):e=!1,ao(t,n),vo(t,r,a),xo(t,r,a,n),Hs(null,t,r,!0,e,n);case 19:return ai(e,t,n);case 23:case 24:return Vs(e,t,n)}throw Error(s(156,t.tag))},rl.prototype.render=function(e){Ju(e,this._internalRoot,null,null)},rl.prototype.unmount=function(){var e=this._internalRoot,t=e.containerInfo;Ju(null,e,null,(function(){t[Jr]=null}))},et=function(e){13===e.tag&&(hu(e,4,du()),nl(e,4))},tt=function(e){13===e.tag&&(hu(e,67108864,du()),nl(e,67108864))},nt=function(e){if(13===e.tag){var t=du(),n=fu(e);hu(e,n,t),nl(e,n)}},rt=function(e,t){return t()},Te=function(e,t,n){switch(t){case"input":if(ne(e,n),t=n.name,"radio"===n.type&&null!=t){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+t)+'][type="radio"]'),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var a=aa(r);if(!a)throw Error(s(90));X(r),ne(r,a)}}}break;case"textarea":le(e,n);break;case"select":null!=(t=n.value)&&se(e,!!n.multiple,t,!1)}},De=wu,Ce=function(e,t,n,r,a){var o=Di;Di|=4;try{return Ha(98,e.bind(null,t,n,r,a))}finally{0===(Di=o)&&(Gi(),Ga())}},$e=function(){0==(49&Di)&&(function(){if(null!==au){var e=au;au=null,e.forEach((function(e){e.expiredLanes|=24&e.pendingLanes,gu(e,Ua())}))}Ga()}(),Ru())},Re=function(e,t){var n=Di;Di|=2;try{return e(t)}finally{0===(Di=n)&&(Gi(),Ga())}};var il={Events:[na,ra,aa,Me,Oe,Ru,{current:!1}]},ul={findFiberByHostInstance:ta,bundleType:0,version:"17.0.2",rendererPackageName:"react-dom"},ll={bundleType:ul.bundleType,version:ul.version,rendererPackageName:ul.rendererPackageName,rendererConfig:ul.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:x.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){return null===(e=Ze(e))?null:e.stateNode},findFiberByHostInstance:ul.findFiberByHostInstance||function(){return null},findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null};if("undefined"!=typeof __REACT_DEVTOOLS_GLOBAL_HOOK__){var cl=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!cl.isDisabled&&cl.supportsFiber)try{ka=cl.inject(ll),Sa=cl}catch(me){}}t.render=function(e,t,n){if(!al(t))throw Error(s(200));return ol(null,e,t,!1,n)}},9060:(e,t,n)=>{"use strict";!function e(){if("undefined"!=typeof __REACT_DEVTOOLS_GLOBAL_HOOK__&&"function"==typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE)try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e)}catch(e){console.error(e)}}(),e.exports=n(1583)},513:function(e,t,n){(function(){"use strict";var e;function t(e){var t=0;return function(){return t<e.length?{done:!1,value:e[t++]}:{done:!0}}}var r="function"==typeof Object.defineProperties?Object.defineProperty:function(e,t,n){return e==Array.prototype||e==Object.prototype||(e[t]=n.value),e};var a=function(e){e=["object"==typeof globalThis&&globalThis,e,"object"==typeof window&&window,"object"==typeof self&&self,"object"==typeof n.g&&n.g];for(var t=0;t<e.length;++t){var r=e[t];if(r&&r.Math==Math)return r}throw Error("Cannot find global object")}(this);function o(e,t){if(t)e:{var n=a;e=e.split(".");for(var o=0;o<e.length-1;o++){var s=e[o];if(!(s in n))break e;n=n[s]}(t=t(o=n[e=e[e.length-1]]))!=o&&null!=t&&r(n,e,{configurable:!0,writable:!0,value:t})}}function s(e){return(e={next:e})[Symbol.iterator]=function(){return this},e}function i(e){var n="undefined"!=typeof Symbol&&Symbol.iterator&&e[Symbol.iterator];return n?n.call(e):{next:t(e)}}function u(e){if(!(e instanceof Array)){e=i(e);for(var t,n=[];!(t=e.next()).done;)n.push(t.value);e=n}return e}o("Symbol",(function(e){function t(e,t){this.h=e,r(this,"description",{configurable:!0,writable:!0,value:t})}if(e)return e;t.prototype.toString=function(){return this.h};var n="jscomp_symbol_"+(1e9*Math.random()>>>0)+"_",a=0;return function e(r){if(this instanceof e)throw new TypeError("Symbol is not a constructor");return new t(n+(r||"")+"_"+a++,r)}})),o("Symbol.iterator",(function(e){if(e)return e;e=Symbol("Symbol.iterator");for(var n="Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array".split(" "),o=0;o<n.length;o++){var i=a[n[o]];"function"==typeof i&&"function"!=typeof i.prototype[e]&&r(i.prototype,e,{configurable:!0,writable:!0,value:function(){return s(t(this))}})}return e}));var l="function"==typeof Object.assign?Object.assign:function(e,t){for(var n=1;n<arguments.length;n++){var r=arguments[n];if(r)for(var a in r)Object.prototype.hasOwnProperty.call(r,a)&&(e[a]=r[a])}return e};o("Object.assign",(function(e){return e||l}));var c,p="function"==typeof Object.create?Object.create:function(e){function t(){}return t.prototype=e,new t};if("function"==typeof Object.setPrototypeOf)c=Object.setPrototypeOf;else{var d;e:{var f={};try{f.__proto__={a:!0},d=f.a;break e}catch(e){}d=!1}c=d?function(e,t){if(e.__proto__=t,e.__proto__!==t)throw new TypeError(e+" is not extensible");return e}:null}var h=c;function m(e,t){if(e.prototype=p(t.prototype),e.prototype.constructor=e,h)h(e,t);else for(var n in t)if("prototype"!=n)if(Object.defineProperties){var r=Object.getOwnPropertyDescriptor(t,n);r&&Object.defineProperty(e,n,r)}else e[n]=t[n];e.za=t.prototype}function g(){this.m=!1,this.j=null,this.i=void 0,this.h=1,this.v=this.s=0,this.l=null}function y(e){if(e.m)throw new TypeError("Generator is already running");e.m=!0}function b(e,t){e.l={ma:t,na:!0},e.h=e.s||e.v}function v(e,t,n){return e.h=n,{value:t}}function w(e){this.h=new g,this.i=e}function x(e,t,n,r){try{var a=t.call(e.h.j,n);if(!(a instanceof Object))throw new TypeError("Iterator result "+a+" is not an object");if(!a.done)return e.h.m=!1,a;var o=a.value}catch(t){return e.h.j=null,b(e.h,t),k(e)}return e.h.j=null,r.call(e.h,o),k(e)}function k(e){for(;e.h.h;)try{var t=e.i(e.h);if(t)return e.h.m=!1,{value:t.value,done:!1}}catch(t){e.h.i=void 0,b(e.h,t)}if(e.h.m=!1,e.h.l){if(t=e.h.l,e.h.l=null,t.na)throw t.ma;return{value:t.return,done:!0}}return{value:void 0,done:!0}}function S(e){this.next=function(t){return y(e.h),e.h.j?t=x(e,e.h.j.next,t,e.h.u):(e.h.u(t),t=k(e)),t},this.throw=function(t){return y(e.h),e.h.j?t=x(e,e.h.j.throw,t,e.h.u):(b(e.h,t),t=k(e)),t},this.return=function(t){return function(e,t){y(e.h);var n=e.h.j;return n?x(e,"return"in n?n.return:function(e){return{value:e,done:!0}},t,e.h.return):(e.h.return(t),k(e))}(e,t)},this[Symbol.iterator]=function(){return this}}function E(e){return function(e){function t(t){return e.next(t)}function n(t){return e.throw(t)}return new Promise((function(r,a){!function e(o){o.done?r(o.value):Promise.resolve(o.value).then(t,n).then(e,a)}(e.next())}))}(new S(new w(e)))}function N(e){return e||Array.prototype.fill}g.prototype.u=function(e){this.i=e},g.prototype.return=function(e){this.l={return:e},this.h=this.v},o("Promise",(function(e){function t(e){this.i=0,this.j=void 0,this.h=[],this.u=!1;var t=this.l();try{e(t.resolve,t.reject)}catch(e){t.reject(e)}}function n(){this.h=null}function r(e){return e instanceof t?e:new t((function(t){t(e)}))}if(e)return e;n.prototype.i=function(e){if(null==this.h){this.h=[];var t=this;this.j((function(){t.m()}))}this.h.push(e)};var o=a.setTimeout;n.prototype.j=function(e){o(e,0)},n.prototype.m=function(){for(;this.h&&this.h.length;){var e=this.h;this.h=[];for(var t=0;t<e.length;++t){var n=e[t];e[t]=null;try{n()}catch(e){this.l(e)}}}this.h=null},n.prototype.l=function(e){this.j((function(){throw e}))},t.prototype.l=function(){function e(e){return function(r){n||(n=!0,e.call(t,r))}}var t=this,n=!1;return{resolve:e(this.I),reject:e(this.m)}},t.prototype.I=function(e){if(e===this)this.m(new TypeError("A Promise cannot resolve to itself"));else if(e instanceof t)this.L(e);else{e:switch(typeof e){case"object":var n=null!=e;break e;case"function":n=!0;break e;default:n=!1}n?this.F(e):this.s(e)}},t.prototype.F=function(e){var t=void 0;try{t=e.then}catch(e){return void this.m(e)}"function"==typeof t?this.M(t,e):this.s(e)},t.prototype.m=function(e){this.v(2,e)},t.prototype.s=function(e){this.v(1,e)},t.prototype.v=function(e,t){if(0!=this.i)throw Error("Cannot settle("+e+", "+t+"): Promise already settled in state"+this.i);this.i=e,this.j=t,2===this.i&&this.K(),this.H()},t.prototype.K=function(){var e=this;o((function(){if(e.D()){var t=a.console;void 0!==t&&t.error(e.j)}}),1)},t.prototype.D=function(){if(this.u)return!1;var e=a.CustomEvent,t=a.Event,n=a.dispatchEvent;return void 0===n||("function"==typeof e?e=new e("unhandledrejection",{cancelable:!0}):"function"==typeof t?e=new t("unhandledrejection",{cancelable:!0}):(e=a.document.createEvent("CustomEvent")).initCustomEvent("unhandledrejection",!1,!0,e),e.promise=this,e.reason=this.j,n(e))},t.prototype.H=function(){if(null!=this.h){for(var e=0;e<this.h.length;++e)s.i(this.h[e]);this.h=null}};var s=new n;return t.prototype.L=function(e){var t=this.l();e.T(t.resolve,t.reject)},t.prototype.M=function(e,t){var n=this.l();try{e.call(t,n.resolve,n.reject)}catch(e){n.reject(e)}},t.prototype.then=function(e,n){function r(e,t){return"function"==typeof e?function(t){try{a(e(t))}catch(e){o(e)}}:t}var a,o,s=new t((function(e,t){a=e,o=t}));return this.T(r(e,a),r(n,o)),s},t.prototype.catch=function(e){return this.then(void 0,e)},t.prototype.T=function(e,t){function n(){switch(r.i){case 1:e(r.j);break;case 2:t(r.j);break;default:throw Error("Unexpected state: "+r.i)}}var r=this;null==this.h?s.i(n):this.h.push(n),this.u=!0},t.resolve=r,t.reject=function(e){return new t((function(t,n){n(e)}))},t.race=function(e){return new t((function(t,n){for(var a=i(e),o=a.next();!o.done;o=a.next())r(o.value).T(t,n)}))},t.all=function(e){var n=i(e),a=n.next();return a.done?r([]):new t((function(e,t){function o(t){return function(n){s[t]=n,0==--i&&e(s)}}var s=[],i=0;do{s.push(void 0),i++,r(a.value).T(o(s.length-1),t),a=n.next()}while(!a.done)}))},t})),o("Array.prototype.keys",(function(e){return e||function(){return function(e,t){e instanceof String&&(e+="");var n=0,r=!1,a={next:function(){if(!r&&n<e.length){var a=n++;return{value:t(a,e[a]),done:!1}}return r=!0,{done:!0,value:void 0}}};return a[Symbol.iterator]=function(){return a},a}(this,(function(e){return e}))}})),o("Array.prototype.fill",(function(e){return e||function(e,t,n){var r=this.length||0;for(0>t&&(t=Math.max(0,r+t)),(null==n||n>r)&&(n=r),0>(n=Number(n))&&(n=Math.max(0,r+n)),t=Number(t||0);t<n;t++)this[t]=e;return this}})),o("Int8Array.prototype.fill",N),o("Uint8Array.prototype.fill",N),o("Uint8ClampedArray.prototype.fill",N),o("Int16Array.prototype.fill",N),o("Uint16Array.prototype.fill",N),o("Int32Array.prototype.fill",N),o("Uint32Array.prototype.fill",N),o("Float32Array.prototype.fill",N),o("Float64Array.prototype.fill",N),o("Object.is",(function(e){return e||function(e,t){return e===t?0!==e||1/e==1/t:e!=e&&t!=t}})),o("Array.prototype.includes",(function(e){return e||function(e,t){var n=this;n instanceof String&&(n=String(n));var r=n.length;for(0>(t=t||0)&&(t=Math.max(t+r,0));t<r;t++){var a=n[t];if(a===e||Object.is(a,e))return!0}return!1}})),o("String.prototype.includes",(function(e){return e||function(e,t){if(null==this)throw new TypeError("The 'this' value for String.prototype.includes must not be null or undefined");if(e instanceof RegExp)throw new TypeError("First argument to String.prototype.includes must not be a regular expression");return-1!==this.indexOf(e,t||0)}}));var T=this||self;function _(e,t){e=e.split(".");var n,r=T;e[0]in r||void 0===r.execScript||r.execScript("var "+e[0]);for(;e.length&&(n=e.shift());)e.length||void 0===t?r=r[n]&&r[n]!==Object.prototype[n]?r[n]:r[n]={}:r[n]=t}function A(e){var t;return(t=T.navigator)&&(t=t.userAgent)||(t=""),-1!=t.indexOf(e)}var I=Array.prototype.map?function(e,t){return Array.prototype.map.call(e,t,void 0)}:function(e,t){for(var n=e.length,r=Array(n),a="string"==typeof e?e.split(""):e,o=0;o<n;o++)o in a&&(r[o]=t.call(void 0,a[o],o,e));return r},M={},O=null;function D(e){var t=e.length,n=3*t/4;n%3?n=Math.floor(n):-1!="=.".indexOf(e[t-1])&&(n=-1!="=.".indexOf(e[t-2])?n-2:n-1);var r=new Uint8Array(n),a=0;return function(e,t){function n(t){for(;r<e.length;){var n=e.charAt(r++),a=O[n];if(null!=a)return a;if(!/^[\s\xa0]*$/.test(n))throw Error("Unknown base64 encoding at char: "+n)}return t}C();for(var r=0;;){var a=n(-1),o=n(0),s=n(64),i=n(64);if(64===i&&-1===a)break;t(a<<2|o>>4),64!=s&&(t(o<<4&240|s>>2),64!=i&&t(s<<6&192|i))}}(e,(function(e){r[a++]=e})),a!==n?r.subarray(0,a):r}function C(){if(!O){O={};for(var e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""),t=["+/=","+/","-_=","-_.","-_"],n=0;5>n;n++){var r=e.concat(t[n].split(""));M[n]=r;for(var a=0;a<r.length;a++){var o=r[a];void 0===O[o]&&(O[o]=a)}}}}var $="undefined"!=typeof Uint8Array,R=!(A("Trident")||A("MSIE"))&&"function"==typeof T.btoa;function F(e){if(!R){var t;void 0===t&&(t=0),C(),t=M[t];for(var n=Array(Math.floor(e.length/3)),r=t[64]||"",a=0,o=0;a<e.length-2;a+=3){var s=e[a],i=e[a+1],u=e[a+2],l=t[s>>2];s=t[(3&s)<<4|i>>4],i=t[(15&i)<<2|u>>6],u=t[63&u],n[o++]=l+s+i+u}switch(l=0,u=r,e.length-a){case 2:u=t[(15&(l=e[a+1]))<<2]||r;case 1:e=e[a],n[o]=t[e>>2]+t[(3&e)<<4|l>>4]+u+r}return n.join("")}for(t="";10240<e.length;)t+=String.fromCharCode.apply(null,e.subarray(0,10240)),e=e.subarray(10240);return t+=String.fromCharCode.apply(null,e),btoa(t)}var P,L=RegExp("[-_.]","g");function z(e){switch(e){case"-":return"+";case"_":return"/";case".":return"=";default:return""}}function B(e){if(!R)return D(e);L.test(e)&&(e=e.replace(L,z)),e=atob(e);for(var t=new Uint8Array(e.length),n=0;n<e.length;n++)t[n]=e.charCodeAt(n);return t}function V(){return P||(P=new Uint8Array(0))}var U={},j="function"==typeof Uint8Array.prototype.slice,W=0,H=0;function q(e){var t=0>e,n=(e=Math.abs(e))>>>0;e=Math.floor((e-n)/4294967296),t&&(t=(n=i(Q(n,e))).next().value,e=n.next().value,n=t),W=n>>>0,H=e>>>0}var G,K="function"==typeof BigInt;function Q(e,t){return t=~t,e?e=1+~e:t+=1,[e,t]}function Y(e,t){this.i=e>>>0,this.h=t>>>0}function X(e){if(!e)return G||(G=new Y(0,0));if(!/^-?\d+$/.test(e))return null;if(16>e.length)q(Number(e));else if(K)e=BigInt(e),W=Number(e&BigInt(4294967295))>>>0,H=Number(e>>BigInt(32)&BigInt(4294967295));else{var t=+("-"===e[0]);H=W=0;for(var n=e.length,r=t,a=(n-t)%6+t;a<=n;r=a,a+=6)r=Number(e.slice(r,a)),H*=1e6,4294967296<=(W=1e6*W+r)&&(H+=W/4294967296|0,W%=4294967296);t&&(e=(t=i(Q(W,H))).next().value,t=t.next().value,W=e,H=t)}return new Y(W,H)}function Z(e,t){return Error("Invalid wire type: "+e+" (at position "+t+")")}function J(){return Error("Failed to read varint, encoding is invalid.")}function ee(e,t){return Error("Tried to read past the end of the data "+t+" > "+e)}function te(){throw Error("Invalid UTF8")}function ne(e,t){return t=String.fromCharCode.apply(null,t),null==e?t:e+t}var re,ae,oe,se=void 0,ie="undefined"!=typeof TextDecoder,ue="undefined"!=typeof TextEncoder;function le(e){if(e!==U)throw Error("illegal external caller")}function ce(e,t){if(le(t),this.V=e,null!=e&&0===e.length)throw Error("ByteString should be constructed with non-empty values")}function pe(){return oe||(oe=new ce(null,U))}function de(e){le(U);var t=e.V;return null==(t=null==t||$&&null!=t&&t instanceof Uint8Array?t:"string"==typeof t?B(t):null)?t:e.V=t}function fe(e,t){this.i=null,this.m=!1,this.h=this.j=this.l=0,he(this,e,t)}function he(e,t,n){n=void 0===n?{}:n,e.S=void 0!==n.S&&n.S,t&&(t=function(e){if("string"==typeof e)return{buffer:B(e),C:!1};if(Array.isArray(e))return{buffer:new Uint8Array(e),C:!1};if(e.constructor===Uint8Array)return{buffer:e,C:!1};if(e.constructor===ArrayBuffer)return{buffer:new Uint8Array(e),C:!1};if(e.constructor===ce)return{buffer:de(e)||V(),C:!0};if(e instanceof Uint8Array)return{buffer:new Uint8Array(e.buffer,e.byteOffset,e.byteLength),C:!1};throw Error("Type not convertible to a Uint8Array, expected a Uint8Array, an ArrayBuffer, a base64 encoded string, a ByteString or an Array of numbers")}(t),e.i=t.buffer,e.m=t.C,e.l=0,e.j=e.i.length,e.h=e.l)}function me(e,t){if(e.h=t,t>e.j)throw ee(e.j,t)}function ge(e){var t=e.i,n=e.h,r=t[n++],a=127&r;if(128&r&&(a|=(127&(r=t[n++]))<<7,128&r&&(a|=(127&(r=t[n++]))<<14,128&r&&(a|=(127&(r=t[n++]))<<21,128&r&&(a|=(r=t[n++])<<28,128&r&&128&t[n++]&&128&t[n++]&&128&t[n++]&&128&t[n++]&&128&t[n++])))))throw J();return me(e,n),a}function ye(e,t){if(0>t)throw Error("Tried to read a negative byte length: "+t);var n=e.h,r=n+t;if(r>e.j)throw ee(t,e.j-n);return e.h=r,n}fe.prototype.reset=function(){this.h=this.l};var be=[];function ve(){this.h=[]}function we(e,t,n){for(;0<n||127<t;)e.h.push(127&t|128),t=(t>>>7|n<<25)>>>0,n>>>=7;e.h.push(t)}function xe(e,t){for(;127<t;)e.h.push(127&t|128),t>>>=7;e.h.push(t)}function ke(e,t){if(be.length){var n=be.pop();he(n,e,t),e=n}else e=new fe(e,t);this.h=e,this.j=this.h.h,this.i=this.l=-1,this.setOptions(t)}function Se(e){var t=e.h;if(t.h==t.j)return!1;e.j=e.h.h;var n=ge(e.h)>>>0;if(t=n>>>3,!(0<=(n&=7)&&5>=n))throw Z(n,e.j);if(1>t)throw Error("Invalid field number: "+t+" (at position "+e.j+")");return e.l=t,e.i=n,!0}function Ee(e){switch(e.i){case 0:if(0!=e.i)Ee(e);else e:{for(var t=(e=e.h).h,n=t+10,r=e.i;t<n;)if(0==(128&r[t++])){me(e,t);break e}throw J()}break;case 1:me(e=e.h,e.h+8);break;case 2:2!=e.i?Ee(e):(t=ge(e.h)>>>0,me(e=e.h,e.h+t));break;case 5:me(e=e.h,e.h+4);break;case 3:for(t=e.l;;){if(!Se(e))throw Error("Unmatched start-group tag: stream EOF");if(4==e.i){if(e.l!=t)throw Error("Unmatched end-group tag");break}Ee(e)}break;default:throw Z(e.i,e.j)}}ve.prototype.length=function(){return this.h.length},ve.prototype.end=function(){var e=this.h;return this.h=[],e},ke.prototype.setOptions=function(e){e=void 0===e?{}:e,this.ca=void 0!==e.ca&&e.ca},ke.prototype.reset=function(){this.h.reset(),this.j=this.h.h,this.i=this.l=-1};var Ne=[];function Te(){this.j=[],this.i=0,this.h=new ve}function _e(e,t){0!==t.length&&(e.j.push(t),e.i+=t.length)}var Ae="function"==typeof Symbol&&"symbol"==typeof Symbol()?Symbol():void 0;function Ie(e,t){return Ae?e[Ae]|=t:void 0!==e.A?e.A|=t:(Object.defineProperties(e,{A:{value:t,configurable:!0,writable:!0,enumerable:!1}}),t)}function Me(e,t){Ae?e[Ae]&&(e[Ae]&=~t):void 0!==e.A&&(e.A&=~t)}function Oe(e){var t;return null==(t=Ae?e[Ae]:e.A)?0:t}function De(e,t){Ae?e[Ae]=t:void 0!==e.A?e.A=t:Object.defineProperties(e,{A:{value:t,configurable:!0,writable:!0,enumerable:!1}})}function Ce(e){return Ie(e,1),e}function $e(e,t){De(t,-51&(0|e))}function Re(e,t){De(t,-41&(18|e))}var Fe={};function Pe(e){return null!==e&&"object"==typeof e&&!Array.isArray(e)&&e.constructor===Object}var Le,ze,Be=[];function Ve(e){if(2&Oe(e.o))throw Error("Cannot mutate an immutable Message")}function Ue(e){var t=e.length;(t=t?e[t-1]:void 0)&&Pe(t)?t.g=1:(t={},e.push((t.g=1,t)))}function je(e){var t=e.i+e.G;return e.B||(e.B=e.o[t]={})}function We(e,t){return-1===t?null:t>=e.i?e.B?e.B[t]:void 0:e.o[t+e.G]}function He(e,t,n,r){Ve(e),qe(e,t,n,r)}function qe(e,t,n,r){e.j&&(e.j=void 0),t>=e.i||r?je(e)[t]=n:(e.o[t+e.G]=n,(e=e.B)&&t in e&&delete e[t])}function Ge(e,t,n,r){var a=We(e,t);Array.isArray(a)||(a=Le);var o=Oe(a);if(1&o||Ce(a),r)2&o||Ie(a,2),1&n||Object.freeze(a);else{r=!(2&n);var s=2&o;1&n||!s?r&&16&o&&!s&&Me(a,16):qe(e,t,a=Ce(Array.prototype.slice.call(a)))}return a}function Ke(e,t){var n=We(e,t),r=null==n?n:"number"==typeof n||"NaN"===n||"Infinity"===n||"-Infinity"===n?Number(n):void 0;return null!=r&&r!==n&&qe(e,t,r),r}function Qe(e,t,n,r,a){e.h||(e.h={});var o=e.h[n],s=Ge(e,n,3,a);if(!o){var i=s;o=[];var u=!!(16&Oe(e.o));s=!!(2&Oe(i));var l=i;!a&&s&&(i=Array.prototype.slice.call(i));for(var c=s,p=0;p<i.length;p++){var d=i[p],f=t,h=!1;if(h=void 0!==h&&h,void 0!==(d=Array.isArray(d)?new f(d):h?new f:void 0)){var m=h=Oe(f=d.o);s&&(m|=2),u&&(m|=16),m!=h&&De(f,m),f=m,c=c||!!(2&f),o.push(d)}}return e.h[n]=o,t=33|(u=Oe(i)),u!=(t=c?-9&t:8|t)&&(c=i,Object.isFrozen(c)&&(c=Array.prototype.slice.call(c)),De(c,t),i=c),l!==i&&qe(e,n,i),(a||r&&s)&&Ie(o,2),r&&Object.freeze(o),o}return a||(a=Object.isFrozen(o),r&&!a?Object.freeze(o):!r&&a&&(o=Array.prototype.slice.call(o),e.h[n]=o)),o}function Ye(e,t,n){var r=!!(2&Oe(e.o));if(t=Qe(e,t,n,r,r),e=Ge(e,n,3,r),!(r||8&Oe(e))){for(r=0;r<t.length;r++){if(2&Oe((n=t[r]).o)){var a=ut(n,!1);a.j=n}else a=n;n!==a&&(t[r]=a,e[r]=a.o)}Ie(e,8)}return t}function Xe(e,t,n){if(null!=n&&"number"!=typeof n)throw Error("Value of float/double field must be a number|null|undefined, found "+typeof n+": "+n);He(e,t,n)}function Ze(e,t,n,r,a){Ve(e);var o=Qe(e,n,t,!1,!1);return n=null!=r?r:new n,e=Ge(e,t,2,!1),null!=a?(o.splice(a,0,n),e.splice(a,0,n.o)):(o.push(n),e.push(n.o)),n.C()&&Me(e,8),n}function Je(e,t){return null==e?t:e}function et(e,t,n){return n=void 0===n?0:n,Je(Ke(e,t),n)}function tt(e,t,n,r){if(null!=e){if(Array.isArray(e))e=nt(e,t,n,void 0!==r);else if(Pe(e)){var a,o={};for(a in e)o[a]=tt(e[a],t,n,r);e=o}else e=t(e,r);return e}}function nt(e,t,n,r){var a=Oe(e);r=r?!!(16&a):void 0,e=Array.prototype.slice.call(e);for(var o=0;o<e.length;o++)e[o]=tt(e[o],t,n,r);return n(a,e),e}function rt(e){return e.ja===Fe?e.toJSON():function(e){switch(typeof e){case"number":return isFinite(e)?e:String(e);case"object":if(e)if(Array.isArray(e)){if(0!=(128&Oe(e)))return Ue(e=Array.prototype.slice.call(e)),e}else{if($&&null!=e&&e instanceof Uint8Array)return F(e);if(e instanceof ce){var t=e.V;return null==t?"":"string"==typeof t?t:e.V=F(t)}}}return e}(e)}function at(e,t){128&e&&Ue(t)}function ot(e,t,n){if(n=void 0===n?Re:n,null!=e){if($&&e instanceof Uint8Array)return e.length?new ce(new Uint8Array(e),U):pe();if(Array.isArray(e)){var r=Oe(e);return 2&r?e:!t||32&r||!(16&r||0===r)?(4&(t=Oe(e=nt(e,ot,4&r?Re:n,!0)))&&2&t&&Object.freeze(e),e):(De(e,2|r),e)}return e.ja===Fe?it(e):e}}function st(e,t,n,r,a,o,s){if(e=e.h&&e.h[n]){if(2&(r=Oe(e))?r=e:(Re(r,o=I(e,it)),Object.freeze(o),r=o),Ve(t),s=null==r?Le:Ce([]),null!=r){for(o=!!r.length,e=0;e<r.length;e++){var i=r[e];o=o&&!(2&Oe(i.o)),s[e]=i.o}o=1|(o?8:0),((e=Oe(s))&o)!==o&&(Object.isFrozen(s)&&(s=Array.prototype.slice.call(s)),De(s,e|o)),t.h||(t.h={}),t.h[n]=r}else t.h&&(t.h[n]=void 0);qe(t,n,s,a)}else He(t,n,ot(r,o,s),a)}function it(e){return 2&Oe(e.o)||Ie((e=ut(e,!0)).o,2),e}function ut(e,t){var n=e.o,r=[];Ie(r,16);var a=e.constructor.h;if(a&&r.push(a),a=e.B){r.length=n.length,r.fill(void 0,r.length,n.length);var o={};r[r.length-1]=o}0!=(128&Oe(n))&&Ue(r),t=t||e.C()?Re:$e,o=e.constructor,ze=r,r=new o(r),ze=void 0,e.R&&(r.R=e.R.slice()),o=!!(16&Oe(n));for(var s=a?n.length-1:n.length,i=0;i<s;i++)st(e,r,i-e.G,n[i],!1,o,t);if(a)for(var u in a)st(e,r,+u,a[u],!0,o,t);return r}function lt(e,t,n){null==e&&(e=ze),ze=void 0;var r,a=this.constructor.i||0,o=0<a,s=this.constructor.h,i=!1;if(null==e){var u=48,l=!0;o&&(a=0,u|=128),De(e=s?[s]:[],u)}else{if(!Array.isArray(e))throw Error();if(s&&s!==e[0])throw Error();var c=u=Ie(e,0);if((l=0!=(16&c))&&((i=0!=(32&c))||(c|=32)),o){if(128&c)a=0;else if(0<e.length){var p=e[e.length-1];if(Pe(p)&&"g"in p){a=0,c|=128,delete p.g;var d,f=!0;for(d in p){f=!1;break}f&&e.pop()}}}else if(128&c)throw Error();u!==c&&De(e,c)}if(this.G=(s?0:-1)-a,this.h=void 0,this.o=e,a=(s=this.o.length)-1,s&&Pe(s=this.o[a])?(this.B=s,this.i=a-this.G):void 0!==t&&-1<t?(this.i=Math.max(t,a+1-this.G),this.B=void 0):this.i=Number.MAX_VALUE,!o&&this.B&&"g"in this.B)throw Error('Unexpected "g" flag in sparse object of message that is not a group type.');if(n)for(t=l&&!i&&!0,o=this.i,l=0;l<n.length;l++)(i=n[l])<o?(a=e[i+=this.G])?ct(a,t):e[i]=Le:(r||(r=je(this)),(a=r[i])?ct(a,t):r[i]=Le)}function ct(e,t){if(Array.isArray(e)){var n=Oe(e),r=1;!t||2&n||(r|=16),(n&r)!==r&&De(e,n|r)}}function pt(e,t,n){if(n){var r,a={};for(r in n){var o=n[r],s=o.ra;s||(a.J=o.xa||o.oa.W,o.ia?(a.aa=vt(o.ia),s=function(e){return function(t,n,r){return e.J(t,n,r,e.aa)}}(a)):o.ka?(a.Z=wt(o.da.P,o.ka),s=function(e){return function(t,n,r){return e.J(t,n,r,e.Z)}}(a)):s=a.J,o.ra=s),s(t,e,o.da),a={J:a.J,aa:a.aa,Z:a.Z}}}!function(e,t){if(t=t.R){_e(e,e.h.end());for(var n=0;n<t.length;n++)_e(e,de(t[n])||V())}}(t,e)}De(Be,23),Le=Object.freeze(Be),lt.prototype.toJSON=function(){return nt(this.o,rt,at)},lt.prototype.C=function(){return!!(2&Oe(this.o))},lt.prototype.ja=Fe,lt.prototype.toString=function(){return this.o.toString()};var dt=Symbol();function ft(e,t,n){return e[dt]||(e[dt]=function(e,r){return t(e,r,n)})}function ht(e){var t=e[dt];if(!t){var n=Dt(e);t=function(e,t){return Ct(e,t,n)},e[dt]=t}return t}function mt(e){var t=function(e){var t=e.ia;return t?ht(t):(t=e.wa)?ft(e.da.P,t,e.ka):void 0}(e),n=e.da,r=e.oa.U;return t?function(e,a){return r(e,a,n,t)}:function(e,t){return r(e,t,n)}}function gt(e,t){var n=e[t];return"function"==typeof n&&0===n.length&&(n=n(),e[t]=n),Array.isArray(n)&&(_t in n||xt in n||0<n.length&&"function"==typeof n[0])?n:void 0}function yt(e,t,n,r,a,o){t.P=e[0];var s=1;if(e.length>s&&"number"!=typeof e[s]){var i=e[s++];n(t,i)}for(;s<e.length;){n=e[s++];for(var u=s+1;u<e.length&&"number"!=typeof e[u];)u++;switch(i=e[s++],u-=s){case 0:r(t,n,i);break;case 1:(u=gt(e,s))?(s++,a(t,n,i,u)):r(t,n,i,e[s++]);break;case 2:a(t,n,i,u=gt(e,u=s++),e[s++]);break;case 3:o(t,n,i,e[s++],e[s++],e[s++]);break;case 4:o(t,n,i,e[s++],e[s++],e[s++],e[s++]);break;default:throw Error("unexpected number of binary field arguments: "+u)}}return t}var bt=Symbol();function vt(e){var t=e[bt];if(!t){var n=Tt(e);t=function(e,t){return $t(e,t,n)},e[bt]=t}return t}function wt(e,t){var n=e[bt];return n||(n=function(e,n){return pt(e,n,t)},e[bt]=n),n}var xt=Symbol();function kt(e,t){e.push(t)}function St(e,t,n){e.push(t,n.W)}function Et(e,t,n,r){var a=vt(r),o=Tt(r).P,s=n.W;e.push(t,(function(e,t,n){return s(e,t,n,o,a)}))}function Nt(e,t,n,r,a,o){var s=wt(r,o),i=n.W;e.push(t,(function(e,t,n){return i(e,t,n,r,s)}))}function Tt(e){var t=e[xt];return t||(t=yt(e,e[xt]=[],kt,St,Et,Nt),_t in e&&xt in e&&(e.length=0),t)}var _t=Symbol();function At(e,t){e[0]=t}function It(e,t,n,r){var a=n.U;e[t]=r?function(e,t,n){return a(e,t,n,r)}:a}function Mt(e,t,n,r,a){var o=n.U,s=ht(r),i=Dt(r).P;e[t]=function(e,t,n){return o(e,t,n,i,s,a)}}function Ot(e,t,n,r,a,o,s){var i=n.U,u=ft(r,a,o);e[t]=function(e,t,n){return i(e,t,n,r,u,s)}}function Dt(e){var t=e[_t];return t||(t=yt(e,e[_t]={},At,It,Mt,Ot),_t in e&&xt in e&&(e.length=0),t)}function Ct(e,t,n){for(;Se(t)&&4!=t.i;){var r=t.l,a=n[r];if(!a){var o=n[0];o&&(o=o[r])&&(a=n[r]=mt(o))}if(!a||!a(t,e,r)){r=e,o=(a=t).j,Ee(a);var s=a;if(!s.ca){if(a=s.h.h-o,s.h.h=o,s=s.h,0==a)a=pe();else{if(o=ye(s,a),s.S&&s.m)a=s.i.subarray(o,o+a);else{s=s.i;var i=o;a=i===(a=o+a)?V():j?s.slice(i,a):new Uint8Array(s.subarray(i,a))}a=0==a.length?pe():new ce(a,U)}(o=r.R)?o.push(a):r.R=[a]}}}return e}function $t(e,t,n){for(var r=n.length,a=1==r%2,o=a?1:0;o<r;o+=2)(0,n[o+1])(t,e,n[o]);pt(e,t,a?n[0]:void 0)}function Rt(e,t){return{U:e,W:t}}var Ft=Rt((function(e,t,n){if(5!==e.i)return!1;var r=(e=e.h).i,a=e.h,o=r[a],s=r[a+1],i=r[a+2];return r=r[a+3],me(e,e.h+4),e=2*((s=(o<<0|s<<8|i<<16|r<<24)>>>0)>>31)+1,o=s>>>23&255,s&=8388607,He(t,n,255==o?s?NaN:1/0*e:0==o?e*Math.pow(2,-149)*s:e*Math.pow(2,o-150)*(s+Math.pow(2,23))),!0}),(function(e,t,n){if(null!=(t=Ke(t,n))){xe(e.h,8*n+5),e=e.h;var r=+t;0===r?0<1/r?W=H=0:(H=0,W=2147483648):isNaN(r)?(H=0,W=2147483647):34028234663852886e22<(r=(n=0>r?-2147483648:0)?-r:r)?(H=0,W=(2139095040|n)>>>0):11754943508222875e-54>r?(r=Math.round(r/Math.pow(2,-149)),H=0,W=(n|r)>>>0):(t=Math.floor(Math.log(r)/Math.LN2),r*=Math.pow(2,-t),16777216<=(r=Math.round(8388608*r))&&++t,H=0,W=(n|t+127<<23|8388607&r)>>>0),n=W,e.h.push(n>>>0&255),e.h.push(n>>>8&255),e.h.push(n>>>16&255),e.h.push(n>>>24&255)}})),Pt=Rt((function(e,t,n){if(0!==e.i)return!1;var r=e.h,a=0,o=e=0,s=r.i,i=r.h;do{var u=s[i++];a|=(127&u)<<o,o+=7}while(32>o&&128&u);for(32<o&&(e|=(127&u)>>4),o=3;32>o&&128&u;o+=7)e|=(127&(u=s[i++]))<<o;if(me(r,i),!(128>u))throw J();return r=a>>>0,(e=2147483648&(u=e>>>0))&&(u=~u>>>0,0==(r=1+~r>>>0)&&(u=u+1>>>0)),r=4294967296*u+(r>>>0),He(t,n,e?-r:r),!0}),(function(e,t,n){null!=(t=We(t,n))&&("string"==typeof t&&X(t),null!=t&&(xe(e.h,8*n),"number"==typeof t?(e=e.h,q(t),we(e,W,H)):(n=X(t),we(e.h,n.i,n.h))))})),Lt=Rt((function(e,t,n){return 0===e.i&&(He(t,n,ge(e.h)),!0)}),(function(e,t,n){if(null!=(t=We(t,n))&&null!=t)if(xe(e.h,8*n),e=e.h,0<=(n=t))xe(e,n);else{for(t=0;9>t;t++)e.h.push(127&n|128),n>>=7;e.h.push(1)}})),zt=Rt((function(e,t,n){if(2!==e.i)return!1;var r=ge(e.h)>>>0,a=ye(e=e.h,r);if(e=e.i,ie){var o,s=e;(o=re)||(o=re=new TextDecoder("utf-8",{fatal:!0})),e=a+r,s=0===a&&e===s.length?s:s.subarray(a,e);try{var i=o.decode(s)}catch(e){if(void 0===se){try{o.decode(new Uint8Array([128]))}catch(e){}try{o.decode(new Uint8Array([97])),se=!0}catch(e){se=!1}}throw!se&&(re=void 0),e}}else{r=(i=a)+r,a=[];for(var u,l,c=null;i<r;)128>(u=e[i++])?a.push(u):224>u?i>=r?te():(l=e[i++],194>u||128!=(192&l)?(i--,te()):a.push((31&u)<<6|63&l)):240>u?i>=r-1?te():128!=(192&(l=e[i++]))||224===u&&160>l||237===u&&160<=l||128!=(192&(s=e[i++]))?(i--,te()):a.push((15&u)<<12|(63&l)<<6|63&s):244>=u?i>=r-2?te():128!=(192&(l=e[i++]))||0!=l-144+(u<<28)>>30||128!=(192&(s=e[i++]))||128!=(192&(o=e[i++]))?(i--,te()):(u=(7&u)<<18|(63&l)<<12|(63&s)<<6|63&o,u-=65536,a.push(55296+(u>>10&1023),56320+(1023&u))):te(),8192<=a.length&&(c=ne(c,a),a.length=0);i=ne(c,a)}return He(t,n,i),!0}),(function(e,t,n){if(null!=(t=We(t,n))){var r=!1;if(r=void 0!==r&&r,ue){if(r&&/(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(t))throw Error("Found an unpaired surrogate");t=(ae||(ae=new TextEncoder)).encode(t)}else{for(var a=0,o=new Uint8Array(3*t.length),s=0;s<t.length;s++){var i=t.charCodeAt(s);if(128>i)o[a++]=i;else{if(2048>i)o[a++]=i>>6|192;else{if(55296<=i&&57343>=i){if(56319>=i&&s<t.length){var u=t.charCodeAt(++s);if(56320<=u&&57343>=u){i=1024*(i-55296)+u-56320+65536,o[a++]=i>>18|240,o[a++]=i>>12&63|128,o[a++]=i>>6&63|128,o[a++]=63&i|128;continue}s--}if(r)throw Error("Found an unpaired surrogate");i=65533}o[a++]=i>>12|224,o[a++]=i>>6&63|128}o[a++]=63&i|128}}t=a===o.length?o:o.subarray(0,a)}xe(e.h,8*n+2),xe(e.h,t.length),_e(e,e.h.end()),_e(e,t)}})),Bt=Rt((function(e,t,n,r,a){if(2!==e.i)return!1;t=Ze(t,n,r),n=e.h.j,r=ge(e.h)>>>0;var o=e.h.h+r,s=o-n;if(0>=s&&(e.h.j=o,a(t,e,void 0,void 0,void 0),s=o-e.h.h),s)throw Error("Message parsing ended unexpectedly. Expected to read "+r+" bytes, instead read "+(r-s)+" bytes, either the data ended unexpectedly or the message misreported its own length");return e.h.h=o,e.h.j=n,!0}),(function(e,t,n,r,a){if(null!=(t=Ye(t,r,n)))for(r=0;r<t.length;r++){var o=e;xe(o.h,8*n+2);var s=o.h.end();_e(o,s),s.push(o.i),o=s,a(t[r],e),s=e;var i=o.pop();for(i=s.i+s.h.length()-i;127<i;)o.push(127&i|128),i>>>=7,s.i++;o.push(i),s.i++}}));function Vt(e){return function(t,n){e:{if(Ne.length){var r=Ne.pop();r.setOptions(n),he(r.h,t,n),t=r}else t=new ke(t,n);try{var a=Dt(e),o=Ct(new a.P,t,a);break e}finally{(a=t.h).i=null,a.m=!1,a.l=0,a.j=0,a.h=0,a.S=!1,t.l=-1,t.i=-1,100>Ne.length&&Ne.push(t)}o=void 0}return o}}function Ut(e){return function(){var t=new Te;$t(this,t,Tt(e)),_e(t,t.h.end());for(var n=new Uint8Array(t.i),r=t.j,a=r.length,o=0,s=0;s<a;s++){var i=r[s];n.set(i,o),o+=i.length}return t.j=[n],n}}function jt(e){lt.call(this,e)}m(jt,lt);var Wt=[jt,1,Lt,2,Ft,3,zt,4,zt];function Ht(e){lt.call(this,e,-1,qt)}jt.prototype.l=Ut(Wt),m(Ht,lt),Ht.prototype.addClassification=function(e,t){return Ze(this,1,jt,e,t),this};var qt=[1],Gt=Vt([Ht,1,Bt,Wt]);function Kt(e){lt.call(this,e)}m(Kt,lt);var Qt=[Kt,1,Ft,2,Ft,3,Ft,4,Ft,5,Ft];function Yt(e){lt.call(this,e,-1,Xt)}Kt.prototype.l=Ut(Qt),m(Yt,lt);var Xt=[1],Zt=Vt([Yt,1,Bt,Qt]);function Jt(e){lt.call(this,e)}m(Jt,lt);var en=[Jt,1,Ft,2,Ft,3,Ft,4,Ft,5,Ft,6,Pt],tn=Vt(en);function nn(e,t,n){if(n=e.createShader(0===n?e.VERTEX_SHADER:e.FRAGMENT_SHADER),e.shaderSource(n,t),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS))throw Error("Could not compile WebGL shader.\n\n"+e.getShaderInfoLog(n));return n}function rn(e){return Ye(e,jt,1).map((function(e){var t=We(e,1);return{index:null==t?0:t,qa:et(e,2),label:null!=We(e,3)?Je(We(e,3),""):void 0,displayName:null!=We(e,4)?Je(We(e,4),""):void 0}}))}function an(e){return{x:et(e,1),y:et(e,2),z:et(e,3),visibility:null!=Ke(e,4)?et(e,4):void 0}}function on(e,t){this.i=e,this.h=t,this.m=0}function sn(e,t,n){return function(e,t){var n=e.h;if(void 0===e.s){var r=nn(n,"\n  attribute vec2 aVertex;\n  attribute vec2 aTex;\n  varying vec2 vTex;\n  void main(void) {\n    gl_Position = vec4(aVertex, 0.0, 1.0);\n    vTex = aTex;\n  }",0),a=nn(n,"\n  precision mediump float;\n  varying vec2 vTex;\n  uniform sampler2D sampler0;\n  void main(){\n    gl_FragColor = texture2D(sampler0, vTex);\n  }",1),o=n.createProgram();if(n.attachShader(o,r),n.attachShader(o,a),n.linkProgram(o),!n.getProgramParameter(o,n.LINK_STATUS))throw Error("Could not compile WebGL program.\n\n"+n.getProgramInfoLog(o));r=e.s=o,n.useProgram(r),a=n.getUniformLocation(r,"sampler0"),e.l={O:n.getAttribLocation(r,"aVertex"),N:n.getAttribLocation(r,"aTex"),ya:a},e.v=n.createBuffer(),n.bindBuffer(n.ARRAY_BUFFER,e.v),n.enableVertexAttribArray(e.l.O),n.vertexAttribPointer(e.l.O,2,n.FLOAT,!1,0,0),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),n.STATIC_DRAW),n.bindBuffer(n.ARRAY_BUFFER,null),e.u=n.createBuffer(),n.bindBuffer(n.ARRAY_BUFFER,e.u),n.enableVertexAttribArray(e.l.N),n.vertexAttribPointer(e.l.N,2,n.FLOAT,!1,0,0),n.bufferData(n.ARRAY_BUFFER,new Float32Array([0,1,0,0,1,0,1,1]),n.STATIC_DRAW),n.bindBuffer(n.ARRAY_BUFFER,null),n.uniform1i(a,0)}r=e.l,n.useProgram(e.s),n.canvas.width=t.width,n.canvas.height=t.height,n.viewport(0,0,t.width,t.height),n.activeTexture(n.TEXTURE0),e.i.bindTexture2d(t.glName),n.enableVertexAttribArray(r.O),n.bindBuffer(n.ARRAY_BUFFER,e.v),n.vertexAttribPointer(r.O,2,n.FLOAT,!1,0,0),n.enableVertexAttribArray(r.N),n.bindBuffer(n.ARRAY_BUFFER,e.u),n.vertexAttribPointer(r.N,2,n.FLOAT,!1,0,0),n.bindFramebuffer(n.DRAW_FRAMEBUFFER?n.DRAW_FRAMEBUFFER:n.FRAMEBUFFER,null),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.colorMask(!0,!0,!0,!0),n.drawArrays(n.TRIANGLE_FAN,0,4),n.disableVertexAttribArray(r.O),n.disableVertexAttribArray(r.N),n.bindBuffer(n.ARRAY_BUFFER,null),e.i.bindTexture2d(0)}(e,t),"function"==typeof e.h.canvas.transferToImageBitmap?Promise.resolve(e.h.canvas.transferToImageBitmap()):n?Promise.resolve(e.h.canvas):"function"==typeof createImageBitmap?createImageBitmap(e.h.canvas):(void 0===e.j&&(e.j=document.createElement("canvas")),new Promise((function(t){e.j.height=e.h.canvas.height,e.j.width=e.h.canvas.width,e.j.getContext("2d",{}).drawImage(e.h.canvas,0,0,e.h.canvas.width,e.h.canvas.height),t(e.j)})))}function un(e){this.h=e}Jt.prototype.l=Ut(en);var ln=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,65,0,253,15,26,11]);function cn(e,t){return t+e}function pn(e,t){window[e]=t}function dn(e){if(this.h=e,this.listeners={},this.l={},this.L={},this.s={},this.v={},this.M=this.u=this.ga=!0,this.I=Promise.resolve(),this.fa="",this.D={},this.locateFile=e&&e.locateFile||cn,"object"==typeof window)var t=window.location.pathname.toString().substring(0,window.location.pathname.toString().lastIndexOf("/"))+"/";else{if("undefined"==typeof location)throw Error("solutions can only be loaded on a web page or in a web worker");t=location.pathname.toString().substring(0,location.pathname.toString().lastIndexOf("/"))+"/"}if(this.ha=t,e.options)for(var n=(t=i(Object.keys(e.options))).next();!n.done;n=t.next()){n=n.value;var r=e.options[n].default;void 0!==r&&(this.l[n]="function"==typeof r?r():r)}}function fn(e){var t,n,r,a,o,s,i,l,c,p,d;return E((function(f){switch(f.h){case 1:return e.ga?(t=void 0===e.h.files?[]:"function"==typeof e.h.files?e.h.files(e.l):e.h.files,v(f,E((function(e){switch(e.h){case 1:return e.s=2,v(e,WebAssembly.instantiate(ln),4);case 4:e.h=3,e.s=0;break;case 2:return e.s=0,e.l=null,e.return(!1);case 3:return e.return(!0)}})),2)):f.return();case 2:if(n=f.i,"object"==typeof window)return pn("createMediapipeSolutionsWasm",{locateFile:e.locateFile}),pn("createMediapipeSolutionsPackedAssets",{locateFile:e.locateFile}),s=t.filter((function(e){return void 0!==e.data})),i=t.filter((function(e){return void 0===e.data})),l=Promise.all(s.map((function(t){var n=hn(e,t.url);if(void 0!==t.path){var r=t.path;n=n.then((function(t){return e.overrideFile(r,t),Promise.resolve(t)}))}return n}))),c=Promise.all(i.map((function(t){return void 0===t.simd||t.simd&&n||!t.simd&&!n?function(e){var t=document.createElement("script");return t.setAttribute("src",e),t.setAttribute("crossorigin","anonymous"),new Promise((function(e){t.addEventListener("load",(function(){e()}),!1),t.addEventListener("error",(function(){e()}),!1),document.body.appendChild(t)}))}(e.locateFile(t.url,e.ha)):Promise.resolve()}))).then((function(){var t,n,r;return E((function(a){if(1==a.h)return t=window.createMediapipeSolutionsWasm,n=window.createMediapipeSolutionsPackedAssets,r=e,v(a,t(n),2);r.i=a.i,a.h=0}))})),p=E((function(t){return e.h.graph&&e.h.graph.url?t=v(t,hn(e,e.h.graph.url),0):(t.h=0,t=void 0),t})),v(f,Promise.all([c,l,p]),7);if("function"!=typeof importScripts)throw Error("solutions can only be loaded on a web page or in a web worker");return r=t.filter((function(e){return void 0===e.simd||e.simd&&n||!e.simd&&!n})).map((function(t){return e.locateFile(t.url,e.ha)})),importScripts.apply(null,u(r)),a=e,v(f,createMediapipeSolutionsWasm(Module),6);case 6:a.i=f.i,e.m=new OffscreenCanvas(1,1),e.i.canvas=e.m,o=e.i.GL.createContext(e.m,{antialias:!1,alpha:!1,va:"undefined"!=typeof WebGL2RenderingContext?2:1}),e.i.GL.makeContextCurrent(o),f.h=4;break;case 7:if(e.m=document.createElement("canvas"),!(d=e.m.getContext("webgl2",{}))&&!(d=e.m.getContext("webgl",{})))return alert("Failed to create WebGL canvas context when passing video frame."),f.return();e.K=d,e.i.canvas=e.m,e.i.createContext(e.m,!0,!0,{});case 4:e.j=new e.i.SolutionWasm,e.ga=!1,f.h=0}}))}function hn(e,t){var n,r;return E((function(a){return t in e.L?a.return(e.L[t]):(n=e.locateFile(t,""),r=fetch(n).then((function(e){return e.arrayBuffer()})),e.L[t]=r,a.return(r))}))}function mn(e,t,n){var r,a,o,s,u,l,c,p,d,f,h,m,g,y;return E((function(b){switch(b.h){case 1:if(!n)return b.return(t);for(r={},a=0,o=i(Object.keys(n)),s=o.next();!s.done;s=o.next())u=s.value,"string"!=typeof(l=n[u])&&"texture"===l.type&&void 0!==t[l.stream]&&++a;1<a&&(e.M=!1),c=i(Object.keys(n)),s=c.next();case 2:if(s.done){b.h=4;break}if(p=s.value,"string"==typeof(d=n[p]))return g=r,y=p,v(b,function(e,t,n){var r;return E((function(a){return"number"==typeof n||n instanceof Uint8Array||n instanceof e.i.Uint8BlobList?a.return(n):n instanceof e.i.Texture2dDataOut?((r=e.v[t])||(r=new on(e.i,e.K),e.v[t]=r),a.return(sn(r,n,e.M))):a.return(void 0)}))}(e,p,t[d]),14);if(f=t[d.stream],"detection_list"===d.type){if(f){for(var w=f.getRectList(),x=f.getLandmarksList(),k=f.getClassificationsList(),S=[],N=0;N<w.size();++N){var T=tn(w.get(N)),_=void 0;_=void 0===_?0:_,T={la:{sa:et(T,1),ta:et(T,2),height:et(T,3),width:et(T,4),rotation:et(T,5,0),pa:Je(We(T,6),_)},ea:Ye(Zt(x.get(N)),Kt,1).map(an),ba:rn(Gt(k.get(N)))},S.push(T)}w=S}else w=[];r[p]=w,b.h=7;break}if("proto_list"===d.type){if(f){for(w=Array(f.size()),x=0;x<f.size();x++)w[x]=f.get(x);f.delete()}else w=[];r[p]=w,b.h=7;break}if(void 0===f){b.h=3;break}if("float_list"===d.type){r[p]=f,b.h=7;break}if("proto"===d.type){r[p]=f,b.h=7;break}if("texture"!==d.type)throw Error("Unknown output config type: '"+d.type+"'");return(h=e.v[p])||(h=new on(e.i,e.K),e.v[p]=h),v(b,sn(h,f,e.M),13);case 13:m=b.i,r[p]=m;case 7:d.transform&&r[p]&&(r[p]=d.transform(r[p])),b.h=3;break;case 14:g[y]=b.i;case 3:s=c.next(),b.h=2;break;case 4:return b.return(r)}}))}function gn(e,t){for(var n=t.name||"$",r=[].concat(u(t.wants)),a=new e.i.StringList,o=i(t.wants),s=o.next();!s.done;s=o.next())a.push_back(s.value);o=e.i.PacketListener.implement({onResults:function(a){for(var o={},s=0;s<t.wants.length;++s)o[r[s]]=a.get(s);var i=e.listeners[n];i&&(e.I=mn(e,o,t.outs).then((function(n){n=i(n);for(var a=0;a<t.wants.length;++a){var s=o[r[a]];"object"==typeof s&&s.hasOwnProperty&&s.hasOwnProperty("delete")&&s.delete()}n&&(e.I=n)})))}}),e.j.attachMultiListener(a,o),a.delete()}function yn(e){return void 0===e&&(e=0),1===e?"selfie_segmentation_landscape.tflite":"selfie_segmentation.tflite"}function bn(e){var t=this;e=e||{},this.h=new dn({locateFile:e.locateFile,files:function(e){return[{simd:!0,url:"selfie_segmentation_solution_simd_wasm_bin.js"},{simd:!1,url:"selfie_segmentation_solution_wasm_bin.js"},{data:!0,url:yn(e.modelSelection)}]},graph:{url:"selfie_segmentation.binarypb"},listeners:[{wants:["segmentation_mask","image_transformed"],outs:{image:{type:"texture",stream:"image_transformed"},segmentationMask:{type:"texture",stream:"segmentation_mask"}}}],inputs:{image:{type:"video",stream:"input_frames_gpu"}},options:{useCpuInference:{type:0,graphOptionXref:{calculatorType:"InferenceCalculator",fieldName:"use_cpu_inference"},default:"object"==typeof window&&void 0!==window.navigator&&("iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";").includes(navigator.platform)||navigator.userAgent.includes("Mac")&&"ontouchend"in document)},selfieMode:{type:0,graphOptionXref:{calculatorType:"GlScalerCalculator",calculatorIndex:1,fieldName:"flip_horizontal"}},modelSelection:{type:1,graphOptionXref:{calculatorType:"ConstantSidePacketCalculator",calculatorName:"ConstantSidePacketCalculatorModelSelection",fieldName:"int_value"},onChange:function(e){var n,r,a;return E((function(o){return 1==o.h?(n=yn(e),r="third_party/mediapipe/modules/selfie_segmentation/"+n,v(o,hn(t.h,n),2)):(a=o.i,t.h.overrideFile(r,a),o.return(!0))}))}}}})}(e=dn.prototype).close=function(){return this.j&&this.j.delete(),Promise.resolve()},e.reset=function(){var e=this;return E((function(t){e.j&&(e.j.reset(),e.s={},e.v={}),t.h=0}))},e.setOptions=function(e,t){var n=this;if(t=t||this.h.options){for(var r=[],a=[],o={},s=i(Object.keys(e)),u=s.next();!u.done;o={X:o.X,Y:o.Y},u=s.next())if(!((u=u.value)in this.l)||this.l[u]!==e[u]){this.l[u]=e[u];var l=t[u];void 0!==l&&(l.onChange&&(o.X=l.onChange,o.Y=e[u],r.push(function(e){return function(){return E((function(t){if(1==t.h)return v(t,e.X(e.Y),2);!0===t.i&&(n.u=!0),t.h=0}))}}(o))),l.graphOptionXref&&(u=Object.assign({},{calculatorName:"",calculatorIndex:0},l.graphOptionXref,{valueNumber:1===l.type?e[u]:0,valueBoolean:0===l.type&&e[u],valueString:2===l.type?e[u]:""}),a.push(u)))}0===r.length&&0===a.length||(this.u=!0,this.H=(void 0===this.H?[]:this.H).concat(a),this.F=(void 0===this.F?[]:this.F).concat(r))}},e.initialize=function(){var e=this;return E((function(t){return 1==t.h?v(t,fn(e),2):3!=t.h?v(t,function(e){var t,n,r,a,o,s,u,l;return E((function(c){if(1==c.h)return e.h.graph&&e.h.graph.url&&e.fa===e.h.graph.url?c.return():(e.u=!0,e.h.graph&&e.h.graph.url?(e.fa=e.h.graph.url,v(c,hn(e,e.h.graph.url),3)):void(c.h=2));for(2!=c.h&&(t=c.i,e.j.loadGraph(t)),n=i(Object.keys(e.D)),r=n.next();!r.done;r=n.next())a=r.value,e.j.overrideFile(a,e.D[a]);if(e.D={},e.h.listeners)for(o=i(e.h.listeners),s=o.next();!s.done;s=o.next())u=s.value,gn(e,u);l=e.l,e.l={},e.setOptions(l),c.h=0}))}(e),3):v(t,function(e){var t,n,r,a,o,s;return E((function(u){switch(u.h){case 1:if(!e.u)return u.return();if(!e.F){u.h=2;break}t=i(e.F),n=t.next();case 3:if(n.done){u.h=5;break}return v(u,(0,n.value)(),4);case 4:n=t.next(),u.h=3;break;case 5:e.F=void 0;case 2:if(e.H){for(r=new e.i.GraphOptionChangeRequestList,a=i(e.H),o=a.next();!o.done;o=a.next())s=o.value,r.push_back(s);e.j.changeOptions(r),r.delete(),e.H=void 0}e.u=!1,u.h=0}}))}(e),0)}))},e.overrideFile=function(e,t){this.j?this.j.overrideFile(e,t):this.D[e]=t},e.clearOverriddenFiles=function(){this.D={},this.j&&this.j.clearOverriddenFiles()},e.send=function(e,t){var n,r,a,o,s,u,l,c,p,d=this;return E((function(f){switch(f.h){case 1:return d.h.inputs?(n=1e3*(null==t?performance.now():t),v(f,d.I,2)):f.return();case 2:return v(f,d.initialize(),3);case 3:for(r=new d.i.PacketDataList,a=i(Object.keys(e)),o=a.next();!o.done;o=a.next())if(s=o.value,u=d.h.inputs[s]){e:{var h=e[s];switch(u.type){case"video":var m=d.s[u.stream];if(m||(m=new on(d.i,d.K),d.s[u.stream]=m),0===m.m&&(m.m=m.i.createTexture()),"undefined"!=typeof HTMLVideoElement&&h instanceof HTMLVideoElement)var g=h.videoWidth,y=h.videoHeight;else"undefined"!=typeof HTMLImageElement&&h instanceof HTMLImageElement?(g=h.naturalWidth,y=h.naturalHeight):(g=h.width,y=h.height);y={glName:m.m,width:g,height:y},(g=m.h).canvas.width=y.width,g.canvas.height=y.height,g.activeTexture(g.TEXTURE0),m.i.bindTexture2d(m.m),g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,h),m.i.bindTexture2d(0),m=y;break e;case"detections":for((m=d.s[u.stream])||(m=new un(d.i),d.s[u.stream]=m),m.data||(m.data=new m.h.DetectionListData),m.data.reset(h.length),y=0;y<h.length;++y){g=h[y];var b=m.data,w=b.setBoundingBox,x=y,k=g.la,S=new Jt;if(Xe(S,1,k.sa),Xe(S,2,k.ta),Xe(S,3,k.height),Xe(S,4,k.width),Xe(S,5,k.rotation),He(S,6,k.pa),k=S.l(),w.call(b,x,k),g.ea)for(b=0;b<g.ea.length;++b){S=g.ea[b],x=(w=m.data).addNormalizedLandmark,k=y,S=Object.assign({},S,{visibility:S.visibility?S.visibility:0});var E=new Kt;Xe(E,1,S.x),Xe(E,2,S.y),Xe(E,3,S.z),S.visibility&&Xe(E,4,S.visibility),S=E.l(),x.call(w,k,S)}if(g.ba)for(b=0;b<g.ba.length;++b)x=(w=m.data).addClassification,k=y,S=g.ba[b],Xe(E=new jt,2,S.qa),S.index&&He(E,1,S.index),S.label&&He(E,3,S.label),S.displayName&&He(E,4,S.displayName),S=E.l(),x.call(w,k,S)}m=m.data;break e;default:m={}}}switch(l=m,c=u.stream,u.type){case"video":r.pushTexture2d(Object.assign({},l,{stream:c,timestamp:n}));break;case"detections":(p=l).stream=c,p.timestamp=n,r.pushDetectionList(p);break;default:throw Error("Unknown input config type: '"+u.type+"'")}}return d.j.send(r),v(f,d.I,4);case 4:r.delete(),f.h=0}}))},e.onResults=function(e,t){this.listeners[t||"$"]=e},_("Solution",dn),_("OptionType",{BOOL:0,NUMBER:1,ua:2,0:"BOOL",1:"NUMBER",2:"STRING"}),(e=bn.prototype).close=function(){return this.h.close(),Promise.resolve()},e.onResults=function(e){this.h.onResults(e)},e.initialize=function(){var e=this;return E((function(t){return v(t,e.h.initialize(),0)}))},e.reset=function(){this.h.reset()},e.send=function(e){var t=this;return E((function(n){return v(n,t.h.send(e),0)}))},e.setOptions=function(e){this.h.setOptions(e)},_("SelfieSegmentation",bn),_("VERSION","0.1.1675465747")}).call(this)},3720:e=>{e.exports=n;var t=null;try{t=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch(e){}function n(e,t,n){this.low=0|e,this.high=0|t,this.unsigned=!!n}function r(e){return!0===(e&&e.__isLong__)}n.prototype.__isLong__,Object.defineProperty(n.prototype,"__isLong__",{value:!0}),n.isLong=r;var a={},o={};function s(e,t){var n,r,s;return t?(s=0<=(e>>>=0)&&e<256)&&(r=o[e])?r:(n=u(e,(0|e)<0?-1:0,!0),s&&(o[e]=n),n):(s=-128<=(e|=0)&&e<128)&&(r=a[e])?r:(n=u(e,e<0?-1:0,!1),s&&(a[e]=n),n)}function i(e,t){if(isNaN(e))return t?y:g;if(t){if(e<0)return y;if(e>=f)return k}else{if(e<=-h)return S;if(e+1>=h)return x}return e<0?i(-e,t).neg():u(e%d|0,e/d|0,t)}function u(e,t,r){return new n(e,t,r)}n.fromInt=s,n.fromNumber=i,n.fromBits=u;var l=Math.pow;function c(e,t,n){if(0===e.length)throw Error("empty string");if("NaN"===e||"Infinity"===e||"+Infinity"===e||"-Infinity"===e)return g;if("number"==typeof t?(n=t,t=!1):t=!!t,(n=n||10)<2||36<n)throw RangeError("radix");var r;if((r=e.indexOf("-"))>0)throw Error("interior hyphen");if(0===r)return c(e.substring(1),t,n).neg();for(var a=i(l(n,8)),o=g,s=0;s<e.length;s+=8){var u=Math.min(8,e.length-s),p=parseInt(e.substring(s,s+u),n);if(u<8){var d=i(l(n,u));o=o.mul(d).add(i(p))}else o=(o=o.mul(a)).add(i(p))}return o.unsigned=t,o}function p(e,t){return"number"==typeof e?i(e,t):"string"==typeof e?c(e,t):u(e.low,e.high,"boolean"==typeof t?t:e.unsigned)}n.fromString=c,n.fromValue=p;var d=4294967296,f=d*d,h=f/2,m=s(1<<24),g=s(0);n.ZERO=g;var y=s(0,!0);n.UZERO=y;var b=s(1);n.ONE=b;var v=s(1,!0);n.UONE=v;var w=s(-1);n.NEG_ONE=w;var x=u(-1,2147483647,!1);n.MAX_VALUE=x;var k=u(-1,-1,!0);n.MAX_UNSIGNED_VALUE=k;var S=u(0,-2147483648,!1);n.MIN_VALUE=S;var E=n.prototype;E.toInt=function(){return this.unsigned?this.low>>>0:this.low},E.toNumber=function(){return this.unsigned?(this.high>>>0)*d+(this.low>>>0):this.high*d+(this.low>>>0)},E.toString=function(e){if((e=e||10)<2||36<e)throw RangeError("radix");if(this.isZero())return"0";if(this.isNegative()){if(this.eq(S)){var t=i(e),n=this.div(t),r=n.mul(t).sub(this);return n.toString(e)+r.toInt().toString(e)}return"-"+this.neg().toString(e)}for(var a=i(l(e,6),this.unsigned),o=this,s="";;){var u=o.div(a),c=(o.sub(u.mul(a)).toInt()>>>0).toString(e);if((o=u).isZero())return c+s;for(;c.length<6;)c="0"+c;s=""+c+s}},E.getHighBits=function(){return this.high},E.getHighBitsUnsigned=function(){return this.high>>>0},E.getLowBits=function(){return this.low},E.getLowBitsUnsigned=function(){return this.low>>>0},E.getNumBitsAbs=function(){if(this.isNegative())return this.eq(S)?64:this.neg().getNumBitsAbs();for(var e=0!=this.high?this.high:this.low,t=31;t>0&&0==(e&1<<t);t--);return 0!=this.high?t+33:t+1},E.isZero=function(){return 0===this.high&&0===this.low},E.eqz=E.isZero,E.isNegative=function(){return!this.unsigned&&this.high<0},E.isPositive=function(){return this.unsigned||this.high>=0},E.isOdd=function(){return 1==(1&this.low)},E.isEven=function(){return 0==(1&this.low)},E.equals=function(e){return r(e)||(e=p(e)),(this.unsigned===e.unsigned||this.high>>>31!=1||e.high>>>31!=1)&&(this.high===e.high&&this.low===e.low)},E.eq=E.equals,E.notEquals=function(e){return!this.eq(e)},E.neq=E.notEquals,E.ne=E.notEquals,E.lessThan=function(e){return this.comp(e)<0},E.lt=E.lessThan,E.lessThanOrEqual=function(e){return this.comp(e)<=0},E.lte=E.lessThanOrEqual,E.le=E.lessThanOrEqual,E.greaterThan=function(e){return this.comp(e)>0},E.gt=E.greaterThan,E.greaterThanOrEqual=function(e){return this.comp(e)>=0},E.gte=E.greaterThanOrEqual,E.ge=E.greaterThanOrEqual,E.compare=function(e){if(r(e)||(e=p(e)),this.eq(e))return 0;var t=this.isNegative(),n=e.isNegative();return t&&!n?-1:!t&&n?1:this.unsigned?e.high>>>0>this.high>>>0||e.high===this.high&&e.low>>>0>this.low>>>0?-1:1:this.sub(e).isNegative()?-1:1},E.comp=E.compare,E.negate=function(){return!this.unsigned&&this.eq(S)?S:this.not().add(b)},E.neg=E.negate,E.add=function(e){r(e)||(e=p(e));var t=this.high>>>16,n=65535&this.high,a=this.low>>>16,o=65535&this.low,s=e.high>>>16,i=65535&e.high,l=e.low>>>16,c=0,d=0,f=0,h=0;return f+=(h+=o+(65535&e.low))>>>16,d+=(f+=a+l)>>>16,c+=(d+=n+i)>>>16,c+=t+s,u((f&=65535)<<16|(h&=65535),(c&=65535)<<16|(d&=65535),this.unsigned)},E.subtract=function(e){return r(e)||(e=p(e)),this.add(e.neg())},E.sub=E.subtract,E.multiply=function(e){if(this.isZero())return g;if(r(e)||(e=p(e)),t)return u(t.mul(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned);if(e.isZero())return g;if(this.eq(S))return e.isOdd()?S:g;if(e.eq(S))return this.isOdd()?S:g;if(this.isNegative())return e.isNegative()?this.neg().mul(e.neg()):this.neg().mul(e).neg();if(e.isNegative())return this.mul(e.neg()).neg();if(this.lt(m)&&e.lt(m))return i(this.toNumber()*e.toNumber(),this.unsigned);var n=this.high>>>16,a=65535&this.high,o=this.low>>>16,s=65535&this.low,l=e.high>>>16,c=65535&e.high,d=e.low>>>16,f=65535&e.low,h=0,y=0,b=0,v=0;return b+=(v+=s*f)>>>16,y+=(b+=o*f)>>>16,b&=65535,y+=(b+=s*d)>>>16,h+=(y+=a*f)>>>16,y&=65535,h+=(y+=o*d)>>>16,y&=65535,h+=(y+=s*c)>>>16,h+=n*f+a*d+o*c+s*l,u((b&=65535)<<16|(v&=65535),(h&=65535)<<16|(y&=65535),this.unsigned)},E.mul=E.multiply,E.divide=function(e){if(r(e)||(e=p(e)),e.isZero())throw Error("division by zero");var n,a,o;if(t)return this.unsigned||-2147483648!==this.high||-1!==e.low||-1!==e.high?u((this.unsigned?t.div_u:t.div_s)(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned):this;if(this.isZero())return this.unsigned?y:g;if(this.unsigned){if(e.unsigned||(e=e.toUnsigned()),e.gt(this))return y;if(e.gt(this.shru(1)))return v;o=y}else{if(this.eq(S))return e.eq(b)||e.eq(w)?S:e.eq(S)?b:(n=this.shr(1).div(e).shl(1)).eq(g)?e.isNegative()?b:w:(a=this.sub(e.mul(n)),o=n.add(a.div(e)));if(e.eq(S))return this.unsigned?y:g;if(this.isNegative())return e.isNegative()?this.neg().div(e.neg()):this.neg().div(e).neg();if(e.isNegative())return this.div(e.neg()).neg();o=g}for(a=this;a.gte(e);){n=Math.max(1,Math.floor(a.toNumber()/e.toNumber()));for(var s=Math.ceil(Math.log(n)/Math.LN2),c=s<=48?1:l(2,s-48),d=i(n),f=d.mul(e);f.isNegative()||f.gt(a);)f=(d=i(n-=c,this.unsigned)).mul(e);d.isZero()&&(d=b),o=o.add(d),a=a.sub(f)}return o},E.div=E.divide,E.modulo=function(e){return r(e)||(e=p(e)),t?u((this.unsigned?t.rem_u:t.rem_s)(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned):this.sub(this.div(e).mul(e))},E.mod=E.modulo,E.rem=E.modulo,E.not=function(){return u(~this.low,~this.high,this.unsigned)},E.and=function(e){return r(e)||(e=p(e)),u(this.low&e.low,this.high&e.high,this.unsigned)},E.or=function(e){return r(e)||(e=p(e)),u(this.low|e.low,this.high|e.high,this.unsigned)},E.xor=function(e){return r(e)||(e=p(e)),u(this.low^e.low,this.high^e.high,this.unsigned)},E.shiftLeft=function(e){return r(e)&&(e=e.toInt()),0==(e&=63)?this:e<32?u(this.low<<e,this.high<<e|this.low>>>32-e,this.unsigned):u(0,this.low<<e-32,this.unsigned)},E.shl=E.shiftLeft,E.shiftRight=function(e){return r(e)&&(e=e.toInt()),0==(e&=63)?this:e<32?u(this.low>>>e|this.high<<32-e,this.high>>e,this.unsigned):u(this.high>>e-32,this.high>=0?0:-1,this.unsigned)},E.shr=E.shiftRight,E.shiftRightUnsigned=function(e){if(r(e)&&(e=e.toInt()),0===(e&=63))return this;var t=this.high;return e<32?u(this.low>>>e|t<<32-e,t>>>e,this.unsigned):u(32===e?t:t>>>e-32,0,this.unsigned)},E.shru=E.shiftRightUnsigned,E.shr_u=E.shiftRightUnsigned,E.toSigned=function(){return this.unsigned?u(this.low,this.high,!1):this},E.toUnsigned=function(){return this.unsigned?this:u(this.low,this.high,!0)},E.toBytes=function(e){return e?this.toBytesLE():this.toBytesBE()},E.toBytesLE=function(){var e=this.high,t=this.low;return[255&t,t>>>8&255,t>>>16&255,t>>>24,255&e,e>>>8&255,e>>>16&255,e>>>24]},E.toBytesBE=function(){var e=this.high,t=this.low;return[e>>>24,e>>>16&255,e>>>8&255,255&e,t>>>24,t>>>16&255,t>>>8&255,255&t]},n.fromBytes=function(e,t,r){return r?n.fromBytesLE(e,t):n.fromBytesBE(e,t)},n.fromBytesLE=function(e,t){return new n(e[0]|e[1]<<8|e[2]<<16|e[3]<<24,e[4]|e[5]<<8|e[6]<<16|e[7]<<24,t)},n.fromBytesBE=function(e,t){return new n(e[4]<<24|e[5]<<16|e[6]<<8|e[7],e[0]<<24|e[1]<<16|e[2]<<8|e[3],t)}},7418:e=>{"use strict";
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/var t=Object.getOwnPropertySymbols,n=Object.prototype.hasOwnProperty,r=Object.prototype.propertyIsEnumerable;e.exports=function(){try{if(!Object.assign)return!1;var e=new String("abc");if(e[5]="de","5"===Object.getOwnPropertyNames(e)[0])return!1;for(var t={},n=0;n<10;n++)t["_"+String.fromCharCode(n)]=n;if("0123456789"!==Object.getOwnPropertyNames(t).map((function(e){return t[e]})).join(""))return!1;var r={};return"abcdefghijklmnopqrst".split("").forEach((function(e){r[e]=e})),"abcdefghijklmnopqrst"===Object.keys(Object.assign({},r)).join("")}catch(e){return!1}}()?Object.assign:function(e,a){for(var o,s,i=function(e){if(null==e)throw new TypeError("Object.assign cannot be called with null or undefined");return Object(e)}(e),u=1;u<arguments.length;u++){for(var l in o=Object(arguments[u]))n.call(o,l)&&(i[l]=o[l]);if(t){s=t(o);for(var c=0;c<s.length;c++)r.call(o,s[c])&&(i[s[c]]=o[s[c]])}}return i}},2408:(e,t,n)=>{"use strict";
/** @license React v17.0.2
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var r=n(7418),a=60103,o=60106;t.Fragment=60107,t.StrictMode=60108,t.Profiler=60114;var s=60109,i=60110,u=60112;t.Suspense=60113;var l=60115,c=60116;if("function"==typeof Symbol&&Symbol.for){var p=Symbol.for;a=p("react.element"),o=p("react.portal"),t.Fragment=p("react.fragment"),t.StrictMode=p("react.strict_mode"),t.Profiler=p("react.profiler"),s=p("react.provider"),i=p("react.context"),u=p("react.forward_ref"),t.Suspense=p("react.suspense"),l=p("react.memo"),c=p("react.lazy")}var d="function"==typeof Symbol&&Symbol.iterator;function f(e){for(var t="https://reactjs.org/docs/error-decoder.html?invariant="+e,n=1;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var h={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},m={};function g(e,t,n){this.props=e,this.context=t,this.refs=m,this.updater=n||h}function y(){}function b(e,t,n){this.props=e,this.context=t,this.refs=m,this.updater=n||h}g.prototype.isReactComponent={},g.prototype.setState=function(e,t){if("object"!=typeof e&&"function"!=typeof e&&null!=e)throw Error(f(85));this.updater.enqueueSetState(this,e,t,"setState")},g.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")},y.prototype=g.prototype;var v=b.prototype=new y;v.constructor=b,r(v,g.prototype),v.isPureReactComponent=!0;var w={current:null},x=Object.prototype.hasOwnProperty,k={key:!0,ref:!0,__self:!0,__source:!0};function S(e,t,n){var r,o={},s=null,i=null;if(null!=t)for(r in void 0!==t.ref&&(i=t.ref),void 0!==t.key&&(s=""+t.key),t)x.call(t,r)&&!k.hasOwnProperty(r)&&(o[r]=t[r]);var u=arguments.length-2;if(1===u)o.children=n;else if(1<u){for(var l=Array(u),c=0;c<u;c++)l[c]=arguments[c+2];o.children=l}if(e&&e.defaultProps)for(r in u=e.defaultProps)void 0===o[r]&&(o[r]=u[r]);return{$$typeof:a,type:e,key:s,ref:i,props:o,_owner:w.current}}function E(e){return"object"==typeof e&&null!==e&&e.$$typeof===a}var N=/\/+/g;function T(e,t){return"object"==typeof e&&null!==e&&null!=e.key?function(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,(function(e){return t[e]}))}(""+e.key):t.toString(36)}function _(e,t,n,r,s){var i=typeof e;"undefined"!==i&&"boolean"!==i||(e=null);var u=!1;if(null===e)u=!0;else switch(i){case"string":case"number":u=!0;break;case"object":switch(e.$$typeof){case a:case o:u=!0}}if(u)return s=s(u=e),e=""===r?"."+T(u,0):r,Array.isArray(s)?(n="",null!=e&&(n=e.replace(N,"$&/")+"/"),_(s,t,n,"",(function(e){return e}))):null!=s&&(E(s)&&(s=function(e,t){return{$$typeof:a,type:e.type,key:t,ref:e.ref,props:e.props,_owner:e._owner}}(s,n+(!s.key||u&&u.key===s.key?"":(""+s.key).replace(N,"$&/")+"/")+e)),t.push(s)),1;if(u=0,r=""===r?".":r+":",Array.isArray(e))for(var l=0;l<e.length;l++){var c=r+T(i=e[l],l);u+=_(i,t,n,c,s)}else if(c=function(e){return null===e||"object"!=typeof e?null:"function"==typeof(e=d&&e[d]||e["@@iterator"])?e:null}(e),"function"==typeof c)for(e=c.call(e),l=0;!(i=e.next()).done;)u+=_(i=i.value,t,n,c=r+T(i,l++),s);else if("object"===i)throw t=""+e,Error(f(31,"[object Object]"===t?"object with keys {"+Object.keys(e).join(", ")+"}":t));return u}function A(e,t,n){if(null==e)return e;var r=[],a=0;return _(e,r,"","",(function(e){return t.call(n,e,a++)})),r}function I(e){if(-1===e._status){var t=e._result;t=t(),e._status=0,e._result=t,t.then((function(t){0===e._status&&(t=t.default,e._status=1,e._result=t)}),(function(t){0===e._status&&(e._status=2,e._result=t)}))}if(1===e._status)return e._result;throw e._result}var M={current:null};function O(){var e=M.current;if(null===e)throw Error(f(321));return e}var D={ReactCurrentDispatcher:M,ReactCurrentBatchConfig:{transition:0},ReactCurrentOwner:w,IsSomeRendererActing:{current:!1},assign:r};t.Children={map:A,forEach:function(e,t,n){A(e,(function(){t.apply(this,arguments)}),n)},count:function(e){var t=0;return A(e,(function(){t++})),t},toArray:function(e){return A(e,(function(e){return e}))||[]},only:function(e){if(!E(e))throw Error(f(143));return e}},t.Component=g,t.PureComponent=b,t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=D,t.cloneElement=function(e,t,n){if(null==e)throw Error(f(267,e));var o=r({},e.props),s=e.key,i=e.ref,u=e._owner;if(null!=t){if(void 0!==t.ref&&(i=t.ref,u=w.current),void 0!==t.key&&(s=""+t.key),e.type&&e.type.defaultProps)var l=e.type.defaultProps;for(c in t)x.call(t,c)&&!k.hasOwnProperty(c)&&(o[c]=void 0===t[c]&&void 0!==l?l[c]:t[c])}var c=arguments.length-2;if(1===c)o.children=n;else if(1<c){l=Array(c);for(var p=0;p<c;p++)l[p]=arguments[p+2];o.children=l}return{$$typeof:a,type:e.type,key:s,ref:i,props:o,_owner:u}},t.createContext=function(e,t){return void 0===t&&(t=null),(e={$$typeof:i,_calculateChangedBits:t,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null}).Provider={$$typeof:s,_context:e},e.Consumer=e},t.createElement=S,t.createFactory=function(e){var t=S.bind(null,e);return t.type=e,t},t.createRef=function(){return{current:null}},t.forwardRef=function(e){return{$$typeof:u,render:e}},t.isValidElement=E,t.lazy=function(e){return{$$typeof:c,_payload:{_status:-1,_result:e},_init:I}},t.memo=function(e,t){return{$$typeof:l,type:e,compare:void 0===t?null:t}},t.useCallback=function(e,t){return O().useCallback(e,t)},t.useContext=function(e,t){return O().useContext(e,t)},t.useDebugValue=function(){},t.useEffect=function(e,t){return O().useEffect(e,t)},t.useImperativeHandle=function(e,t,n){return O().useImperativeHandle(e,t,n)},t.useLayoutEffect=function(e,t){return O().useLayoutEffect(e,t)},t.useMemo=function(e,t){return O().useMemo(e,t)},t.useReducer=function(e,t,n){return O().useReducer(e,t,n)},t.useRef=function(e){return O().useRef(e)},t.useState=function(e){return O().useState(e)},t.version="17.0.2"},7294:(e,t,n)=>{"use strict";e.exports=n(2408)},53:(e,t)=>{"use strict";
/** @license React v0.20.2
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var n,r,a,o;if("object"==typeof performance&&"function"==typeof performance.now){var s=performance;t.unstable_now=function(){return s.now()}}else{var i=Date,u=i.now();t.unstable_now=function(){return i.now()-u}}if("undefined"==typeof window||"function"!=typeof MessageChannel){var l=null,c=null,p=function(){if(null!==l)try{var e=t.unstable_now();l(!0,e),l=null}catch(e){throw setTimeout(p,0),e}};n=function(e){null!==l?setTimeout(n,0,e):(l=e,setTimeout(p,0))},r=function(e,t){c=setTimeout(e,t)},a=function(){clearTimeout(c)},t.unstable_shouldYield=function(){return!1},o=t.unstable_forceFrameRate=function(){}}else{var d=window.setTimeout,f=window.clearTimeout;if("undefined"!=typeof console){var h=window.cancelAnimationFrame;"function"!=typeof window.requestAnimationFrame&&console.error("This browser doesn't support requestAnimationFrame. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills"),"function"!=typeof h&&console.error("This browser doesn't support cancelAnimationFrame. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills")}var m=!1,g=null,y=-1,b=5,v=0;t.unstable_shouldYield=function(){return t.unstable_now()>=v},o=function(){},t.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):b=0<e?Math.floor(1e3/e):5};var w=new MessageChannel,x=w.port2;w.port1.onmessage=function(){if(null!==g){var e=t.unstable_now();v=e+b;try{g(!0,e)?x.postMessage(null):(m=!1,g=null)}catch(e){throw x.postMessage(null),e}}else m=!1},n=function(e){g=e,m||(m=!0,x.postMessage(null))},r=function(e,n){y=d((function(){e(t.unstable_now())}),n)},a=function(){f(y),y=-1}}function k(e,t){var n=e.length;e.push(t);e:for(;;){var r=n-1>>>1,a=e[r];if(!(void 0!==a&&0<N(a,t)))break e;e[r]=t,e[n]=a,n=r}}function S(e){return void 0===(e=e[0])?null:e}function E(e){var t=e[0];if(void 0!==t){var n=e.pop();if(n!==t){e[0]=n;e:for(var r=0,a=e.length;r<a;){var o=2*(r+1)-1,s=e[o],i=o+1,u=e[i];if(void 0!==s&&0>N(s,n))void 0!==u&&0>N(u,s)?(e[r]=u,e[i]=n,r=i):(e[r]=s,e[o]=n,r=o);else{if(!(void 0!==u&&0>N(u,n)))break e;e[r]=u,e[i]=n,r=i}}}return t}return null}function N(e,t){var n=e.sortIndex-t.sortIndex;return 0!==n?n:e.id-t.id}var T=[],_=[],A=1,I=null,M=3,O=!1,D=!1,C=!1;function $(e){for(var t=S(_);null!==t;){if(null===t.callback)E(_);else{if(!(t.startTime<=e))break;E(_),t.sortIndex=t.expirationTime,k(T,t)}t=S(_)}}function R(e){if(C=!1,$(e),!D)if(null!==S(T))D=!0,n(F);else{var t=S(_);null!==t&&r(R,t.startTime-e)}}function F(e,n){D=!1,C&&(C=!1,a()),O=!0;var o=M;try{for($(n),I=S(T);null!==I&&(!(I.expirationTime>n)||e&&!t.unstable_shouldYield());){var s=I.callback;if("function"==typeof s){I.callback=null,M=I.priorityLevel;var i=s(I.expirationTime<=n);n=t.unstable_now(),"function"==typeof i?I.callback=i:I===S(T)&&E(T),$(n)}else E(T);I=S(T)}if(null!==I)var u=!0;else{var l=S(_);null!==l&&r(R,l.startTime-n),u=!1}return u}finally{I=null,M=o,O=!1}}var P=o;t.unstable_IdlePriority=5,t.unstable_ImmediatePriority=1,t.unstable_LowPriority=4,t.unstable_NormalPriority=3,t.unstable_Profiling=null,t.unstable_UserBlockingPriority=2,t.unstable_cancelCallback=function(e){e.callback=null},t.unstable_continueExecution=function(){D||O||(D=!0,n(F))},t.unstable_getCurrentPriorityLevel=function(){return M},t.unstable_getFirstCallbackNode=function(){return S(T)},t.unstable_next=function(e){switch(M){case 1:case 2:case 3:var t=3;break;default:t=M}var n=M;M=t;try{return e()}finally{M=n}},t.unstable_pauseExecution=function(){},t.unstable_requestPaint=P,t.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=M;M=e;try{return t()}finally{M=n}},t.unstable_scheduleCallback=function(e,o,s){var i=t.unstable_now();switch("object"==typeof s&&null!==s?s="number"==typeof(s=s.delay)&&0<s?i+s:i:s=i,e){case 1:var u=-1;break;case 2:u=250;break;case 5:u=1073741823;break;case 4:u=1e4;break;default:u=5e3}return e={id:A++,callback:o,priorityLevel:e,startTime:s,expirationTime:u=s+u,sortIndex:-1},s>i?(e.sortIndex=s,k(_,e),null===S(T)&&e===S(_)&&(C?a():C=!0,r(R,s-i))):(e.sortIndex=u,k(T,e),D||O||(D=!0,n(F))),e},t.unstable_wrapCallback=function(e){var t=M;return function(){var n=M;M=t;try{return e.apply(this,arguments)}finally{M=n}}}},3840:(e,t,n)=>{"use strict";e.exports=n(53)},6377:(e,t,n)=>{var r=n(4832),a=n(8652),o=n(801),s=n(2030),i=n(3618),u=n(9049),l=n(1971);l.alea=r,l.xor128=a,l.xorwow=o,l.xorshift7=s,l.xor4096=i,l.tychei=u,e.exports=l},4832:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this,n=function(){var e=4022871197,t=function(t){t=String(t);for(var n=0;n<t.length;n++){var r=.02519603282416938*(e+=t.charCodeAt(n));r-=e=r>>>0,e=(r*=e)>>>0,e+=4294967296*(r-=e)}return 2.3283064365386963e-10*(e>>>0)};return t}();t.next=function(){var e=2091639*t.s0+2.3283064365386963e-10*t.c;return t.s0=t.s1,t.s1=t.s2,t.s2=e-(t.c=0|e)},t.c=1,t.s0=n(" "),t.s1=n(" "),t.s2=n(" "),t.s0-=n(e),t.s0<0&&(t.s0+=1),t.s1-=n(e),t.s1<0&&(t.s1+=1),t.s2-=n(e),t.s2<0&&(t.s2+=1),n=null}function i(e,t){return t.c=e.c,t.s0=e.s0,t.s1=e.s1,t.s2=e.s2,t}function u(e,t){var n=new s(e),r=t&&t.state,a=n.next;return a.int32=function(){return 4294967296*n.next()|0},a.double=function(){return a()+11102230246251565e-32*(2097152*a()|0)},a.quick=a,r&&("object"==typeof r&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.alea=u}(0,e=n.nmd(e),n.amdD)},9049:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this,n="";t.next=function(){var e=t.b,n=t.c,r=t.d,a=t.a;return e=e<<25^e>>>7^n,n=n-r|0,r=r<<24^r>>>8^a,a=a-e|0,t.b=e=e<<20^e>>>12^n,t.c=n=n-r|0,t.d=r<<16^n>>>16^a,t.a=a-e|0},t.a=0,t.b=0,t.c=-1640531527,t.d=1367130551,e===Math.floor(e)?(t.a=e/4294967296|0,t.b=0|e):n+=e;for(var r=0;r<n.length+20;r++)t.b^=0|n.charCodeAt(r),t.next()}function i(e,t){return t.a=e.a,t.b=e.b,t.c=e.c,t.d=e.d,t}function u(e,t){var n=new s(e),r=t&&t.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do{var e=((n.next()>>>11)+(n.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=n.next,a.quick=a,r&&("object"==typeof r&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.tychei=u}(0,e=n.nmd(e),n.amdD)},8652:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this,n="";t.x=0,t.y=0,t.z=0,t.w=0,t.next=function(){var e=t.x^t.x<<11;return t.x=t.y,t.y=t.z,t.z=t.w,t.w^=t.w>>>19^e^e>>>8},e===(0|e)?t.x=e:n+=e;for(var r=0;r<n.length+64;r++)t.x^=0|n.charCodeAt(r),t.next()}function i(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t}function u(e,t){var n=new s(e),r=t&&t.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do{var e=((n.next()>>>11)+(n.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=n.next,a.quick=a,r&&("object"==typeof r&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.xor128=u}(0,e=n.nmd(e),n.amdD)},3618:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this;t.next=function(){var e,n,r=t.w,a=t.X,o=t.i;return t.w=r=r+1640531527|0,n=a[o+34&127],e=a[o=o+1&127],n^=n<<13,e^=e<<17,n^=n>>>15,e^=e>>>12,n=a[o]=n^e,t.i=o,n+(r^r>>>16)|0},function(e,t){var n,r,a,o,s,i=[],u=128;for(t===(0|t)?(r=t,t=null):(t+="\0",r=0,u=Math.max(u,t.length)),a=0,o=-32;o<u;++o)t&&(r^=t.charCodeAt((o+32)%t.length)),0===o&&(s=r),r^=r<<10,r^=r>>>15,r^=r<<4,r^=r>>>13,o>=0&&(s=s+1640531527|0,a=0==(n=i[127&o]^=r+s)?a+1:0);for(a>=128&&(i[127&(t&&t.length||0)]=-1),a=127,o=512;o>0;--o)r=i[a+34&127],n=i[a=a+1&127],r^=r<<13,n^=n<<17,r^=r>>>15,n^=n>>>12,i[a]=r^n;e.w=s,e.X=i,e.i=a}(t,e)}function i(e,t){return t.i=e.i,t.w=e.w,t.X=e.X.slice(),t}function u(e,t){null==e&&(e=+new Date);var n=new s(e),r=t&&t.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do{var e=((n.next()>>>11)+(n.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=n.next,a.quick=a,r&&(r.X&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.xor4096=u}(0,e=n.nmd(e),n.amdD)},2030:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this;t.next=function(){var e,n,r=t.x,a=t.i;return e=r[a],n=(e^=e>>>7)^e<<24,n^=(e=r[a+1&7])^e>>>10,n^=(e=r[a+3&7])^e>>>3,n^=(e=r[a+4&7])^e<<7,e=r[a+7&7],n^=(e^=e<<13)^e<<9,r[a]=n,t.i=a+1&7,n},function(e,t){var n,r=[];if(t===(0|t))r[0]=t;else for(t=""+t,n=0;n<t.length;++n)r[7&n]=r[7&n]<<15^t.charCodeAt(n)+r[n+1&7]<<13;for(;r.length<8;)r.push(0);for(n=0;n<8&&0===r[n];++n);for(8==n?r[7]=-1:r[n],e.x=r,e.i=0,n=256;n>0;--n)e.next()}(t,e)}function i(e,t){return t.x=e.x.slice(),t.i=e.i,t}function u(e,t){null==e&&(e=+new Date);var n=new s(e),r=t&&t.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do{var e=((n.next()>>>11)+(n.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=n.next,a.quick=a,r&&(r.x&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.xorshift7=u}(0,e=n.nmd(e),n.amdD)},801:function(e,t,n){var r;!function(e,a,o){function s(e){var t=this,n="";t.next=function(){var e=t.x^t.x>>>2;return t.x=t.y,t.y=t.z,t.z=t.w,t.w=t.v,(t.d=t.d+362437|0)+(t.v=t.v^t.v<<4^e^e<<1)|0},t.x=0,t.y=0,t.z=0,t.w=0,t.v=0,e===(0|e)?t.x=e:n+=e;for(var r=0;r<n.length+64;r++)t.x^=0|n.charCodeAt(r),r==n.length&&(t.d=t.x<<10^t.x>>>4),t.next()}function i(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t.v=e.v,t.d=e.d,t}function u(e,t){var n=new s(e),r=t&&t.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do{var e=((n.next()>>>11)+(n.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=n.next,a.quick=a,r&&("object"==typeof r&&i(r,n),a.state=function(){return i(n,{})}),a}a&&a.exports?a.exports=u:n.amdD&&n.amdO?void 0===(r=function(){return u}.call(t,n,t,a))||(a.exports=r):this.xorwow=u}(0,e=n.nmd(e),n.amdD)},1971:function(e,t,n){var r;!function(a,o,s){var i,u=256,l=s.pow(u,6),c=s.pow(2,52),p=2*c,d=u-1;function f(e,t,n){var r=[],d=y(g((t=1==t?{entropy:!0}:t||{}).entropy?[e,b(o)]:null==e?function(){try{var e;return i&&(e=i.randomBytes)?e=e(u):(e=new Uint8Array(u),(a.crypto||a.msCrypto).getRandomValues(e)),b(e)}catch(e){var t=a.navigator,n=t&&t.plugins;return[+new Date,a,n,a.screen,b(o)]}}():e,3),r),f=new h(r),v=function(){for(var e=f.g(6),t=l,n=0;e<c;)e=(e+n)*u,t*=u,n=f.g(1);for(;e>=p;)e/=2,t/=2,n>>>=1;return(e+n)/t};return v.int32=function(){return 0|f.g(4)},v.quick=function(){return f.g(4)/4294967296},v.double=v,y(b(f.S),o),(t.pass||n||function(e,t,n,r){return r&&(r.S&&m(r,f),e.state=function(){return m(f,{})}),n?(s.random=e,t):e})(v,d,"global"in t?t.global:this==s,t.state)}function h(e){var t,n=e.length,r=this,a=0,o=r.i=r.j=0,s=r.S=[];for(n||(e=[n++]);a<u;)s[a]=a++;for(a=0;a<u;a++)s[a]=s[o=d&o+e[a%n]+(t=s[a])],s[o]=t;(r.g=function(e){for(var t,n=0,a=r.i,o=r.j,s=r.S;e--;)t=s[a=d&a+1],n=n*u+s[d&(s[a]=s[o=d&o+t])+(s[o]=t)];return r.i=a,r.j=o,n})(u)}function m(e,t){return t.i=e.i,t.j=e.j,t.S=e.S.slice(),t}function g(e,t){var n,r=[],a=typeof e;if(t&&"object"==a)for(n in e)try{r.push(g(e[n],t-1))}catch(e){}return r.length?r:"string"==a?e:e+"\0"}function y(e,t){for(var n,r=e+"",a=0;a<r.length;)t[d&a]=d&(n^=19*t[d&a])+r.charCodeAt(a++);return b(t)}function b(e){return String.fromCharCode.apply(0,e)}if(y(s.random(),o),e.exports){e.exports=f;try{i=n(5042)}catch(e){}}else void 0===(r=function(){return f}.call(t,n,t,e))||(e.exports=r)}("undefined"!=typeof self?self:this,[],Math)},5410:()=>{},8628:()=>{},5042:()=>{}},t={};function n(r){var a=t[r];if(void 0!==a)return a.exports;var o=t[r]={id:r,loaded:!1,exports:{}};return e[r].call(o.exports,o,o.exports,n),o.loaded=!0,o.exports}n.amdD=function(){throw new Error("define cannot be used indirect")},n.amdO={},n.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return n.d(t,{a:t}),t},n.d=(e,t)=>{for(var r in t)n.o(t,r)&&!n.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},n.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),n.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),n.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),(()=>{"use strict";var e={};n.r(e),n.d(e,{arraysEqual:()=>re,arraysEqualWithNull:()=>ne,assert:()=>X,assertNonNegativeIntegerDimensions:()=>Ce,assertNonNull:()=>J,assertShapesMatch:()=>Z,bytesFromStringArray:()=>ve,bytesPerElement:()=>be,checkConversionForErrors:()=>me,clamp:()=>H,computeStrides:()=>Te,convertBackendValuesAndArrayBuffer:()=>Ie,createScalarValue:()=>La,createShuffledIndices:()=>ie,decodeString:()=>ja,distSquared:()=>Y,encodeString:()=>Ua,fetch:()=>Va,fingerPrint64:()=>Pa,flatten:()=>Ha,getArrayFromDType:()=>he,getTypedArrayFromDType:()=>fe,hasEncodingLoss:()=>ye,hexToLong:()=>Ta,indexToLoc:()=>Re,inferDtype:()=>Se,inferFromImplicitShape:()=>ce,isBoolean:()=>xe,isFunction:()=>Ee,isInt:()=>ae,isNumber:()=>ke,isPromise:()=>Fe,isScalarShape:()=>te,isString:()=>we,isTypedArray:()=>Wa,isValidDtype:()=>ge,locToIndex:()=>$e,makeOnesTypedArray:()=>Me,makeZerosNestedTypedArray:()=>De,makeZerosTypedArray:()=>Oe,nearestDivisor:()=>Ne,nearestLargerEven:()=>q,now:()=>Ba,parseAxisParam:()=>pe,randUniform:()=>Q,repeatedTry:()=>le,rightPad:()=>ue,shuffle:()=>j,shuffleCombo:()=>W,sizeFromShape:()=>ee,sizeToSquarishShape:()=>se,squeezeShape:()=>de,sum:()=>K,swap:()=>G,tanh:()=>oe,toNestedArray:()=>Ae,toTypedArray:()=>za});var t={};n.r(t),n.d(t,{assertTypesMatch:()=>ko,getTensorsInContainer:()=>Eo,isTensorInList:()=>So,makeTypesMatch:()=>xo});var r={};n.r(r),n.d(r,{isBrowser:()=>Ro,isMobile:()=>$o,mockIsMobile:()=>Co});var a={};n.r(a),n.d(a,{Serializable:()=>Ri,SerializationMap:()=>Fi,getRegisteredName:()=>Li,registerClass:()=>Pi});var o={};n.r(o),n.d(o,{assertAndGetBroadcastShape:()=>Qi,getBroadcastDims:()=>Gi,getReductionAxes:()=>Ki});var s={};n.r(s),n.d(s,{CompositeArrayBuffer:()=>Ko,browserFiles:()=>ou,browserHTTPRequest:()=>hu,concatenateArrayBuffers:()=>ts,copyModel:()=>Vs,decodeWeights:()=>Xo,encodeWeights:()=>Yo,fromMemory:()=>bu,fromMemorySync:()=>vu,getLoadHandlers:()=>fs,getModelArtifactsForJSON:()=>os,getModelArtifactsForJSONSync:()=>as,getModelArtifactsInfoForJSON:()=>ss,getSaveHandlers:()=>ds,getWeightSpecs:()=>is,http:()=>fu,isHTTPScheme:()=>pu,listModels:()=>zs,loadWeights:()=>uu,moveModel:()=>Us,registerLoadRouter:()=>ps,registerSaveRouter:()=>cs,removeModel:()=>Bs,weightsLoaderFactory:()=>lu,withSaveHandler:()=>wu,withSaveHandlerSync:()=>xu});var i={};n.r(i),n.d(i,{confusionMatrix:()=>Au});var u={};n.r(u),n.d(u,{draw:()=>Pu,fromPixels:()=>Lu,fromPixelsAsync:()=>$u,toPixels:()=>Fu});var l={};n.r(l),n.d(l,{prepareAndValidate:()=>zu});var c={};n.r(c),n.d(c,{calculateShapes:()=>Uu,validateInput:()=>Vu,validateUpdateShape:()=>Bu});var p={};n.r(p),n.d(p,{assertParamsValid:()=>Hu,computeFlatOffset:()=>al,computeOutShape:()=>Gu,getNormalizedAxes:()=>Xu,isSliceContinous:()=>rl,maskToAxes:()=>qu,parseSliceParams:()=>ol,sliceInfo:()=>sl,startForAxis:()=>tl,startIndicesWithElidedDims:()=>Zu,stopForAxis:()=>nl,stopIndicesWithElidedDims:()=>Ju,stridesForAxis:()=>el,stridesWithElidedDims:()=>Ku});var d={};n.r(d),n.d(d,{TEST_EPSILON_FLOAT16:()=>ll,createVideoElement:()=>wl,encodeStrings:()=>vl,expectArrayBuffersEqual:()=>bl,expectArraysClose:()=>cl,expectArraysEqual:()=>hl,expectNumbersClose:()=>ml,expectPromiseToFail:()=>fl,expectValuesInRange:()=>yl,play:()=>xl,testEpsilon:()=>pl});var f={};n.r(f),n.d(f,{conv2d:()=>_f,depthwiseConv2d:()=>Mf,matMul:()=>Of});var h={};n.r(h),n.d(h,{collectGatherOpShapeInfo:()=>Lm,computeOutShape:()=>Pm,segOpComputeOptimalWindowSize:()=>Fm});var m={};n.r(m),n.d(m,{ERF_A1:()=>em,ERF_A2:()=>tm,ERF_A3:()=>nm,ERF_A4:()=>rm,ERF_A5:()=>am,ERF_P:()=>Jh,PARALLELIZE_THRESHOLD:()=>jh,RowPartitionType:()=>Lh,SELU_SCALE:()=>Zh,SELU_SCALEALPHA:()=>Xh,applyActivation:()=>Nf,assertAndGetBroadcastShape:()=>Qi,assertAxesAreInnerMostDims:()=>Kc,assertParamsConsistent:()=>Fh,assignToTypedArray:()=>cm,axesAreInnerMostDims:()=>Wc,calculateShapes:()=>Uu,checkEinsumDimSizes:()=>vm,checkPadOnDimRoundingMode:()=>Yl,combineLocations:()=>Hc,combineRaggedTensorToTensorShapes:()=>zh,complexWithEvenIndex:()=>im,complexWithOddIndex:()=>um,computeConv2DInfo:()=>zl,computeConv3DInfo:()=>Bl,computeDefaultPad:()=>Vl,computeDilation2DInfo:()=>Fl,computeOptimalWindowSize:()=>Wh,computeOutAndReduceShapes:()=>qc,computeOutShape:()=>Ph,computePool2DInfo:()=>Pl,computePool3DInfo:()=>Ll,convertConv2DDataFormat:()=>Ql,decodeEinsumEquation:()=>ym,eitherStridesOrDilationsAreOne:()=>Gl,expandShapeToKeepDim:()=>Gc,exponent:()=>dm,exponents:()=>pm,fromStringArrayToUint8:()=>Bm,fromUint8ToStringArray:()=>zm,getAxesPermutation:()=>Qc,getBroadcastDims:()=>Gi,getComplexWithIndex:()=>lm,getEinsumComputePath:()=>wm,getEinsumPermutation:()=>bm,getFusedBiasGradient:()=>Ef,getFusedDyActivation:()=>Sf,getImageCenter:()=>Hh,getInnerMostAxes:()=>Xc,getPermuted:()=>Gh,getRaggedRank:()=>Vh,getReductionAxes:()=>Ki,getReshaped:()=>qh,getReshapedPermuted:()=>Kh,getRowPartitionTypesHelper:()=>Bh,getSliceBeginCoords:()=>Qh,getSliceSize:()=>Yh,getSparseFillEmptyRowsIndicesDenseShapeMismatch:()=>Em,getSparseFillEmptyRowsNegativeIndexErrorMessage:()=>Nm,getSparseFillEmptyRowsOutOfRangeIndexErrorMessage:()=>Tm,getSparseReshapeEmptyTensorZeroOutputDimErrorMessage:()=>Im,getSparseReshapeInputOutputMismatchErrorMessage:()=>Om,getSparseReshapeInputOutputMultipleErrorMessage:()=>Mm,getSparseReshapeMultipleNegativeOneOutputDimErrorMessage:()=>_m,getSparseReshapeNegativeOutputDimErrorMessage:()=>Am,getSparseSegmentReductionIndicesOutOfRangeErrorMessage:()=>Rm,getSparseSegmentReductionNegativeSegmentIdsErrorMessage:()=>Dm,getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage:()=>Cm,getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage:()=>$m,getUndoAxesPermutation:()=>Yc,isIdentityPermutation:()=>xm,log:()=>pa,mergeRealAndImagArrays:()=>om,prepareAndValidate:()=>zu,prepareSplitSize:()=>Sm,segment_util:()=>h,shouldFuse:()=>Tf,slice_util:()=>p,splitRealAndImagArrays:()=>sm,stridesOrDilationsArePositive:()=>Kl,tupleValuesAreOne:()=>ql,upcastType:()=>yo,validateDefaultValueShape:()=>Uh,validateInput:()=>Vu,validateUpdateShape:()=>Bu,warn:()=>ca});var g={};n.r(g),n.d(g,{nonMaxSuppressionV3Impl:()=>Hf,nonMaxSuppressionV4Impl:()=>qf,nonMaxSuppressionV5Impl:()=>Gf,whereImpl:()=>pf});var y={};n.r(y),n.d(y,{Abs:()=>He,Acos:()=>qe,Acosh:()=>Ge,AdadeltaOptimizer:()=>Bi,AdagradOptimizer:()=>Ui,AdamOptimizer:()=>Hi,AdamaxOptimizer:()=>Xi,Add:()=>Ke,AddN:()=>Qe,All:()=>Ye,Any:()=>Xe,ArgMax:()=>Ze,ArgMin:()=>Je,Asin:()=>et,Asinh:()=>tt,Atan:()=>nt,Atan2:()=>at,Atanh:()=>rt,AvgPool:()=>ot,AvgPool3D:()=>it,AvgPool3DGrad:()=>ut,AvgPoolGrad:()=>st,BatchMatMul:()=>lt,BatchToSpaceND:()=>ct,Bincount:()=>pt,BitwiseAnd:()=>dt,BroadcastArgs:()=>ht,BroadcastTo:()=>ft,Cast:()=>mt,Ceil:()=>gt,ClipByValue:()=>yt,Complex:()=>bt,ComplexAbs:()=>vt,Concat:()=>wt,Conv2D:()=>xt,Conv2DBackpropFilter:()=>kt,Conv2DBackpropInput:()=>St,Conv3D:()=>Et,Conv3DBackpropFilterV2:()=>Nt,Conv3DBackpropInputV2:()=>Tt,Cos:()=>_t,Cosh:()=>At,CropAndResize:()=>Ot,Cumprod:()=>It,Cumsum:()=>Mt,DataStorage:()=>B,DenseBincount:()=>Dt,DepthToSpace:()=>Ct,DepthwiseConv2dNative:()=>$t,DepthwiseConv2dNativeBackpropFilter:()=>Rt,DepthwiseConv2dNativeBackpropInput:()=>Ft,Diag:()=>Pt,Dilation2D:()=>Lt,Dilation2DBackpropFilter:()=>Bt,Dilation2DBackpropInput:()=>zt,Draw:()=>Vt,ENV:()=>Ue,Einsum:()=>jt,Elu:()=>Wt,EluGrad:()=>Ht,Environment:()=>Le,Equal:()=>Gt,Erf:()=>qt,Exp:()=>Kt,ExpandDims:()=>Qt,Expm1:()=>Yt,FFT:()=>Xt,Fill:()=>Zt,FlipLeftRight:()=>Jt,Floor:()=>en,FloorDiv:()=>tn,FromPixels:()=>oa,FusedBatchNorm:()=>nn,FusedConv2D:()=>ua,FusedDepthwiseConv2D:()=>la,GatherNd:()=>an,GatherV2:()=>rn,Greater:()=>on,GreaterEqual:()=>sn,IFFT:()=>ln,Identity:()=>un,Imag:()=>cn,IsFinite:()=>pn,IsInf:()=>dn,IsNan:()=>fn,KernelBackend:()=>V,LRN:()=>Tn,LRNGrad:()=>_n,LeakyRelu:()=>hn,Less:()=>mn,LessEqual:()=>gn,LinSpace:()=>yn,Log:()=>bn,Log1p:()=>vn,LogSoftmax:()=>En,LogicalAnd:()=>wn,LogicalNot:()=>xn,LogicalOr:()=>kn,LogicalXor:()=>Sn,LowerBound:()=>Nn,MatrixBandPart:()=>An,Max:()=>In,MaxPool:()=>On,MaxPool3D:()=>Cn,MaxPool3DGrad:()=>$n,MaxPoolGrad:()=>Dn,MaxPoolWithArgmax:()=>Rn,Maximum:()=>Mn,Mean:()=>Fn,Min:()=>Pn,Minimum:()=>Ln,MirrorPad:()=>zn,Mod:()=>Bn,MomentumOptimizer:()=>Ji,Multinomial:()=>Vn,Multiply:()=>Un,Neg:()=>jn,NonMaxSuppressionV3:()=>Hn,NonMaxSuppressionV4:()=>qn,NonMaxSuppressionV5:()=>Gn,NotEqual:()=>Wn,OP_SCOPE_SUFFIX:()=>Uo,OneHot:()=>Qn,OnesLike:()=>Kn,Optimizer:()=>zi,OptimizerConstructors:()=>Sl,Pack:()=>Yn,PadV2:()=>Xn,Pool:()=>Zn,Pow:()=>Jn,Prelu:()=>er,Prod:()=>tr,RMSPropOptimizer:()=>eu,RaggedGather:()=>nr,RaggedRange:()=>rr,RaggedTensorToTensor:()=>ar,Range:()=>or,Rank:()=>co,Real:()=>sr,RealDiv:()=>Ut,Reciprocal:()=>ir,Reduction:()=>ph,Relu:()=>ur,Relu6:()=>hr,Reshape:()=>lr,ResizeBilinear:()=>dr,ResizeBilinearGrad:()=>fr,ResizeNearestNeighbor:()=>cr,ResizeNearestNeighborGrad:()=>pr,Reverse:()=>mr,RotateWithOffset:()=>sa,Round:()=>gr,Rsqrt:()=>yr,SGDOptimizer:()=>Zi,ScatterNd:()=>br,SearchSorted:()=>wr,Select:()=>xr,Selu:()=>kr,Sigmoid:()=>_r,Sign:()=>Tr,Sin:()=>Er,Sinh:()=>Nr,Slice:()=>Sr,Softmax:()=>Cr,Softplus:()=>Ar,SpaceToBatchND:()=>Or,SparseFillEmptyRows:()=>$r,SparseReshape:()=>Rr,SparseSegmentMean:()=>Fr,SparseSegmentSum:()=>Pr,SparseToDense:()=>Lr,SplitV:()=>Dr,Sqrt:()=>Ir,Square:()=>Br,SquaredDifference:()=>zr,StaticRegexReplace:()=>Vr,Step:()=>aa,StridedSlice:()=>Ur,StringNGrams:()=>jr,StringSplit:()=>Wr,StringToHashBucketFast:()=>Hr,Sub:()=>qr,Sum:()=>Mr,Tan:()=>Gr,Tanh:()=>Kr,Tensor:()=>io,TensorBuffer:()=>ro,TensorScatterUpdate:()=>vr,Tile:()=>Qr,TopK:()=>Yr,Transform:()=>Xr,Transpose:()=>Zr,Unique:()=>Jr,Unpack:()=>ea,UnsortedSegmentSum:()=>ta,UpperBound:()=>na,Variable:()=>lo,ZerosLike:()=>ra,_FusedMatMul:()=>ia,abs:()=>qi,acos:()=>El,acosh:()=>Nl,add:()=>bi,addN:()=>Tl,all:()=>_l,any:()=>Al,argMax:()=>Il,argMin:()=>Ml,asin:()=>Ol,asinh:()=>Dl,atan:()=>Cl,atan2:()=>$l,atanh:()=>Rl,avgPool:()=>Zl,avgPool3d:()=>Jl,backend:()=>gi,backend_util:()=>m,basicLSTMCell:()=>ac,batchNorm:()=>sc,batchNorm2d:()=>ic,batchNorm3d:()=>uc,batchNorm4d:()=>lc,batchToSpaceND:()=>oc,bincount:()=>cc,bitwiseAnd:()=>pc,booleanMaskAsync:()=>ff,broadcastArgs:()=>dc,broadcastTo:()=>fc,broadcast_util:()=>o,browser:()=>u,buffer:()=>Gs,cast:()=>Ks,ceil:()=>hc,clipByValue:()=>mc,clone:()=>Qs,complex:()=>Wo,concat:()=>ec,concat1d:()=>gc,concat2d:()=>yc,concat3d:()=>bc,concat4d:()=>vc,conv1d:()=>xc,conv2d:()=>wc,conv2dTranspose:()=>Sc,conv3d:()=>Ec,conv3dTranspose:()=>Tc,copyRegisteredKernels:()=>xa,cos:()=>_c,cosh:()=>Ac,cosineWindow:()=>wf,cumprod:()=>Ic,cumsum:()=>Mc,customGrad:()=>Mi,denseBincount:()=>Oc,deprecationWarn:()=>ei,depthToSpace:()=>Dc,depthwiseConv2d:()=>Cc,device_util:()=>r,diag:()=>$c,dilation2d:()=>Rc,disableDeprecationWarnings:()=>Js,dispose:()=>si,disposeVariables:()=>ti,div:()=>wi,divNoNan:()=>Lc,dot:()=>zc,dropout:()=>bf,einsum:()=>Bc,elu:()=>Vc,enableDebugMode:()=>Zs,enableProdMode:()=>Xs,enclosingPowerOfTwo:()=>vf,engine:()=>ni,ensureShape:()=>Uc,env:()=>Be,equal:()=>Fc,erf:()=>jc,euclideanNorm:()=>rp,exp:()=>ap,expandDims:()=>op,expm1:()=>sp,eye:()=>up,fft:()=>Bd,fill:()=>Vi,findBackend:()=>fi,findBackendFactory:()=>hi,floor:()=>lp,floorDiv:()=>vi,fused:()=>f,gather:()=>cp,gatherND:()=>yf,gather_util:()=>l,getBackend:()=>pi,getGradient:()=>ma,getKernel:()=>ha,getKernelsForBackend:()=>ga,grad:()=>Ni,grads:()=>Ti,greater:()=>pp,greaterEqual:()=>dp,ifft:()=>Vd,imag:()=>Eu,image:()=>Ah,inTopKAsync:()=>xf,io:()=>s,irfft:()=>Ud,isFinite:()=>fp,isInf:()=>hp,isNaN:()=>mp,keep:()=>ii,kernel_impls:()=>g,leakyRelu:()=>gp,less:()=>yp,lessEqual:()=>bp,linalg:()=>Ih,linspace:()=>vp,localResponseNormalization:()=>wp,log:()=>xp,log1p:()=>kp,logSigmoid:()=>Ep,logSoftmax:()=>Np,logSumExp:()=>Tp,logicalAnd:()=>_p,logicalNot:()=>Ap,logicalOr:()=>Ip,logicalXor:()=>Mp,losses:()=>Mh,lowerBound:()=>Cp,matMul:()=>ku,math:()=>i,max:()=>Zc,maxPool:()=>$p,maxPool3d:()=>Rp,maxPoolWithArgmax:()=>Fp,maximum:()=>Yi,mean:()=>Pp,memory:()=>ri,meshgrid:()=>Bp,min:()=>Jc,minimum:()=>Vp,mirrorPad:()=>Up,mod:()=>jp,moments:()=>Wp,movingAverage:()=>hf,mul:()=>xi,multiRNNCell:()=>Hp,multinomial:()=>qp,neg:()=>Nu,nextFrame:()=>Rh,norm:()=>np,notEqual:()=>Gp,oneHot:()=>Su,ones:()=>zp,onesLike:()=>Kp,op:()=>jo,outerProduct:()=>Qp,pad:()=>Yp,pad1d:()=>Xp,pad2d:()=>Zp,pad3d:()=>Jp,pad4d:()=>ed,pool:()=>nd,pow:()=>ji,prelu:()=>rd,print:()=>Ys,prod:()=>ad,profile:()=>ai,raggedGather:()=>od,raggedRange:()=>sd,raggedTensorToTensor:()=>id,rand:()=>ud,randomGamma:()=>fd,randomNormal:()=>hd,randomStandardNormal:()=>md,randomUniform:()=>gd,randomUniformInt:()=>yd,range:()=>bd,ready:()=>ci,real:()=>Tu,reciprocal:()=>vd,registerBackend:()=>mi,registerGradient:()=>ba,registerKernel:()=>ya,relu:()=>wd,relu6:()=>xd,removeBackend:()=>di,reshape:()=>Xl,reverse:()=>kd,reverse1d:()=>Sd,reverse2d:()=>Ed,reverse3d:()=>Nd,reverse4d:()=>Td,rfft:()=>Wd,round:()=>_d,rsqrt:()=>Ad,scalar:()=>Di,scatterND:()=>mf,scatter_util:()=>c,searchSorted:()=>Dp,selu:()=>Id,separableConv2d:()=>Md,serialization:()=>a,setBackend:()=>li,setPlatform:()=>yi,setdiff1dAsync:()=>Od,sigmoid:()=>tc,sign:()=>Dd,signal:()=>_h,sin:()=>Cd,sinh:()=>$d,slice:()=>nc,slice1d:()=>Rd,slice2d:()=>Fd,slice3d:()=>Pd,slice4d:()=>Ld,slice_util:()=>p,softmax:()=>zd,softplus:()=>Sp,spaceToBatchND:()=>td,sparse:()=>Oh,sparseToDense:()=>gf,spectral:()=>Th,split:()=>jd,sqrt:()=>ki,square:()=>Si,squaredDifference:()=>Hd,squeeze:()=>qd,stack:()=>Gd,step:()=>Kd,stridedSlice:()=>Qd,string:()=>Dh,sub:()=>Wi,sum:()=>ep,sumOutType:()=>bo,tan:()=>Yd,tanh:()=>rc,tensor:()=>qo,tensor1d:()=>Xd,tensor2d:()=>Zd,tensor3d:()=>Iu,tensor4d:()=>Jd,tensor5d:()=>ef,tensor6d:()=>tf,tensorScatterUpdate:()=>nf,tensor_util:()=>t,test_util:()=>d,tidy:()=>oi,tile:()=>ip,time:()=>ui,topk:()=>rf,train:()=>Ch,transpose:()=>_u,truncatedNormal:()=>af,unique:()=>of,unregisterGradient:()=>wa,unregisterKernel:()=>va,unsortedSegmentSum:()=>sf,unstack:()=>uf,upcastType:()=>yo,upperBound:()=>lf,util:()=>e,valueAndGrad:()=>_i,valueAndGrads:()=>Ai,variable:()=>cf,variableGrads:()=>Ii,version_core:()=>kl,where:()=>Pc,whereAsync:()=>df,zeros:()=>Lp,zerosLike:()=>Ei});var b={};n.r(b),n.d(b,{json:()=>Jm});var v={};n.r(v),n.d(v,{json:()=>eg});var w={};n.r(w),n.d(w,{json:()=>tg});var x={};n.r(x),n.d(x,{json:()=>ng});var k={};n.r(k),n.d(k,{json:()=>rg});var S={};n.r(S),n.d(S,{json:()=>ag});var E={};n.r(E),n.d(E,{json:()=>og});var N={};n.r(N),n.d(N,{json:()=>sg});var T={};n.r(T),n.d(T,{json:()=>ig});var _={};n.r(_),n.d(_,{json:()=>ug});var A={};n.r(A),n.d(A,{json:()=>lg});var I={};n.r(I),n.d(I,{json:()=>cg});var M={};n.r(M),n.d(M,{json:()=>pg});var O={};n.r(O),n.d(O,{json:()=>dg});var D={};n.r(D),n.d(D,{json:()=>fg});var C={};n.r(C),n.d(C,{json:()=>hg});var $={};n.r($),n.d($,{json:()=>mg});var R={};n.r(R),n.d(R,{json:()=>gg});var F={};n.r(F),n.d(F,{json:()=>yg});var P={};n.r(P),n.d(P,{OP_SCOPE_SUFFIX:()=>Uo,abs:()=>qi,acos:()=>El,acosh:()=>Nl,add:()=>bi,addN:()=>Tl,all:()=>_l,any:()=>Al,argMax:()=>Il,argMin:()=>Ml,asin:()=>Ol,asinh:()=>Dl,atan:()=>Cl,atan2:()=>$l,atanh:()=>Rl,avgPool:()=>Zl,avgPool3d:()=>Jl,basicLSTMCell:()=>ac,batchNorm:()=>sc,batchNorm2d:()=>ic,batchNorm3d:()=>uc,batchNorm4d:()=>lc,batchToSpaceND:()=>oc,bincount:()=>cc,bitwiseAnd:()=>pc,booleanMaskAsync:()=>ff,broadcastArgs:()=>dc,broadcastTo:()=>fc,buffer:()=>Gs,cast:()=>Ks,ceil:()=>hc,clipByValue:()=>mc,clone:()=>Qs,complex:()=>Wo,concat:()=>ec,concat1d:()=>gc,concat2d:()=>yc,concat3d:()=>bc,concat4d:()=>vc,conv1d:()=>xc,conv2d:()=>wc,conv2dTranspose:()=>Sc,conv3d:()=>Ec,conv3dTranspose:()=>Tc,cos:()=>_c,cosh:()=>Ac,cosineWindow:()=>wf,cumprod:()=>Ic,cumsum:()=>Mc,denseBincount:()=>Oc,depthToSpace:()=>Dc,depthwiseConv2d:()=>Cc,diag:()=>$c,dilation2d:()=>Rc,div:()=>wi,divNoNan:()=>Lc,dot:()=>zc,dropout:()=>bf,einsum:()=>Bc,elu:()=>Vc,enclosingPowerOfTwo:()=>vf,ensureShape:()=>Uc,equal:()=>Fc,erf:()=>jc,euclideanNorm:()=>rp,exp:()=>ap,expandDims:()=>op,expm1:()=>sp,eye:()=>up,fft:()=>Bd,fill:()=>Vi,floor:()=>lp,floorDiv:()=>vi,fused:()=>f,gather:()=>cp,gatherND:()=>yf,greater:()=>pp,greaterEqual:()=>dp,ifft:()=>Vd,imag:()=>Eu,image:()=>Ah,inTopKAsync:()=>xf,irfft:()=>Ud,isFinite:()=>fp,isInf:()=>hp,isNaN:()=>mp,leakyRelu:()=>gp,less:()=>yp,lessEqual:()=>bp,linalg:()=>Ih,linspace:()=>vp,localResponseNormalization:()=>wp,log:()=>xp,log1p:()=>kp,logSigmoid:()=>Ep,logSoftmax:()=>Np,logSumExp:()=>Tp,logicalAnd:()=>_p,logicalNot:()=>Ap,logicalOr:()=>Ip,logicalXor:()=>Mp,losses:()=>Mh,lowerBound:()=>Cp,matMul:()=>ku,max:()=>Zc,maxPool:()=>$p,maxPool3d:()=>Rp,maxPoolWithArgmax:()=>Fp,maximum:()=>Yi,mean:()=>Pp,meshgrid:()=>Bp,min:()=>Jc,minimum:()=>Vp,mirrorPad:()=>Up,mod:()=>jp,moments:()=>Wp,movingAverage:()=>hf,mul:()=>xi,multiRNNCell:()=>Hp,multinomial:()=>qp,neg:()=>Nu,norm:()=>np,notEqual:()=>Gp,oneHot:()=>Su,ones:()=>zp,onesLike:()=>Kp,op:()=>jo,outerProduct:()=>Qp,pad:()=>Yp,pad1d:()=>Xp,pad2d:()=>Zp,pad3d:()=>Jp,pad4d:()=>ed,pool:()=>nd,pow:()=>ji,prelu:()=>rd,print:()=>Ys,prod:()=>ad,raggedGather:()=>od,raggedRange:()=>sd,raggedTensorToTensor:()=>id,rand:()=>ud,randomGamma:()=>fd,randomNormal:()=>hd,randomStandardNormal:()=>md,randomUniform:()=>gd,randomUniformInt:()=>yd,range:()=>bd,real:()=>Tu,reciprocal:()=>vd,relu:()=>wd,relu6:()=>xd,reshape:()=>Xl,reverse:()=>kd,reverse1d:()=>Sd,reverse2d:()=>Ed,reverse3d:()=>Nd,reverse4d:()=>Td,rfft:()=>Wd,round:()=>_d,rsqrt:()=>Ad,scalar:()=>Di,scatterND:()=>mf,searchSorted:()=>Dp,selu:()=>Id,separableConv2d:()=>Md,setdiff1dAsync:()=>Od,sigmoid:()=>tc,sign:()=>Dd,signal:()=>_h,sin:()=>Cd,sinh:()=>$d,slice:()=>nc,slice1d:()=>Rd,slice2d:()=>Fd,slice3d:()=>Pd,slice4d:()=>Ld,softmax:()=>zd,softplus:()=>Sp,spaceToBatchND:()=>td,sparse:()=>Oh,sparseToDense:()=>gf,spectral:()=>Th,split:()=>jd,sqrt:()=>ki,square:()=>Si,squaredDifference:()=>Hd,squeeze:()=>qd,stack:()=>Gd,step:()=>Kd,stridedSlice:()=>Qd,string:()=>Dh,sub:()=>Wi,sum:()=>ep,tan:()=>Yd,tanh:()=>rc,tensor:()=>qo,tensor1d:()=>Xd,tensor2d:()=>Zd,tensor3d:()=>Iu,tensor4d:()=>Jd,tensor5d:()=>ef,tensor6d:()=>tf,tensorScatterUpdate:()=>nf,tile:()=>ip,topk:()=>rf,transpose:()=>_u,truncatedNormal:()=>af,unique:()=>of,unsortedSegmentSum:()=>sf,unstack:()=>uf,upperBound:()=>lf,variable:()=>cf,where:()=>Pc,whereAsync:()=>df,zeros:()=>Lp,zerosLike:()=>Ei});var L=n(7294),z=n(9060);class B{constructor(e,t){this.backend=e,this.dataMover=t,this.data=new WeakMap,this.dataIdsCount=0}get(e){return this.data.has(e)||this.dataMover.moveData(this.backend,e),this.data.get(e)}set(e,t){this.dataIdsCount++,this.data.set(e,t)}has(e){return this.data.has(e)}delete(e){return this.dataIdsCount--,this.data.delete(e)}numDataIds(){return this.dataIdsCount}}class V{refCount(e){return U("refCount")}incRef(e){return U("incRef")}timerAvailable(){return!0}time(e){return U("time")}read(e){return U("read")}readSync(e){return U("readSync")}readToGPU(e,t){return U("readToGPU")}numDataIds(){return U("numDataIds")}disposeData(e,t){return U("disposeData")}write(e,t,n){return U("write")}move(e,t,n,r,a){return U("move")}createTensorFromGPUData(e,t,n){return U("createTensorFromGPUData")}memory(){return U("memory")}floatPrecision(){return U("floatPrecision")}epsilon(){return 32===this.floatPrecision()?1e-7:1e-4}dispose(){return U("dispose")}}function U(e){throw new Error(`'${e}' not yet implemented or not found in the registry. This kernel may not be supported by the tfjs backend you have chosen`)}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function j(e){let t=e.length,n=0;for(;t>0;)n=Math.random()*t|0,t--,G(e,t,n)}function W(e,t){if(e.length!==t.length)throw new Error(`Array sizes must match to be shuffled together First array length was ${e.length}Second array length was ${t.length}`);let n=e.length,r=0;for(;n>0;)r=Math.random()*n|0,n--,G(e,n,r),G(t,n,r)}function H(e,t,n){return Math.max(e,Math.min(t,n))}function q(e){return e%2==0?e:e+1}function G(e,t,n){const r=e[t];e[t]=e[n],e[n]=r}function K(e){let t=0;for(let n=0;n<e.length;n++)t+=e[n];return t}function Q(e,t){const n=Math.random();return t*n+(1-n)*e}function Y(e,t){let n=0;for(let r=0;r<e.length;r++){const a=Number(e[r])-Number(t[r]);n+=a*a}return n}function X(e,t){if(!e)throw new Error("string"==typeof t?t:t())}function Z(e,t,n=""){X(re(e,t),(()=>n+` Shapes ${e} and ${t} must match`))}function J(e){X(null!=e,(()=>"The input to the tensor constructor must be a non-null value."))}function ee(e){if(0===e.length)return 1;let t=e[0];for(let n=1;n<e.length;n++)t*=e[n];return t}function te(e){return 0===e.length}function ne(e,t){if(e===t)return!0;if(null==e||null==t)return!1;if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(null!==e[n]&&null!==t[n]&&e[n]!==t[n])return!1;return!0}function re(e,t){if(e===t)return!0;if(null==e||null==t)return!1;if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function ae(e){return e%1==0}function oe(e){if(null!=Math.tanh)return Math.tanh(e);if(e===1/0)return 1;if(e===-1/0)return-1;{const t=Math.exp(2*e);return(t-1)/(t+1)}}function se(e){const t=Math.ceil(Math.sqrt(e));return[t,Math.ceil(e/t)]}function ie(e){const t=new Uint32Array(e);for(let n=0;n<e;++n)t[n]=n;return j(t),t}function ue(e,t){return t<=e.length?e:e+" ".repeat(t-e.length)}function le(e,t=(e=>0),n,r){return new Promise(((a,o)=>{let s=0;const i=()=>{if(e())return void a();s++;const u=t(s);null!=n&&s>=n?o():null!=r?r(i,u):setTimeout(i,u)};i()}))}function ce(e,t){let n=1,r=-1;for(let t=0;t<e.length;++t)if(e[t]>=0)n*=e[t];else if(-1===e[t]){if(-1!==r)throw Error(`Shapes can only have 1 implicit size. Found -1 at dim ${r} and dim ${t}`);r=t}else if(e[t]<0)throw Error(`Shapes can not be < 0. Found ${e[t]} at dim ${t}`);if(-1===r){if(t>0&&t!==n)throw Error(`Size(${t}) must match the product of shape ${e}`);return e}if(0===n)throw Error(`Cannot infer the missing size in [${e}] when there are 0 elements`);if(t%n!=0)throw Error(`The implicit shape can't be a fractional number. Got ${t} / ${n}`);const a=e.slice();return a[r]=t/n,a}function pe(e,t){const n=t.length;return X((e=null==e?t.map(((e,t)=>t)):[].concat(e)).every((e=>e>=-n&&e<n)),(()=>`All values in axis param must be in range [-${n}, ${n}) but got axis ${e}`)),X(e.every((e=>ae(e))),(()=>`All values in axis param must be integers but got axis ${e}`)),e.map((e=>e<0?n+e:e))}function de(e,t){const n=[],r=[],a=null!=t&&Array.isArray(t)&&0===t.length,o=null==t||a?null:pe(t,e).sort();let s=0;for(let t=0;t<e.length;++t){if(null!=o){if(o[s]===t&&1!==e[t])throw new Error(`Can't squeeze axis ${t} since its dim '${e[t]}' is not 1`);(null==o[s]||o[s]>t)&&1===e[t]&&(n.push(e[t]),r.push(t)),o[s]<=t&&s++}1!==e[t]&&(n.push(e[t]),r.push(t))}return{newShape:n,keptDims:r}}function fe(e,t){return he(e,t)}function he(e,t){let n=null;if(null==e||"float32"===e)n=new Float32Array(t);else if("int32"===e)n=new Int32Array(t);else if("bool"===e)n=new Uint8Array(t);else{if("string"!==e)throw new Error(`Unknown data type ${e}`);n=new Array(t)}return n}function me(e,t){for(let n=0;n<e.length;n++){const r=e[n];if(isNaN(r)||!isFinite(r))throw Error(`A tensor of type ${t} being uploaded contains ${r}.`)}}function ge(e){return"bool"===e||"complex64"===e||"float32"===e||"int32"===e||"string"===e}function ye(e,t){return"complex64"!==t&&(("float32"!==t||"complex64"===e)&&(("int32"!==t||"float32"===e||"complex64"===e)&&("bool"!==t||"bool"!==e)))}function be(e){if("float32"===e||"int32"===e)return 4;if("complex64"===e)return 8;if("bool"===e)return 1;throw new Error(`Unknown dtype ${e}`)}function ve(e){if(null==e)return 0;let t=0;return e.forEach((e=>t+=e.length)),t}function we(e){return"string"==typeof e||e instanceof String}function xe(e){return"boolean"==typeof e}function ke(e){return"number"==typeof e}function Se(e){return Array.isArray(e)?Se(e[0]):e instanceof Float32Array?"float32":e instanceof Int32Array||e instanceof Uint8Array||e instanceof Uint8ClampedArray?"int32":ke(e)?"float32":we(e)?"string":xe(e)?"bool":"float32"}function Ee(e){return!!(e&&e.constructor&&e.call&&e.apply)}function Ne(e,t){for(let n=t;n<e;++n)if(e%n==0)return n;return e}function Te(e){const t=e.length;if(t<2)return[];const n=new Array(t-1);n[t-2]=e[t-1];for(let r=t-3;r>=0;--r)n[r]=n[r+1]*e[r+1];return n}function _e(e,t,n,r=!1){const a=new Array;if(1===t.length){const o=t[0]*(r?2:1);for(let t=0;t<o;t++)a[t]=n[e+t]}else{const o=t[0],s=t.slice(1),i=s.reduce(((e,t)=>e*t))*(r?2:1);for(let t=0;t<o;t++)a[t]=_e(e+t*i,s,n,r)}return a}function Ae(e,t,n=!1){if(0===e.length)return t[0];const r=e.reduce(((e,t)=>e*t))*(n?2:1);if(0===r)return[];if(r!==t.length)throw new Error(`[${e}] does not match the input size ${t.length}${n?" for a complex tensor":""}.`);return _e(0,e,t,n)}function Ie(e,t){if(Array.isArray(e))return e;if("float32"===t)return e instanceof Float32Array?e:new Float32Array(e);if("int32"===t)return e instanceof Int32Array?e:new Int32Array(e);if("bool"===t||"string"===t)return Uint8Array.from(new Int32Array(e));throw new Error(`Unknown dtype ${t}`)}function Me(e,t){const n=Oe(e,t);for(let e=0;e<n.length;e++)n[e]=1;return n}function Oe(e,t){if(null==t||"float32"===t||"complex64"===t)return new Float32Array(e);if("int32"===t)return new Int32Array(e);if("bool"===t)return new Uint8Array(e);throw new Error(`Unknown data type ${t}`)}function De(e,t){const n=e.reduce(((e,t)=>e*t),1);if(null==t||"float32"===t)return Ae(e,new Float32Array(n));if("int32"===t)return Ae(e,new Int32Array(n));if("bool"===t)return Ae(e,new Uint8Array(n));throw new Error(`Unknown data type ${t}`)}function Ce(e){e.forEach((t=>{X(Number.isInteger(t)&&t>=0,(()=>`Tensor must have a shape comprised of positive integers but got shape [${e}].`))}))}function $e(e,t,n){if(0===t)return 0;if(1===t)return e[0];let r=e[e.length-1];for(let t=0;t<e.length-1;++t)r+=n[t]*e[t];return r}function Re(e,t,n){if(0===t)return[];if(1===t)return[e];const r=new Array(t);for(let t=0;t<r.length-1;++t)r[t]=Math.floor(e/n[t]),e-=r[t]*n[t];return r[r.length-1]=e,r}function Fe(e){return e&&e.then&&"function"==typeof e.then}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Pe="tfjsflags";class Le{constructor(e){this.global=e,this.flags={},this.flagRegistry={},this.urlFlags={},this.getQueryParams=ze,this.populateURLFlags()}setPlatform(e,t){null!=this.platform&&(Be().getBool("IS_TEST")||Be().getBool("PROD")||console.warn(`Platform ${this.platformName} has already been set. Overwriting the platform with ${e}.`)),this.platformName=e,this.platform=t}registerFlag(e,t,n){if(this.flagRegistry[e]={evaluationFn:t,setHook:n},null!=this.urlFlags[e]){const t=this.urlFlags[e];Be().getBool("IS_TEST")||Be().getBool("PROD")||console.warn(`Setting feature override from URL ${e}: ${t}.`),this.set(e,t)}}async getAsync(e){return e in this.flags||(this.flags[e]=await this.evaluateFlag(e)),this.flags[e]}get(e){if(e in this.flags)return this.flags[e];const t=this.evaluateFlag(e);if(Fe(t))throw new Error(`Flag ${e} cannot be synchronously evaluated. Please use getAsync() instead.`);return this.flags[e]=t,this.flags[e]}getNumber(e){return this.get(e)}getBool(e){return this.get(e)}getString(e){return this.get(e)}getFlags(){return this.flags}get features(){return this.flags}set(e,t){if(null==this.flagRegistry[e])throw new Error(`Cannot set flag ${e} as it has not been registered.`);this.flags[e]=t,null!=this.flagRegistry[e].setHook&&this.flagRegistry[e].setHook(t)}evaluateFlag(e){if(null==this.flagRegistry[e])throw new Error(`Cannot evaluate flag '${e}': no evaluation function found.`);return this.flagRegistry[e].evaluationFn()}setFlags(e){this.flags=Object.assign({},e)}reset(){this.flags={},this.urlFlags={},this.populateURLFlags()}populateURLFlags(){if(void 0===this.global||void 0===this.global.location||void 0===this.global.location.search)return;const e=this.getQueryParams(this.global.location.search);if(Pe in e){e[Pe].split(",").forEach((e=>{const[t,n]=e.split(":");this.urlFlags[t]=function(e,t){const n=t.toLowerCase();return"true"===n||"false"===n?"true"===n:""+ +n===n?+n:t}(0,n)}))}}}function ze(e){const t={};return e.replace(/[?&]([^=?&]+)(?:=([^&]*))?/g,((e,...n)=>(function(e,t,n){e[decodeURIComponent(t)]=decodeURIComponent(n||"")}(t,n[0],n[1]),n.join("=")))),t}function Be(){return Ue}let Ve,Ue=null;function je(){if(null==Ve){let e;if("undefined"!=typeof window)e=window;else if(void 0!==n.g)e=n.g;else if("undefined"!=typeof process)e=process;else{if("undefined"==typeof self)throw new Error("Could not find a global object");e=self}Ve=e}return Ve}function We(e,t){const n=function(){const e=je();return null==e._tfGlobals&&(e._tfGlobals=new Map),e._tfGlobals}();if(n.has(e))return n.get(e);{const r=t();return n.set(e,r),n.get(e)}}const He="Abs",qe="Acos",Ge="Acosh",Ke="Add",Qe="AddN",Ye="All",Xe="Any",Ze="ArgMax",Je="ArgMin",et="Asin",tt="Asinh",nt="Atan",rt="Atanh",at="Atan2",ot="AvgPool",st="AvgPoolGrad",it="AvgPool3D",ut="AvgPool3DGrad",lt="BatchMatMul",ct="BatchToSpaceND",pt="Bincount",dt="BitwiseAnd",ft="BroadcastTo",ht="BroadcastArgs",mt="Cast",gt="Ceil",yt="ClipByValue",bt="Complex",vt="ComplexAbs",wt="Concat",xt="Conv2D",kt="Conv2DBackpropFilter",St="Conv2DBackpropInput",Et="Conv3D",Nt="Conv3DBackpropFilterV2",Tt="Conv3DBackpropInputV2",_t="Cos",At="Cosh",It="Cumprod",Mt="Cumsum",Ot="CropAndResize",Dt="DenseBincount",Ct="DepthToSpace",$t="DepthwiseConv2dNative",Rt="DepthwiseConv2dNativeBackpropFilter",Ft="DepthwiseConv2dNativeBackpropInput",Pt="Diag",Lt="Dilation2D",zt="Dilation2DBackpropInput",Bt="Dilation2DBackpropFilter",Vt="Draw",Ut="RealDiv",jt="Einsum",Wt="Elu",Ht="EluGrad",qt="Erf",Gt="Equal",Kt="Exp",Qt="ExpandDims",Yt="Expm1",Xt="FFT",Zt="Fill",Jt="FlipLeftRight",en="Floor",tn="FloorDiv",nn="FusedBatchNorm",rn="GatherV2",an="GatherNd",on="Greater",sn="GreaterEqual",un="Identity",ln="IFFT",cn="Imag",pn="IsFinite",dn="IsInf",fn="IsNan",hn="LeakyRelu",mn="Less",gn="LessEqual",yn="LinSpace",bn="Log",vn="Log1p",wn="LogicalAnd",xn="LogicalNot",kn="LogicalOr",Sn="LogicalXor",En="LogSoftmax",Nn="LowerBound",Tn="LRN",_n="LRNGrad",An="MatrixBandPart",In="Max",Mn="Maximum",On="MaxPool",Dn="MaxPoolGrad",Cn="MaxPool3D",$n="MaxPool3DGrad",Rn="MaxPoolWithArgmax",Fn="Mean",Pn="Min",Ln="Minimum",zn="MirrorPad",Bn="Mod",Vn="Multinomial",Un="Multiply",jn="Neg",Wn="NotEqual",Hn="NonMaxSuppressionV3",qn="NonMaxSuppressionV4",Gn="NonMaxSuppressionV5",Kn="OnesLike",Qn="OneHot",Yn="Pack",Xn="PadV2",Zn="Pool",Jn="Pow",er="Prelu",tr="Prod",nr="RaggedGather",rr="RaggedRange",ar="RaggedTensorToTensor",or="Range",sr="Real",ir="Reciprocal",ur="Relu",lr="Reshape",cr="ResizeNearestNeighbor",pr="ResizeNearestNeighborGrad",dr="ResizeBilinear",fr="ResizeBilinearGrad",hr="Relu6",mr="Reverse",gr="Round",yr="Rsqrt",br="ScatterNd",vr="TensorScatterUpdate",wr="SearchSorted",xr="Select",kr="Selu",Sr="Slice",Er="Sin",Nr="Sinh",Tr="Sign",_r="Sigmoid",Ar="Softplus",Ir="Sqrt",Mr="Sum",Or="SpaceToBatchND",Dr="SplitV",Cr="Softmax",$r="SparseFillEmptyRows",Rr="SparseReshape",Fr="SparseSegmentMean",Pr="SparseSegmentSum",Lr="SparseToDense",zr="SquaredDifference",Br="Square",Vr="StaticRegexReplace",Ur="StridedSlice",jr="StringNGrams",Wr="StringSplit",Hr="StringToHashBucketFast",qr="Sub",Gr="Tan",Kr="Tanh",Qr="Tile",Yr="TopK",Xr="Transform",Zr="Transpose",Jr="Unique",ea="Unpack",ta="UnsortedSegmentSum",na="UpperBound",ra="ZerosLike",aa="Step",oa="FromPixels",sa="RotateWithOffset",ia="_FusedMatMul",ua="FusedConv2D",la="FusedDepthwiseConv2D";
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ca(...e){Be().getBool("IS_TEST")||Be().getBool("PROD")||console.warn(...e)}function pa(...e){Be().getBool("IS_TEST")||Be().getBool("PROD")||console.log(...e)}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const da=We("kernelRegistry",(()=>new Map)),fa=We("gradRegistry",(()=>new Map));function ha(e,t){const n=ka(e,t);return da.get(n)}function ma(e){return fa.get(e)}function ga(e){const t=da.entries(),n=[];for(;;){const{done:r,value:a}=t.next();if(r)break;const[o,s]=a,[i]=o.split("_");i===e&&n.push(s)}return n}function ya(e){const{kernelName:t,backendName:n}=e,r=ka(t,n);da.has(r)&&ca(`The kernel '${t}' for backend '${n}' is already registered`),da.set(r,e)}function ba(e){const{kernelName:t}=e;fa.has(t)&&Be().getBool("DEBUG")&&ca(`Overriding the gradient for '${t}'`),fa.set(t,e)}function va(e,t){const n=ka(e,t);if(!da.has(n))throw new Error(`The kernel '${e}' for backend '${t}' is not registered`);da.delete(n)}function wa(e){if(!fa.has(e))throw new Error(`The gradient '${e}' for backend is not registered`);fa.delete(e)}function xa(e,t){ga(e).forEach((e=>{ya(Object.assign({},e,{backendName:t}))}))}function ka(e,t){return`${t}_${e}`}
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Sa(e){return e instanceof Float32Array||e instanceof Int32Array||e instanceof Uint8Array||e instanceof Uint8ClampedArray}var Ea=n(3720);
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Na=n.n(Ea)()||Ea;function Ta(e){return Na.fromString(e,!0,16)}const _a=Ta("c3a5c85c97cb3127"),Aa=Ta("b492b66fbe98f273"),Ia=Ta("9ae16a3b2f90404f");function Ma(e){return e.xor(e.shru(47))}function Oa(e,t,n){const r=e.slice(t,t+n);return Na.fromBytes(Array.from(r),!0,!0)}function Da(e,t){return Oa(e,t,8)}function Ca(e,t){return Oa(e,t,4)}function $a(e,t){return 0===t?e:e.shru(t).or(e.shl(64-t))}function Ra(e,t,n=Ta("9ddfea08eb382d69")){let r=e.xor(t).mul(n);r=r.xor(r.shru(47));let a=t.xor(r).mul(n);return a=a.xor(a.shru(47)),a=a.mul(n),a}function Fa(e,t,n,r){return function(e,t,n,r,a,o){a=a.add(e),o=$a(o.add(a).add(r),21);const s=a;return a=(a=a.add(t)).add(n),o=o.add($a(a,44)),[a.add(r),o.add(s)]}(Da(e,t),Da(e,t+8),Da(e,t+16),Da(e,t+24),n,r)}function Pa(e,t=e.length){const n=Na.fromNumber(81,!0);if(t<=32)return t<=16?function(e,t=e.length){if(t>=8){const n=Ia.add(2*t),r=Da(e,0).add(Ia),a=Da(e,t-8);return Ra($a(a,37).mul(n).add(r),$a(r,25).add(a).mul(n),n)}if(t>=4){const n=Ia.add(2*t);return Ra(Ca(e,0).shl(3).add(t),Ca(e,t-4),n)}if(t>0){const n=e[0]+(e[t>>1]<<8),r=t+(e[t-1]<<2);return Ma(Ia.mul(n).xor(_a.mul(r))).mul(Ia)}return Ia}(e,t):function(e,t=e.length){const n=Ia.add(2*t),r=Da(e,0).mul(Aa),a=Da(e,8),o=Da(e,t-8).mul(n),s=Da(e,t-16).mul(Ia);return Ra($a(r.add(a),43).add($a(o,30)).add(s),r.add($a(a.add(Ia),18)).add(o),n)}(e,t);if(t<=64)return function(e,t=e.length){const n=Ia.add(2*t),r=Da(e,0).mul(Ia),a=Da(e,8),o=Da(e,t-8).mul(n),s=Da(e,t-16).mul(Ia),i=$a(r.add(a),43).add($a(o,30)).add(s),u=Ra(i,r.add($a(a.add(Ia),18)).add(o),n),l=Da(e,16).mul(n),c=Da(e,24),p=i.add(Da(e,t-32)).mul(n),d=u.add(Da(e,t-24)).mul(n);return Ra($a(l.add(c),43).add($a(p,30)).add(d),l.add($a(c.add(r),18)).add(p),n)}(e,t);let r=n,a=n.mul(Aa).add(113),o=Ma(a.mul(Ia).add(113)).mul(Ia),s=[Na.UZERO,Na.UZERO],i=[Na.UZERO,Na.UZERO];r=r.mul(Ia).add(Da(e,0));let u=0;const l=64*(t-1>>6),c=l+(t-1&63)-63;do{r=$a(r.add(a).add(s[0]).add(Da(e,u+8)),37).mul(Aa),a=$a(a.add(s[1]).add(Da(e,u+48)),42).mul(Aa),r=r.xor(i[1]),a=a.add(s[0]).add(Da(e,u+40)),o=$a(o.add(i[0]),33).mul(Aa),s=Fa(e,u,s[1].mul(Aa),r.add(i[0])),i=Fa(e,u+32,o.add(i[1]),a.add(Da(e,u+16))),[o,r]=[r,o],u+=64}while(u!==l);const p=Aa.add(o.and(255).shl(1));return u=c,i[0]=i[0].add(t-1&63),s[0]=s[0].add(i[0]),i[0]=i[0].add(s[0]),r=$a(r.add(a).add(s[0]).add(Da(e,u+8)),37).mul(p),a=$a(a.add(s[1]).add(Da(e,u+48)),42).mul(p),r=r.xor(i[1].mul(9)),a=a.add(s[0].mul(9).add(Da(e,u+40))),o=$a(o.add(i[0]),33).mul(p),s=Fa(e,u,s[1].mul(p),r.add(i[0])),i=Fa(e,u+32,o.add(i[1]),a.add(Da(e,u+16))),[o,r]=[r,o],Ra(Ra(s[0],i[0],p).add(Ma(a).mul(_a)).add(o),Ra(s[1],i[1],p).add(r),p)}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function La(e,t){return"string"===t?Ua(e):za([e],t)}function za(e,t){if("string"===t)throw new Error("Cannot convert a string[] to a TypedArray");if(Array.isArray(e)&&(e=Ha(e)),Be().getBool("DEBUG")&&me(e,t),function(e,t){return e instanceof Float32Array&&"float32"===t||e instanceof Int32Array&&"int32"===t||e instanceof Uint8Array&&"bool"===t}(e,t))return e;if(null==t||"float32"===t||"complex64"===t)return new Float32Array(e);if("int32"===t)return new Int32Array(e);if("bool"===t){const t=new Uint8Array(e.length);for(let n=0;n<t.length;++n)0!==Math.round(e[n])&&(t[n]=1);return t}throw new Error(`Unknown data type ${t}`)}function Ba(){return Be().platform.now()}function Va(e,t){return Be().platform.fetch(e,t)}function Ua(e,t="utf-8"){return t=t||"utf-8",Be().platform.encode(e,t)}function ja(e,t="utf-8"){return t=t||"utf-8",Be().platform.decode(e,t)}function Wa(e){return null!=Be().platform.isTypedArray?Be().platform.isTypedArray(e):Sa(e)}function Ha(e,t=[],n=!1){if(null==t&&(t=[]),"boolean"==typeof e||"number"==typeof e||"string"==typeof e||Fe(e)||null==e||Wa(e)&&n)t.push(e);else if(Array.isArray(e)||Wa(e))for(let r=0;r<e.length;++r)Ha(e[r],t,n);else{let r=-1;for(const t of Object.keys(e))/^([1-9]+[0-9]*|0)$/.test(t)&&(r=Math.max(r,Number(t)));for(let a=0;a<=r;a++)Ha(e[a],t,n)}return t}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class qa{constructor(e,t){this.backendTimer=e,this.logger=t,null==t&&(this.logger=new Ka)}profileKernel(e,t,n){let r;const a=()=>{r=n()};let o;const s=Ba();if(this.backendTimer.timerAvailable())o=this.backendTimer.time(a);else{a();for(const e of r)e.dataSync();o=Promise.resolve({kernelMs:Ba()-s})}if(Be().getBool("CHECK_COMPUTATION_FOR_ERRORS"))for(let t=0;t<r.length;t++){const n=r[t];n.data().then((t=>{Ga(t,n.dtype,e)}))}return{kernelName:e,outputs:r,inputs:t,timeMs:o.then((e=>e.kernelMs)),extraInfo:o.then((e=>null!=e.getExtraProfileInfo?e.getExtraProfileInfo():""))}}logKernelProfile(e){const{kernelName:t,outputs:n,timeMs:r,inputs:a,extraInfo:o}=e;n.forEach((e=>{Promise.all([e.data(),r,o]).then((n=>{this.logger.logKernelProfile(t,e,n[0],n[1],a,n[2])}))}))}}function Ga(e,t,n){if("float32"!==t)return!1;for(let t=0;t<e.length;t++){const r=e[t];if(isNaN(r)||!isFinite(r))return console.warn(`Found ${r} in the result of '${n}'`),!0}return!1}class Ka{logKernelProfile(e,t,n,r,a,o){const s="number"==typeof r?ue(`${r}ms`,9):r.error,i=ue(e,25),u=t.rank,l=t.size,c=ue(t.shape.toString(),14);let p="";for(const e in a){const n=a[e];if(null!=n){const r=n.shape||t.shape,a=r.length;p+=`${e}: ${a}D ${a>0?r:""} `}}console.log(`%c${i}\t%c${s}\t%c${u}D ${c}\t%c${l}\t%c${p}\t%c${o}`,"font-weight:bold","color:red","color:blue","color: orange","color: green","color: steelblue")}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Qa=20,Ya=3,Xa=7;function Za(e,t,n,r){const a=Te(t),o=function(e,t,n,r){const a=ee(t),o=r[r.length-1],s=new Array(o).fill(0),i=t.length,u="complex64"===n?no(e):e;if(i>1)for(let e=0;e<a/o;e++){const t=e*o;for(let e=0;e<o;e++)s[e]=Math.max(s[e],Ja(u[t+e],0,n).length)}return s}(e,t,n,a),s=t.length,i=to(e,t,n,a,o),u=["Tensor"];return r&&(u.push(`  dtype: ${n}`),u.push(`  rank: ${s}`),u.push(`  shape: [${t}]`),u.push("  values:")),u.push(i.map((e=>"    "+e)).join("\n")),u.join("\n")}function Ja(e,t,n){let r;return r=Array.isArray(e)?`${parseFloat(e[0].toFixed(Xa))} + ${parseFloat(e[1].toFixed(Xa))}j`:we(e)?`'${e}'`:"bool"===n?eo(e):parseFloat(e.toFixed(Xa)).toString(),ue(r,t)}function eo(e){return 0===e?"false":"true"}function to(e,t,n,r,a,o=!0){const s="complex64"===n?2:1,i=t[0],u=t.length;if(0===u){if("complex64"===n){return[Ja(no(e)[0],0,n)]}return"bool"===n?[eo(e[0])]:[e[0].toString()]}if(1===u){if(i>Qa){const t=Ya*s;let r=Array.from(e.slice(0,t)),o=Array.from(e.slice((i-Ya)*s,i*s));return"complex64"===n&&(r=no(r),o=no(o)),["["+r.map(((e,t)=>Ja(e,a[t],n))).join(", ")+", ..., "+o.map(((e,t)=>Ja(e,a[i-Ya+t],n))).join(", ")+"]"]}return["["+("complex64"===n?no(e):Array.from(e)).map(((e,t)=>Ja(e,a[t],n))).join(", ")+"]"]}const l=t.slice(1),c=r.slice(1),p=r[0]*s,d=[];if(i>Qa){for(let t=0;t<Ya;t++){const r=t*p,o=r+p;d.push(...to(e.slice(r,o),l,n,c,a,!1))}d.push("...");for(let t=i-Ya;t<i;t++){const r=t*p,o=r+p;d.push(...to(e.slice(r,o),l,n,c,a,t===i-1))}}else for(let t=0;t<i;t++){const r=t*p,o=r+p;d.push(...to(e.slice(r,o),l,n,c,a,t===i-1))}const f=2===u?",":"";d[0]="["+(i>0?d[0]+f:"");for(let e=1;e<d.length-1;e++)d[e]=" "+d[e]+f;let h=",\n";for(let e=2;e<u;e++)h+="\n";return d[d.length-1]=" "+d[d.length-1]+"]"+(o?"":h),d}function no(e){const t=[];for(let n=0;n<e.length;n+=2)t.push([e[n],e[n+1]]);return t}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ro{constructor(e,t,n){if(this.dtype=t,this.shape=e.slice(),this.size=ee(e),null!=n){const e=n.length;X(e===this.size,(()=>`Length of values '${e}' does not match the size inferred by the shape '${this.size}'.`))}if("complex64"===t)throw new Error("complex64 dtype TensorBuffers are not supported. Please create a TensorBuffer for the real and imaginary parts separately and call tf.complex(real, imag).");this.values=n||he(t,this.size),this.strides=Te(e)}set(e,...t){0===t.length&&(t=[0]),X(t.length===this.rank,(()=>`The number of provided coordinates (${t.length}) must match the rank (${this.rank})`));const n=this.locToIndex(t);this.values[n]=e}get(...e){0===e.length&&(e=[0]);let t=0;for(const n of e){if(n<0||n>=this.shape[t]){const t=`Requested out of range element at ${e}.   Buffer shape=${this.shape}`;throw new Error(t)}t++}let n=e[e.length-1];for(let t=0;t<e.length-1;++t)n+=this.strides[t]*e[t];return this.values[n]}locToIndex(e){if(0===this.rank)return 0;if(1===this.rank)return e[0];let t=e[e.length-1];for(let n=0;n<e.length-1;++n)t+=this.strides[n]*e[n];return t}indexToLoc(e){if(0===this.rank)return[];if(1===this.rank)return[e];const t=new Array(this.shape.length);for(let n=0;n<t.length-1;++n)t[n]=Math.floor(e/this.strides[n]),e-=t[n]*this.strides[n];return t[t.length-1]=e,t}get rank(){return this.shape.length}toTensor(){return ao().makeTensor(this.values,this.shape,this.dtype)}}let ao=null,oo=null,so=null;class io{constructor(e,t,n,r){this.kept=!1,this.isDisposedInternal=!1,this.shape=e.slice(),this.dtype=t||"float32",this.size=ee(e),this.strides=Te(e),this.dataId=n,this.id=r,this.rankType=this.rank<5?this.rank.toString():"higher"}get rank(){return this.shape.length}async buffer(){const e=await this.data();return oo.buffer(this.shape,this.dtype,e)}bufferSync(){return oo.buffer(this.shape,this.dtype,this.dataSync())}async array(){const e=await this.data();return Ae(this.shape,e,"complex64"===this.dtype)}arraySync(){return Ae(this.shape,this.dataSync(),"complex64"===this.dtype)}async data(){this.throwIfDisposed();const e=ao().read(this.dataId);if("string"===this.dtype){const t=await e;try{return t.map((e=>ja(e)))}catch(e){throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}}return e}dataToGPU(e){return this.throwIfDisposed(),ao().readToGPU(this.dataId,e)}dataSync(){this.throwIfDisposed();const e=ao().readSync(this.dataId);if("string"===this.dtype)try{return e.map((e=>ja(e)))}catch(e){throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}return e}async bytes(){this.throwIfDisposed();const e=await ao().read(this.dataId);return"string"===this.dtype?e:new Uint8Array(e.buffer)}dispose(){this.isDisposed||(this.kerasMask&&this.kerasMask.dispose(),ao().disposeTensor(this),this.isDisposedInternal=!0)}get isDisposed(){return this.isDisposedInternal}throwIfDisposed(){if(this.isDisposed)throw new Error("Tensor is disposed.")}print(e=!1){return oo.print(this,e)}clone(){return this.throwIfDisposed(),oo.clone(this)}toString(e=!1){return Za(this.dataSync(),this.shape,this.dtype,e)}cast(e){return this.throwIfDisposed(),oo.cast(this,e)}variable(e=!0,t,n){return this.throwIfDisposed(),ao().makeVariable(this,e,t,n)}}function uo(){return We("Tensor",(()=>io))}Object.defineProperty(io,Symbol.hasInstance,{value:e=>!!e&&null!=e.data&&null!=e.dataSync&&null!=e.throwIfDisposed}),uo();class lo extends io{constructor(e,t,n,r){super(e.shape,e.dtype,e.dataId,r),this.trainable=t,this.name=n}assign(e){if(e.dtype!==this.dtype)throw new Error(`dtype of the new value (${e.dtype}) and previous value (${this.dtype}) must match`);if(!re(e.shape,this.shape))throw new Error(`shape of the new value (${e.shape}) and previous value (${this.shape}) must match`);ao().disposeTensor(this),this.dataId=e.dataId,ao().incRef(this,null)}dispose(){ao().disposeVariable(this),this.isDisposedInternal=!0}}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var co,po,fo,ho,mo;Object.defineProperty(lo,Symbol.hasInstance,{value:e=>e instanceof io&&null!=e.assign&&e.assign instanceof Function}),function(e){e.R0="R0",e.R1="R1",e.R2="R2",e.R3="R3",e.R4="R4",e.R5="R5",e.R6="R6"}(co||(co={})),function(e){e.float32="float32",e.int32="int32",e.bool="int32",e.complex64="complex64"}(po||(po={})),function(e){e.float32="float32",e.int32="int32",e.bool="bool",e.complex64="complex64"}(fo||(fo={})),function(e){e.float32="float32",e.int32="float32",e.bool="float32",e.complex64="complex64"}(ho||(ho={})),function(e){e.float32="complex64",e.int32="complex64",e.bool="complex64",e.complex64="complex64"}(mo||(mo={}));const go={float32:ho,int32:po,bool:fo,complex64:mo};function yo(e,t){if("string"===e||"string"===t){if("string"===e&&"string"===t)return"string";throw new Error(`Can not upcast ${e} with ${t}`)}return go[e][t]}function bo(e){return yo(e,"int32")}function vo(e){return null!=e&&"object"==typeof e&&"texture"in e&&e.texture instanceof WebGLTexture}function wo(e){return"undefined"!=typeof GPUBuffer&&null!=e&&"object"==typeof e&&"buffer"in e&&e.buffer instanceof GPUBuffer}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xo(e,t){if(e.dtype===t.dtype)return[e,t];const n=yo(e.dtype,t.dtype);return[e.cast(n),t.cast(n)]}function ko(e,t){X(e.dtype===t.dtype,(()=>`The dtypes of the first(${e.dtype}) and second(${t.dtype}) input must match`))}function So(e,t){return t.some((t=>t.id===e.id))}function Eo(e){const t=[];return No(e,t,new Set),t}function No(e,t,n){if(null==e)return;if(e instanceof io)return void t.push(e);if(r=e,!Array.isArray(r)&&"object"!=typeof r)return;var r;const a=e;for(const e in a){const r=a[e];n.has(r)||(n.add(r),No(r,t,n))}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function To(e){return null!=e.kernelName}class _o{constructor(){this.registeredVariables={},this.nextTapeNodeId=0,this.numBytes=0,this.numTensors=0,this.numStringTensors=0,this.numDataBuffers=0,this.gradientDepth=0,this.kernelDepth=0,this.scopeStack=[],this.numDataMovesStack=[],this.nextScopeId=0,this.tensorInfo=new WeakMap,this.profiling=!1,this.activeProfile={newBytes:0,newTensors:0,peakBytes:0,kernels:[],result:null,get kernelNames(){return Array.from(new Set(this.kernels.map((e=>e.name))))}}}dispose(){for(const e in this.registeredVariables)this.registeredVariables[e].dispose()}}class Ao{constructor(e){this.ENV=e,this.registry={},this.registryFactory={},this.pendingBackendInitId=0,this.state=new _o}async ready(){if(null!=this.pendingBackendInit)return this.pendingBackendInit.then((()=>{}));if(null!=this.backendInstance)return;const e=this.getSortedBackends();for(let t=0;t<e.length;t++){const n=e[t];if(await this.initializeBackend(n).success)return void await this.setBackend(n)}throw new Error("Could not initialize any backends, all backend initializations failed.")}get backend(){if(null!=this.pendingBackendInit)throw new Error(`Backend '${this.backendName}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);if(null==this.backendInstance){const{name:e,asyncInit:t}=this.initializeBackendsAndReturnBest();if(t)throw new Error(`The highest priority backend '${e}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);this.setBackend(e)}return this.backendInstance}backendNames(){return Object.keys(this.registryFactory)}findBackend(e){if(!(e in this.registry)){if(!(e in this.registryFactory))return null;{const{asyncInit:t}=this.initializeBackend(e);if(t)return null}}return this.registry[e]}findBackendFactory(e){return e in this.registryFactory?this.registryFactory[e].factory:null}registerBackend(e,t,n=1){return e in this.registryFactory?(ca(`${e} backend was already registered. Reusing existing backend factory.`),!1):(this.registryFactory[e]={factory:t,priority:n},!0)}async setBackend(e){if(null==this.registryFactory[e])throw new Error(`Backend name '${e}' not found in registry`);if(this.backendName=e,null==this.registry[e]){this.backendInstance=null;const{success:t,asyncInit:n}=this.initializeBackend(e);if(!(n?await t:t))return!1}return this.backendInstance=this.registry[e],this.setupRegisteredKernels(),this.profiler=new qa(this.backendInstance),!0}setupRegisteredKernels(){ga(this.backendName).forEach((e=>{null!=e.setupFunc&&e.setupFunc(this.backendInstance)}))}disposeRegisteredKernels(e){ga(e).forEach((t=>{null!=t.disposeFunc&&t.disposeFunc(this.registry[e])}))}initializeBackend(e){const t=this.registryFactory[e];if(null==t)throw new Error(`Cannot initialize backend ${e}, no registration found.`);try{const n=t.factory();if(!n||n instanceof V||"function"!=typeof n.then)return this.registry[e]=n,{success:!0,asyncInit:!1};{const t=++this.pendingBackendInitId,r=n.then((n=>!(t<this.pendingBackendInitId)&&(this.registry[e]=n,this.pendingBackendInit=null,!0))).catch((n=>(t<this.pendingBackendInitId||(this.pendingBackendInit=null,ca(`Initialization of backend ${e} failed`),ca(n.stack||n.message)),!1)));return this.pendingBackendInit=r,{success:r,asyncInit:!0}}}catch(t){return ca(`Initialization of backend ${e} failed`),ca(t.stack||t.message),{success:!1,asyncInit:!1}}}removeBackend(e){if(!(e in this.registryFactory))throw new Error(`${e} backend not found in registry`);this.backendName===e&&null!=this.pendingBackendInit&&this.pendingBackendInitId++,e in this.registry&&(this.disposeRegisteredKernels(e),this.registry[e].dispose(),delete this.registry[e]),delete this.registryFactory[e],this.backendName===e&&(this.pendingBackendInit=null,this.backendName=null,this.backendInstance=null)}getSortedBackends(){if(0===Object.keys(this.registryFactory).length)throw new Error("No backend found in registry.");return Object.keys(this.registryFactory).sort(((e,t)=>this.registryFactory[t].priority-this.registryFactory[e].priority))}initializeBackendsAndReturnBest(){const e=this.getSortedBackends();for(let t=0;t<e.length;t++){const n=e[t],{success:r,asyncInit:a}=this.initializeBackend(n);if(a||r)return{name:n,asyncInit:a}}throw new Error("Could not initialize any backends, all backend initializations failed.")}moveData(e,t){const n=this.state.tensorInfo.get(t),r=n.backend,a=this.readSync(t),o=r.refCount(t);r.disposeData(t,!0),n.backend=e,e.move(t,a,n.shape,n.dtype,o),this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack[this.state.numDataMovesStack.length-1]++}tidy(e,t){let n,r=null;if(null==t){if("function"!=typeof e)throw new Error("Please provide a function to tidy()");t=e}else{if("string"!=typeof e&&!(e instanceof String))throw new Error("When calling with two arguments, the first argument to tidy() must be a string");if("function"!=typeof t)throw new Error("When calling with two arguments, the 2nd argument to tidy() must be a function");r=e}return this.scopedRun((()=>this.startScope(r)),(()=>this.endScope(n)),(()=>(n=t(),n instanceof Promise&&console.error("Cannot return a Promise inside of tidy."),n)))}scopedRun(e,t,n){e();try{const e=n();return t(),e}catch(e){throw t(),e}}nextTensorId(){return Ao.nextTensorId++}nextVariableId(){return Ao.nextVariableId++}clone(e){const t=Mo.runKernel(un,{x:e}),n={x:e};return this.addTapeNode(this.state.activeScope.name,n,[t],(e=>({x:()=>{const t={x:e},n={dtype:"float32"};return Mo.runKernel(mt,t,n)}})),[],{}),t}runKernel(e,t,n){null==this.backendName&&this.backend;if(!(null!=ha(e,this.backendName)))throw new Error(`Kernel '${e}' not registered for backend '${this.backendName}'`);return this.runKernelFunc({kernelName:e,inputs:t,attrs:n})}shouldCheckForMemLeaks(){return this.ENV.getBool("IS_TEST")}checkKernelForMemLeak(e,t,n){const r=this.backend.numDataIds();let a=0;n.forEach((e=>{a+="complex64"===e.dtype?3:1}));const o=this.state.numDataMovesStack[this.state.numDataMovesStack.length-1],s=r-t-a-o;if(s>0)throw new Error(`Backend '${this.backendName}' has an internal memory leak (${s} data ids) after running '${e}'`)}runKernelFunc(e){let t,n=[];const r=this.isTapeOn(),a=this.state.numBytes,o=this.state.numTensors;let s,i;this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack.push(0),null==this.backendName&&this.backend;const u=To(e)?e.kernelName:null!=this.state.activeScope?this.state.activeScope.name:"";if(To(e)){const{kernelName:t,inputs:a,attrs:o}=e;null==this.backendName&&this.backend;const u=ha(t,this.backendName);X(null!=u,(()=>`Cannot find registered kernel '${t}' for backend '${this.backendName}'`)),s=()=>{const e=this.backend.numDataIds();i=u.kernelFunc({inputs:a,attrs:o,backend:this.backend});const s=Array.isArray(i)?i:[i];this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(t,e,s);const l=s.map((e=>null!=e.rank?e:this.makeTensorFromTensorInfo(e)));if(r){const e=this.getTensorsForGradient(t,a,l);n=this.saveTensorsForBackwardMode(e)}return l}}else{const{forwardFunc:t}=e,a=e=>{r&&(n=e.map((e=>this.keep(this.clone(e)))))};s=()=>{const e=this.backend.numDataIds();i=this.tidy((()=>t(this.backend,a)));const n=Array.isArray(i)?i:[i];return this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(u,e,n),n}}const{inputs:l,attrs:c}=e,p=To(e)?null:e.backwardsFunc;let d;return this.scopedRun((()=>this.state.kernelDepth++),(()=>this.state.kernelDepth--),(()=>{this.ENV.getBool("DEBUG")||this.state.profiling?(d=this.profiler.profileKernel(u,l,(()=>s())),this.ENV.getBool("DEBUG")&&this.profiler.logKernelProfile(d),t=d.outputs):t=s()})),r&&this.addTapeNode(u,l,t,p,n,c),this.state.profiling&&this.state.activeProfile.kernels.push({name:u,bytesAdded:this.state.numBytes-a,totalBytesSnapshot:this.state.numBytes,tensorsAdded:this.state.numTensors-o,totalTensorsSnapshot:this.state.numTensors,inputShapes:Object.keys(l).map((e=>null!=l[e]?l[e].shape:null)),outputShapes:t.map((e=>e.shape)),kernelTimeMs:d.timeMs,extraInfo:d.extraInfo}),Array.isArray(i)?t:t[0]}saveTensorsForBackwardMode(e){const t=e.map((e=>this.keep(this.clone(e))));return t}getTensorsForGradient(e,t,n){const r=ma(e);if(null!=r){const e=r.inputsToSave||[],a=r.outputsToSave||[];let o;r.saveAllInputs?(X(Array.isArray(t),(()=>"saveAllInputs is true, expected inputs to be an array.")),o=Object.keys(t).map((e=>t[e]))):o=e.map((e=>t[e]));const s=n.filter(((e,t)=>a[t]));return o.concat(s)}return[]}makeTensor(e,t,n,r){if(null==e)throw new Error("Values passed to engine.makeTensor() are null");n=n||"float32",r=r||this.backend;let a=e;"string"===n&&we(e[0])&&(a=e.map((e=>Ua(e))));const o=r.write(a,t,n),s=new io(t,n,o,this.nextTensorId());if(this.trackTensor(s,r),"string"===n){const e=this.state.tensorInfo.get(o),t=ve(a);this.state.numBytes+=t-e.bytes,e.bytes=t}return s}makeTensorFromDataId(e,t,n,r){const a={dataId:e,shape:t,dtype:n=n||"float32"};return this.makeTensorFromTensorInfo(a,r)}makeTensorFromTensorInfo(e,t){const{dataId:n,shape:r,dtype:a}=e,o=new io(r,a,n,this.nextTensorId());return this.trackTensor(o,t),o}makeVariable(e,t=!0,n,r){n=n||this.nextVariableId().toString(),null!=r&&r!==e.dtype&&(e=e.cast(r));const a=new lo(e,t,n,this.nextTensorId());if(null!=this.state.registeredVariables[a.name])throw new Error(`Variable with name ${a.name} was already registered`);return this.state.registeredVariables[a.name]=a,this.incRef(a,this.backend),a}trackTensor(e,t){this.state.numTensors++,"string"===e.dtype&&this.state.numStringTensors++;let n=0;"complex64"!==e.dtype&&"string"!==e.dtype&&(n=e.size*be(e.dtype)),this.state.numBytes+=n,this.state.tensorInfo.has(e.dataId)||(this.state.numDataBuffers++,this.state.tensorInfo.set(e.dataId,{backend:t||this.backend,dtype:e.dtype,shape:e.shape,bytes:n})),e instanceof lo||this.track(e)}incRef(e,t){this.trackTensor(e,t),this.backend.incRef(e.dataId)}removeDataId(e,t){this.state.tensorInfo.has(e)&&this.state.tensorInfo.get(e).backend===t&&(this.state.tensorInfo.delete(e),this.state.numDataBuffers--)}disposeTensor(e){if(!this.state.tensorInfo.has(e.dataId))return;const t=this.state.tensorInfo.get(e.dataId);if(this.state.numTensors--,"string"===e.dtype&&(this.state.numStringTensors--,this.state.numBytes-=t.bytes),"complex64"!==e.dtype&&"string"!==e.dtype){const t=e.size*be(e.dtype);this.state.numBytes-=t}t.backend.disposeData(e.dataId)&&this.removeDataId(e.dataId,t.backend)}disposeVariables(){for(const e in this.state.registeredVariables){const t=this.state.registeredVariables[e];this.disposeVariable(t)}}disposeVariable(e){this.disposeTensor(e),null!=this.state.registeredVariables[e.name]&&delete this.state.registeredVariables[e.name]}memory(){const e=this.backend.memory();return e.numTensors=this.state.numTensors,e.numDataBuffers=this.state.numDataBuffers,e.numBytes=this.state.numBytes,this.state.numStringTensors>0&&(e.unreliable=!0,null==e.reasons&&(e.reasons=[]),e.reasons.push("Memory usage by string tensors is approximate (2 bytes per character)")),e}async profile(e){this.state.profiling=!0;const t=this.state.numBytes,n=this.state.numTensors;this.state.activeProfile.kernels=[],this.state.activeProfile.result=await e(),this.state.profiling=!1,this.state.activeProfile.peakBytes=Math.max(...this.state.activeProfile.kernels.map((e=>e.totalBytesSnapshot))),this.state.activeProfile.newBytes=this.state.numBytes-t,this.state.activeProfile.newTensors=this.state.numTensors-n;for(const e of this.state.activeProfile.kernels)e.kernelTimeMs=await e.kernelTimeMs,e.extraInfo=await e.extraInfo;return this.state.activeProfile}isTapeOn(){return this.state.gradientDepth>0&&0===this.state.kernelDepth}addTapeNode(e,t,n,r,a,o){const s={id:this.state.nextTapeNodeId++,kernelName:e,inputs:t,outputs:n,saved:a},i=ma(e);null!=i&&(r=i.gradFunc),null!=r&&(s.gradient=e=>(e=e.map(((e,t)=>{if(null==e){const e=n[t],r=Oe(e.size,e.dtype);return this.makeTensor(r,e.shape,e.dtype)}return e})),r(e.length>1?e:e[0],a,o))),this.state.activeTape.push(s)}keep(e){return e.kept=!0,e}startTape(){0===this.state.gradientDepth&&(this.state.activeTape=[]),this.state.gradientDepth++}endTape(){this.state.gradientDepth--}startScope(e){const t={track:[],name:"unnamed scope",id:this.state.nextScopeId++};e&&(t.name=e),this.state.scopeStack.push(t),this.state.activeScope=t}endScope(e){const t=Eo(e),n=new Set(t.map((e=>e.id)));for(let e=0;e<this.state.activeScope.track.length;e++){const t=this.state.activeScope.track[e];t.kept||n.has(t.id)||t.dispose()}const r=this.state.scopeStack.pop();this.state.activeScope=0===this.state.scopeStack.length?null:this.state.scopeStack[this.state.scopeStack.length-1],t.forEach((e=>{e.kept||e.scopeId!==r.id||this.track(e)}))}gradients(e,t,n,r=!1){if(X(t.length>0,(()=>"gradients() received an empty list of xs.")),null!=n&&"float32"!==n.dtype)throw new Error(`dy must have 'float32' dtype, but has '${n.dtype}'`);const a=this.scopedRun((()=>this.startTape()),(()=>this.endTape()),(()=>this.tidy("forward",e)));X(a instanceof io,(()=>"The result y returned by f() must be a tensor."));const o=
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r={},a={};for(let e=0;e<t.length;e++)r[t[e].id]=!0;for(let n=0;n<e.length;n++){const o=e[n],s=o.inputs;for(const e in s){const n=s[e];let i=!1;for(let e=0;e<t.length;e++)if(r[n.id]){o.outputs.forEach((e=>r[e.id]=!0)),i=!0,a[o.id]=!0;break}if(i)break}}const o={};o[n.id]=!0;const s={};for(let t=e.length-1;t>=0;t--){const n=e[t],r=n.inputs;for(let e=0;e<n.outputs.length;e++)if(o[n.outputs[e].id]){for(const e in r)o[r[e].id]=!0,s[n.id]=!0;break}}const i=[];for(let t=0;t<e.length;t++){const n=e[t];if(a[n.id]&&s[n.id]){const e={};for(const t in n.inputs){const a=n.inputs[t];r[a.id]&&(e[t]=a)}const t=Object.assign({},n);t.inputs=e,t.outputs=n.outputs,i.push(t)}}return i}(this.state.activeTape,t,a);if(!r&&0===o.length&&t.length>0)throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that the f you passed encloses all operations that lead from x to y.");return this.tidy("backward",(()=>{const e={};e[a.id]=null==n?function(e){const t=Me(ee(e),"float32");return Mo.makeTensor(t,e,"float32")}(a.shape):n,function(e,t,n,r){for(let a=t.length-1;a>=0;a--){const o=t[a],s=[];if(o.outputs.forEach((t=>{const n=e[t.id];null!=n?s.push(n):s.push(null)})),null==o.gradient)throw new Error(`Cannot compute gradient: gradient function not found for ${o.kernelName}.`);const i=o.gradient(s);for(const t in o.inputs){if(!(t in i))throw new Error(`Cannot backprop through input ${t}. Available gradients found: ${Object.keys(i)}.`);const a=n((()=>i[t]()));if("float32"!==a.dtype)throw new Error(`Error in gradient for op ${o.kernelName}. The gradient of input ${t} must have 'float32' dtype, but has '${a.dtype}'`);const s=o.inputs[t];if(!re(a.shape,s.shape))throw new Error(`Error in gradient for op ${o.kernelName}. The gradient of input '${t}' has shape '${a.shape}', which does not match the shape of the input '${s.shape}'`);if(null==e[s.id])e[s.id]=a;else{const t=e[s.id];e[s.id]=r(t,a),t.dispose()}}}}(e,o,(e=>this.tidy(e)),Oo);const r=t.map((t=>e[t.id]));return 0===this.state.gradientDepth&&(this.state.activeTape.forEach((e=>{for(const t of e.saved)t.dispose()})),this.state.activeTape=null),{value:a,grads:r}}))}customGrad(e){return X(Ee(e),(()=>"The f passed in customGrad(f) must be a function.")),(...t)=>{let n;X(t.every((e=>e instanceof io)),(()=>"The args passed in customGrad(f)(x1, x2,...) must all be tensors"));const r={};t.forEach(((e,t)=>{r[t]=e}));return this.runKernelFunc({forwardFunc:(r,a)=>(n=e(...t,a),X(n.value instanceof io,(()=>"The function f passed in customGrad(f) must return an object where `obj.value` is a tensor")),X(Ee(n.gradFunc),(()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function.")),n.value),backwardsFunc:(e,r)=>{const a=n.gradFunc(e,r),o=Array.isArray(a)?a:[a];X(o.length===t.length,(()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns the same number of tensors as inputs passed to f(...).")),X(o.every((e=>e instanceof io)),(()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns a list of only tensors."));const s={};return o.forEach(((e,t)=>{s[t]=()=>e})),s},inputs:r})}}readSync(e){return this.state.tensorInfo.get(e).backend.readSync(e)}read(e){return this.state.tensorInfo.get(e).backend.read(e)}readToGPU(e,t){return this.state.tensorInfo.get(e).backend.readToGPU(e,t)}async time(e){const t=Ba(),n=await this.backend.time(e);return n.wallMs=Ba()-t,n}track(e){return null!=this.state.activeScope&&(e.scopeId=this.state.activeScope.id,this.state.activeScope.track.push(e)),e}get registeredVariables(){return this.state.registeredVariables}reset(){this.pendingBackendInitId++,this.state.dispose(),this.ENV.reset(),this.state=new _o;for(const e in this.registry)this.disposeRegisteredKernels(e),this.registry[e].dispose(),delete this.registry[e];this.backendName=null,this.backendInstance=null,this.pendingBackendInit=null}}function Io(){const e=je();if(null==e._tfengine){const t=new Le(e);e._tfengine=new Ao(t)}var t;return t=e._tfengine.ENV,Ue=t,ao=()=>e._tfengine,e._tfengine}Ao.nextTensorId=0,Ao.nextVariableId=0;const Mo=Io();function Oo(e,t){const n={a:e,b:t};return Mo.runKernel(Ke,n)}let Do;function Co(e){Do=e}function $o(e){if(void 0!==Do)return Do;if(e||"undefined"!=typeof navigator&&null!=navigator){if(e||(e=navigator),"ReactNative"===e.product)return!0;const t=e.userAgent||e.vendor||("undefined"!=typeof window?window.opera:"");if(!t){const t=e;return t.userAgentData&&t.userAgentData.mobile}return/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(t)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(t.substr(0,4))}return!1}function Ro(){return"undefined"!=typeof window&&null!=window.document||"undefined"!=typeof WorkerGlobalScope}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Fo=Be();
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Po(e,t){let n=e;if(Wa(e))return"string"===t?[]:[e.length];if(vo(e)){const t=e.channels||"RGBA";return[e.height,e.width*t.length]}if(wo(e))return[e.buffer.size/(null==t?4:be(t))];if(!Array.isArray(e))return[];const r=[];for(;Array.isArray(n)||Wa(n)&&"string"!==t;)r.push(n.length),n=n[0];return Array.isArray(e)&&Be().getBool("TENSORLIKE_CHECK_SHAPE_CONSISTENCY")&&Lo(e,r,[]),r}function Lo(e,t,n){if(n=n||[],!Array.isArray(e)&&!Wa(e))return void X(0===t.length,(()=>`Element arr[${n.join("][")}] is a primitive, but should be an array/TypedArray of ${t[0]} elements`));X(t.length>0,(()=>`Element arr[${n.join("][")}] should be a primitive, but is an array of ${e.length} elements`)),X(e.length===t[0],(()=>`Element arr[${n.join("][")}] should have ${t[0]} elements, but has ${e.length} elements`));const r=t.slice(1);for(let t=0;t<e.length;++t)Lo(e[t],r,n.concat(t))}function zo(e,t,n,r){if("string_or_numeric"!==e){if(null==e)throw new Error("Expected dtype cannot be null.");if("numeric"!==e&&e!==t||"numeric"===e&&"string"===t)throw new Error(`Argument '${n}' passed to '${r}' must be ${e} tensor, but got ${t} tensor`)}}function Bo(e,t,n,r="numeric"){if(e instanceof uo())return zo(r,e.dtype,t,n),e;let a=Se(e);if("string"!==a&&["bool","int32","float32"].indexOf(r)>=0&&(a=r),zo(r,a,t,n),null==e||!Wa(e)&&!Array.isArray(e)&&"number"!=typeof e&&"boolean"!=typeof e&&"string"!=typeof e){const r=null==e?"null":e.constructor.name;throw new Error(`Argument '${t}' passed to '${n}' must be a Tensor or TensorLike, but got '${r}'`)}const o=Po(e,a);Wa(e)||Array.isArray(e)||(e=[e]);const s="string"!==a?za(e,a):Ha(e,[],!0);return Mo.makeTensor(s,o,a)}function Vo(e,t,n,r="numeric"){if(!Array.isArray(e))throw new Error(`Argument ${t} passed to ${n} must be a \`Tensor[]\` or \`TensorLike[]\``);return e.map(((e,a)=>Bo(e,`${t}[${a}]`,n,r)))}Fo.registerFlag("DEBUG",(()=>!1),(e=>{e&&console.warn("Debugging mode is ON. The output of every math call will be downloaded to CPU and checked for NaNs. This significantly impacts performance.")})),Fo.registerFlag("IS_BROWSER",(()=>Ro())),Fo.registerFlag("IS_NODE",(()=>"undefined"!=typeof process&&void 0!==process.versions&&void 0!==process.versions.node)),Fo.registerFlag("IS_CHROME",(()=>"undefined"!=typeof navigator&&null!=navigator&&null!=navigator.userAgent&&/Chrome/.test(navigator.userAgent)&&/Google Inc/.test(navigator.vendor))),Fo.registerFlag("IS_SAFARI",(()=>"undefined"!=typeof navigator&&null!=navigator&&null!=navigator.userAgent&&/Safari/.test(navigator.userAgent)&&/Apple/.test(navigator.vendor))),Fo.registerFlag("PROD",(()=>!1)),Fo.registerFlag("TENSORLIKE_CHECK_SHAPE_CONSISTENCY",(()=>Fo.getBool("DEBUG"))),Fo.registerFlag("DEPRECATION_WARNINGS_ENABLED",(()=>!0)),Fo.registerFlag("IS_TEST",(()=>!1)),Fo.registerFlag("CHECK_COMPUTATION_FOR_ERRORS",(()=>Fo.getBool("DEBUG"))),Fo.registerFlag("WRAP_TO_IMAGEBITMAP",(()=>!1)),Fo.registerFlag("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU",(()=>!1)),Fo.registerFlag("USE_SETTIMEOUTCUSTOM",(()=>!1));
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Uo="__op";function jo(e){const t=Object.keys(e);if(1!==t.length)throw new Error(`Please provide an object with a single key (operation name) mapping to a function. Got an object with ${t.length} keys.`);let n=t[0];const r=e[n];n.endsWith("_")&&(n=n.substring(0,n.length-1)),n+=Uo;const a=(...e)=>{Mo.startScope(n);try{const t=r(...e);return Fe(t)&&console.error("Cannot return a Promise inside of tidy."),Mo.endScope(t),t}catch(e){throw Mo.endScope(null),e}};return Object.defineProperty(a,"name",{value:n,configurable:!0}),a}const Wo=jo({complex_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"real","complex"),r=Bo(t,"imag","complex");Z(n.shape,r.shape,`real and imag shapes, ${n.shape} and ${r.shape}, must match in call to tf.complex().`);const a={real:n,imag:r};return Mo.runKernel(bt,a)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ho(e,t,n,r){if(null==r)r=Se(e);else if("complex64"===r)throw new Error("Cannot construct a complex64 tensor directly. Please use tf.complex(real, imag).");if(wo(e)||vo(e)){if("float32"!==r&&"int32"!==r)throw new Error(`Creating tensor from GPU data only supports 'float32'|'int32' dtype, while the dtype is ${r}.`);return Mo.backend.createTensorFromGPUData(e,t||n,r)}if(!Wa(e)&&!Array.isArray(e)&&"number"!=typeof e&&"boolean"!=typeof e&&"string"!=typeof e)throw new Error("values passed to tensor(values) must be a number/boolean/string or an array of numbers/booleans/strings, or a TypedArray");if(null!=t){Ce(t);const e=ee(t),r=ee(n);X(e===r,(()=>`Based on the provided shape, [${t}], the tensor should have ${e} values but has ${r}`));for(let e=0;e<n.length;++e){const r=n[e],a=e!==n.length-1||r!==ee(t.slice(e));X(n[e]===t[e]||!a,(()=>`Error creating a new Tensor. Inferred shape (${n}) does not match the provided shape (${t}). `))}}return Wa(e)||Array.isArray(e)||(e=[e]),t=t||n,e="string"!==r?za(e,r):Ha(e,[],!0),Mo.makeTensor(e,t,r)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qo(e,t,n){return Ho(e,t,Po(e,n),n)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Go={float32:4,float16:2,int32:4,uint16:2,uint8:1,bool:1,complex64:8};class Ko{static join(e){return new Ko(e).slice()}constructor(e){if(this.shards=[],this.previousShardIndex=0,null==e)return;if(e instanceof Array||(e=[e]),0===(e=e.map((e=>Wa(e)?e.buffer:e))).length)return;this.bufferUniformSize=e[0].byteLength;let t=0;for(let n=0;n<e.length;n++){const r=e[n];n!==e.length-1&&r.byteLength!==this.bufferUniformSize&&(this.bufferUniformSize=void 0);const a=t+r.byteLength;this.shards.push({buffer:r,start:t,end:a}),t=a}0===this.shards.length&&(this.byteLength=0),this.byteLength=this.shards[this.shards.length-1].end}slice(e=0,t=this.byteLength){if(0===this.shards.length)return new ArrayBuffer(0);if(e=isNaN(Number(e))?0:e,t=isNaN(Number(t))?0:t,e=Math.max(0,e),(t=Math.min(this.byteLength,t))<=e)return new ArrayBuffer(0);const n=this.findShardForByte(e);if(-1===n)throw new Error(`Could not find start shard for byte ${e}`);const r=new ArrayBuffer(t-e),a=new Uint8Array(r);let o=0;for(let r=n;r<this.shards.length;r++){const n=this.shards[r],s=e+o-n.start,i=o,u=Math.min(t,n.end)-n.start,l=new Uint8Array(n.buffer,s,u-s);if(a.set(l,i),o+=l.length,t<n.end)break}return r}findShardForByte(e){if(0===this.shards.length||e<0||e>=this.byteLength)return-1;if(null!=this.bufferUniformSize)return this.previousShardIndex=Math.floor(e/this.bufferUniformSize),this.previousShardIndex;function t(t){return e<t.start?-1:e>=t.end?1:0}if(0===t(this.shards[this.previousShardIndex]))return this.previousShardIndex;const n=function(e,t){let n=0,r=e.length;for(;n<=r;){const a=Math.floor((r-n)/2)+n,o=t(e[a]);if(0===o)return a;o<0?r=a:n=a+1}return-1}(this.shards,t);return-1===n?-1:(this.previousShardIndex=n,this.previousShardIndex)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Qo=4;async function Yo(e,t){const n=[],r=[],a=Array.isArray(e)?e.map((e=>e.name)):Object.keys(e);for(let o=0;o<a.length;++o){const s=a[o],i=Array.isArray(e)?e[o].tensor:e[s];if("float32"!==i.dtype&&"int32"!==i.dtype&&"bool"!==i.dtype&&"string"!==i.dtype&&"complex64"!==i.dtype)throw new Error(`Unsupported dtype in weight '${s}': ${i.dtype}`);const u={name:s,shape:i.shape,dtype:i.dtype};if("string"===i.dtype){const e=new Promise((async e=>{const t=await i.bytes(),n=t.reduce(((e,t)=>e+t.length),0)+Qo*t.length,r=new Uint8Array(n);let a=0;for(let e=0;e<t.length;e++){const n=t[e],o=new Uint8Array(new Uint32Array([n.length]).buffer);r.set(o,a),a+=Qo,r.set(n,a),a+=n.length}e(r)}));r.push(e)}else r.push(i.data());null!=t&&(u.group=t),n.push(u)}return{data:Zo(await Promise.all(r)),specs:n}}function Xo(e,t){const n=new Ko(e),r={};let a,o=0;for(const e of t){const t=e.name,s=e.dtype,i=e.shape,u=ee(i);let l;if("quantization"in e){const r=e.quantization;if("uint8"===r.dtype||"uint16"===r.dtype){if(!("min"in r)||!("scale"in r))throw new Error(`Weight ${e.name} with quantization ${r.dtype} doesn't have corresponding metadata min and scale.`)}else{if("float16"!==r.dtype)throw new Error(`Weight ${e.name} has unknown quantization dtype ${r.dtype}. Supported quantization dtypes are: 'uint8', 'uint16', and 'float16'.`);if("float32"!==s)throw new Error(`Weight ${e.name} is quantized with ${r.dtype} which only supports weights of type float32 not ${s}.`)}const i=Go[r.dtype],c=n.slice(o,o+u*i),p="uint8"===r.dtype?new Uint8Array(c):new Uint16Array(c);if("float32"===s)if("uint8"===r.dtype||"uint16"===r.dtype){l=new Float32Array(p.length);for(let e=0;e<p.length;e++){const t=p[e];l[e]=t*r.scale+r.min}}else{if("float16"!==r.dtype)throw new Error(`Unsupported quantization type ${r.dtype} for weight type float32.`);void 0===a&&(a=us()),l=a(p)}else{if("int32"!==s)throw new Error(`Unsupported dtype in weight '${t}': ${s}`);if("uint8"!==r.dtype&&"uint16"!==r.dtype)throw new Error(`Unsupported quantization type ${r.dtype} for weight type int32.`);l=new Int32Array(p.length);for(let e=0;e<p.length;e++){const t=p[e];l[e]=Math.round(t*r.scale+r.min)}}o+=u*i}else if("string"===s){const t=ee(e.shape);l=[];for(let e=0;e<t;e++){const e=new Uint32Array(n.slice(o,o+Qo))[0];o+=Qo;const t=new Uint8Array(n.slice(o,o+e));l.push(t),o+=e}}else{const e=Go[s],a=n.slice(o,o+u*e);if("float32"===s)l=new Float32Array(a);else if("int32"===s)l=new Int32Array(a);else if("bool"===s)l=new Uint8Array(a);else{if("complex64"!==s)throw new Error(`Unsupported dtype in weight '${t}': ${s}`);{l=new Float32Array(a);const e=new Float32Array(l.length/2),n=new Float32Array(l.length/2);for(let t=0;t<e.length;t++)e[t]=l[2*t],n[t]=l[2*t+1];const o=qo(e,i,"float32"),s=qo(n,i,"float32");r[t]=Wo(o,s),o.dispose(),s.dispose()}}o+=u*e}"complex64"!==s&&(r[t]=qo(l,i,s))}return r}function Zo(e){if(null===e)throw new Error(`Invalid input value: ${JSON.stringify(e)}`);let t=0;const n=[];e.forEach((e=>{if(t+=e.byteLength,n.push(e.byteLength===e.buffer.byteLength?e:new e.constructor(e)),!(e instanceof Float32Array||e instanceof Int32Array||e instanceof Uint8Array))throw new Error(`Unsupported TypedArray subtype: ${e.constructor.name}`)}));const r=new Uint8Array(t);let a=0;return n.forEach((e=>{r.set(new Uint8Array(e.buffer),a),a+=e.byteLength})),r.buffer}const Jo="undefined"!=typeof Buffer&&("undefined"==typeof Blob||"undefined"==typeof atob||"undefined"==typeof btoa);function es(e){return Jo?Buffer.byteLength(e,"utf8"):new Blob([e]).size}function ts(e){return Ko.join(e)}function ns(e){for(e=e.trim();e.endsWith("/");)e=e.slice(0,e.length-1);const t=e.split("/");return t[t.length-1]}function rs(e,t){const n={modelTopology:e.modelTopology,format:e.format,generatedBy:e.generatedBy,convertedBy:e.convertedBy,weightsManifest:t};return null!=e.signature&&(n.signature=e.signature),null!=e.userDefinedMetadata&&(n.userDefinedMetadata=e.userDefinedMetadata),null!=e.modelInitializer&&(n.modelInitializer=e.modelInitializer),null!=e.initializerSignature&&(n.initializerSignature=e.initializerSignature),null!=e.trainingConfig&&(n.trainingConfig=e.trainingConfig),n}function as(e,t,n){const r={modelTopology:e.modelTopology,format:e.format,generatedBy:e.generatedBy,convertedBy:e.convertedBy};if(null!=e.trainingConfig&&(r.trainingConfig=e.trainingConfig),null!=e.weightsManifest){if(!t)throw new Error("modelJSON has weightsManifest but weightSpecs is null");if(!n)throw new Error("modelJSON has weightsManifest but weightData is null");r.weightSpecs=t,r.weightData=n}return null!=e.signature&&(r.signature=e.signature),null!=e.userDefinedMetadata&&(r.userDefinedMetadata=e.userDefinedMetadata),null!=e.modelInitializer&&(r.modelInitializer=e.modelInitializer),null!=e.initializerSignature&&(r.initializerSignature=e.initializerSignature),r}async function os(e,t){let n,r;return null!=e.weightsManifest&&([n,r]=await t(e.weightsManifest)),as(e,n,r)}function ss(e){if(e.modelTopology instanceof ArrayBuffer)throw new Error("Expected JSON model topology, received ArrayBuffer.");return{dateSaved:new Date,modelTopologyType:"JSON",modelTopologyBytes:null==e.modelTopology?0:es(JSON.stringify(e.modelTopology)),weightSpecsBytes:null==e.weightSpecs?0:es(JSON.stringify(e.weightSpecs)),weightDataBytes:null==e.weightData?0:new Ko(e.weightData).byteLength}}function is(e){const t=[];for(const n of e)t.push(...n.weights);return t}function us(){const e=function(){const e=e=>{let t=e<<13,n=0;for(;0==(8388608&t);)n-=8388608,t<<=1;return t&=-8388609,n+=947912704,t|n},t=new Uint32Array(2048);t[0]=0;for(let n=1;n<1024;n++)t[n]=e(n);for(let e=1024;e<2048;e++)t[e]=939524096+(e-1024<<13);return t}(),t=function(){const e=new Uint32Array(64);e[0]=0,e[31]=1199570944,e[32]=2147483648,e[63]=3347054592;for(let t=1;t<31;t++)e[t]=t<<23;for(let t=33;t<63;t++)e[t]=2147483648+(t-32<<23);return e}(),n=function(){const e=new Uint32Array(64);for(let t=0;t<64;t++)e[t]=1024;return e[0]=e[32]=0,e}();return r=>{const a=new ArrayBuffer(4*r.length),o=new Uint32Array(a);for(let a=0;a<r.length;a++){const s=r[a],i=e[n[s>>10]+(1023&s)]+t[s>>10];o[a]=i}return new Float32Array(a)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ls{constructor(){this.saveRouters=[],this.loadRouters=[]}static getInstance(){return null==ls.instance&&(ls.instance=new ls),ls.instance}static registerSaveRouter(e){ls.getInstance().saveRouters.push(e)}static registerLoadRouter(e){ls.getInstance().loadRouters.push(e)}static getSaveHandlers(e){return ls.getHandlers(e,"save")}static getLoadHandlers(e,t){return ls.getHandlers(e,"load",t)}static getHandlers(e,t,n){const r=[];return("load"===t?ls.getInstance().loadRouters:ls.getInstance().saveRouters).forEach((t=>{const a=t(e,n);null!==a&&r.push(a)})),r}}const cs=e=>ls.registerSaveRouter(e),ps=e=>ls.registerLoadRouter(e),ds=e=>ls.getSaveHandlers(e),fs=(e,t)=>ls.getLoadHandlers(e,t),hs="tensorflowjs",ms="models_store",gs="model_info_store";function ys(){if(!Be().getBool("IS_BROWSER"))throw new Error("Failed to obtain IndexedDB factory because the current environmentis not a web browser.");const e="undefined"==typeof window?self:window,t=e.indexedDB||e.mozIndexedDB||e.webkitIndexedDB||e.msIndexedDB||e.shimIndexedDB;if(null==t)throw new Error("The current browser does not appear to support IndexedDB.");return t}function bs(e){const t=e.result;t.createObjectStore(ms,{keyPath:"modelPath"}),t.createObjectStore(gs,{keyPath:"modelPath"})}class vs{constructor(e){if(this.indexedDB=ys(),null==e||!e)throw new Error("For IndexedDB, modelPath must not be null, undefined or empty.");this.modelPath=e}async save(e){if(e.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");return this.databaseAction(this.modelPath,e)}async load(){return this.databaseAction(this.modelPath)}databaseAction(e,t){return new Promise(((e,n)=>{const r=this.indexedDB.open(hs,1);r.onupgradeneeded=()=>bs(r),r.onsuccess=()=>{const a=r.result;if(null==t){const t=a.transaction(ms,"readonly"),r=t.objectStore(ms).get(this.modelPath);r.onsuccess=()=>{if(null==r.result)return a.close(),n(new Error(`Cannot find model with path '${this.modelPath}' in IndexedDB.`));e(r.result.modelArtifacts)},r.onerror=e=>(a.close(),n(r.error)),t.oncomplete=()=>a.close()}else{t.weightData=Ko.join(t.weightData);const r=ss(t),o=a.transaction(gs,"readwrite");let s,i,u=o.objectStore(gs);try{s=u.put({modelPath:this.modelPath,modelArtifactsInfo:r})}catch(e){return n(e)}s.onsuccess=()=>{i=a.transaction(ms,"readwrite");const s=i.objectStore(ms);let l;try{l=s.put({modelPath:this.modelPath,modelArtifacts:t,modelArtifactsInfo:r})}catch(e){return n(e)}l.onsuccess=()=>e({modelArtifactsInfo:r}),l.onerror=e=>{u=o.objectStore(gs);const t=u.delete(this.modelPath);t.onsuccess=()=>(a.close(),n(l.error)),t.onerror=e=>(a.close(),n(l.error))}},s.onerror=e=>(a.close(),n(s.error)),o.oncomplete=()=>{null==i?a.close():i.oncomplete=()=>a.close()}}},r.onerror=e=>n(r.error)}))}}vs.URL_SCHEME="indexeddb://";const ws=e=>{return Be().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(vs.URL_SCHEME)?(t=e.slice(vs.URL_SCHEME.length),new vs(t)):null;var t};ls.registerSaveRouter(ws),ls.registerLoadRouter(ws);class xs{constructor(){this.indexedDB=ys()}async listModels(){return new Promise(((e,t)=>{const n=this.indexedDB.open(hs,1);n.onupgradeneeded=()=>bs(n),n.onsuccess=()=>{const r=n.result,a=r.transaction(gs,"readonly"),o=a.objectStore(gs).getAll();o.onsuccess=()=>{const t={};for(const e of o.result)t[e.modelPath]=e.modelArtifactsInfo;e(t)},o.onerror=e=>(r.close(),t(o.error)),a.oncomplete=()=>r.close()},n.onerror=e=>t(n.error)}))}async removeModel(e){var t;return e=(t=e).startsWith(vs.URL_SCHEME)?t.slice(vs.URL_SCHEME.length):t,new Promise(((t,n)=>{const r=this.indexedDB.open(hs,1);r.onupgradeneeded=()=>bs(r),r.onsuccess=()=>{const a=r.result,o=a.transaction(gs,"readwrite"),s=o.objectStore(gs),i=s.get(e);let u;i.onsuccess=()=>{if(null==i.result)return a.close(),n(new Error(`Cannot find model with path '${e}' in IndexedDB.`));{const r=s.delete(e),o=()=>{u=a.transaction(ms,"readwrite");const r=u.objectStore(ms).delete(e);r.onsuccess=()=>t(i.result.modelArtifactsInfo),r.onerror=e=>n(i.error)};r.onsuccess=o,r.onerror=e=>(o(),a.close(),n(i.error))}},i.onerror=e=>(a.close(),n(i.error)),o.oncomplete=()=>{null==u?a.close():u.oncomplete=()=>a.close()}},r.onerror=e=>n(r.error)}))}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ks="/",Ss="tensorflowjs_models",Es="info",Ns="model_topology",Ts="weight_specs",_s="weight_data",As="model_metadata";function Is(e){return{info:[Ss,e,Es].join(ks),topology:[Ss,e,Ns].join(ks),weightSpecs:[Ss,e,Ts].join(ks),weightData:[Ss,e,_s].join(ks),modelMetadata:[Ss,e,As].join(ks)}}function Ms(e){for(const t of Object.values(e))window.localStorage.removeItem(t)}function Os(e){const t=e.split(ks);if(t.length<3)throw new Error(`Invalid key format: ${e}`);return t.slice(1,t.length-1).join(ks)}class Ds{constructor(e){if(!Be().getBool("IS_BROWSER")||"undefined"==typeof window||void 0===window.localStorage)throw new Error("The current environment does not support local storage.");if(this.LS=window.localStorage,null==e||!e)throw new Error("For local storage, modelPath must not be null, undefined or empty.");this.modelPath=e,this.keys=Is(this.modelPath)}async save(e){if(e.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");{const t=JSON.stringify(e.modelTopology),n=JSON.stringify(e.weightSpecs),r=ss(e),a=Ko.join(e.weightData);try{this.LS.setItem(this.keys.info,JSON.stringify(r)),this.LS.setItem(this.keys.topology,t),this.LS.setItem(this.keys.weightSpecs,n),this.LS.setItem(this.keys.weightData,function(e){if(Jo)return Buffer.from(e).toString("base64");const t=new Uint8Array(e);let n="";for(let e=0,r=t.length;e<r;e++)n+=String.fromCharCode(t[e]);return btoa(n)}(a));const o={format:e.format,generatedBy:e.generatedBy,convertedBy:e.convertedBy,signature:null!=e.signature?e.signature:void 0,userDefinedMetadata:null!=e.userDefinedMetadata?e.userDefinedMetadata:void 0,modelInitializer:null!=e.modelInitializer?e.modelInitializer:void 0,initializerSignature:null!=e.initializerSignature?e.initializerSignature:void 0,trainingConfig:null!=e.trainingConfig?e.trainingConfig:void 0};return this.LS.setItem(this.keys.modelMetadata,JSON.stringify(o)),{modelArtifactsInfo:r}}catch(e){throw Ms(this.keys),new Error(`Failed to save model '${this.modelPath}' to local storage: size quota being exceeded is a possible cause of this failure: modelTopologyBytes=${r.modelTopologyBytes}, weightSpecsBytes=${r.weightSpecsBytes}, weightDataBytes=${r.weightDataBytes}.`)}}}async load(){const e=JSON.parse(this.LS.getItem(this.keys.info));if(null==e)throw new Error(`In local storage, there is no model with name '${this.modelPath}'`);if("JSON"!==e.modelTopologyType)throw new Error("BrowserLocalStorage does not support loading non-JSON model topology yet.");const t={},n=JSON.parse(this.LS.getItem(this.keys.topology));if(null==n)throw new Error(`In local storage, the topology of model '${this.modelPath}' is missing.`);t.modelTopology=n;const r=JSON.parse(this.LS.getItem(this.keys.weightSpecs));if(null==r)throw new Error(`In local storage, the weight specs of model '${this.modelPath}' are missing.`);t.weightSpecs=r;const a=this.LS.getItem(this.keys.modelMetadata);if(null!=a){const e=JSON.parse(a);t.format=e.format,t.generatedBy=e.generatedBy,t.convertedBy=e.convertedBy,null!=e.signature&&(t.signature=e.signature),null!=e.userDefinedMetadata&&(t.userDefinedMetadata=e.userDefinedMetadata),null!=e.modelInitializer&&(t.modelInitializer=e.modelInitializer),null!=e.initializerSignature&&(t.initializerSignature=e.initializerSignature),null!=e.trainingConfig&&(t.trainingConfig=e.trainingConfig)}const o=this.LS.getItem(this.keys.weightData);if(null==o)throw new Error(`In local storage, the binary weight values of model '${this.modelPath}' are missing.`);return t.weightData=function(e){if(Jo){const t=Buffer.from(e,"base64");return t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength)}const t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;++e)n.set([t.charCodeAt(e)],e);return n.buffer}(o),t}}Ds.URL_SCHEME="localstorage://";const Cs=e=>{return Be().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(Ds.URL_SCHEME)?(t=e.slice(Ds.URL_SCHEME.length),new Ds(t)):null;var t};ls.registerSaveRouter(Cs),ls.registerLoadRouter(Cs);class $s{constructor(){X(Be().getBool("IS_BROWSER"),(()=>"Current environment is not a web browser")),X("undefined"==typeof window||void 0!==window.localStorage,(()=>"Current browser does not appear to support localStorage")),this.LS=window.localStorage}async listModels(){const e={},t=Ss+ks,n=ks+Es;for(let r=0;r<this.LS.length;++r){const a=this.LS.key(r);if(a.startsWith(t)&&a.endsWith(n)){e[Os(a)]=JSON.parse(this.LS.getItem(a))}}return e}async removeModel(e){var t;const n=Is(e=(t=e).startsWith(Ds.URL_SCHEME)?t.slice(Ds.URL_SCHEME.length):t);if(null==this.LS.getItem(n.info))throw new Error(`Cannot find model at path '${e}'`);const r=JSON.parse(this.LS.getItem(n.info));return Ms(n),r}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Rs="://";class Fs{constructor(){this.managers={}}static getInstance(){return null==Fs.instance&&(Fs.instance=new Fs),Fs.instance}static registerManager(e,t){X(null!=e,(()=>"scheme must not be undefined or null.")),e.endsWith(Rs)&&(e=e.slice(0,e.indexOf(Rs))),X(e.length>0,(()=>"scheme must not be an empty string."));const n=Fs.getInstance();X(null==n.managers[e],(()=>`A model store manager is already registered for scheme '${e}'.`)),n.managers[e]=t}static getManager(e){const t=Fs.getInstance().managers[e];if(null==t)throw new Error(`Cannot find model manager for scheme '${e}'`);return t}static getSchemes(){return Object.keys(Fs.getInstance().managers)}}function Ps(e){if(-1===e.indexOf(Rs))throw new Error(`The url string provided does not contain a scheme. Supported schemes are: ${Fs.getSchemes().join(",")}`);return{scheme:e.split(Rs)[0],path:e.split(Rs)[1]}}async function Ls(e,t,n=!1){X(e!==t,(()=>`Old path and new path are the same: '${e}'`));const r=ls.getLoadHandlers(e);X(r.length>0,(()=>`Copying failed because no load handler is found for source URL ${e}.`)),X(r.length<2,(()=>`Copying failed because more than one (${r.length}) load handlers for source URL ${e}.`));const a=r[0],o=ls.getSaveHandlers(t);X(o.length>0,(()=>`Copying failed because no save handler is found for destination URL ${t}.`)),X(o.length<2,(()=>`Copying failed because more than one (${r.length}) save handlers for destination URL ${t}.`));const s=o[0],i=Ps(e).scheme,u=Ps(e).path,l=i===Ps(e).scheme,c=await a.load();n&&l&&await Fs.getManager(i).removeModel(u);const p=await s.save(c);return n&&!l&&await Fs.getManager(i).removeModel(u),p.modelArtifactsInfo}async function zs(){const e=Fs.getSchemes(),t={};for(const n of e){const e=await Fs.getManager(n).listModels();for(const r in e){t[n+Rs+r]=e[r]}}return t}async function Bs(e){const t=Ps(e);return Fs.getManager(t.scheme).removeModel(t.path)}async function Vs(e,t){return Ls(e,t,!1)}async function Us(e,t){return Ls(e,t,!0)}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class js{constructor(){this.messageName="setTimeoutCustom",this.functionRefs=[],this.handledMessageCount=0,this.hasEventListener=!1}fetch(e,t){return fetch(e,t)}now(){return performance.now()}encode(e,t){if("utf-8"!==t&&"utf8"!==t)throw new Error(`Browser's encoder only supports utf-8, but got ${t}`);return null==this.textEncoder&&(this.textEncoder=new TextEncoder),this.textEncoder.encode(e)}decode(e,t){return new TextDecoder(t).decode(e)}setTimeoutCustom(e,t){"undefined"!=typeof window&&Be().getBool("USE_SETTIMEOUTCUSTOM")?(this.functionRefs.push(e),setTimeout((()=>{window.postMessage({name:this.messageName,index:this.functionRefs.length-1},"*")}),t),this.hasEventListener||(this.hasEventListener=!0,window.addEventListener("message",(e=>{if(e.source===window&&e.data.name===this.messageName){e.stopPropagation();(0,this.functionRefs[e.data.index])(),this.handledMessageCount++,this.handledMessageCount===this.functionRefs.length&&(this.functionRefs=[],this.handledMessageCount=0)}}),!0))):setTimeout(e,t)}isTypedArray(e){return Sa(e)}}if(Be().get("IS_BROWSER")){Be().setPlatform("browser",new js);try{Fs.registerManager(Ds.URL_SCHEME,new $s)}catch(e){}try{Fs.registerManager(vs.URL_SCHEME,new xs)}catch(e){}}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Ws=()=>n(5410);let Hs;class qs{constructor(){this.util=n(8628),this.textEncoder=new this.util.TextEncoder}fetch(e,t){return null!=Be().global.fetch?Be().global.fetch(e,t):(null==Hs&&(Hs=Ws()),Hs(e,t))}now(){const e=process.hrtime();return 1e3*e[0]+e[1]/1e6}encode(e,t){if("utf-8"!==t&&"utf8"!==t)throw new Error(`Node built-in encoder only supports utf-8, but got ${t}`);return this.textEncoder.encode(e)}decode(e,t){return 0===e.length?"":new this.util.TextDecoder(t).decode(e)}isTypedArray(e){return this.util.types.isFloat32Array(e)||this.util.types.isInt32Array(e)||this.util.types.isUint8Array(e)||this.util.types.isUint8ClampedArray(e)}}
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Gs(e,t="float32",n){return t=t||"float32",Ce(e),new ro(e,t,n)}Be().get("IS_NODE")&&!Be().get("IS_BROWSER")&&Be().setPlatform("node",new qs);const Ks=jo({cast_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","cast");if(!ge(t))throw new Error(`Failed to cast to unknown dtype ${t}`);if("string"===t&&"string"!==n.dtype||"string"!==t&&"string"===n.dtype)throw new Error("Only strings can be casted to strings");const r={x:n},a={dtype:t};return Mo.runKernel(mt,r,a)}});const Qs=jo({clone_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","clone","string_or_numeric")};return Mo.runKernel(un,t)}});
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ys(e,t=!1){console.log(e.toString(t))}
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
Io();
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Xs(){Be().set("PROD",!0)}function Zs(){Be().set("DEBUG",!0)}function Js(){Be().set("DEPRECATION_WARNINGS_ENABLED",!1),console.warn("TensorFlow.js deprecation warnings have been disabled.")}function ei(e){Be().getBool("DEPRECATION_WARNINGS_ENABLED")&&console.warn(e+" You can disable deprecation warnings with tf.disableDeprecationWarnings().")}function ti(){Mo.disposeVariables()}function ni(){return Mo}function ri(){return Mo.memory()}function ai(e){return Mo.profile(e)}function oi(e,t){return Mo.tidy(e,t)}function si(e){Eo(e).forEach((e=>e.dispose()))}function ii(e){return Mo.keep(e)}function ui(e){return Mo.time(e)}function li(e){return Mo.setBackend(e)}function ci(){return Mo.ready()}function pi(){return Mo.backendName}function di(e){Mo.removeBackend(e)}function fi(e){return Mo.findBackend(e)}function hi(e){return Mo.findBackendFactory(e)}function mi(e,t,n=1){return Mo.registerBackend(e,t,n)}function gi(){return Mo.backend}function yi(e,t){Be().setPlatform(e,t)}oo={buffer:Gs,cast:Ks,clone:Qs,print:Ys},so=ei;const bi=jo({add_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","add"),r=Bo(t,"b","add");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(Ke,a)}});const vi=jo({floorDiv_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","floorDiv"),r=Bo(t,"b","floorDiv");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(tn,a)}});const wi=jo({div_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","div"),r=Bo(t,"b","div");if([n,r]=xo(n,r),"int32"===n.dtype&&"int32"===r.dtype)return vi(n,r);const a={a:n,b:r};return Mo.runKernel(Ut,a,{})}});const xi=jo({mul_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","mul"),r=Bo(t,"b","mul");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(Un,a)}});const ki=jo({sqrt_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","sqrt","float32")};return Mo.runKernel(Ir,t)}});const Si=jo({square_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"x","square");return Mo.runKernel("Square",{x:t},{})}});const Ei=jo({zerosLike_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","zerosLike")};return Mo.runKernel(ra,t)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ni(e){return X(Ee(e),(()=>"The f passed in grad(f) must be a function")),(t,n)=>{const r=Bo(t,"x","tf.grad","string_or_numeric"),a=null!=n?Bo(n,"dy","tf.grad"):null;return Mo.tidy((()=>{const{value:t,grads:n}=Mo.gradients((()=>e(r)),[r],a);return null!=a&&Z(t.shape,a.shape,"The shape of dy passed in grad(f)(x, dy) must match the shape returned by f(x)"),Oi(n),n[0]}))}}function Ti(e){return X(Ee(e),(()=>"The f passed in grads(f) must be a function")),(t,n)=>{X(Array.isArray(t),(()=>"The args passed in grads(f)(args) must be an array of `Tensor`s or `TensorLike`s"));const r=Vo(t,"args","tf.grads","string_or_numeric"),a=null!=n?Bo(n,"dy","tf.grads"):null;return Mo.tidy((()=>{const{value:t,grads:n}=Mo.gradients((()=>e(...r)),r,a);return null!=a&&Z(t.shape,a.shape,"The shape of dy passed in grads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),Oi(n),n}))}}function _i(e){return X(Ee(e),(()=>"The f passed in valueAndGrad(f) must be a function")),(t,n)=>{X(t instanceof io,(()=>"The x passed in valueAndGrad(f)(x) must be a tensor")),X(null==n||n instanceof io,(()=>"The dy passed in valueAndGrad(f)(x, dy) must be a tensor"));const{grads:r,value:a}=Mo.gradients((()=>e(t)),[t],n);return Oi(r),{grad:r[0],value:a}}}function Ai(e){return X(Ee(e),(()=>"The f passed in valueAndGrads(f) must be a function")),(t,n)=>{X(Array.isArray(t)&&t.every((e=>e instanceof io)),(()=>"The args passed in valueAndGrads(f)(args) must be array of tensors")),X(null==n||n instanceof io,(()=>"The dy passed in valueAndGrads(f)(args, dy) must be a tensor"));const r=Mo.gradients((()=>e(...t)),t,n);return null!=n&&Z(r.value.shape,n.shape,"The shape of dy passed in valueAndGrads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),Oi(r.grads),r}}function Ii(e,t){X(Ee(e),(()=>"The f passed in variableGrads(f) must be a function")),X(null==t||Array.isArray(t)&&t.every((e=>e instanceof lo)),(()=>"The varList passed in variableGrads(f, varList) must be an array of variables"));const n=null!=t;if(!n){t=[];for(const e in Mo.registeredVariables)t.push(Mo.registeredVariables[e])}const r=n?t.filter((e=>!e.trainable)):null,a=t.length;t=t.filter((e=>e.trainable)),X(t.length>0,(()=>`variableGrads() expects at least one of the input variables to be trainable, but none of the ${a} variables is trainable.`));const{value:o,grads:s}=Mo.gradients(e,t,null,!0);X(s.some((e=>null!=e)),(()=>"Cannot find a connection between any variable and the result of the loss function y=f(x). Please make sure the operations that use variables are inside the function f passed to minimize().")),X(0===o.rank,(()=>`The f passed in variableGrads(f) must return a scalar, but it returned a rank-${o.rank} tensor`));const i={};return t.forEach(((e,t)=>{null!=s[t]&&(i[e.name]=s[t])})),null!=r&&r.forEach((e=>i[e.name]=null)),{value:o,grads:i}}function Mi(e){return Mo.customGrad(e)}function Oi(e){if(e.filter((e=>null==e)).length>0)throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that\n    the f you passed encloses all operations that lead from x to y.")}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Di(e,t){if((Wa(e)&&"string"!==t||Array.isArray(e))&&"complex64"!==t)throw new Error("Error creating a new Scalar: value must be a primitive (number|boolean|string)");if("string"===t&&Wa(e)&&!(e instanceof Uint8Array))throw new Error("When making a scalar from encoded string, the value must be `Uint8Array`.");return Ho(e,[],[],t)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Ci=new Map,$i=new Map;class Ri{getClassName(){return this.constructor.className}static fromConfig(e,t){return new e(t)}}class Fi{constructor(){this.classNameMap={}}static getMap(){return null==Fi.instance&&(Fi.instance=new Fi),Fi.instance}static register(e){Fi.getMap().classNameMap[e.className]=[e,e.fromConfig]}}function Pi(e,t,n){X(null!=e.className,(()=>"Class being registered does not have the static className property defined.")),X("string"==typeof e.className,(()=>"className is required to be a string, but got type "+typeof e.className)),X(e.className.length>0,(()=>"Class being registered has an empty-string as its className, which is disallowed.")),void 0===t&&(t="Custom"),void 0===n&&(n=e.className);const r=t+">"+n;return Fi.register(e),Ci.set(r,e),$i.set(e,r),e}function Li(e){return $i.has(e)?$i.get(e):e.className}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class zi extends Ri{minimize(e,t=!1,n){const{value:r,grads:a}=this.computeGradients(e,n);if(null!=n){const e=n.map((e=>({name:e.name,tensor:a[e.name]})));this.applyGradients(e)}else this.applyGradients(a);return si(a),t?r:(r.dispose(),null)}get iterations(){return null==this.iterations_&&(this.iterations_=0),this.iterations_}incrementIterations(){this.iterations_=this.iterations+1}computeGradients(e,t){return Ii(e,t)}dispose(){null!=this.iterations_&&si(this.iterations_)}async saveIterations(){return null==this.iterations_&&(this.iterations_=0),{name:"iter",tensor:Di(this.iterations_,"int32")}}async getWeights(){throw new Error("getWeights() is not implemented for this optimizer yet.")}async setWeights(e){throw new Error(`setWeights() is not implemented for this optimizer class ${this.getClassName()}`)}async extractIterations(e){return this.iterations_=(await e[0].tensor.data())[0],e.slice(1)}}Object.defineProperty(zi,Symbol.hasInstance,{value:e=>null!=e.minimize&&null!=e.computeGradients&&null!=e.applyGradients});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Bi extends zi{static get className(){return"Adadelta"}constructor(e,t,n=null){super(),this.learningRate=e,this.rho=t,this.epsilon=n,this.accumulatedGrads=[],this.accumulatedUpdates=[],null==n&&(this.epsilon=Mo.backend.epsilon())}applyGradients(e){(Array.isArray(e)?e.map((e=>e.name)):Object.keys(e)).forEach(((t,n)=>{const r=Mo.registeredVariables[t];null==this.accumulatedGrads[n]&&(this.accumulatedGrads[n]={originalName:`${t}/accum_grad`,variable:oi((()=>Ei(r).variable(false)))}),null==this.accumulatedUpdates[n]&&(this.accumulatedUpdates[n]={originalName:`${t}/accum_var`,variable:oi((()=>Ei(r).variable(false)))});const a=Array.isArray(e)?e[n].tensor:e[t];if(null==a)return;const o=this.accumulatedGrads[n].variable,s=this.accumulatedUpdates[n].variable;oi((()=>{const e=bi(xi(o,this.rho),xi(Si(a),1-this.rho)),t=xi(wi(ki(bi(s,this.epsilon)),ki(bi(o,this.epsilon))),a),n=bi(xi(s,this.rho),xi(Si(t),1-this.rho));o.assign(e),s.assign(n);const i=bi(xi(t,-this.learningRate),r);r.assign(i)}))})),this.incrementIterations()}dispose(){null!=this.accumulatedUpdates&&(si(this.accumulatedGrads.map((e=>e.variable))),si(this.accumulatedUpdates.map((e=>e.variable))))}async getWeights(){const e=[...this.accumulatedGrads,...this.accumulatedUpdates];return[await this.saveIterations()].concat(e.map((e=>({name:e.originalName,tensor:e.variable}))))}async setWeights(e){const t=(e=await this.extractIterations(e)).length/2;this.accumulatedGrads=e.slice(0,t).map((e=>({originalName:e.name,variable:e.tensor.variable(false)}))),this.accumulatedUpdates=e.slice(t,2*t).map((e=>({originalName:e.name,variable:e.tensor.variable(false)})))}getConfig(){return{learningRate:this.learningRate,rho:this.rho,epsilon:this.epsilon}}static fromConfig(e,t){return new e(t.learningRate,t.rho,t.epsilon)}}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vi(e,t,n){Ce(e);const r={shape:e,value:t,dtype:n=n||Se(t)};return Mo.runKernel(Zt,{},r)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Ui extends zi{static get className(){return"Adagrad"}constructor(e,t=.1){super(),this.learningRate=e,this.initialAccumulatorValue=t,this.accumulatedGrads=[]}applyGradients(e){(Array.isArray(e)?e.map((e=>e.name)):Object.keys(e)).forEach(((t,n)=>{const r=Mo.registeredVariables[t];if(null==this.accumulatedGrads[n]){const e=!1;this.accumulatedGrads[n]={originalName:`${t}/accumulator`,variable:oi((()=>Vi(r.shape,this.initialAccumulatorValue).variable(e)))}}const a=Array.isArray(e)?e[n].tensor:e[t];if(null==a)return;const o=this.accumulatedGrads[n].variable;oi((()=>{const e=bi(o,Si(a));o.assign(e);const t=bi(xi(wi(a,ki(bi(e,Mo.backend.epsilon()))),-this.learningRate),r);r.assign(t)}))})),this.incrementIterations()}dispose(){null!=this.accumulatedGrads&&si(this.accumulatedGrads.map((e=>e.variable)))}async getWeights(){return[await this.saveIterations()].concat(this.accumulatedGrads.map((e=>({name:e.originalName,tensor:e.variable}))))}async setWeights(e){e=await this.extractIterations(e);this.accumulatedGrads=e.map((e=>({originalName:e.name,variable:e.tensor.variable(false)})))}getConfig(){return{learningRate:this.learningRate,initialAccumulatorValue:this.initialAccumulatorValue}}static fromConfig(e,t){return new e(t.learningRate,t.initialAccumulatorValue)}}const ji=jo({pow_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"base","pow"),r=Bo(t,"exp","pow");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(Jn,a)}});const Wi=jo({sub_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","sub"),r=Bo(t,"b","sub");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(qr,a)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Hi extends zi{static get className(){return"Adam"}constructor(e,t,n,r=null){super(),this.learningRate=e,this.beta1=t,this.beta2=n,this.epsilon=r,this.accumulatedFirstMoment=[],this.accumulatedSecondMoment=[],oi((()=>{this.accBeta1=Di(t).variable(),this.accBeta2=Di(n).variable()})),null==r&&(this.epsilon=Mo.backend.epsilon())}applyGradients(e){const t=Array.isArray(e)?e.map((e=>e.name)):Object.keys(e);oi((()=>{const n=Wi(1,this.accBeta1),r=Wi(1,this.accBeta2);t.forEach(((t,a)=>{const o=Mo.registeredVariables[t];null==this.accumulatedFirstMoment[a]&&(this.accumulatedFirstMoment[a]={originalName:`${t}/m`,variable:oi((()=>Ei(o).variable(false)))}),null==this.accumulatedSecondMoment[a]&&(this.accumulatedSecondMoment[a]={originalName:`${t}/v`,variable:oi((()=>Ei(o).variable(false)))});const s=Array.isArray(e)?e[a].tensor:e[t];if(null==s)return;const i=this.accumulatedFirstMoment[a].variable,u=this.accumulatedSecondMoment[a].variable,l=bi(xi(i,this.beta1),xi(s,1-this.beta1)),c=bi(xi(u,this.beta2),xi(Si(s),1-this.beta2)),p=wi(l,n),d=wi(c,r);i.assign(l),u.assign(c);const f=bi(xi(wi(p,bi(ki(d),this.epsilon)),-this.learningRate),o);o.assign(f)})),this.accBeta1.assign(xi(this.accBeta1,this.beta1)),this.accBeta2.assign(xi(this.accBeta2,this.beta2))})),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.accBeta2.dispose(),null!=this.accumulatedFirstMoment&&si(this.accumulatedFirstMoment.map((e=>e.variable))),null!=this.accumulatedSecondMoment&&si(this.accumulatedSecondMoment.map((e=>e.variable)))}async getWeights(){const e=[...this.accumulatedFirstMoment,...this.accumulatedSecondMoment];return[await this.saveIterations()].concat(e.map((e=>({name:e.originalName,tensor:e.variable}))))}async setWeights(e){e=await this.extractIterations(e),oi((()=>{this.accBeta1.assign(ji(this.beta1,this.iterations_+1)),this.accBeta2.assign(ji(this.beta2,this.iterations_+1))}));const t=e.length/2;this.accumulatedFirstMoment=e.slice(0,t).map((e=>({originalName:e.name,variable:e.tensor.variable(false)}))),this.accumulatedSecondMoment=e.slice(t,2*t).map((e=>({originalName:e.name,variable:e.tensor.variable(false)})))}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon}}static fromConfig(e,t){return new e(t.learningRate,t.beta1,t.beta2,t.epsilon)}}const qi=jo({abs_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"x","abs");if("complex64"===t.dtype){const e={x:t};return Mo.runKernel(vt,e)}{const e={x:t};return Mo.runKernel(He,e)}}});
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Gi(e,t){const n=e.length,r=[];for(let a=0;a<n;a++){const o=n-1-a,s=e[o]||1;(t[t.length-1-a]||1)>1&&1===s&&r.unshift(o)}return r}function Ki(e,t){const n=[];for(let r=0;r<t.length;r++){const a=e[e.length-r-1],o=t.length-r-1,s=t[o];(null==a||1===a&&s>1)&&n.unshift(o)}return n}function Qi(e,t){const n=Math.max(e.length,t.length),r=new Array(n);for(let a=0;a<n;a++){let o=e[e.length-a-1];null==o&&(o=1);let s=t[t.length-a-1];if(null==s&&(s=1),1===o)r[n-a-1]=s;else if(1===s)r[n-a-1]=o;else{if(o!==s){throw Error(`Operands could not be broadcast together with shapes ${e} and ${t}.`)}r[n-a-1]=o}}return r}const Yi=jo({maximum_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","maximum"),r=Bo(t,"b","maximum");[n,r]=xo(n,r),"bool"===n.dtype&&(n=Ks(n,"int32"),r=Ks(r,"int32")),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(Mn,a)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Xi extends zi{static get className(){return"Adamax"}constructor(e,t,n,r=null,a=0){super(),this.learningRate=e,this.beta1=t,this.beta2=n,this.epsilon=r,this.decay=a,this.accumulatedFirstMoment=[],this.accumulatedWeightedInfNorm=[],oi((()=>{this.iteration=Di(0).variable(),this.accBeta1=Di(t).variable()})),null==r&&(this.epsilon=Mo.backend.epsilon())}applyGradients(e){const t=Array.isArray(e)?e.map((e=>e.name)):Object.keys(e);oi((()=>{const n=Wi(1,this.accBeta1),r=wi(-this.learningRate,bi(xi(this.iteration,this.decay),1));t.forEach(((t,a)=>{const o=Mo.registeredVariables[t];null==this.accumulatedFirstMoment[a]&&(this.accumulatedFirstMoment[a]={originalName:`${t}/m`,variable:Ei(o).variable(false)}),null==this.accumulatedWeightedInfNorm[a]&&(this.accumulatedWeightedInfNorm[a]={originalName:`${t}/v`,variable:Ei(o).variable(false)});const s=Array.isArray(e)?e[a].tensor:e[t];if(null==s)return;const i=this.accumulatedFirstMoment[a].variable,u=this.accumulatedWeightedInfNorm[a].variable,l=bi(xi(i,this.beta1),xi(s,1-this.beta1)),c=xi(u,this.beta2),p=qi(s),d=Yi(c,p);i.assign(l),u.assign(d);const f=bi(xi(wi(r,n),wi(l,bi(d,this.epsilon))),o);o.assign(f)})),this.iteration.assign(bi(this.iteration,1)),this.accBeta1.assign(xi(this.accBeta1,this.beta1))})),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.iteration.dispose(),null!=this.accumulatedFirstMoment&&si(this.accumulatedFirstMoment.map((e=>e.variable))),null!=this.accumulatedWeightedInfNorm&&si(this.accumulatedWeightedInfNorm.map((e=>e.variable)))}async getWeights(){throw new Error("getWeights() is not implemented for Adamax yet.")}async setWeights(e){throw new Error("setWeights() is not implemented for Adamax yet.")}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon,decay:this.decay}}static fromConfig(e,t){return new e(t.learningRate,t.beta1,t.beta2,t.epsilon,t.decay)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Zi extends zi{static get className(){return"SGD"}constructor(e){super(),this.learningRate=e,this.setLearningRate(e)}applyGradients(e){(Array.isArray(e)?e.map((e=>e.name)):Object.keys(e)).forEach(((t,n)=>{const r=Array.isArray(e)?e[n].tensor:e[t];if(null==r)return;const a=Mo.registeredVariables[t];oi((()=>{const e=bi(xi(this.c,r),a);a.assign(e)}))})),this.incrementIterations()}setLearningRate(e){this.learningRate=e,null!=this.c&&this.c.dispose(),this.c=ii(Di(-e))}dispose(){this.c.dispose()}async getWeights(){return[await this.saveIterations()]}async setWeights(e){if(0!==(e=await this.extractIterations(e)).length)throw new Error("SGD optimizer does not have settable weights.")}getConfig(){return{learningRate:this.learningRate}}static fromConfig(e,t){return new e(t.learningRate)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Ji extends Zi{static get className(){return"Momentum"}constructor(e,t,n=!1){super(e),this.learningRate=e,this.momentum=t,this.useNesterov=n,this.accumulations=[],this.m=Di(this.momentum)}applyGradients(e){(Array.isArray(e)?e.map((e=>e.name)):Object.keys(e)).forEach(((t,n)=>{const r=Mo.registeredVariables[t];if(null==this.accumulations[n]){const e=!1;this.accumulations[n]={originalName:`${t}/momentum`,variable:oi((()=>Ei(r).variable(e)))}}const a=this.accumulations[n].variable,o=Array.isArray(e)?e[n].tensor:e[t];null!=o&&oi((()=>{let e;const t=bi(xi(this.m,a),o);e=this.useNesterov?bi(xi(this.c,bi(o,xi(t,this.m))),r):bi(xi(this.c,t),r),a.assign(t),r.assign(e)}))})),this.incrementIterations()}dispose(){this.m.dispose(),null!=this.accumulations&&si(this.accumulations.map((e=>e.variable)))}setMomentum(e){this.momentum=e}async getWeights(){return[await this.saveIterations()].concat(this.accumulations.map((e=>({name:e.originalName,tensor:e.variable}))))}async setWeights(e){e=await this.extractIterations(e);this.accumulations=e.map((e=>({originalName:e.name,variable:e.tensor.variable(false)})))}getConfig(){return{learningRate:this.learningRate,momentum:this.momentum,useNesterov:this.useNesterov}}static fromConfig(e,t){return new e(t.learningRate,t.momentum,t.useNesterov)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class eu extends zi{static get className(){return"RMSProp"}constructor(e,t=.9,n=0,r=null,a=!1){if(super(),this.learningRate=e,this.decay=t,this.momentum=n,this.epsilon=r,this.accumulatedMeanSquares=[],this.accumulatedMoments=[],this.accumulatedMeanGrads=[],this.centered=a,null==r&&(this.epsilon=Mo.backend.epsilon()),null==e)throw new Error("learningRate for RMSPropOptimizer must be defined.")}applyGradients(e){(Array.isArray(e)?e.map((e=>e.name)):Object.keys(e)).forEach(((t,n)=>{const r=Mo.registeredVariables[t],a=!1;null==this.accumulatedMeanSquares[n]&&(this.accumulatedMeanSquares[n]={originalName:`${t}/rms`,variable:oi((()=>Ei(r).variable(a)))}),null==this.accumulatedMoments[n]&&(this.accumulatedMoments[n]={originalName:`${t}/momentum`,variable:oi((()=>Ei(r).variable(a)))}),null==this.accumulatedMeanGrads[n]&&this.centered&&(this.accumulatedMeanGrads[n]={originalName:`${t}/mg`,variable:oi((()=>Ei(r).variable(a)))});const o=Array.isArray(e)?e[n].tensor:e[t];if(null==o)return;const s=this.accumulatedMeanSquares[n].variable,i=this.accumulatedMoments[n].variable;oi((()=>{const e=bi(xi(s,this.decay),xi(Si(o),1-this.decay));if(this.centered){const t=this.accumulatedMeanGrads[n].variable,a=bi(xi(t,this.decay),xi(o,1-this.decay)),u=wi(xi(o,this.learningRate),ki(Wi(e,bi(Si(a),this.epsilon)))),l=bi(xi(i,this.momentum),u);s.assign(e),t.assign(a),i.assign(l);const c=Wi(r,l);r.assign(c)}else{const e=bi(xi(s,this.decay),xi(Si(o),1-this.decay)),t=bi(xi(i,this.momentum),wi(xi(o,this.learningRate),ki(bi(e,this.epsilon))));s.assign(e),i.assign(t);const n=Wi(r,t);r.assign(n)}}))})),this.incrementIterations()}dispose(){null!=this.accumulatedMeanSquares&&si(this.accumulatedMeanSquares.map((e=>e.variable))),null!=this.accumulatedMeanGrads&&this.centered&&si(this.accumulatedMeanGrads.map((e=>e.variable))),null!=this.accumulatedMoments&&si(this.accumulatedMoments.map((e=>e.variable)))}async getWeights(){const e=[...this.accumulatedMeanSquares,...this.accumulatedMoments];return this.centered&&e.push(...this.accumulatedMeanGrads),[await this.saveIterations()].concat(e.map((e=>({name:e.originalName,tensor:e.variable}))))}async setWeights(e){e=await this.extractIterations(e);const t=this.centered?e.length/3:e.length/2,n=!1;this.accumulatedMeanSquares=e.slice(0,t).map((e=>({originalName:e.name,variable:e.tensor.variable(n)}))),this.accumulatedMoments=e.slice(t,2*t).map((e=>({originalName:e.name,variable:e.tensor.variable(n)}))),this.centered&&(this.accumulatedMeanGrads=e.slice(2*t,3*t).map((e=>({originalName:e.name,variable:e.tensor.variable(n)}))))}getConfig(){return{learningRate:this.learningRate,decay:this.decay,momentum:this.momentum,epsilon:this.epsilon,centered:this.centered}}static fromConfig(e,t){return new e(t.learningRate,t.decay,t.momentum,t.epsilon,t.centered)}}
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const tu=[Bi,Ui,Hi,Xi,Ji,eu,Zi];function nu(e){return new Promise((e=>setTimeout(e))).then(e)}class ru{constructor(e){if(!Be().getBool("IS_BROWSER"))throw new Error("browserDownloads() cannot proceed because the current environment is not a browser.");e.startsWith(ru.URL_SCHEME)&&(e=e.slice(ru.URL_SCHEME.length)),null!=e&&0!==e.length||(e="model"),this.modelJsonFileName=e+".json",this.weightDataFileName=e+".weights.bin"}async save(e){if("undefined"==typeof document)throw new Error("Browser downloads are not supported in this environment since `document` is not present");const t=Ko.join(e.weightData),n=window.URL.createObjectURL(new Blob([t],{type:"application/octet-stream"}));if(e.modelTopology instanceof ArrayBuffer)throw new Error("BrowserDownloads.save() does not support saving model topology in binary formats yet.");{const t=rs(e,[{paths:["./"+this.weightDataFileName],weights:e.weightSpecs}]),r=window.URL.createObjectURL(new Blob([JSON.stringify(t)],{type:"application/json"})),a=null==this.modelJsonAnchor?document.createElement("a"):this.modelJsonAnchor;if(a.download=this.modelJsonFileName,a.href=r,await nu((()=>a.dispatchEvent(new MouseEvent("click")))),null!=e.weightData){const e=null==this.weightDataAnchor?document.createElement("a"):this.weightDataAnchor;e.download=this.weightDataFileName,e.href=n,await nu((()=>e.dispatchEvent(new MouseEvent("click"))))}return{modelArtifactsInfo:ss(e)}}}}ru.URL_SCHEME="downloads://";class au{constructor(e){if(null==e||e.length<1)throw new Error(`When calling browserFiles, at least 1 file is required, but received ${e}`);this.jsonFile=e[0],this.weightsFiles=e.slice(1)}async load(){return new Promise(((e,t)=>{const n=new FileReader;n.onload=n=>{const r=JSON.parse(n.target.result),a=r.modelTopology;if(null==a)return void t(new Error(`modelTopology field is missing from file ${this.jsonFile.name}`));if(null==r.weightsManifest)return void t(new Error(`weightManifest field is missing from file ${this.jsonFile.name}`));if(0===this.weightsFiles.length)return void e({modelTopology:a});const o=os(r,(e=>this.loadWeights(e)));e(o)},n.onerror=e=>t(`Failed to read model topology and weights manifest JSON from file '${this.jsonFile.name}'. BrowserFiles supports loading Keras-style tf.Model artifacts only.`),n.readAsText(this.jsonFile)}))}loadWeights(e){const t=[],n=[];for(const r of e)t.push(...r.weights),n.push(...r.paths);const r=this.checkManifestAndWeightFiles(e),a=n.map((e=>this.loadWeightsFile(e,r[e])));return Promise.all(a).then((e=>[t,e]))}loadWeightsFile(e,t){return new Promise(((n,r)=>{const a=new FileReader;a.onload=e=>{const t=e.target.result;n(t)},a.onerror=t=>r(`Failed to weights data from file of path '${e}'.`),a.readAsArrayBuffer(t)}))}checkManifestAndWeightFiles(e){const t=[],n=this.weightsFiles.map((e=>ns(e.name))),r={};for(const a of e)a.paths.forEach((e=>{const a=ns(e);if(-1!==t.indexOf(a))throw new Error(`Duplicate file basename found in weights manifest: '${a}'`);if(t.push(a),-1===n.indexOf(a))throw new Error(`Weight file with basename '${a}' is not provided.`);r[e]=this.weightsFiles[n.indexOf(a)]}));if(t.length!==this.weightsFiles.length)throw new Error(`Mismatch in the number of files in weights manifest (${t.length}) and the number of weight files provided (${this.weightsFiles.length}).`);return r}}function ou(e){return new au(e)}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function su(e,t,n,r){!function(e){X(null!=e&&Array.isArray(e)&&e.length>0,(()=>"promises must be a none empty array"))}(e),function(e,t){X(e>=0&&e<=1,(()=>`Progress fraction must be in range [0, 1], but got startFraction ${e}`)),X(t>=0&&t<=1,(()=>`Progress fraction must be in range [0, 1], but got endFraction ${t}`)),X(t>=e,(()=>`startFraction must be no more than endFraction, but got startFraction ${e} and endFraction ${t}`))}(n=null==n?0:n,r=null==r?1:r);let a=0;return Promise.all(e.map((o=>(o.then((o=>{const s=n+ ++a/e.length*(r-n);return t(s),o})),o))))}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function iu(e,t){null==t&&(t={});const n=null==t.fetchFunc?Be().platform.fetch:t.fetchFunc,r=e.map((e=>n(e,t.requestInit,{isBinary:!0}))),a=(null==t.onProgress?await Promise.all(r):await su(r,t.onProgress,0,.5)).map((e=>e.arrayBuffer()));return null==t.onProgress?await Promise.all(a):await su(a,t.onProgress,.5,1)}async function uu(e,t="",n,r){return lu((e=>iu(e,{requestInit:r})))(e,t,n)}function lu(e){return async(t,n="",r)=>{const a=t.map((()=>!1)),o={},s=null!=r?r.map((()=>!1)):[],i=[];if(t.forEach(((e,t)=>{let n=0;e.weights.forEach((e=>{const u="quantization"in e?e.quantization.dtype:e.dtype,l=Go[u]*ee(e.shape),c=()=>{a[t]=!0,null==o[t]&&(o[t]=[]),o[t].push({manifestEntry:e,groupOffset:n,sizeBytes:l})};null!=r?r.forEach(((t,n)=>{t===e.name&&(c(),s[n]=!0)})):c(),i.push(e.name),n+=l}))})),!s.every((e=>e))){const e=r.filter(((e,t)=>!s[t]));throw new Error(`Could not find weights in manifest with names: ${e.join(", ")}. \nManifest JSON has weights with names: ${i.join(", ")}.`)}const u=a.reduce(((e,t,n)=>(t&&e.push(n),e)),[]),l=[];u.forEach((e=>{t[e].paths.forEach((e=>{const t=n+(n.endsWith("/")?"":"/")+e;l.push(t)}))}));const c=await e(l),p={};let d=0;return u.forEach((e=>{const n=t[e].paths.length,r=new Ko(c.slice(d,d+n));o[e].forEach((e=>{const t=Xo(r.slice(e.groupOffset,e.groupOffset+e.sizeBytes),[e.manifestEntry]);for(const e in t)p[e]=t[e]})),d+=n})),p}}ls.registerSaveRouter((e=>Be().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(ru.URL_SCHEME)?function(e="model"){return new ru(e)}(e.slice(ru.URL_SCHEME.length)):null));class cu{constructor(e,t){if(this.DEFAULT_METHOD="POST",null==t&&(t={}),this.weightPathPrefix=t.weightPathPrefix,this.onProgress=t.onProgress,this.weightUrlConverter=t.weightUrlConverter,null!=t.fetchFunc?(X("function"==typeof t.fetchFunc,(()=>"Must pass a function that matches the signature of `fetch` (see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)")),this.fetch=t.fetchFunc):this.fetch=Be().platform.fetch,X(null!=e&&e.length>0,(()=>"URL path for http must not be null, undefined or empty.")),Array.isArray(e)&&X(2===e.length,(()=>`URL paths for http must have a length of 2, (actual length is ${e.length}).`)),this.path=e,null!=t.requestInit&&null!=t.requestInit.body)throw new Error("requestInit is expected to have no pre-existing body, but has one.");this.requestInit=t.requestInit||{}}async save(e){if(e.modelTopology instanceof ArrayBuffer)throw new Error("BrowserHTTPRequest.save() does not support saving model topology in binary formats yet.");const t=Object.assign({method:this.DEFAULT_METHOD},this.requestInit);t.body=new FormData;const n=rs(e,[{paths:["./model.weights.bin"],weights:e.weightSpecs}]);if(t.body.append("model.json",new Blob([JSON.stringify(n)],{type:"application/json"}),"model.json"),null!=e.weightData){const n=Ko.join(e.weightData);t.body.append("model.weights.bin",new Blob([n],{type:"application/octet-stream"}),"model.weights.bin")}const r=await this.fetch(this.path,t);if(r.ok)return{modelArtifactsInfo:ss(e),responses:[r]};throw new Error(`BrowserHTTPRequest.save() failed due to HTTP response status ${r.status}.`)}async load(){const e=await this.fetch(this.path,this.requestInit);if(!e.ok)throw new Error(`Request to ${this.path} failed with status code ${e.status}. Please verify this URL points to the model JSON of the model to load.`);let t;try{t=await e.json()}catch(e){let t=`Failed to parse model JSON of response from ${this.path}.`;throw this.path.endsWith(".pb")?t+=" Your path contains a .pb file extension. Support for .pb models have been removed in TensorFlow.js 1.0 in favor of .json models. You can re-convert your Python TensorFlow model using the TensorFlow.js 1.0 conversion scripts or you can convert your.pb models with the 'pb2json'NPM script in the tensorflow/tfjs-converter repository.":t+=" Please make sure the server is serving valid JSON for this request.",new Error(t)}const n=t.modelTopology,r=t.weightsManifest;if(null==n&&null==r)throw new Error(`The JSON from HTTP path ${this.path} contains neither model topology or manifest for weights.`);return os(t,(e=>this.loadWeights(e)))}async loadWeights(e){const t=Array.isArray(this.path)?this.path[1]:this.path,[n,r]=function(e){const t=e.lastIndexOf("/"),n=e.lastIndexOf("?"),r=e.substring(0,t),a=n>t?e.substring(n):"";return[r+"/",a]}(t),a=this.weightPathPrefix||n,o=is(e),s=[],i=[];for(const t of e)for(const e of t.paths)null!=this.weightUrlConverter?i.push(this.weightUrlConverter(e)):s.push(a+e+r);this.weightUrlConverter&&s.push(...await Promise.all(i));return[o,await iu(s,{requestInit:this.requestInit,fetchFunc:this.fetch,onProgress:this.onProgress})]}}function pu(e){return null!=e.match(cu.URL_SCHEME_REGEX)}cu.URL_SCHEME_REGEX=/^https?:\/\//;const du=(e,t)=>{if("undefined"==typeof fetch&&(null==t||null==t.fetchFunc))return null;{let n=!0;if(n=Array.isArray(e)?e.every((e=>pu(e))):pu(e),n)return fu(e,t)}return null};function fu(e,t){return new cu(e,t)}function hu(e,t){return fu(e,t)}ls.registerSaveRouter(du),ls.registerLoadRouter(du);
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class mu{constructor(e){this.modelArtifacts=e}load(){return this.modelArtifacts}}class gu{constructor(e){this.saveHandler=e}save(e){return this.saveHandler(e)}}class yu{constructor(e){e.load&&(this.load=()=>Promise.resolve(e.load())),e.save&&(this.save=t=>Promise.resolve(e.save(t)))}}function bu(e,t,n,r){return new yu(vu(...arguments))}function vu(e,t,n,r){if(1===arguments.length){return null!=e.modelTopology||null!=e.weightSpecs?new mu(e):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new mu({modelTopology:e}))}return console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new mu({modelTopology:e,weightSpecs:t,weightData:n,trainingConfig:r})}function wu(e){return new gu(e)}function xu(e){return new gu(e)}const ku=jo({matMul_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=!1,r=!1){let a=Bo(e,"a","matMul"),o=Bo(t,"b","matMul");[a,o]=xo(a,o);const s={a,b:o},i={transposeA:n,transposeB:r};return Mo.runKernel(lt,s,i)}});const Su=jo({oneHot_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=1,r=0,a="int32"){if(t<2)throw new Error(`Error in oneHot: depth must be >=2, but it is ${t}`);const o={indices:Bo(e,"indices","oneHot","int32")},s={dtype:a,depth:t,onValue:n,offValue:r};return Mo.runKernel(Qn,o,s)}});const Eu=jo({imag_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={input:Bo(e,"input","imag")};return Mo.runKernel(cn,t)}});const Nu=jo({neg_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","neg")};return Mo.runKernel(jn,t)}});const Tu=jo({real_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={input:Bo(e,"input","real")};return Mo.runKernel(sr,t)}});const _u=jo({transpose_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","transpose");if(null==t&&(t=r.shape.map(((e,t)=>t)).reverse()),X(r.rank===t.length,(()=>`Error in transpose: rank of input ${r.rank} must match length of perm ${t}.`)),t.forEach((e=>{X(e>=0&&e<r.rank,(()=>"All entries in 'perm' must be between 0 and "+(r.rank-1)+` but got ${t}`))})),r.rank<=1)return r.clone();const a={x:r},o={perm:t};return"complex64"===r.dtype?oi((()=>{let e=Tu(r),t=Eu(r);return e=Mo.runKernel(Zr,{x:e},o),t=Mo.runKernel(Zr,{x:t},o),n&&(t=Nu(t)),Wo(e,t)})):Mo.runKernel(Zr,a,o)}});const Au=jo({confusionMatrix_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"labels","confusionMatrix"),a=Bo(t,"predictions","confusionMatrix");X(null==n||n>0&&Number.isInteger(n),(()=>`If provided, numClasses must be a positive integer, but got ${n}`)),X(1===r.rank,(()=>`Expected the rank of labels to be 1, but got ${r.rank}`)),X(1===a.rank,(()=>`Expected the rank of predictions to be 1, but got ${a.rank}`)),X(r.shape[0]===a.shape[0],(()=>`Mismatch in the number of examples: ${r.shape[0]} vs. ${a.shape[0]}. Labels and predictions should have the same number of elements.`)),X(n>0&&Number.isInteger(n),(()=>`numClasses is required to be a positive integer, but got ${n}`));const o=Su(Ks(r,"int32"),n),s=Su(Ks(a,"int32"),n),i=_u(o),u=ku(i,s);return Ks(u,"int32")}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Iu(e,t,n){if(J(e),null!=t&&3!==t.length)throw new Error("tensor3d() requires shape to have three numbers");const r=Po(e,n);if(3!==r.length&&1!==r.length)throw new Error("tensor3d() requires values to be number[][][] or flat/TypedArray");if(1===r.length&&null==t)throw new Error("tensor3d() requires shape to be provided when `values` are a flat array");return Ho(e,t,r,n)}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
let Mu,Ou=!1;function Du(e,t=3){if(t>4)throw new Error("Cannot construct Tensor with more than 4 channels from pixels.");if(null==e)throw new Error("pixels passed to tf.browser.fromPixels() can not be null");let n=!1,r=!1,a=!1,o=!1,s=!1,i=!1;if(e.data instanceof Uint8Array)n=!0;else if("undefined"!=typeof ImageData&&e instanceof ImageData)r=!0;else if("undefined"!=typeof HTMLVideoElement&&e instanceof HTMLVideoElement)a=!0;else if("undefined"!=typeof HTMLImageElement&&e instanceof HTMLImageElement)o=!0;else if(null!=e.getContext)s=!0;else{if(!("undefined"!=typeof ImageBitmap&&e instanceof ImageBitmap))throw new Error(`pixels passed to tf.browser.fromPixels() must be either an HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, ImageData in browser, or OffscreenCanvas, ImageData in webworker or {data: Uint32Array, width: number, height: number}, but was ${e.constructor.name}`);i=!0}if(null!=ha(oa,Mo.backendName)){const n={pixels:e},r={numChannels:t};return Mo.runKernel(oa,n,r)}const[u,l]=a?[e.videoWidth,e.videoHeight]:[e.width,e.height];let c,p;if(s)c=e.getContext("2d").getImageData(0,0,u,l).data;else if(r||n)c=e.data;else if(o||a||i){if(null==Mu)if("undefined"==typeof document){if("undefined"==typeof OffscreenCanvas||"undefined"==typeof OffscreenCanvasRenderingContext2D)throw new Error("Cannot parse input in current context. Reason: OffscreenCanvas Context2D rendering is not supported.");Mu=new OffscreenCanvas(1,1).getContext("2d")}else Mu=document.createElement("canvas").getContext("2d",{willReadFrequently:!0});Mu.canvas.width=u,Mu.canvas.height=l,Mu.drawImage(e,0,0,u,l),c=Mu.getImageData(0,0,u,l).data}if(4===t)p=new Int32Array(c);else{const e=u*l;p=new Int32Array(e*t);for(let n=0;n<e;n++)for(let e=0;e<t;++e)p[n*t+e]=c[4*n+e]}return Iu(p,[l,u,t],"int32")}function Cu(e){return"undefined"!=typeof window&&"undefined"!=typeof ImageBitmap&&window.hasOwnProperty("createImageBitmap")&&!(e instanceof ImageBitmap)&&function(e){return null!=e&&0!==e.width&&0!==e.height}(e)&&!function(e){return null!=e&&e.data instanceof Uint8Array}(e)}async function $u(e,t=3){let n=null;if(Be().getBool("WRAP_TO_IMAGEBITMAP")&&Cu(e)){let t;try{t=await createImageBitmap(e,{premultiplyAlpha:"none"})}catch(e){t=null}n=null!=t&&t.width===e.width&&t.height===e.height?t:e}else n=e;return Du(n,t)}function Ru(e){if(2!==e.rank&&3!==e.rank)throw new Error(`toPixels only supports rank 2 or 3 tensors, got rank ${e.rank}.`);const t=2===e.rank?1:e.shape[2];if(t>4||2===t)throw new Error(`toPixels only supports depth of size 1, 3 or 4 but got ${t}`);if("float32"!==e.dtype&&"int32"!==e.dtype)throw new Error(`Unsupported type for toPixels: ${e.dtype}. Please use float32 or int32 tensors.`)}async function Fu(e,t){let n=Bo(e,"img","toPixels");if(!(e instanceof io)){const e=n;n=Ks(e,"int32"),e.dispose()}Ru(n);const[r,a]=n.shape.slice(0,2),o=2===n.rank?1:n.shape[2],s=await n.data(),i="float32"===n.dtype?255:1,u=new Uint8ClampedArray(a*r*4);for(let e=0;e<r*a;++e){const t=[0,0,0,255];for(let r=0;r<o;r++){const a=s[e*o+r];if("float32"===n.dtype){if(a<0||a>1)throw new Error(`Tensor values for a float32 Tensor must be in the range [0 - 1] but encountered ${a}.`)}else if("int32"===n.dtype&&(a<0||a>255))throw new Error(`Tensor values for a int32 Tensor must be in the range [0 - 255] but encountered ${a}.`);1===o?(t[0]=a*i,t[1]=a*i,t[2]=a*i):t[r]=a*i}const r=4*e;u[r+0]=Math.round(t[0]),u[r+1]=Math.round(t[1]),u[r+2]=Math.round(t[2]),u[r+3]=Math.round(t[3])}if(null!=t){if(!Ou){null!=ha(Vt,Mo.backendName)&&(console.warn("tf.browser.toPixels is not efficient to draw tensor on canvas. Please try tf.browser.draw instead."),Ou=!0)}t.width=a,t.height=r;const e=t.getContext("2d"),n=new ImageData(u,a,r);e.putImageData(n,0,0)}return n!==e&&n.dispose(),u}function Pu(e,t,n){let r=Bo(e,"img","draw");if(!(e instanceof io)){const e=r;r=Ks(e,"int32"),e.dispose()}Ru(r),function(e){const t=(null==e?void 0:e.alpha)||1;if(t>1||t<0)throw new Error(`Alpha value ${t} is suppoed to be in range [0 - 1].`)}(null==n?void 0:n.imageOptions);const a={image:r},o={canvas:t,options:n};Mo.runKernel(Vt,a,o)}const Lu=jo({fromPixels_:Du});function zu(e,t){const n=e.shape.length,r=t.shape.length;if(n<1)throw new Error(`tf.gatherND() expects the input to be rank 1 or higher, but the rank was ${n}.`);if(r<1)throw new Error(`tf.gatherND() expects the indices to be rank 1 or higher, but the rank was ${r}.`);if("int32"!==t.dtype)throw new Error(`tf.gatherND() expects the indices to be int32 type, but the dtype was ${t.dtype}.`);if(t.shape[r-1]>n)throw new Error(`index innermost dimension length must be <= tensor rank; saw: ${t.shape[r-1]} vs. ${n}`);if(0===ee(e.shape))throw new Error(`Requested more than 0 entries, but input is empty. Input shape: ${e.shape}.`);const a=t.shape,o=a[a.length-1];let s=1;for(let e=0;e<a.length-1;++e)s*=a[e];const i=e.shape,u=a.slice();u.pop();let l=1;for(let e=o;e<n;++e)l*=i[e],u.push(i[e]);const c=[...Te(e.shape).map((e=>e/l)),1].slice(0,o);return[u,s,l,c]}function Bu(e,t,n){const r=t.rank>1?t.shape[t.rank-1]:1,a=t.rank>1?t.rank-1:1,o=`Must have updates.shape = indices.shape[:batchDim] + shape[sliceDim:], got updates.shape: ${n.shape}, indices.shape: ${t.shape}, shape: ${e}, sliceDim: ${r}, and batchDim: ${a}.`;if(n.rank<a)throw new Error(o+` update.rank < ${a}. `);if(e.length<r+(n.rank-a))throw new Error(o+` Output shape length < ${r+(n.rank-a)}`);if(n.rank!==a+e.length-r)throw new Error(o+" update.rank != "+(a+e.length-r));for(let e=0;e<a;++e)if(n.shape[e]!==t.shape[e])throw new Error(o+` updates.shape[${e}] (${n.shape[e]}) != indices.shape[${e}] (${t.shape[e]}).`);for(let t=0;t<n.rank-a;++t)if(n.shape[t+a]!==e[t+r])throw new Error(o+` updates.shape[${t+a}] (${n.shape[t+a]}) != shape[${t+a}] (${e[t+a]})`)}function Vu(e,t,n){if(t.rank<1)throw new Error(`tf.scatterND() expects the indices to be rank 1 or higher, but the rank was ${t.rank}.`);if(e.rank<1)throw new Error(`tf.scatterND() expects the updates to be rank 1 or higher, but the rank was ${e.rank}.`);if("int32"!==t.dtype)throw new Error(`The dtype of 'indices' should be int32, but got dtype: ${t.dtype}`);if(n.length<1)throw new Error(`Output rank must be greater or equal to 1, but got shape: ${n}`);if(0===n.length){if(0===t.size)throw new Error(`Indices specified for empty output. indices shape: ${t.shape}`);if(0===e.size)throw new Error(`Updates specified for empty output. updates shape: ${e.shape}`)}Bu(n,t,e)}function Uu(e,t,n){const r=t.shape.length,a=r>1?t.shape[r-1]:1,o=n.length;let s=1;for(let e=a;e<o;++e)s*=n[e];const i=a<1?1:a;return{sliceRank:a,numUpdates:ee(t.shape)/i,sliceSize:s,strides:[...Te(n.slice(0,a)),1],outputSize:ee(n)}}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ju=-2,Wu=-1;function Hu(e,t,n){const r=e.shape.length;X(r===t.length,(()=>`Error in slice${r}D: Length of begin ${t} must match the rank of the array (${r}).`)),X(r===n.length,(()=>`Error in slice${r}D: Length of size ${n} must match the rank of the array (${r}).`));for(let a=0;a<r;++a)X(t[a]+n[a]<=e.shape[a],(()=>`Error in slice${r}D: begin[${a}] + size[${a}] (${t[a]+n[a]}) would overflow input.shape[${a}] (${e.shape[a]})`))}function qu(e){const t=[];let n=0;for(;e>0;)1&e&&t.push(n),e/=2,n++;return t}function Gu(e,t,n){const r=[];for(let a=0;a<e.length;a++)r[a]=Math.ceil((t[a]-e[a])/n[a]);return r}function Ku(e,t,n,r){const a=[...e];for(let e=a.length;e<r.length;e++)a.push(1);for(let e=0;e<n;e++)0===e?a[t]=1:(a.splice(t,0,1),a.pop());return a}function Qu(e,t,n){return n<=e?n:n-(t-1)}function Yu(e,t){const n=[];for(let r=0;r<e;r++)n.push(t+r);return n}function Xu(e,t,n,r,a,o,s,i,u){const l=e.length;let c=new Array(l),p=new Array(l),d=new Array(l);if(t.length&&n>0){const u=t[0],l=n+1;c=Zu(s,u,l,r,e),p=Ju(i,u,l,a,e),d=Ku(o,u,l,e)}else for(let t=0;t<l;t++)c[t]=tl(s,r,o,e,t,u),p[t]=nl(i,a,o,e,t,u),d[t]=el(o,t,u);return{begin:c,end:p,strides:d}}function Zu(e,t,n,r,a){const o=[...a],s=Yu(n,t);for(let a=0;a<o.length;a++)if(s.indexOf(a)>-1)o[a]=0;else{const s=Qu(t,n,a);let i=r[s];e&1<<s&&(i=0),o[a]=i}return o}function Ju(e,t,n,r,a){const o=[...a],s=Yu(n,t);for(let a=0;a<o.length;a++)if(s.indexOf(a)>-1)o[a]=Number.MAX_SAFE_INTEGER;else{const s=Qu(t,n,a);let i=r[s];e&1<<s&&(i=Number.MAX_SAFE_INTEGER),o[a]=i}for(let e=0;e<o.length;e++){const t=a[e];o[e]<0&&(o[e]+=t),o[e]=H(0,o[e],a[e])}return o}function el(e,t,n){let r=e[t];return(n&1<<t||null==r)&&(r=1),r}function tl(e,t,n,r,a,o){let s=t[a];const i=n[a]||1;(e&1<<a||o&1<<a||null==s)&&(s=i>0?Number.MIN_SAFE_INTEGER:Number.MAX_SAFE_INTEGER);const u=r[a];return s<0&&(s+=u),s=H(0,s,u-1),s}function nl(e,t,n,r,a,o){let s=t[a];const i=n[a]||1;(e&1<<a||o&1<<a||null==s)&&(s=i>0?Number.MAX_SAFE_INTEGER:Number.MIN_SAFE_INTEGER);const u=r[a];return s<0&&(s+=u),s=i>0?H(0,s,u):H(-1,s,u-1),s}function rl(e,t,n){let r=n.length;for(let e=0;e<n.length;e++)if(n[e]>1){r=e;break}for(let a=r+1;a<n.length;a++)if(t[a]>0||n[a]!==e[a])return!1;return!0}function al(e,t){let n=e.length>0?e[e.length-1]:1;for(let r=0;r<e.length-1;r++)n+=e[r]*t[r];return n}function ol(e,t,n){let r;const a=e.shape.length;let o;return r="number"==typeof t?[t,...new Array(a-1).fill(0)]:t.length<a?t.concat(new Array(a-t.length).fill(0)):t.slice(),r.forEach((e=>{X(-1!==e,(()=>"slice() does not support negative begin indexing."))})),o=null==n?new Array(a).fill(-1):"number"==typeof n?[n,...new Array(a-1).fill(-1)]:n.length<a?n.concat(new Array(a-n.length).fill(-1)):n,o=o.map(((t,n)=>t>=0?t:(X(-1===t,(()=>`Negative size values should be exactly -1 but got ${t} for the slice() size at index ${n}.`)),e.shape[n]-r[n]))),[r,o]}function sl(e,t,n,r,a,o,s,i,u){let l;if(null==r?(l=new Array(t.length),l.fill(1)):l=r,null!=s&&0!=(s&s-1))throw new Error("Multiple ellipses in slice is not allowed.");let c=!1;const p={dims:l.length,numAddAxisAfterEllipsis:0,begin:t.slice(),end:n.slice(),strides:l.slice(),beginMask:a,endMask:o,ellipsisMask:s,newAxisMask:i,shrinkAxisMask:u};for(let e=0;e<p.dims;e++)c&&0!=(1<<e&i)&&p.numAddAxisAfterEllipsis++,1<<e&s&&(c=!0);c||(p.ellipsisMask|=1<<p.dims,p.dims++);const d={dims:e.length,beginMask:0,endMask:0,beginValid:!1,endValid:!1};!function(e,t){t.beginMask=0,t.endMask=0,t.shrinkAxisMask=0;let n=0;t.beginValid=null!=e.begin,t.endValid=null!=e.end,t.begin=new Array(t.dims),t.end=new Array(t.dims),t.strides=new Array(t.dims),t.finalShapeGatherIndices=[],t.finalShapeGatherIndicesSparse=[],t.inputShapeGatherIndicesSparse=new Array(t.dims);for(let r=0;r<e.dims;r++)if(1<<r&e.ellipsisMask){const a=Math.min(t.dims-(e.dims-r)+1+e.numAddAxisAfterEllipsis,t.dims);for(;n<a;n++)t.begin[n]=0,t.end[n]=0,t.strides[n]=1,t.beginMask|=1<<n,t.endMask|=1<<n,t.finalShapeGatherIndices.push(n),t.finalShapeGatherIndicesSparse.push(-1),t.inputShapeGatherIndicesSparse[n]=r}else if(1<<r&e.newAxisMask)t.finalShapeGatherIndices.push(ju),t.finalShapeGatherIndicesSparse.push(-1);else{if(n===t.begin.length)throw Error(`Index out of range using input dim ${n}; input has only ${t.dims} dims, ${t.begin.length}.`);null!=e.begin&&(t.begin[n]=e.begin[r]),null!=e.end&&(t.end[n]=e.end[r]),t.strides[n]=e.strides[r],e.beginMask&1<<r&&(t.beginMask|=1<<n),e.endMask&1<<r&&(t.endMask|=1<<n),e.shrinkAxisMask&1<<r?(t.finalShapeGatherIndices.push(Wu),t.finalShapeGatherIndicesSparse.push(-1),t.shrinkAxisMask|=1<<n):(t.finalShapeGatherIndices.push(n),t.finalShapeGatherIndicesSparse.push(r)),t.inputShapeGatherIndicesSparse[n]=r,n++}}(p,d);let f=!0,h=!0,m=!0;const g=[],y=[];for(let t=0;t<e.length;++t){if(0===d.strides[t])throw Error(`strides[${t}] must be non-zero`);const n=!!(d.shrinkAxisMask&1<<t),r=e[t];if(-1===r){g.push(n?1:-1);continue}const a=[d.beginMask&1<<t,d.endMask&1<<t],o=[d.strides[t]>0?0:-1,d.strides[t]>0?r:r-1];if(n&&d.strides[t]<=0)throw Error("only stride 1 allowed on non-range indexing.");m=m&&1===d.strides[t];const s=!!(d.beginMask&1<<t&&d.endMask&1<<t);if(d.beginValid&&d.endValid){if(n){const e=d.begin[t]<0?r+d.begin[t]:d.begin[t];if(d.begin[t]=e,d.end[t]=d.begin[t]+1,e<0||e>=r)throw Error(`slice index ${d.begin[t]} of dimension ${t} out of bounds.`)}else d.begin[t]=il(d.begin[t],0,d.strides[t],r,a,o),d.end[t]=il(d.end[t],1,d.strides[t],r,a,o);const e=1===d.strides[t]&&0===d.begin[t]&&d.end[t]===r;f=f&&e,h=h&&(0===t&&1===d.strides[t]||e)}else f=f&&1===d.strides[t]&&s,h=h&&(0===t&&1===d.strides[t]||s);let i,u=!1;if(d.beginValid&&d.endValid?(i=d.end[t]-d.begin[t],u=!0):n?(i=1,u=!0):s&&r>=0&&(i=d.strides[t]<0?-r:r,u=!0),u){let e;e=0===i||i<0!=d.strides[t]<0?0:Math.trunc(i/d.strides[t])+(i%d.strides[t]!=0?1:0),g.push(e)}else g.push(-1)}for(let e=0;e<d.finalShapeGatherIndices.length;++e){const t=d.finalShapeGatherIndices[e];t>=0?y.push(g[t]):t===ju&&y.push(1)}return{finalShapeSparse:y.filter(((e,t)=>d.finalShapeGatherIndices[t]!==ju)),finalShape:y,isIdentity:f,sliceDim0:h,isSimpleSlice:m,begin:d.begin,end:d.end,strides:d.strides}}function il(e,t,n,r,a,o){if(a[t])return n>0?o[t]:o[t+1&1];{const t=e<0?r+e:e;return t<o[0]?o[0]:t>o[1]?o[1]:t}}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ul=.001,ll=.1;function cl(e,t,n){return null==n&&(n=pl()),dl(e,t,((e,t)=>gl(e,t,n)))}function pl(){return 32===Mo.backend.floatPrecision()?ul:ll}function dl(e,t,n){let r=!0;if((Wa(e)||Wa(t))&&(r=!1),Wa(e)&&Wa(t)&&(r=!0),r){const n=e.constructor.name,r=t.constructor.name;if(n!==r)throw new Error(`Arrays are of different type. Actual: ${n}. Expected: ${r}`)}if(Array.isArray(e)&&Array.isArray(t)){const n=Po(e),r=Po(t);if(!re(n,r))throw new Error(`Arrays have different shapes. Actual: [${n}]. Expected: [${r}]`)}const a=Wa(e)?e:Ha(e),o=Wa(t)?t:Ha(t);if(a.length!==o.length)throw new Error(`Arrays have different lengths actual: ${a.length} vs expected: ${o.length}.\nActual:   ${a}.\nExpected: ${o}.`);for(let e=0;e<o.length;++e){const t=a[e],r=o[e];if(!n(t,r))throw new Error(`Arrays differ: actual[${e}] = ${t}, expected[${e}] = ${r}.\nActual:   ${a}.\nExpected: ${o}.`)}"undefined"!=typeof expect&&expect().nothing()}function fl(e,t){e().then((()=>t.fail()),(()=>t())),"undefined"!=typeof expect&&expect().nothing()}function hl(e,t){const n="string"==typeof t||"number"==typeof t||"boolean"==typeof t?[t]:t;return we(e)||we(e[0])||we(t)||we(t[0])?dl(e,n,((e,t)=>e==t)):dl(e,t,((e,t)=>gl(e,t,0)))}function ml(e,t,n){if(null==n&&(n=pl()),!gl(e,t,n))throw new Error(`Numbers differ: actual === ${e}, expected === ${t}`);"undefined"!=typeof expect&&expect().nothing()}function gl(e,t,n){return!isFinite(e)&&!isFinite(t)||!(isNaN(e)||isNaN(t)||Math.abs(e-t)>n)}function yl(e,t,n){for(let r=0;r<e.length;r++)if(e[r]<t||e[r]>n)throw new Error(`Value out of range:${e[r]} low: ${t}, high: ${n}`)}function bl(e,t){const n=new Float32Array(e),r=new Float32Array(t);if(n.length!==r.length)throw new Error(`Expected ArrayBuffer to be of length ${r.length}, but it was ${n.length}`);for(let e=0;e<r.length;e++)if(n[e]!==r[e])throw new Error(`Expected ArrayBuffer value at ${e} to be ${r[e]} but got ${n[e]} instead`)}function vl(e){for(let t=0;t<e.length;t++){const n=e[t];Array.isArray(n)?vl(n):e[t]=Ua(n)}return e}function wl(e){const t=document.createElement("video");return"playsInline"in t&&(t.playsInline=!0),t.muted=!0,t.loop=!0,t.style.position="fixed",t.style.left="0px",t.style.top="0px",t.preload="auto",t.appendChild(e),new Promise((e=>{t.addEventListener("loadeddata",(n=>e(t))),t.load()}))}async function xl(e){await e.play(),"requestVideoFrameCallback"in e&&await new Promise((t=>{e.requestVideoFrameCallback(t)}))}
/** @license See the LICENSE file. */
const kl="4.13.0";
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Sl{static sgd(e){return new Zi(e)}static momentum(e,t,n=!1){return new Ji(e,t,n)}static rmsprop(e,t=.9,n=0,r=null,a=!1){return new eu(e,t,n,r,a)}static adam(e=.001,t=.9,n=.999,r=null){return new Hi(e,t,n,r)}static adadelta(e=.001,t=.95,n=null){return new Bi(e,t,n)}static adamax(e=.002,t=.9,n=.999,r=null,a=0){return new Xi(e,t,n,r,a)}static adagrad(e,t=.1){return new Ui(e,t)}}const El=jo({acos_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","acos")};return Mo.runKernel(qe,t)}});const Nl=jo({acosh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","acosh")};return Mo.runKernel(Ge,t)}});const Tl=jo({addN_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){X(Array.isArray(e),(()=>"The argument passed to tf.addN() must be a list of tensors")),X(e.length>=1,(()=>`Must pass at least one tensor to tf.addN(), but got ${e.length}`));const t=e.map(((e,t)=>Bo(e,`tensors${t}`,"addN"))),n=t[0];t.forEach((e=>{if(e.dtype!==n.dtype)throw new Error("All tensors passed to tf.addN() must have the same dtype")})),t.forEach((e=>{if(!re(e.shape,n.shape))throw new Error("All tensors passed to tf.addN() must have the same shape")}));const r=t;return Mo.runKernel(Qe,r)}});const _l=jo({all_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r={x:Bo(e,"x","all","bool")},a={axis:t,keepDims:n};return Mo.runKernel(Ye,r,a)}});const Al=jo({any_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r={x:Bo(e,"x","any","bool")},a={axis:t,keepDims:n};return Mo.runKernel(Xe,r,a)}});const Il=jo({argMax_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n={x:Bo(e,"x","argMax")},r={axis:t};return Mo.runKernel(Ze,n,r)}});const Ml=jo({argMin_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n={x:Bo(e,"x","argMin")},r={axis:t};return Mo.runKernel(Je,n,r)}});const Ol=jo({asin_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","asin")};return Mo.runKernel(et,t)}});const Dl=jo({asinh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","asinh")};return Mo.runKernel(tt,t)}});const Cl=jo({atan_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","atan")};return Mo.runKernel(nt,t)}});const $l=jo({atan2_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","atan2"),r=Bo(t,"b","atan2");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(at,a)}});const Rl=jo({atanh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","atanh")};return Mo.runKernel(rt,t)}});
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Fl(e,t,n,r,a="NHWC",o){return zl(e,[...t,e[3]],n,o,r,null,null,Ql(a))}function Pl(e,t,n,r,a,o,s="channelsLast"){const[i,u]=Ul(t);let l;if("channelsLast"===s)l=[i,u,e[3],e[3]];else{if("channelsFirst"!==s)throw new Error(`Unknown dataFormat ${s}`);l=[i,u,e[1],e[1]]}return zl(e,l,n,r,a,o,!1,s)}function Ll(e,t,n,r,a,o,s="NDHWC"){const[i,u,l]=jl(t);let c,p;if("NDHWC"===s)p="channelsLast",c=[i,u,l,e[4],e[4]];else{if("NCDHW"!==s)throw new Error(`Unknown dataFormat ${s}`);p="channelsFirst",c=[i,u,l,e[1],e[1]]}return Bl(e,c,n,r,a,!1,p,o)}function zl(e,t,n,r,a,o,s=!1,i="channelsLast"){let[u,l,c,p]=[-1,-1,-1,-1];if("channelsLast"===i)[u,l,c,p]=e;else{if("channelsFirst"!==i)throw new Error(`Unknown dataFormat ${i}`);[u,p,l,c]=e}const[d,f,,h]=t,[m,g]=Ul(n),[y,b]=Ul(r),v=Wl(d,y),w=Wl(f,b),{padInfo:x,outHeight:k,outWidth:S}=function(e,t,n,r,a,o,s,i,u){let l,c,p;if("number"==typeof e){l={top:e,bottom:e,left:e,right:e,type:0===e?"VALID":"NUMBER"};const a=function(e,t,n,r,a){null==r&&(r=Vl(e,t,n));const o=e[0],s=e[1],i=Hl((o-t+2*r)/n+1,a),u=Hl((s-t+2*r)/n+1,a);return[i,u]}([t,n],o,r,e,i);c=a[0],p=a[1]}else if("same"===e){c=Math.ceil(t/r),p=Math.ceil(n/a);const e=Math.max(0,(c-1)*r+o-t),i=Math.max(0,(p-1)*a+s-n),u=Math.floor(e/2),d=e-u,f=Math.floor(i/2);l={top:u,bottom:d,left:f,right:i-f,type:"SAME"}}else if("valid"===e)l={top:0,bottom:0,left:0,right:0,type:"VALID"},c=Math.ceil((t-o+1)/r),p=Math.ceil((n-s+1)/a);else{if("object"!=typeof e)throw Error(`Unknown padding parameter: ${e}`);{const d="channelsLast"===u?e[1][0]:e[2][0],f="channelsLast"===u?e[1][1]:e[2][1],h="channelsLast"===u?e[2][0]:e[3][0],m="channelsLast"===u?e[2][1]:e[3][1];l={top:d,bottom:f,left:h,right:m,type:0===d&&0===f&&0===h&&0===m?"VALID":"EXPLICIT"},c=Hl((t-o+d+f)/r+1,i),p=Hl((n-s+h+m)/a+1,i)}}return{padInfo:l,outHeight:c,outWidth:p}}(a,l,c,m,g,v,w,o,i),E=s?h*p:h;let N;return"channelsFirst"===i?N=[u,E,k,S]:"channelsLast"===i&&(N=[u,k,S,E]),{batchSize:u,dataFormat:i,inHeight:l,inWidth:c,inChannels:p,outHeight:k,outWidth:S,outChannels:E,padInfo:x,strideHeight:m,strideWidth:g,filterHeight:d,filterWidth:f,effectiveFilterHeight:v,effectiveFilterWidth:w,dilationHeight:y,dilationWidth:b,inShape:e,outShape:N,filterShape:t}}function Bl(e,t,n,r,a,o=!1,s="channelsLast",i){let[u,l,c,p,d]=[-1,-1,-1,-1,-1];if("channelsLast"===s)[u,l,c,p,d]=e;else{if("channelsFirst"!==s)throw new Error(`Unknown dataFormat ${s}`);[u,d,l,c,p]=e}const[f,h,m,,g]=t,[y,b,v]=jl(n),[w,x,k]=jl(r),S=Wl(f,w),E=Wl(h,x),N=Wl(m,k),{padInfo:T,outDepth:_,outHeight:A,outWidth:I}=function(e,t,n,r,a,o,s,i,u,l,c){let p,d,f,h;"valid"===e&&(e=0);if("number"==typeof e){p={top:e,bottom:e,left:e,right:e,front:e,back:e,type:0===e?"VALID":"NUMBER"};const m=function(e,t,n,r,a,o){null==a&&(a=Vl(e,t[0],r[0]));const s=[0,0,0,n];for(let n=0;n<3;n++)e[n]+2*a>=t[n]&&(s[n]=Hl((e[n]-t[n]+2*a)/r[n]+1,o));return s}([t,n,r,1],[i,u,l],1,[a,o,s],e,c);d=m[0],f=m[1],h=m[2]}else{if("same"!==e)throw Error(`Unknown padding parameter: ${e}`);{d=Math.ceil(t/a),f=Math.ceil(n/o),h=Math.ceil(r/s);const e=(d-1)*a+i-t,c=(f-1)*o+u-n,m=(h-1)*s+l-r,g=Math.floor(e/2),y=e-g,b=Math.floor(c/2),v=c-b,w=Math.floor(m/2);p={top:b,bottom:v,left:w,right:m-w,front:g,back:y,type:"SAME"}}}return{padInfo:p,outDepth:d,outHeight:f,outWidth:h}}(a,l,c,p,y,b,v,S,E,N,i),M=o?g*d:g;let O;return"channelsFirst"===s?O=[u,M,_,A,I]:"channelsLast"===s&&(O=[u,_,A,I,M]),{batchSize:u,dataFormat:s,inDepth:l,inHeight:c,inWidth:p,inChannels:d,outDepth:_,outHeight:A,outWidth:I,outChannels:M,padInfo:T,strideDepth:y,strideHeight:b,strideWidth:v,filterDepth:f,filterHeight:h,filterWidth:m,effectiveFilterDepth:S,effectiveFilterHeight:E,effectiveFilterWidth:N,dilationDepth:w,dilationHeight:x,dilationWidth:k,inShape:e,outShape:O,filterShape:t}}function Vl(e,t,n,r=1){const a=Wl(t,r);return Math.floor((e[0]*(n-1)-n+a)/2)}function Ul(e){return"number"==typeof e?[e,e,e]:2===e.length?[e[0],e[1],1]:e}function jl(e){return"number"==typeof e?[e,e,e]:e}function Wl(e,t){return t<=1?e:e+(e-1)*(t-1)}function Hl(e,t){if(!t)return Math.trunc(e);switch(t){case"round":return Math.round(e);case"ceil":return Math.ceil(e);case"floor":return Math.floor(e);default:throw new Error(`Unknown roundingMode ${t}`)}}function ql(e){const[t,n,r]=Ul(e);return 1===t&&1===n&&1===r}function Gl(e,t){return ql(e)||ql(t)}function Kl(e){return Ul(e).every((e=>e>0))}function Ql(e){if("NHWC"===e)return"channelsLast";if("NCHW"===e)return"channelsFirst";throw new Error(`Unknown dataFormat ${e}`)}function Yl(e,t,n){if(null!=n){if("string"==typeof t)throw Error(`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${t}.`);if("number"==typeof t)X(ae(t),(()=>`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${t}.`));else{if("object"!=typeof t)throw Error(`Error in ${e}: Unknown padding parameter: ${t}`);t.forEach((t=>{t.forEach((t=>{X(ae(t),(()=>`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${t}.`))}))}))}}}const Xl=jo({reshape_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n={x:Bo(e,"x","reshape","string_or_numeric")},r={shape:t};return Mo.runKernel(lr,n,r)}});const Zl=jo({avgPool_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a){const o=Bo(e,"x","avgPool","float32");X(Gl(n,1),(()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${n} and dilations '1'`));let s=o,i=!1;3===o.rank&&(i=!0,s=Xl(o,[1,o.shape[0],o.shape[1],o.shape[2]])),X(4===s.rank,(()=>`Error in avgPool: x must be rank 4 but got rank ${s.rank}.`)),Yl("avgPool",r,a);const u={x:s},l={filterSize:t,strides:n,pad:r,dimRoundingMode:a};let c=Mo.runKernel(ot,u,l);return c=Ks(c,o.dtype),i?Xl(c,[c.shape[1],c.shape[2],c.shape[3]]):c}});const Jl=jo({avgPool3d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o="NDHWC"){const s=Bo(e,"x","avgPool3d","float32");let i=s,u=!1;4===s.rank&&(u=!0,i=Xl(s,[1,s.shape[0],s.shape[1],s.shape[2],s.shape[3]])),X(5===i.rank,(()=>`Error in avgPool3d: x must be rank 5 but got rank ${i.rank}.`)),X("NDHWC"===o,(()=>`Error in avgPool3d: Only NDHWC is currently supported, but got dataFormat of ${o}`)),X("number"==typeof n&&n>0||Array.isArray(n)&&n[0]>0&&n[1]>0&&n[2]>0,(()=>`Error in avgPool3d: Stride must be > 0, but got '${n}'`)),Yl("avgPool3d",r,a);const l={x:i},c={filterSize:t,strides:n,pad:r,dimRoundingMode:a,dataFormat:o};let p=Mo.runKernel(it,l,c);return p=Ks(p,i.dtype),u?Xl(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}});const ec=jo({concat_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){X(e.length>=1,(()=>"Pass at least one tensor to concat"));const n=Vo(e,"tensors","concat","string_or_numeric");if("complex64"===n[0].dtype&&n.forEach((e=>{if("complex64"!==e.dtype)throw new Error(`Cannot concatenate complex64 tensors with a tensor\n          with dtype ${e.dtype}. `)})),1===n.length)return Qs(n[0]);const r=n,a={axis:t};return Mo.runKernel(wt,r,a)}});const tc=jo({sigmoid_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","sigmoid","float32")};return Mo.runKernel(_r,t)}});const nc=jo({slice_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","slice","string_or_numeric");if(0===r.rank)throw new Error("Slicing scalar is not possible");const a={x:r},o={begin:t,size:n};return Mo.runKernel(Sr,a,o)}});const rc=jo({tanh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","tanh","float32")};return Mo.runKernel(Kr,t)}});const ac=jo({basicLSTMCell_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o){const s=Bo(e,"forgetBias","basicLSTMCell"),i=Bo(t,"lstmKernel","basicLSTMCell"),u=Bo(n,"lstmBias","basicLSTMCell"),l=Bo(r,"data","basicLSTMCell"),c=Bo(a,"c","basicLSTMCell"),p=Bo(o,"h","basicLSTMCell"),d=ec([l,p],1),f=ku(d,i),h=bi(f,u),m=h.shape[0],g=h.shape[1]/4,y=[m,g],b=nc(h,[0,0],y),v=nc(h,[0,g],y),w=nc(h,[0,2*g],y),x=nc(h,[0,3*g],y),k=bi(xi(tc(b),rc(v)),xi(c,tc(bi(s,w))));return[k,xi(rc(k),tc(x))]}});const oc=jo({batchToSpaceND_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","batchToSpaceND"),a=t.reduce(((e,t)=>e*t));X(r.rank>=1+t.length,(()=>`input rank is ${r.rank} but should be > than blockShape.length ${t.length}`)),X(n.length===t.length,(()=>`crops.length is ${n.length} but should be equal to blockShape.length  ${t.length}`)),X(r.shape[0]%a==0,(()=>`input tensor batch is ${r.shape[0]} but is not divisible by the product of the elements of blockShape ${t.join(" * ")} === ${a}`));const o={x:r},s={blockShape:t,crops:n};return Mo.runKernel(ct,o,s)}});const sc=jo({batchNorm_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o){null==o&&(o=.001);const s=Bo(e,"x","batchNorm"),i=Bo(t,"mean","batchNorm"),u=Bo(n,"variance","batchNorm");let l,c;null!=a&&(l=Bo(a,"scale","batchNorm")),null!=r&&(c=Bo(r,"offset","batchNorm")),X(i.rank===u.rank,(()=>"Batch normalization gradient requires mean and variance to have equal ranks.")),X(null==c||i.rank===c.rank,(()=>"Batch normalization gradient requires mean and offset to have equal ranks.")),X(null==l||i.rank===l.rank,(()=>"Batch normalization gradient requires mean and scale to have equal ranks."));const p={x:function(e){let t;return t=0===e.rank||1===e.rank?Xl(e,[1,1,1,e.size]):2===e.rank?Xl(e,[1,1,e.shape[0],e.shape[1]]):3===e.rank?Xl(e,[1,e.shape[0],e.shape[1],e.shape[2]]):e,t}(s),scale:l,offset:c,mean:i,variance:u},d={varianceEpsilon:o},f=Mo.runKernel(nn,p,d);return Xl(f,s.shape)}});const ic=jo({batchNorm2d_:function(e,t,n,r,a,o){const s=Bo(e,"x","batchNorm"),i=Bo(t,"mean","batchNorm"),u=Bo(n,"variance","batchNorm");let l,c;return null!=a&&(l=Bo(a,"scale","batchNorm")),null!=r&&(c=Bo(r,"offset","batchNorm")),X(2===s.rank,(()=>`Error in batchNorm2D: x must be rank 2 but got rank ${s.rank}.`)),X(2===i.rank||1===i.rank,(()=>`Error in batchNorm2D: mean must be rank 2 or rank 1 but got rank ${i.rank}.`)),X(2===u.rank||1===u.rank,(()=>`Error in batchNorm2D: variance must be rank 2 or rank 1 but got rank ${u.rank}.`)),null!=l&&X(2===l.rank||1===l.rank,(()=>`Error in batchNorm2D: scale must be rank 2 or rank 1 but got rank ${l.rank}.`)),null!=c&&X(2===c.rank||1===c.rank,(()=>`Error in batchNorm2D: offset must be rank 2 or rank 1 but got rank ${c.rank}.`)),sc(s,i,u,c,l,o)}});const uc=jo({batchNorm3d_:function(e,t,n,r,a,o){const s=Bo(e,"x","batchNorm"),i=Bo(t,"mean","batchNorm"),u=Bo(n,"variance","batchNorm");let l,c;return null!=a&&(l=Bo(a,"scale","batchNorm")),null!=r&&(c=Bo(r,"offset","batchNorm")),X(3===s.rank,(()=>`Error in batchNorm3D: x must be rank 3 but got rank ${s.rank}.`)),X(3===i.rank||1===i.rank,(()=>`Error in batchNorm3D: mean must be rank 3 or rank 1 but got rank ${i.rank}.`)),X(3===u.rank||1===u.rank,(()=>`Error in batchNorm3D: variance must be rank 3 or rank 1 but got rank ${u.rank}.`)),null!=l&&X(3===l.rank||1===l.rank,(()=>`Error in batchNorm3D: scale must be rank 3 or rank 1 but got rank ${l.rank}.`)),null!=c&&X(3===c.rank||1===c.rank,(()=>`Error in batchNorm3D: offset must be rank 3 or rank 1 but got rank ${c.rank}.`)),sc(s,i,u,c,l,o)}});const lc=jo({batchNorm4d_:function(e,t,n,r,a,o){const s=Bo(e,"x","batchNorm"),i=Bo(t,"mean","batchNorm"),u=Bo(n,"variance","batchNorm");let l,c;return null!=a&&(l=Bo(a,"scale","batchNorm")),null!=r&&(c=Bo(r,"offset","batchNorm")),X(4===s.rank,(()=>`Error in batchNorm4D: x must be rank 4 but got rank ${s.rank}.`)),X(4===i.rank||1===i.rank,(()=>`Error in batchNorm4D: mean must be rank 4 or rank 1 but got rank ${i.rank}.`)),X(4===u.rank||1===u.rank,(()=>`Error in batchNorm4D: variance must be rank 4 or rank 1 but got rank ${u.rank}.`)),null!=l&&X(4===l.rank||1===l.rank,(()=>`Error in batchNorm4D: scale must be rank 4 or rank 1 but got rank ${l.rank}.`)),null!=c&&X(4===c.rank||1===c.rank,(()=>`Error in batchNorm4D: offset must be rank 4 or rank 1 but got rank ${c.rank}.`)),sc(s,i,u,c,l,o)}});const cc=jo({bincount_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","bincount"),a=Bo(t,"weights","bincount");X("int32"===r.dtype,(()=>`Error in bincount: input dtype must be int32, but got ${r.dtype}`)),X(n>=0,(()=>`size must be non-negative, but got ${n}.`)),X(a.size===r.size||0===a.size,(()=>`Error in bincount: weights must have the same size as input or0-length, but got input shape: ${r.shape}, weights shape: ${a.shape}.`));const o={x:r,weights:a},s={size:n};return Mo.runKernel(pt,o,s)}});const pc=jo({bitwiseAnd_:
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","bitwiseAnd"),r=Bo(t,"y","bitwiseAnd");if(!re(n.shape,r.shape))throw new Error(`BitwiseAnd: Tensors must have the same shape. x: ${n.shape}, y: ${r.shape}`);if("int32"!==n.dtype||"int32"!==r.dtype)throw new Error(`BitwiseAnd: Only supports 'int32' values in tensor, found type of x: ${n.dtype} and type of y: ${r.dtype}`);const a={a:n,b:r};return Mo.runKernel(dt,a)}});const dc=jo({broadcastArgs_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"s0","broadcastArgs","int32"),r=Bo(t,"s1","broadcastArgs","int32");if(1!==n.rank)throw new Error(`broadcastArgs(): first input must be a vector (rank=1). Has rank ${n.rank}`);if(1!==r.rank)throw new Error(`broadcastArgs(): second input must be a vector (rank=1). Has rank ${r.rank}`);const a={s0:n,s1:r};return Mo.runKernel(ht,a)}});const fc=jo({broadcastTo_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"broadcastTo","x");const r=n.shape;if(Ce(t),t.length<n.rank)throw new Error(`broadcastTo(): shape.length=${t.length} < input.rank=${n.rank}.`);if(t.length>n.rank){const e=n.shape.slice();for(;e.length<t.length;)e.unshift(1);n=Xl(n,e)}const a=n.shape,o=Array.from(t);for(let e=t.length-1;e>=0;e--)if(a[e]===t[e])o[e]=1;else if(1!==n.shape[e])throw new Error(`broadcastTo(): [${r}] cannot be broadcast to [${t}].`);if(0===o.map(((e,t)=>e>1?t:-1)).filter((e=>e>=0)).length)return Qs(n);const s={x:n},i={reps:o};return Mo.runKernel(Qr,s,i)}});const hc=jo({ceil_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","ceil","float32")};return Mo.runKernel(gt,t)}});const mc=jo({clipByValue_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","clipByValue");if(X(t<=n,(()=>`Error in clip: min (${t}) must be less than or equal to max (${n}).`)),t===n)return Vi(r.shape,t,r.dtype);const a={x:r},o={clipValueMin:t,clipValueMax:n};return Mo.runKernel(yt,a,o)}});const gc=jo({concat1d_:function(e){return ec(e,0)}});const yc=jo({concat2d_:function(e,t){return ec(e,t)}});const bc=jo({concat3d_:function(e,t){return ec(e,t)}});const vc=jo({concat4d_:function(e,t){return ec(e,t)}});const wc=jo({conv2d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a="NHWC",o=[1,1],s){const i=Bo(e,"x","conv2d","float32"),u=Bo(t,"filter","conv2d","float32");let l=i,c=!1;3===i.rank&&(c=!0,l=Xl(i,[1,i.shape[0],i.shape[1],i.shape[2]])),X(4===l.rank,(()=>`Error in conv2d: input must be rank 4, but got rank ${l.rank}.`)),X(4===u.rank,(()=>`Error in conv2d: filter must be rank 4, but got rank ${u.rank}.`)),Yl("conv2d",r,s);const p="NHWC"===a?l.shape[3]:l.shape[1];X(p===u.shape[2],(()=>`Error in conv2d: depth of input (${p}) must match input depth for filter ${u.shape[2]}.`)),X(Gl(n,o),(()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`)),X(Kl(o),(()=>"Error in conv2D: Dilated rates should be larger than 0.")),X(Kl(n),(()=>"Error in conv2D: Strides should be larger than 0."));const d={x:l,filter:u},f={strides:n,pad:r,dataFormat:a,dilations:o,dimRoundingMode:s},h=Mo.runKernel(xt,d,f);return c?Xl(h,[h.shape[1],h.shape[2],h.shape[3]]):h}});const xc=jo({conv1d_:function(e,t,n,r,a="NWC",o=1,s){const i=Bo(e,"x","conv1d"),u=Bo(t,"filter","conv1d");let l=i,c=!1;2===i.rank&&(c=!0,l=Xl(i,[1,i.shape[0],i.shape[1]])),X(3===l.rank,(()=>`Error in conv1d: input must be rank 3, but got rank ${l.rank}.`)),X(3===u.rank,(()=>`Error in conv1d: filter must be rank 3, but got rank ${u.rank}.`)),Yl("conv1d",r,s),X(l.shape[2]===u.shape[1],(()=>`Error in conv1d: depth of input (${l.shape[2]}) must match input depth for filter ${u.shape[1]}.`)),X(Gl(n,o),(()=>`Error in conv1D: Either stride or dilation must be 1. Got stride ${n} and dilation '${o}'`)),X(Kl(o),(()=>"Error in conv1D: Dilated rates should be larger than 0.")),X(Kl(n),(()=>"Error in conv1D: Stride should be larger than 0.")),X("NWC"===a,(()=>`Error in conv1d: got dataFormat of ${a} but only NWC is currently supported.`));const p=Xl(u,[1,u.shape[0],u.shape[1],u.shape[2]]),d=Xl(l,[l.shape[0],1,l.shape[1],l.shape[2]]),f=wc(d,p,[1,n],r,"NHWC",[1,o],s);return Xl(f,c?[f.shape[2],f.shape[3]]:[f.shape[0],f.shape[2],f.shape[3]])}});const kc=jo({conv2DBackpropInput_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o="NHWC",s){X(e.length===t.rank,(()=>`Length of inShape (${e.length}) and rank of dy (${t.rank}) must match`));let i=e,u=t,l=!1;3===t.rank&&(l=!0,u=Xl(t,[1,t.shape[0],t.shape[1],t.shape[2]]),i=[1,e[0],e[1],e[2]]),X(4===i.length,(()=>`Error in conv2dDerInput: inShape must be length 4, but got length ${i.length}.`)),X(4===u.rank,(()=>`Error in conv2dDerInput: dy must be rank 4, but got rank ${u.rank}`)),X(4===n.rank,(()=>`Error in conv2dDerInput: filter must be rank 4, but got rank ${n.rank}`));const c="NHWC"===o?i[3]:i[1],p="NHWC"===o?u.shape[3]:u.shape[1];X(c===n.shape[2],(()=>`Error in conv2dDerInput: depth of input (${c}) must match input depth for filter ${n.shape[2]}.`)),X(p===n.shape[3],(()=>`Error in conv2dDerInput: depth of output (${p}) must match output depth for filter ${n.shape[3]}.`)),Yl("conv2dDerInput",a,s);const d={dy:u,filter:n},f={strides:r,pad:a,dataFormat:o,dimRoundingMode:s,inputShape:i},h=Mo.runKernel(St,d,f);return l?Xl(h,[h.shape[1],h.shape[2],h.shape[3]]):h}});const Sc=jo({conv2dTranspose_:function(e,t,n,r,a,o){const s=Bo(e,"x","conv2dTranspose"),i=Bo(t,"filter","conv2dTranspose");return kc(n,s,i,r,a,"NHWC",o)}});const Ec=jo({conv3d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a="NDHWC",o=[1,1,1]){const s=Bo(e,"x","conv3d"),i=Bo(t,"filter","conv3d");let u=s,l=!1;4===s.rank&&(l=!0,u=Xl(s,[1,s.shape[0],s.shape[1],s.shape[2],s.shape[3]])),X(5===u.rank,(()=>`Error in conv3d: input must be rank 5, but got rank ${u.rank}.`)),X(5===i.rank,(()=>`Error in conv3d: filter must be rank 5, but got rank ${i.rank}.`)),X(u.shape[4]===i.shape[3],(()=>`Error in conv3d: depth of input (${u.shape[4]}) must match input depth for filter ${i.shape[3]}.`)),X(Gl(n,o),(()=>`Error in conv3D: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`)),X("NDHWC"===a,(()=>`Error in conv3d: got dataFormat of ${a} but only NDHWC is currently supported.`)),X(Kl(o),(()=>"Error in conv3D: Dilated rates should be larger than 0.")),X(Kl(n),(()=>"Error in conv3D: Strides should be larger than 0."));const c={x:u,filter:i},p={strides:n,pad:r,dataFormat:a,dilations:o},d=Mo.runKernel(Et,c,p);return l?Xl(d,[d.shape[1],d.shape[2],d.shape[3],d.shape[4]]):d}});const Nc=jo({conv3DBackpropInput_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a){X(e.length===t.rank,(()=>`Length of inShape (${e.length}) and rank of dy (${t.rank}) must match`));let o=e,s=t,i=!1;4===t.rank&&(i=!0,s=Xl(t,[1,t.shape[0],t.shape[1],t.shape[2],t.shape[3]]),o=[1,e[0],e[1],e[2],e[3]]);const u=o[4],l=s.shape[4];X(5===o.length,(()=>`Error in conv3dDerInput: inShape must be length 5, but got length ${o.length}.`)),X(5===s.rank,(()=>`Error in conv3dDerInput: dy must be rank 5, but got rank ${s.rank}`)),X(5===n.rank,(()=>`Error in conv3dDerInput: filter must be rank 5, but got rank ${n.rank}`)),X(u===n.shape[3],(()=>`Error in conv3dDerInput: depth of input (${u}) must match input depth for filter ${n.shape[3]}.`)),X(l===n.shape[4],(()=>`Error in conv3dDerInput: depth of output (${l}) must match output depth for filter ${n.shape[4]}.`));const c={dy:s,filter:n},p={pad:a,strides:r,inputShape:o},d=Mo.runKernel(Tt,c,p);return i?Xl(d,[d.shape[1],d.shape[2],d.shape[3],d.shape[4]]):d}});const Tc=jo({conv3dTranspose_:function(e,t,n,r,a){const o=Bo(e,"x","conv3dTranspose"),s=Bo(t,"filter","conv3dTranspose");return Nc(n,o,s,r,a)}});const _c=jo({cos_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","cos","float32")};return Mo.runKernel(_t,t)}});const Ac=jo({cosh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","cosh","float32")};return Mo.runKernel(At,t)}});const Ic=jo({cumprod_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0,n=!1,r=!1){const a={x:Bo(e,"x","cumprod")},o={axis:t,exclusive:n,reverse:r};return Mo.runKernel(It,a,o)}});const Mc=jo({cumsum_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0,n=!1,r=!1){const a={x:Bo(e,"x","cumsum")},o={axis:t,exclusive:n,reverse:r};return Mo.runKernel(Mt,a,o)}});const Oc=jo({denseBincount_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=!1){const a=Bo(e,"x","denseBincount"),o=Bo(t,"weights","denseBincount");X("int32"===a.dtype,(()=>`Error in denseBincount: input dtype must be int32, but got ${a.dtype}`)),X(a.rank<=2,(()=>`Error in denseBincount: input must be at most rank 2, but got rank ${a.rank}.`)),X(n>=0,(()=>`size must be non-negative, but got ${n}.`)),X(o.size===a.size||0===o.size,(()=>`Error in denseBincount: weights must have the same shape as x or 0-length, but got x shape: ${a.shape}, weights shape: ${o.shape}.`));const s={x:a,weights:o},i={size:n,binaryOutput:r};return Mo.runKernel(Dt,s,i)}});const Dc=jo({depthToSpace_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n="NHWC"){const r=Bo(e,"x","depthToSpace","float32"),a="NHWC"===n?r.shape[1]:r.shape[2],o="NHWC"===n?r.shape[2]:r.shape[3],s="NHWC"===n?r.shape[3]:r.shape[1];X(t>1,(()=>`blockSize should be > 1 for depthToSpace, but was: ${t}`)),X(a*t>=0,(()=>`Negative dimension size caused by overflow when multiplying\n    ${a} and ${t}  for depthToSpace with input shape\n    ${r.shape}`)),X(o*t>=0,(()=>`Negative dimension size caused by overflow when multiplying\n    ${o} and ${t} for depthToSpace with input shape\n        ${r.shape}`)),X(s%(t*t)==0,(()=>`Dimension size must be evenly divisible by ${t*t} but is ${s} for depthToSpace with input shape ${r.shape}`));const i={x:r},u={blockSize:t,dataFormat:n};return Mo.runKernel(Ct,i,u)}});const Cc=jo({depthwiseConv2d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a="NHWC",o=[1,1],s){const i=Bo(e,"x","depthwiseConv2d","float32"),u=Bo(t,"filter","depthwiseConv2d","float32");let l=i,c=!1;3===i.rank&&(c=!0,l=Xl(i,[1,i.shape[0],i.shape[1],i.shape[2]])),X(4===l.rank,(()=>`Error in depthwiseConv2d: input must be rank 4, but got rank ${l.rank}.`)),X(4===u.rank,(()=>`Error in depthwiseConv2d: filter must be rank 4, but got rank ${u.rank}.`));const p="NHWC"===a?l.shape[3]:l.shape[1];X(p===u.shape[2],(()=>`Error in depthwiseConv2d: number of input channels (${p}) must match the inChannels dimension in filter ${u.shape[2]}.`)),Yl("depthwiseConv2d",r,s);const d={x:l,filter:u},f={strides:n,pad:r,dataFormat:a,dilations:o,dimRoundingMode:s},h=Mo.runKernel($t,d,f);return c?Xl(h,[h.shape[1],h.shape[2],h.shape[3]]):h}});const $c=jo({diag_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","diag")};return Mo.runKernel(Pt,t)}});const Rc=jo({dilation2d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a=[1,1],o="NHWC"){const s=Bo(e,"x","dilation2d"),i=Bo(t,"filter","dilation2d");X(3===s.rank||4===s.rank,(()=>`Error in dilation2d: input must be rank 3 or 4, but got rank ${s.rank}.`)),X(3===i.rank,(()=>`Error in dilation2d: filter must be rank 3, but got rank ${i.rank}.`)),X("NHWC"===o,(()=>`Error in dilation2d: Only NHWC is currently supported, but got dataFormat of ${o}`));let u=s,l=!1;3===s.rank&&(u=Xl(s,[1,s.shape[0],s.shape[1],s.shape[2]]),l=!0),X(u.shape[3]===i.shape[2],(()=>`Error in dilation2d:  input and filter must have the same depth: ${u.shape[3]} vs ${i.shape[2]}`));const c={x:u,filter:i},p={strides:n,pad:r,dilations:a},d=Mo.runKernel(Lt,c,p);return l?Xl(d,[d.shape[1],d.shape[2],d.shape[3]]):d}});const Fc=jo({equal_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","equal","string_or_numeric"),r=Bo(t,"b","equal","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(Gt,a)}});const Pc=jo({where_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(t,"a","where"),a=Bo(n,"b","where"),o=Bo(e,"condition","where","bool"),s=Qi(Qi(o.shape,r.shape),a.shape),i={condition:fc(o,s),t:fc(r,s),e:fc(a,s)};return Mo.runKernel(xr,i)}});const Lc=jo({divNoNan_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","div"),r=Bo(t,"b","div");[n,r]=xo(n,r);const a=wi(n,r),o=Ei(a),s=Fc(r,o);return Pc(s,o,a)}});const zc=jo({dot_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"t1","dot"),r=Bo(t,"t2","dot");X(!(1!==n.rank&&2!==n.rank||1!==r.rank&&2!==r.rank),(()=>`Error in dot: inputs must all be rank 1 or 2, but got ranks ${n.rank} and ${r.rank}.`));const a=1===n.rank?n.size:n.shape[1],o=1===r.rank?r.size:r.shape[0];if(X(a===o,(()=>`Error in dot: inner dimensions of inputs must match, but got ${a} and ${o}.`)),1===n.rank&&1===r.rank){const e=Xl(n,[1,-1]),t=Xl(r,[-1,1]),a=ku(e,t);return Xl(a,[])}if(1===n.rank&&2===r.rank){const e=Xl(n,[1,-1]),t=Xl(r,[r.shape[0],r.shape[1]]),a=ku(e,t);return Xl(a,[a.size])}if(2===n.rank&&1===r.rank){const e=Xl(r,[-1,1]),t=ku(n,e);return Xl(t,[t.size])}{const e=Xl(r,[r.shape[0],r.shape[1]]);return ku(n,e)}}});const Bc=jo({einsum_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,...t){const n=t.map(((e,t)=>Bo(e,`tensors${t}`,"einsum"))),r={equation:e};return Mo.runKernel(jt,n,r)}});const Vc=jo({elu_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","elu","float32")};return Mo.runKernel(Wt,t)}});const Uc=jo({ensureShape_:
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","ensureShape","string_or_numeric");if(!ne(n.shape,t))throw new Error(`EnsureShape: Shape of tensor ${n.shape} is not compatible with expected shape ${t}`);return e}});const jc=jo({erf_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){let t=Bo(e,"x","erf");X("int32"===t.dtype||"float32"===t.dtype,(()=>"Input dtype must be `int32` or `float32`.")),"int32"===t.dtype&&(t=Ks(t,"float32"));const n={x:t};return Mo.runKernel(qt,n)}});
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wc(e,t){for(let n=0;n<e.length;++n)if(e[e.length-n-1]!==t-1-n)return!1;return!0}function Hc(e,t,n){const r=e.length+t.length,a=[];let o=0,s=0;for(let i=0;i<r;i++)-1===n.indexOf(i)?a.push(e[o++]):a.push(t[s++]);return a}function qc(e,t){const n=[],r=e.length;for(let a=0;a<r;a++)-1===t.indexOf(a)&&n.push(e[a]);return[n,t.map((t=>e[t]))]}function Gc(e,t){return Hc(e,t.map((e=>1)),t)}function Kc(e,t,n){X(Wc(t,n),(()=>`${e} supports only inner-most axes for now. Got axes ${t} and rank-${n} input.`))}function Qc(e,t){if(Wc(e,t))return null;const n=[];for(let r=0;r<t;++r)-1===e.indexOf(r)&&n.push(r);return e.forEach((e=>n.push(e))),n}function Yc(e){return e.map(((e,t)=>[t,e])).sort(((e,t)=>e[1]-t[1])).map((e=>e[0]))}function Xc(e,t){const n=[];for(let r=t-e;r<t;++r)n.push(r);return n}const Zc=jo({max_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r={x:Bo(e,"x","max")},a={reductionIndices:t,keepDims:n};return Mo.runKernel(In,r,a)}});const Jc=jo({min_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r={x:Bo(e,"x","min")},a={axis:t,keepDims:n};return Mo.runKernel(Pn,r,a)}});const ep=jo({sum_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){let r=Bo(e,"x","sum");"bool"===r.dtype&&(r=Ks(r,"int32"));const a={x:r},o={axis:t,keepDims:n};return Mo.runKernel(Mr,a,o)}});function tp(e,t,n=null){if(0===e.rank)return qi(e);if(1!==e.rank&&null===n)return tp(Xl(e,[-1]),t,n);if(1===e.rank||"number"==typeof n||Array.isArray(n)&&1===n.length){if(1===t)return ep(qi(e),n);if(t===1/0)return Zc(qi(e),n);if(t===-1/0)return Jc(qi(e),n);if("euclidean"===t||2===t)return ki(ep(ji(qi(e),Di(2,"int32")),n));throw new Error(`Error in norm: invalid ord value: ${t}`)}if(Array.isArray(n)&&2===n.length){if(1===t)return Zc(ep(qi(e),n[0]),n[1]-1);if(t===1/0)return Zc(ep(qi(e),n[1]),n[0]);if(t===-1/0)return Jc(ep(qi(e),n[1]),n[0]);if("fro"===t||"euclidean"===t)return ki(ep(Si(e),n));throw new Error(`Error in norm: invalid ord value: ${t}`)}throw new Error(`Error in norm: invalid axis: ${n}`)}const np=jo({norm_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t="euclidean",n=null,r=!1){const a=tp(e=Bo(e,"x","norm"),t,n);let o=a.shape;if(r){const t=pe(n,e.shape);o=Gc(a.shape,t)}return Xl(a,o)}});const rp=jo({euclideanNorm_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){return np(e,"euclidean",t,n)}});const ap=jo({exp_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","exp")};return Mo.runKernel(Kt,t)}});const op=jo({expandDims_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n=Bo(e,"x","expandDims","string_or_numeric");X(t<=n.rank,(()=>"Axis must be <= rank of the tensor"));const r={input:n},a={dim:t};return Mo.runKernel(Qt,r,a)}});const sp=jo({expm1_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","expm1")};return Mo.runKernel(Yt,t)}});const ip=jo({tile_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","tile","string_or_numeric");X(n.rank===t.length,(()=>`Error in transpose: rank of input ${n.rank} must match length of reps ${t}.`));const r={x:n},a={reps:t};return Mo.runKernel(Qr,r,a)}});const up=jo({eye_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r="float32"){null==t&&(t=e);const a=Gs([e,t],r),o=e<=t?e:t;for(let e=0;e<o;++e)a.set(1,e,e);const s=Xl(a.toTensor(),[e,t]);if(null==n)return s;if(1===n.length)return ip(op(s,0),[n[0],1,1]);if(2===n.length)return ip(op(op(s,0),0),[n[0],n[1],1,1]);if(3===n.length)return ip(op(op(op(s,0),0),0),[n[0],n[1],n[2],1,1]);throw new Error(`eye() currently supports only 1D and 2D batchShapes, but received ${n.length}D.`)}});const lp=jo({floor_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","floor","float32")};return Mo.runKernel(en,t)}});const cp=jo({gather_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=0,r=0){const a={x:Bo(e,"x","gather"),indices:Bo(t,"indices","gather","int32")},o={axis:n,batchDims:r};return Mo.runKernel(rn,a,o)}});const pp=jo({greater_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","greater","string_or_numeric"),r=Bo(t,"b","greater","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(on,a)}});const dp=jo({greaterEqual_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","greaterEqual","string_or_numeric"),r=Bo(t,"b","greaterEqual","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(sn,a)}});const fp=jo({isFinite_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","isFinite")};return Mo.runKernel(pn,t)}});const hp=jo({isInf_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","isInf")};return Mo.runKernel(dn,t)}});const mp=jo({isNaN_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","isNaN")};return Mo.runKernel(fn,t)}});const gp=jo({leakyRelu_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=.2){const n={x:Bo(e,"x","leakyRelu")},r={alpha:t};return Mo.runKernel(hn,n,r)}});const yp=jo({less_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","less","string_or_numeric"),r=Bo(t,"b","less","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(mn,a)}});const bp=jo({lessEqual_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","lessEqual","string_or_numeric"),r=Bo(t,"b","lessEqual","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(gn,a)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function vp(e,t,n){if(n<=0)throw new Error("The number of values should be positive.");const r={start:e,stop:t,num:n};return Mo.runKernel(yn,{},r)}const wp=jo({localResponseNormalization_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=5,n=1,r=1,a=.5){const o=Bo(e,"x","localResponseNormalization");X(4===o.rank||3===o.rank,(()=>`Error in localResponseNormalization: x must be rank 3 or 4 but got\n               rank ${o.rank}.`)),X(ae(t),(()=>`Error in localResponseNormalization: depthRadius must be an integer but got depthRadius ${t}.`));let s=o,i=!1;3===o.rank&&(i=!0,s=Xl(o,[1,o.shape[0],o.shape[1],o.shape[2]]));const u={x:s},l={depthRadius:t,bias:n,alpha:r,beta:a},c=Mo.runKernel(Tn,u,l);return i?Xl(c,[c.shape[1],c.shape[2],c.shape[3]]):c}});const xp=jo({log_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","log","float32")};return Mo.runKernel(bn,t)}});const kp=jo({log1p_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","log1p")};return Mo.runKernel(vn,t)}});const Sp=jo({softplus_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","softplus")};return Mo.runKernel(Ar,t)}});const Ep=jo({logSigmoid_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"x","logSigmoid");return Mi((e=>({value:Nu(Sp(Nu(e))),gradFunc:t=>xi(t,tc(Nu(e)))})))(t)}});const Np=jo({logSoftmax_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=-1){const n=Bo(e,"logits","logSoftmax");if(-1===t&&(t=n.rank-1),t!==n.rank-1)throw Error(`Log Softmax along a non-last dimension is not yet supported. Logits was rank ${n.rank} and axis was ${t}`);const r=Mi(((e,n)=>{const r=Zc(e,t,!0),a=Wi(e,r),o=Wi(Ks(a,"float32"),xp(ep(ap(a),t,!0)));n([o]);return{value:o,gradFunc:(e,n)=>{const[r]=n,a=ap(r);return Wi(e,xi(ep(e,t,!0),a))}}}));return r(n)}});const Tp=jo({logSumExp_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r=Bo(e,"x","logSumExp"),a=pe(t,r.shape),o=Zc(r,a,!0),s=Wi(r,o),i=ap(s),u=ep(i,a),l=xp(u),c=bi(Xl(o,l.shape),l);if(n){const e=Gc(c.shape,a);return Xl(c,e)}return c}});const _p=jo({logicalAnd_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"a","logicalAnd","bool"),r=Bo(t,"b","logicalAnd","bool");Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(wn,a)}});const Ap=jo({logicalNot_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","logicalNot","bool")};return Mo.runKernel(xn,t)}});const Ip=jo({logicalOr_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"a","logicalOr","bool"),r=Bo(t,"b","logicalOr","bool");Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(kn,a)}});const Mp=jo({logicalXor_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"a","logicalXor","bool"),r=Bo(t,"b","logicalXor","bool");return Qi(n.shape,r.shape),_p(Ip(e,t),Ap(_p(e,t)))}}),Op=2147483648;const Dp=jo({searchSorted_:function(e,t,n="left"){const r=Bo(e,"sortedSequence","searchSorted"),a=Bo(t,"values","searchSorted"),o=r.shape[r.shape.length-1],s=a.shape[a.shape.length-1],i=Xl(r,[-1,o]),u=Xl(a,[-1,s]);if(i.rank<2)throw new Error("Sorted input argument must be at least 2-dimensional");if(i.shape[0]!==u.shape[0])throw new Error("Leading dimension of 'sortedSequence' and 'values' must match.");if(ee(u.shape)>=Op)throw new Error("values tensor size must less than 2147483648");if(i.shape[1]>=Op)throw new Error(`trailing dim_size must less than 2147483648 for int32 output type, was ${i.shape[1]}`);const l={sortedSequence:i,values:u},c={side:n};return Mo.runKernel(wr,l,c)}});
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Cp(e,t){return Dp(e,t,"left")}const $p=jo({maxPool_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a){const o=Bo(e,"x","maxPool");let s=o,i=!1;3===o.rank&&(i=!0,s=Xl(o,[1,o.shape[0],o.shape[1],o.shape[2]])),X(4===s.rank,(()=>`Error in maxPool: input must be rank 4 but got rank ${s.rank}.`)),X(Gl(n,1),(()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${n} and dilations '1'`)),Yl("maxPool",r,a);const u={x:s},l={filterSize:t,strides:n,pad:r,dimRoundingMode:a},c=Mo.runKernel(On,u,l);return i?Xl(c,[c.shape[1],c.shape[2],c.shape[3]]):c}});const Rp=jo({maxPool3d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=[1,1,1],n,r,a,o="NDHWC"){const s=Bo(e,"x","maxPool3d");let i=s,u=!1;4===s.rank&&(u=!0,i=Xl(s,[1,s.shape[0],s.shape[1],s.shape[2],s.shape[3]])),X(5===i.rank,(()=>`Error in maxPool3d: x must be rank 5 but got rank ${i.rank}.`)),X("NDHWC"===o,(()=>`Error in maxPool3d: Only NDHWC is currently supported, but got dataFormat of ${o}`)),Yl("maxPool3d",r,a);const l={x:i},c={filterSize:t,strides:n,pad:r,dimRoundingMode:a,dataFormat:o},p=Mo.runKernel(Cn,l,c);return u?Xl(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}});const Fp=jo({maxPoolWithArgmax_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a=!1){const o={x:Bo(e,"x","maxPoolWithArgmax")},s={filterSize:t,strides:n,pad:r,includeBatchInIndex:a},i=Mo.runKernel(Rn,o,s);return{result:i[0],indexes:i[1]}}});const Pp=jo({mean_:
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r={x:Bo(e,"x","mean")},a={axis:t,keepDims:n};return Mo.runKernel(Fn,r,a)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Lp(e,t="float32"){if(Ce(e),"complex64"===t){const t=Lp(e,"float32"),n=Lp(e,"float32");return Wo(t,n)}const n=Oe(ee(e),t);return Mo.makeTensor(n,e,t)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zp(e,t="float32"){if(Ce(e),"complex64"===t){const t=zp(e,"float32"),n=Lp(e,"float32");return Wo(t,n)}const n=Me(ee(e),t);return Mo.makeTensor(n,e,t)}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Bp(e,t,{indexing:n="xy"}={}){if("xy"!==n&&"ij"!==n)throw new TypeError(`${n} is not a valid third argument to meshgrid`);if(void 0===e)return[];let r=Bo(e,"x","meshgrid",e instanceof io?e.dtype:"float32");if(void 0===t)return[r];let a=Bo(t,"y","meshgrid",t instanceof io?t.dtype:"float32");const o=ee(r.shape),s=ee(a.shape);return"xy"===n?(r=Xl(r,[1,-1]),a=Xl(a,[-1,1]),[ku(zp([s,1],r.dtype),r),ku(a,zp([1,o],a.dtype))]):(r=Xl(r,[-1,1]),a=Xl(a,[1,-1]),[ku(r,zp([1,s],r.dtype)),ku(zp([o,1],a.dtype),a)])}const Vp=jo({minimum_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","minimum"),r=Bo(t,"b","minimum");[n,r]=xo(n,r),"bool"===n.dtype&&(n=Ks(n,"int32"),r=Ks(r,"int32")),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(Ln,a)}});const Up=jo({mirrorPad_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){X("reflect"===n||"symmetric"===n,(()=>`Invalid mode. Mode must be either reflect or symmetric. Got ${n}.`));const r=Bo(e,"x","mirrorPad");if(0===r.rank)throw new Error("mirrorPad(scalar) is not defined. Pass non-scalar to mirrorPad");X(t.length===r.rank,(()=>`Padding doesn't match input. Must be ${r.rank}. Got ${t.length}.`));const a="reflect"===n?1:0;for(let e=0;e<r.rank;e++)X(2===t[e].length,(()=>"Invalid number of paddings. Must be length of 2 each.")),X(t[e][0]>=0&&t[e][0]<=r.shape[e]-a&&t[e][1]>=0&&t[e][1]<=r.shape[e]-a,(()=>`Padding in dimension ${e} cannot be greater than or equal to ${r.shape[e]-a} or less than 0 for input of shape ${r.shape}`));const o={paddings:t,mode:n},s={x:r};return Mo.runKernel(zn,s,o)}});const jp=jo({mod_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","mod"),r=Bo(t,"b","mod");[n,r]=xo(n,r);const a={a:n,b:r};return Mo.runKernel(Bn,a)}});const Wp=jo({moments_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){const r=pe(t,(e=Bo(e,"x","moments")).shape),a=Pp(e,r,n);let o=a.shape;n||(o=Gc(a.shape,r));const s=Si(Wi(Ks(e,"float32"),Xl(a,o)));return{mean:a,variance:Pp(s,r,n)}}});const Hp=jo({multiRNNCell_:function(e,t,n,r){const a=Bo(t,"data","multiRNNCell"),o=Vo(n,"c","multiRNNCell"),s=Vo(r,"h","multiRNNCell");let i=a;const u=[];for(let t=0;t<e.length;t++){const n=e[t](i,o[t],s[t]);u.push(n[0]),u.push(n[1]),i=n[1]}const l=[],c=[];for(let e=0;e<u.length;e+=2)l.push(u[e]),c.push(u[e+1]);return[l,c]}});const qp=jo({multinomial_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=!1){const a=Bo(e,"logits","multinomial"),o=a.size,s=a.rank;if(o<2)throw new Error(`Error in multinomial: you need at least 2 outcomes, but got ${o}.`);if(s>2)throw new Error(`Rank of probabilities must be 1 or 2, but is ${s}`);n=n||Math.random();const i={logits:1===s?Xl(a,[1,-1]):a},u={numSamples:t,seed:n,normalized:r},l=Mo.runKernel(Vn,i,u);return 1===s?Xl(l,[l.size]):l}});const Gp=jo({notEqual_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","notEqual","string_or_numeric"),r=Bo(t,"b","notEqual","string_or_numeric");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(Wn,a)}});const Kp=jo({onesLike_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","onesLike")};return Mo.runKernel(Kn,t)}});const Qp=jo({outerProduct_:function(e,t){const n=Bo(e,"v1","outerProduct"),r=Bo(t,"v2","outerProduct");X(1===n.rank&&1===r.rank,(()=>`Error in outerProduct: inputs must be rank 1, but got ranks ${n.rank} and ${r.rank}.`));const a=Xl(n,[-1,1]),o=Xl(r,[1,-1]);return ku(a,o)}});const Yp=jo({pad_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=0){const r=Bo(e,"x","pad");if(0===r.rank)throw new Error("pad(scalar) is not defined. Pass non-scalar to pad");const a={paddings:t,constantValue:n},o={x:r};return Mo.runKernel(Xn,o,a)}});const Xp=jo({pad1d_:function(e,t,n=0){return X(2===t.length,(()=>"Invalid number of paddings. Must be length of 2.")),Yp(e,[t],n)}});const Zp=jo({pad2d_:function(e,t,n=0){return X(2===t.length&&2===t[0].length&&2===t[1].length,(()=>"Invalid number of paddings. Must be length of 2 each.")),Yp(e,t,n)}});const Jp=jo({pad3d_:function(e,t,n=0){return X(3===t.length&&2===t[0].length&&2===t[1].length&&2===t[2].length,(()=>"Invalid number of paddings. Must be length of 2 each.")),Yp(e,t,n)}});const ed=jo({pad4d_:function(e,t,n=0){return X(4===t.length&&2===t[0].length&&2===t[1].length&&2===t[2].length&&2===t[3].length,(()=>"Invalid number of paddings. Must be length of 2 each.")),Yp(e,t,n)}});const td=jo({spaceToBatchND_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","spaceToBatchND");X(r.rank>=1+t.length,(()=>`input rank ${r.rank} should be > than [blockShape] ${t.length}`)),X(n.length===t.length,(()=>`paddings.shape[0] ${n.length} must be equal to [blockShape] ${t.length}`)),X(r.shape.reduce(((e,r,a)=>a>0&&a<=t.length?e&&(r+n[a-1][0]+n[a-1][1])%t[a-1]==0:e),!0),(()=>`input spatial dimensions ${r.shape.slice(1)} with paddings ${n.toString()} must be divisible by blockShapes ${t.toString()}`));const a={x:r},o={blockShape:t,paddings:n};return Mo.runKernel(Or,a,o)}});const nd=jo({pool_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o,s){null==a&&(a=[1,1]),null==o&&(o=1),0===r&&(r="valid");const i=Bo(e,"x","maxPool");let u=i,l=!1;3===i.rank&&(l=!0,u=Xl(i,[1,i.shape[0],i.shape[1],i.shape[2]])),X(Gl(o,a),(()=>`Error in pool: Either strides or dilations must be 1. Got strides ${o} and dilations '${a}'`));const c=Pl(u.shape,t,o,a,r),p=[c.dilationHeight,c.dilationWidth];let d;d="same"===r?function(e,t){const n=e.map(((e,n)=>e+(e-1)*(t[n]-1))),r=n.map((e=>e-1)),a=r.map((e=>Math.floor(e/2))),o=r.map(((e,t)=>e-a[t]));return r.map(((e,t)=>[a[t],o[t]]))}([c.filterHeight,c.filterWidth],p):[[0,0],[0,0]];const f=1===p[0]&&1===p[1],[h,m]=function(e,t,n){const r=n.map((e=>e[0])),a=n.map((e=>e[1])),o=e.concat(r,a),s=t.map(((e,t)=>(e-o[t]%e)%e)),i=a.map(((e,t)=>e+s[t])),u=t.map(((e,t)=>[r[t],i[t]])),l=t.map(((e,t)=>[0,s[t]]));return[u,l]}([c.inHeight,c.inWidth],p,d),g=f?r:"valid",y=f?u:td(u,p,h),b=("avg"===n?()=>Zl(y,t,o,g,s):()=>$p(y,t,o,g,s))(),v=f?b:oc(b,p,m);return l?Xl(v,[v.shape[1],v.shape[2],v.shape[3]]):v}});const rd=jo({prelu_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n={x:Bo(e,"x","prelu"),alpha:Bo(t,"alpha","prelu")};return Mo.runKernel(er,n)}});const ad=jo({prod_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=null,n=!1){let r=Bo(e,"x","prod");"bool"===r.dtype&&(r=Ks(r,"int32"));const a={x:r},o={axis:t,keepDims:n};return Mo.runKernel(tr,a,o)}});const od=jo({raggedGather_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r){const a={paramsNestedSplits:e.map(((e,t)=>Bo(e,`tensors${t}`,"raggedGather","int32"))),paramsDenseValues:Bo(t,"paramsDenseValues","raggedGather"),indices:Bo(n,"indices","raggedGather","int32")},o={outputRaggedRank:r},s=Mo.runKernel(nr,a,o);return{outputNestedSplits:s.slice(0,s.length-1),outputDenseValues:s[s.length-1]}}});const sd=jo({raggedRange_:
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"starts","raggedRange"),a={starts:r,limits:Bo(t,"limits","raggedRange",r.dtype),deltas:Bo(n,"deltas","raggedRange",r.dtype)},o=Mo.runKernel(rr,a);return{rtNestedSplits:o[0],rtDenseValues:o[1]}}});const id=jo({raggedTensorToTensor_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a){const o=Bo(e,"shape","raggedTensorToTensor","int32"),s=Bo(t,"values","raggedTensorToTensor"),i={shape:o,values:s,defaultValue:Bo(n,"defaultValue","raggedTensorToTensor",s.dtype),rowPartitionTensors:r.map(((e,t)=>Bo(e,`tensors${t}`,"raggedTensorToTensor","int32")))},u={rowPartitionTypes:a};return Mo.runKernel(ar,i,u)}});const ud=jo({rand_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){Ce(e);const r=ee(e);let a=null;if(null==n||"float32"===n)a=new Float32Array(r);else if("int32"===n)a=new Int32Array(r);else{if("bool"!==n)throw new Error(`Unknown data type ${n}`);a=new Uint8Array(r)}for(let e=0;e<r;e++)a[e]=t();return Mo.makeTensor(a,e,n)}});var ld=n(6377);
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class cd{constructor(e,t,n,r,a){this.mean=e,this.stdDev=t,this.dtype=n,this.nextVal=NaN,this.truncated=r,this.truncated&&(this.upper=this.mean+2*this.stdDev,this.lower=this.mean-2*this.stdDev);const o=a||Math.random();this.random=ld.alea(o.toString())}nextValue(){if(!isNaN(this.nextVal)){const e=this.nextVal;return this.nextVal=NaN,e}let e,t,n=!1;for(;!n;){let r,a,o;do{r=2*this.random()-1,a=2*this.random()-1,o=r*r+a*a}while(o>=1||0===o);const s=Math.sqrt(-2*Math.log(o)/o);e=this.mean+this.stdDev*r*s,t=this.mean+this.stdDev*a*s,this.truncated&&!this.isValidTruncated(e)||(n=!0)}return this.truncated&&!this.isValidTruncated(t)||(this.nextVal=this.convertValue(t)),this.convertValue(e)}convertValue(e){return null==this.dtype||"float32"===this.dtype?e:Math.round(e)}isValidTruncated(e){return e<=this.upper&&e>=this.lower}}class pd{constructor(e,t,n,r){this.alpha=e,this.beta=1/t,this.dtype=n;const a=r||Math.random();this.randu=ld.alea(a.toString()),this.randn=new cd(0,1,n,!1,this.randu()),this.d=e<1?e+2/3:e-1/3,this.c=1/Math.sqrt(9*this.d)}nextValue(){let e,t,n,r,a,o;for(;;){do{r=this.randn.nextValue(),o=1+this.c*r}while(o<=0);if(o*=o*o,e=r*r,t=1-.331*e*e,n=.5*e+this.d*(1-o+Math.log(o)),a=this.randu(),a<t||Math.log(a)<n)break}return o=1/this.beta*this.d*o,this.alpha<1&&(o*=Math.pow(this.randu(),1/this.alpha)),this.convertValue(o)}convertValue(e){return"float32"===this.dtype?e:Math.round(e)}}class dd{constructor(e=0,t=1,n,r){if(this.canReturnFloat=()=>null==this.dtype||"float32"===this.dtype,this.min=e,this.range=t-e,this.dtype=n,null==r&&(r=Math.random()),"number"==typeof r&&(r=r.toString()),!this.canReturnFloat()&&this.range<=1)throw new Error(`The difference between ${e} - ${t} <= 1 and dtype is not float`);this.random=ld.alea(r)}convertValue(e){return this.canReturnFloat()?e:Math.round(e)}nextValue(){return this.convertValue(this.min+this.range*this.random())}}const fd=jo({randomGamma_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=1,r="float32",a){if(Ce(e),null==n&&(n=1),null==r&&(r="float32"),"float32"!==r&&"int32"!==r)throw new Error(`Unsupported data type ${r}`);const o=new pd(t,n,r,a),s=Gs(e,r);for(let e=0;e<s.values.length;e++)s.values[e]=o.nextValue();return s.toTensor()}});const hd=jo({randomNormal_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0,n=1,r,a){if(Ce(e),null!=r&&"bool"===r)throw new Error(`Unsupported data type ${r}`);const o=new cd(t,n,r,!1,a),s=Gs(e,r);for(let e=0;e<s.values.length;e++)s.values[e]=o.nextValue();return s.toTensor()}});const md=jo({randomStandardNormal_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){if(null!=t&&"bool"===t)throw new Error(`Unsupported data type ${t}`);return hd(e,0,1,t,n)}});const gd=jo({randomUniform_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0,n=1,r="float32",a){Ce(e);const o=Gs(e,r),s=new dd(t,n,null,a);for(let e=0;e<o.values.length;e++)o.values[e]=s.nextValue();return o.toTensor()}});const yd=jo({randomUniformInt_:
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r){return gd(e,t,n,"int32",r)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function bd(e,t,n=1,r="float32"){if(0===n)throw new Error("Cannot have a step of zero");const a={start:e,stop:t,step:n,dtype:r};return Mo.runKernel(or,{},a)}const vd=jo({reciprocal_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","reciprocal")};return Mo.runKernel(ir,t)}});const wd=jo({relu_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","relu")};return Mo.runKernel(ur,t)}});const xd=jo({relu6_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","relu6")};return Mo.runKernel(hr,t)}});const kd=jo({reverse_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n={x:Bo(e,"x","reverse")},r={dims:t};return Mo.runKernel(mr,n,r)}});const Sd=jo({reverse1d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"x","reverse");return X(1===t.rank,(()=>`Error in reverse1D: x must be rank 1 but got rank ${t.rank}.`)),kd(t,0)}});const Ed=jo({reverse2d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","reverse");return X(2===n.rank,(()=>`Error in reverse2D: x must be rank 2 but got rank ${n.rank}.`)),kd(n,t)}});const Nd=jo({reverse3d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","reverse");return X(3===n.rank,(()=>`Error in reverse3D: x must be rank 3 but got rank ${n.rank}.`)),kd(n,t)}});const Td=jo({reverse4d_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","reverse");return X(4===n.rank,(()=>`Error in reverse4D: x must be rank 4 but got rank ${n.rank}.`)),kd(n,t)}});const _d=jo({round_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","round")};return Mo.runKernel(gr,t)}});const Ad=jo({rsqrt_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","rsqrt","float32")};return Mo.runKernel(yr,t)}});const Id=jo({selu_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","selu")};return Mo.runKernel(kr,t)}});const Md=jo({separableConv2d_:function(e,t,n,r,a,o=[1,1],s="NHWC"){const i=Bo(e,"x","separableConv2d"),u=Bo(t,"depthwiseFilter","separableConv2d"),l=Bo(n,"pointwiseFilter","separableConv2d");let c=i,p=!1;if(3===i.rank&&(p=!0,c=Xl(i,[1,i.shape[0],i.shape[1],i.shape[2]])),"NCHW"===s)throw new Error("separableConv2d currently does not support dataFormat NCHW; only NHWC is supported");X(4===c.rank,(()=>`Error in separableConv2d: input must be rank 4, but got rank ${c.rank}.`)),X(4===u.rank,(()=>`Error in separableConv2d: depthwise filter must be rank 4, but got rank ${u.rank}.`)),X(4===l.rank,(()=>`Error in separableConv2d: pointwise filter must be rank 4, but got rank ${u.rank}.`)),X(1===l.shape[0],(()=>`Error in separableConv2d: the first dimension of pointwise filter  must be 1, but got ${l.shape[0]}.`)),X(1===l.shape[1],(()=>`Error in separableConv2d: the second dimension of pointwise filter must be 1, but got ${l.shape[1]}.`));const d=u.shape[2],f=u.shape[3];X(l.shape[2]===d*f,(()=>`Error in separableConv2d: the third dimension of pointwise filter must be ${d*f}, but got ${l.shape[2]}.`));const h=Cc(c,u,r,a,s,o),m=wc(h,l,1,"valid",s);return p?Xl(m,[m.shape[1],m.shape[2],m.shape[3]]):m}});const Od=
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t){const n=Bo(e,"x","setdiff1d"),r=Bo(t,"y","setdiff1d");X(n.dtype===r.dtype,(()=>`x and y should have the same dtype, but got x (${n.dtype}) and y (${r.dtype}).`)),X(1===n.rank,(()=>`x should be 1D tensor, but got x (${n.shape}).`)),X(1===r.rank,(()=>`y should be 1D tensor, but got y (${r.shape}).`));const a=await n.data(),o=await r.data(),s=new Set(o);let i=0;for(let e=0;e<a.length;e++)s.has(a[e])||i++;const u=new ro([i],n.dtype),l=new ro([i],"int32");for(let e=0,t=0;e<a.length;e++)s.has(a[e])||(u.values[t]=a[e],l.values[t]=e,t++);return[u.toTensor(),l.toTensor()]};const Dd=jo({sign_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","sign")};return Mo.runKernel(Tr,t)}});const Cd=jo({sin_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","sin","float32")};return Mo.runKernel(Er,t)}});const $d=jo({sinh_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","sinh")};return Mo.runKernel(Nr,t)}});const Rd=jo({slice1d_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","slice1d");return X(1===r.rank,(()=>`slice1d expects a rank-1 tensor, but got a rank-${r.rank} tensor`)),nc(r,[t],[n])}});const Fd=jo({slice2d_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","slice2d");return X(2===r.rank,(()=>`slice2d expects a rank-2 tensor, but got a rank-${r.rank} tensor`)),nc(r,t,n)}});const Pd=jo({slice3d_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","slice3d");return X(3===r.rank,(()=>`slice3d expects a rank-3 tensor, but got a rank-${r.rank} tensor`)),nc(r,t,n)}});const Ld=jo({slice4d_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","slice4d");return X(4===r.rank,(()=>`slice4d expects a rank-4 tensor, but got a rank-${r.rank} tensor`)),nc(r,t,n)}});const zd=jo({softmax_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=-1){const n=Bo(e,"logits","softmax","float32");if(-1===t&&(t=n.rank-1),t!==n.rank-1)throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${n.rank} and dim was ${t}`);const r={logits:n},a={dim:t};return Mo.runKernel(Cr,r,a)}});const Bd=jo({fft_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){X("complex64"===e.dtype,(()=>`The dtype for tf.spectral.fft() must be complex64 but got ${e.dtype}.`));const t={input:e};return Mo.runKernel(Xt,t)}});const Vd=jo({ifft_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){X("complex64"===e.dtype,(()=>`The dtype for tf.spectral.ifft() must be complex64 but got ${e.dtype}.`));const t={input:e};return Mo.runKernel(ln,t)}});const Ud=jo({irfft_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=e.shape[e.shape.length-1],n=e.size/t;let r;if(t<=2){const a=Xl(e,[n,t]);r=Vd(a)}else{const a=[n,2*(t-1)],o=Xl(Tu(e),[n,t]),s=Xl(Eu(e),[n,t]),i=kd(nc(o,[0,1],[n,t-2]),1),u=xi(kd(nc(s,[0,1],[n,t-2]),1),Di(-1)),l=ec([o,i],1),c=ec([s,u],1),p=Xl(Wo(l,c),[a[0],a[1]]);r=Vd(p)}if(r=Tu(r),3===e.rank&&0!==e.shape[0]){const t=r,n=e.shape[0];r=Xl(r,[n,r.shape[0]/n,r.shape[1]]),t.dispose()}return r}});const jd=jo({split_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=0){const r={x:Bo(e,"x","split")},a={numOrSizeSplits:t,axis:n};return Mo.runKernel(Dr,r,a)}});const Wd=jo({rfft_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){X("float32"===e.dtype,(()=>`The dtype for rfft() must be real value but got ${e.dtype}`));let n=e.shape[e.shape.length-1];const r=e.size/n;let a;if(null!=t&&t<n){const r=e.shape.map((e=>0)),o=e.shape.map((e=>e));o[e.shape.length-1]=t,a=nc(e,r,o),n=t}else if(null!=t&&t>n){const r=e.shape.map((e=>e));r[e.shape.length-1]=t-n,a=ec([e,Lp(r)],e.shape.length-1),n=t}else a=e;const o=Ei(a),s=Xl(Wo(a,o),[r,n]),i=Bd(s),u=Math.floor(n/2)+1,l=Tu(i),c=Eu(i),p=jd(l,[u,n-u],l.shape.length-1),d=jd(c,[u,n-u],c.shape.length-1),f=a.shape.slice();return f[a.shape.length-1]=u,Xl(Wo(p[0],d[0]),f)}});const Hd=jo({squaredDifference_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){let n=Bo(e,"a","squaredDifference"),r=Bo(t,"b","squaredDifference");[n,r]=xo(n,r),Qi(n.shape,r.shape);const a={a:n,b:r};return Mo.runKernel(zr,a,{})}});const qd=jo({squeeze_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"x","squeeze","string_or_numeric");return Xl(n,de(n.shape,t).newShape)}});const Gd=jo({stack_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n=Vo(e,"tensors","stack","string_or_numeric");X(n.length>=1,(()=>"Pass at least one tensor to tf.stack")),n.length>0&&X(t<=n[0].rank,(()=>"Axis must be <= rank of the tensor"));const r=n,a={axis:t};return Mo.runKernel(Yn,r,a)}});const Kd=jo({step_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n={x:Bo(e,"x","step")},r={alpha:t};return Mo.runKernel(aa,n,r)}});const Qd=jo({stridedSlice_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a=0,o=0,s=0,i=0,u=0){const l={x:Bo(e,"x","stridedSlice","string_or_numeric")},c={begin:t,end:n,strides:r,beginMask:a,endMask:o,ellipsisMask:s,newAxisMask:i,shrinkAxisMask:u};return Mo.runKernel(Ur,l,c)}});const Yd=jo({tan_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t={x:Bo(e,"x","tan","float32")};return Mo.runKernel(Gr,t)}});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Xd(e,t){J(e);const n=Po(e,t);if(1!==n.length)throw new Error("tensor1d() requires values to be a flat/TypedArray");return Ho(e,null,n,t)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Zd(e,t,n){if(J(e),null!=t&&2!==t.length)throw new Error("tensor2d() requires shape to have two numbers");const r=Po(e,n);if(2!==r.length&&1!==r.length)throw new Error("tensor2d() requires values to be number[][] or flat/TypedArray");if(1===r.length&&null==t)throw new Error("tensor2d() requires shape to be provided when `values` are a flat/TypedArray");return Ho(e,t,r,n)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Jd(e,t,n){if(J(e),null!=t&&4!==t.length)throw new Error("tensor4d() requires shape to have four numbers");const r=Po(e,n);if(4!==r.length&&1!==r.length)throw new Error("tensor4d() requires values to be number[][][][] or flat/TypedArray");if(1===r.length&&null==t)throw new Error("tensor4d() requires shape to be provided when `values` are a flat array");return Ho(e,t,r,n)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ef(e,t,n){if(J(e),null!=t&&5!==t.length)throw new Error("tensor5d() requires shape to have five numbers");const r=Po(e,n);if(5!==r.length&&1!==r.length)throw new Error("tensor5d() requires values to be number[][][][][] or flat/TypedArray");if(1===r.length&&null==t)throw new Error("tensor5d() requires shape to be provided when `values` are a flat array");return Ho(e,t,r,n)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function tf(e,t,n){if(J(e),null!=t&&6!==t.length)throw new Error("tensor6d() requires shape to have six numbers");const r=Po(e,n);if(6!==r.length&&1!==r.length)throw new Error("tensor6d() requires values to be number[][][][][][] or flat/TypedArray");if(1===r.length&&null==t)throw new Error("tensor6d() requires shape to be provided when `values` are a flat array");return Ho(e,t=t||r,r,n)}const nf=jo({tensorScatterUpdate_:
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"tensor","tensorScatterupdate"),a=Bo(t,"indices","tensorScatterupdate","int32"),o=Bo(n,"updates","tensorScatterupdate");if(Vu(o,a,r.shape),r.dtype!==o.dtype)throw new Error(`tensor and updates must have the same dtype, instead they are ${r.dtype} and ${o.dtype}.`);const s={tensor:r,indices:a,updates:o};return Mo.runKernel(vr,s,{})}});const rf=jo({topk_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=1,n=!0){const r=Bo(e,"x","topk");if(0===r.rank)throw new Error("topk() expects the input to be of rank 1 or higher");const a=r.shape[r.shape.length-1];if(t<0)throw new Error(`'k' passed to topk() must be >= 0 but got ${t}`);if(t>a)throw new Error(`'k' passed to topk() must be <= the last dimension (${a}) but got ${t}`);const o={x:r},s={k:t,sorted:n},[i,u]=Mo.runKernel(Yr,o,s);return{values:i,indices:u}}});const af=jo({truncatedNormal_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0,n=1,r,a){if(Ce(e),null!=r&&"bool"===r)throw new Error("Unsupported data type $ { dtype }");const o=new cd(t,n,r,!0,a),s=Gs(e,r);for(let e=0;e<s.values.length;e++)s.values[e]=o.nextValue();return s.toTensor()}});const of=jo({unique_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n=Bo(e,"x","unique","string_or_numeric");X(n.rank>0,(()=>"The input tensor must be at least 1D"));const r={x:n},a={axis:t},[o,s]=Mo.runKernel(Jr,r,a);return{values:o,indices:s}}});const sf=jo({unsortedSegmentSum_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"x","unsortedSegmentSum"),a=Bo(t,"segmentIds","unsortedSegmentSum","int32");X(ae(n),(()=>"numSegments must be of dtype int"));const o={x:r,segmentIds:a},s={numSegments:n};return Mo.runKernel(ta,o,s)}});const uf=jo({unstack_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=0){const n=Bo(e,"x","unstack","string_or_numeric");X(t>=-n.shape.length&&t<n.shape.length,(()=>`Axis = ${t} is not in [-${n.shape.length}, ${n.shape.length})`));const r={value:n},a={axis:t};return Mo.runKernel(ea,r,a)}});
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function lf(e,t){return Dp(e,t,"right")}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cf(e,t=!0,n,r){return Mo.makeVariable(e,t,n,r)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function pf(e,t){const n=[];for(let e=0;e<t.length;e++)t[e]&&n.push(e);const r=Gs(e,"int32"),a=Gs([n.length,e.length],"int32");for(let t=0;t<n.length;t++){const o=r.indexToLoc(n[t]),s=t*e.length;a.values.set(o,s)}return a.toTensor()}const df=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e){const t=Bo(e,"condition","whereAsync","bool"),n=await t.data(),r=pf(t.shape,n);return e!==t&&t.dispose(),r};const ff=
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t,n){const r=Bo(e,"tensor","boolMask"),a=Bo(t,"mask","boolMask","bool"),o=null==n?0:n,s=a.rank,i=r.shape;X(s>0,(()=>"mask cannot be scalar")),Z(i.slice(o,o+s),a.shape,"mask's shape must match the first K dimensions of tensor's shape,");let u=1;for(let e=o;e<o+s;e++)u*=i[e];const l=i.slice(0,o).concat([u],i.slice(o+s)),c=Xl(r,l),p=Xl(a,[-1]),d=await df(p),f=qd(d,[1]),h=cp(c,f,o);return e!==r&&r.dispose(),t!==a&&a.dispose(),f.dispose(),c.dispose(),p.dispose(),d.dispose(),h};const hf=jo({movingAverage_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a=!0){const o=Bo(e,"v","movingAverage"),s=Bo(t,"x","movingAverage"),i=Bo(n,"decay","movingAverage");ko(o,s),X(re(o.shape,s.shape),(()=>"Shape mismatch in v and x"));const u=Di(1),l=Wi(u,i);let c=xi(Wi(s,o),l);if(a){X(null!=r,(()=>"When using zeroDebias: true, step is required."));const e=Bo(r,"step","movingAverage");c=wi(c,Wi(u,ji(i,e)))}return bi(o,c)}});const mf=jo({scatterND_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){Ce(n);const r=Bo(e,"indices","scatterND","int32"),a=Bo(t,"updates","scatterND");Vu(a,r,n);const o={indices:r,updates:a},s={shape:n};return Mo.runKernel(br,o,s)}});const gf=jo({sparseToDense_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=0){Ce(n);const a=Bo(e,"sparseIndices","sparseToDense","int32"),o=Bo(t,"sparseValues","sparseToDense","string_or_numeric"),s=Bo(r,"defaultValue","sparseToDense",o.dtype);!function(e,t,n,r){if("int32"!==e.dtype)throw new Error(`tf.sparseToDense() expects the indices to be int32 type, but the dtype was ${e.dtype}.`);if(e.rank>2)throw new Error(`sparseIndices should be a scalar, vector, or matrix, but got shape ${e.shape}.`);const a=e.rank>0?e.shape[0]:1,o=e.rank>1?e.shape[1]:1;if(n.length!==o)throw new Error(`outputShape has incorrect number of elements:, ${n.length}, should be: ${o}.`);const s=t.size;if(0!==t.rank&&(1!==t.rank||s!==a))throw new Error(`sparseValues has incorrect shape ${t.shape}, should be [] or [${a}]`);if(t.dtype!==r.dtype)throw new Error("sparseValues.dtype must match defaultValues.dtype")}(a,o,n,s);const i={sparseIndices:a,sparseValues:o,defaultValue:s},u={outputShape:n};return Mo.runKernel(Lr,i,u)}});const yf=jo({gatherND_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(t,"indices","gatherND","int32"),r={params:Bo(e,"x","gatherND","string_or_numeric"),indices:n};return Mo.runKernel(an,r)}});const bf=jo({dropout_:
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r){const a=Bo(e,"x","dropout");if(X("float32"===a.dtype,(()=>`x has to be a floating point tensor since it's going to be scaled, but got a ${a.dtype} tensor instead.`)),X(t>=0&&t<1,(()=>`rate must be a float in the range [0, 1), but got ${t}.`)),0===t)return e instanceof io?a.clone():a;const o=
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){if(null==t)return e.shape.slice();if(re(e.shape,t))return t;if(e.shape.length===t.length){const n=[];for(let r=0;r<e.shape.length;r++)null==t[r]&&null!=e.shape[r]?n.push(e.shape[r]):n.push(t[r]);return n}return t}(a,n),s=1-t,i=wi(lp(bi(gd(o,0,1,"float32",r),s)),s);return xi(a,i)}});
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function vf(e){return Math.floor(Math.pow(2,Math.ceil(Math.log(e)/Math.log(2))))}function wf(e,t,n){const r=1-e%2,a=new Float32Array(e);for(let o=0;o<e;++o){const s=2*Math.PI*o/(e+r-1);a[o]=t-n*Math.cos(s)}return Xd(a,"float32")}const xf=
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t,n=1){const r=Bo(e,"predictions","inTopK"),a=Bo(t,"targets","inTopK");X(r.rank>1,(()=>`inTopK() expects the predictions to be of rank 2 or higher, but got ${r.rank}`)),X(r.rank-1===a.rank,(()=>`predictions rank should be 1 larger than targets rank, but got predictions rank ${r.rank} and targets rank ${a.rank}`)),Z(r.shape.slice(0,r.shape.length-1),a.shape,"predictions's shape should be align with the targets' shape, except the last dimension.");const o=r.shape[r.shape.length-1];X(n>0&&n<=o,(()=>`'k' passed to inTopK() must be > 0 && <= the predictions last dimension (${o}), but got ${n}`));const s=await r.data(),i=await a.data(),[u,l]=[s.length/o,o],c=fe("bool",u);for(let e=0;e<u;e++){const t=e*l,r=s.subarray(t,t+l),a=[];for(let e=0;e<r.length;e++)a.push({value:r[e],index:e});a.sort(((e,t)=>t.value-e.value)),c[e]=0;for(let t=0;t<n;t++)if(a[t].index===i[e]){c[e]=1;break}}return e!==r&&r.dispose(),t!==a&&a.dispose(),qo(c,a.shape,"bool")};const kf=jo({conv2DBackpropFilter_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o="NHWC",s){let i=e;3===e.rank&&(i=Xl(e,[1,e.shape[0],e.shape[1],e.shape[2]]));let u=t;3===u.rank&&(u=Xl(t,[1,t.shape[0],t.shape[1],t.shape[2]])),X(4===i.rank,(()=>`Error in conv2dDerFilter: input must be rank 4, but got shape ${i.shape}.`)),X(4===u.rank,(()=>`Error in conv2dDerFilter: dy must be rank 4, but got shape ${u.shape}.`)),X(4===n.length,(()=>`Error in conv2dDerFilter: filterShape must be length 4, but got ${n}.`));const l="NHWC"===o?i.shape[3]:i.shape[1],c="NHWC"===o?u.shape[3]:u.shape[1];X(l===n[2],(()=>`Error in conv2dDerFilter: depth of input ${l}) must match input depth in filter (${n[2]}.`)),X(c===n[3],(()=>`Error in conv2dDerFilter: depth of dy (${c}) must match output depth for filter (${n[3]}).`)),Yl("conv2dDerFilter",a,s);const p={x:i,dy:u},d={strides:r,pad:a,dataFormat:o,dimRoundingMode:s,filterShape:n};return Mo.runKernel(kt,p,d)}});
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Sf(e,t,n){if(null==n||"linear"===n)return e;if("relu"===n)return xi(e,Kd(t));throw new Error(`Cannot compute gradient for fused activation ${n}.`)}function Ef(e,t){let n=t;const r=Ki(e.shape,t.shape);return r.length>0&&(n=ep(n,r)),Xl(n,e.shape)}function Nf(e,t,n,r){if("linear"===t)return e;if("relu"===t)return wd(e);if("elu"===t)return Vc(e);if("relu6"===t)return xd(e);if("prelu"===t)return rd(e,n);if("leakyrelu"===t)return gp(e,r);if("sigmoid"===t)return tc(e);throw new Error(`Unknown fused activation ${t}.`)}const Tf=(e,t)=>!(e>0)||"linear"===t;const _f=jo({fusedConv2d_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function({x:e,filter:t,strides:n,pad:r,dataFormat:a="NHWC",dilations:o=[1,1],dimRoundingMode:s,bias:i,activation:u="linear",preluActivationWeights:l,leakyreluAlpha:c}){if(u=u||"linear",!1===Tf(Mo.state.gradientDepth,u)){X("NHWC"===a,(()=>`Error in fused conv2d: got dataFormat of ${a} but only NHWC is currently supported for the case of gradient depth is 0 and the activation is not linear.`));let p=wc(e,t,n,r,a,o,s);return null!=i&&(p=bi(p,i)),Nf(p,u,l,c)}const p=Bo(e,"x","conv2d","float32"),d=Bo(t,"filter","conv2d","float32");let f=p,h=!1;3===p.rank&&(h=!0,f=Xl(p,[1,p.shape[0],p.shape[1],p.shape[2]])),X(4===f.rank,(()=>`Error in fused conv2d: input must be rank 4, but got rank ${f.rank}.`)),X(4===d.rank,(()=>`Error in fused conv2d: filter must be rank 4, but got rank ${d.rank}.`)),Yl("fused conv2d",r,s);const m="NHWC"===a?f.shape[3]:f.shape[1];X(d.shape[2]===m,(()=>`Error in conv2d: depth of input (${m}) must match input depth for filter ${d.shape[2]}.`)),X(Gl(n,o),(()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`));const g=zl(f.shape,d.shape,n,o,r,s);let y,b;if(null!=i&&(y=Bo(i,"bias","fused conv2d"),[y]=xo(y,p),"NHWC"===a?Qi(g.outShape,y.shape):(X(y.shape.length<=1,(()=>`Error in fused conv2d: only supports scalar or 1-D Tensor bias for NCHW format but got the bias of rank-${y.shape.length}.`)),X(0===y.shape.length||y.shape[0]===g.outChannels||1===y.shape[0],(()=>`Error in fused conv2d: bias shape (${y.shape}) is not compatible with the number of output channels (${g.outChannels})`)))),null!=l){const e=l.shape;if(X(e.length<=1||3===e.length,(()=>`Error in fused conv2d: only supports scalar, 1-D Tensor or 3-D Tensor PReLU activation weights but got a tensor of rank-${e.length}.`)),1===e.length)X(1===e[0]||e[0]===g.outChannels,(()=>`Error in fused conv2d: PReLU activation weights (${e}) is not compatible with the number of output channels (${g.outChannels}).`));else if(3===e.length)try{Qi(e,g.outShape)}catch(t){const n=`Error in fused conv2d: PReLU activation weights (${e}) is not compatible with the output shape of the conv2d (${g.outShape}).`;throw Error(n)}b=Bo(l,"prelu weights","fused conv2d")}const v=(e,t)=>{X("NHWC"===a,(()=>`Error in gradient of fused conv2D: got dataFormat of ${a} but only NHWC is currently supported.`));const[s,i,l,c]=t,p=Sf(e,l,u);X(ql(o),(()=>`Error in gradient of fused conv2D: dilation rates greater than 1 are not yet supported in gradients. Got dilations '${o}'`));const d=[kc(i.shape,p,s,n,r),kf(i,p,s.shape,n,r)];if(null!=c){const e=Ef(c,p);d.push(e)}return d},w={x:f,filter:d,bias:y,preluActivationWeights:b},x={strides:n,pad:r,dataFormat:a,dilations:o,dimRoundingMode:s,activation:u,leakyreluAlpha:c};if(null==i){const e=Mi(((e,t,n)=>{let r=Mo.runKernel(ua,w,x);return n([t,e,r]),h&&(r=Xl(r,[r.shape[1],r.shape[2],r.shape[3]])),{value:r,gradFunc:v}}));return e(f,d)}{const e=Mi(((e,t,n,r)=>{let a=Mo.runKernel(ua,w,x);return r([t,e,a,n]),h&&(a=Xl(a,[a.shape[1],a.shape[2],a.shape[3]])),{value:a,gradFunc:v}}));return e(f,d,y)}}});const Af=jo({depthwiseConv2dNativeBackpropFilter_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o=[1,1],s){let i=e;3===e.rank&&(i=Xl(e,[1,e.shape[0],e.shape[1],e.shape[2]]));let u=t;3===u.rank&&(u=Xl(t,[1,t.shape[0],t.shape[1],t.shape[2]]));const l={x:i,dy:u},c={strides:r,pad:a,dimRoundingMode:s,dilations:o,filterShape:n};return Mo.runKernel(Rt,l,c)}});const If=jo({depthwiseConv2dNativeBackpropInput_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o=[1,1],s){let i=t,u=!1;3===t.rank&&(u=!0,i=Xl(t,[1,t.shape[0],t.shape[1],t.shape[2]]));const l={dy:i,filter:n},c={strides:r,pad:a,dimRoundingMode:s,dilations:o,inputShape:e},p=Mo.runKernel(Ft,l,c);return u?Xl(p,[p.shape[1],p.shape[2],p.shape[3]]):p}});const Mf=jo({fusedDepthwiseConv2d_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function({x:e,filter:t,strides:n,pad:r,dataFormat:a="NHWC",dilations:o=[1,1],dimRoundingMode:s,bias:i,activation:u="linear",preluActivationWeights:l,leakyreluAlpha:c}){if(!1===Tf(Mo.state.gradientDepth,u)){let p=Cc(e,t,n,r,a,o,s);return null!=i&&(p=bi(p,i)),Nf(p,u,l,c)}const p=Bo(e,"x","depthwiseConv2d","float32"),d=Bo(t,"filter","depthwiseConv2d","float32");let f=p,h=!1;3===p.rank&&(h=!0,f=Xl(p,[1,p.shape[0],p.shape[1],p.shape[2]])),X(4===f.rank,(()=>`Error in fused depthwiseConv2d: input must be rank 4, but got rank ${f.rank}.`)),X(4===d.rank,(()=>`Error in fused depthwiseConv2d: filter must be rank 4, but got rank ${d.rank}.`)),X(f.shape[3]===d.shape[2],(()=>`Error in fused depthwiseConv2d: number of input channels (${f.shape[3]}) must match the inChannels dimension in filter ${d.shape[2]}.`)),null==o&&(o=[1,1]),X(Gl(n,o),(()=>`Error in fused depthwiseConv2d: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`)),Yl("fused depthwiseConv2d",r,s);const m=zl(f.shape,d.shape,n,o,r,s,!0);let g,y;null!=i&&(g=Bo(i,"bias","fused conv2d"),[g]=xo(g,p),Qi(m.outShape,g.shape)),null!=l&&(y=Bo(l,"prelu weights","fused depthwiseConv2d"));const b=(e,t)=>{X(ql(o),(()=>`Error in gradient of fused depthwiseConv2d: dilation rates greater than 1 are not yet supported. Got dilations '${o}'`));const[a,i,l,c]=t,p=Sf(e,l,u),d=If(i.shape,p,a,n,r,o,s),f=Af(i,p,a.shape,n,r,o,s);if(null!=c){return[d,f,Ef(g,p)]}return[d,f]},v={x:f,filter:d,bias:g,preluActivationWeights:y},w={strides:n,pad:r,dataFormat:a,dilations:o,dimRoundingMode:s,activation:u,leakyreluAlpha:c};if(null==i){const e=Mi(((e,t,n)=>{let r=Mo.runKernel(la,v,w);return n([t,e,r]),h&&(r=Xl(r,[r.shape[1],r.shape[2],r.shape[3]])),{value:r,gradFunc:b}}));return e(f,d)}{const e=Mi(((e,t,n,r)=>{let a=Mo.runKernel(la,v,w);return r([t,e,a,n]),h&&(a=Xl(a,[a.shape[1],a.shape[2],a.shape[3]])),{value:a,gradFunc:b}}));return e(f,d,g)}}});const Of=jo({fusedMatMul_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function({a:e,b:t,transposeA:n=!1,transposeB:r=!1,bias:a,activation:o="linear",preluActivationWeights:s,leakyreluAlpha:i=.2}){if(!1===Tf(Mo.state.gradientDepth,o)){let u=ku(e,t,n,r);return null!=a&&(u=bi(u,a)),Nf(u,o,s,i)}let u=Bo(e,"a","fused matMul"),l=Bo(t,"b","fused matMul");[u,l]=xo(u,l);const c=n?u.shape[u.rank-2]:u.shape[u.rank-1],p=r?l.shape[l.rank-1]:l.shape[l.rank-2],d=n?u.shape[u.rank-1]:u.shape[u.rank-2],f=r?l.shape[l.rank-2]:l.shape[l.rank-1],h=u.shape.slice(0,-2),m=l.shape.slice(0,-2),g=ee(h),y=ee(m);X(c===p,(()=>`Error in fused matMul: inner shapes (${c}) and (${p}) of Tensors with shapes ${u.shape} and ${l.shape} and transposeA=${n} and transposeB=${r} must match.`));const b=Qi(u.shape.slice(0,-2),l.shape.slice(0,-2)).concat([d,f]),v=Xl(u,n?[g,c,d]:[g,d,c]),w=Xl(l,r?[y,f,p]:[y,p,f]);let x,k;null!=a&&(x=Bo(a,"bias","fused matMul"),[x]=xo(x,u),Qi(b,x.shape)),null!=s&&(k=Bo(s,"prelu weights","fused matMul"));const S=(e,t)=>{const[s,i,u,l]=t,c=Sf(Xl(e,u.shape),u,o);let p,d;if(n||r?!n&&r?(p=ku(c,i,!1,!1),d=ku(c,s,!0,!1)):n&&!r?(p=ku(i,c,!1,!0),d=ku(s,c,!1,!1)):(p=ku(i,c,!0,!0),d=ku(c,s,!0,!0)):(p=ku(c,i,!1,!0),d=ku(s,c,!0,!1)),null!=a){return[p,d,Ef(l,c)]}return[p,d]},E={a:v,b:w,bias:x,preluActivationWeights:k},N={transposeA:n,transposeB:r,activation:o,leakyreluAlpha:i};if(null==a){const e=Mi(((e,t,n)=>{const r=Mo.runKernel(ia,E,N);return n([e,t,r]),{value:Xl(r,b),gradFunc:S}}));return e(v,w)}{const e=Mi(((e,t,n,r)=>{const a=Mo.runKernel(ia,E,N);return r([e,t,a,n]),{value:Xl(a,b),gradFunc:S}}));return e(v,w,x)}}});const Df=jo({hammingWindow_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){return wf(e,.54,.46)}});const Cf=jo({hannWindow_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){return wf(e,.5,.5)}});const $f=jo({frame_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=!1,a=0){let o=0;const s=[];for(;o+t<=e.size;)s.push(nc(e,o,t)),o+=n;if(r)for(;o<e.size;){const r=o+t-e.size,i=ec([nc(e,o,t-r),Vi([r],a)]);s.push(i),o+=n}return 0===s.length?Zd([],[0,t]):Xl(ec(s),[s.length,t])}});const Rf=jo({stft_:
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a=Cf){null==r&&(r=vf(t));const o=$f(e,t,n),s=xi(o,a(t));return Wd(s,r)}});const Ff=jo({cropAndResize_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a="bilinear",o=0){const s=Bo(e,"image","cropAndResize"),i=Bo(t,"boxes","cropAndResize","float32"),u=Bo(n,"boxInd","cropAndResize","int32"),l=i.shape[0];X(4===s.rank,(()=>`Error in cropAndResize: image must be rank 4,but got rank ${s.rank}.`)),X(2===i.rank&&4===i.shape[1],(()=>`Error in cropAndResize: boxes must be have size [${l},4] but had shape ${i.shape}.`)),X(1===u.rank&&u.shape[0]===l,(()=>`Error in cropAndResize: boxInd must be have size [${l}] but had shape ${i.shape}.`)),X(2===r.length,(()=>`Error in cropAndResize: cropSize must be of length 2, but got length ${r.length}.`)),X(r[0]>=1&&r[1]>=1,(()=>`cropSize must be atleast [1,1], but was ${r}`)),X("bilinear"===a||"nearest"===a,(()=>`method must be bilinear or nearest, but was ${a}`));const c={image:s,boxes:i,boxInd:u},p={method:a,extrapolationValue:o,cropSize:r};return Mo.runKernel(Ot,c,p)}});const Pf=jo({flipLeftRight_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"image","flipLeftRight","float32");X(4===t.rank,(()=>`Error in flipLeftRight: image must be rank 4,but got rank ${t.rank}.`));const n={image:t};return Mo.runKernel(Jt,n,{})}});const Lf=jo({grayscaleToRGB_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"image","grayscaleToRGB"),n=t.rank-1,r=t.shape[n];X(t.rank>=2,(()=>`Error in grayscaleToRGB: images must be at least rank 2, but got rank ${t.rank}.`)),X(1===r,(()=>`Error in grayscaleToRGB: last dimension of a grayscale image should be size 1, but got size ${r}.`));const a=new Array(t.rank);return a.fill(1,0,n),a[n]=3,ip(t,a)}});const zf=jo({rgbToGrayscale_:
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){const t=Bo(e,"image","RGBToGrayscale"),n=t.rank-1,r=t.shape[n];X(t.rank>=2,(()=>`Error in RGBToGrayscale: images must be at least rank 2, but got rank ${t.rank}.`)),X(3===r,(()=>`Error in RGBToGrayscale: last dimension of an RGB image should be size 3, but got size ${r}.`));const a=t.dtype,o=Ks(t,"float32"),s=Xd([.2989,.587,.114]);let i;switch(t.rank){case 2:i=Bc("ij,j->i",o,s);break;case 3:i=Bc("ijk,k->ij",o,s);break;case 4:i=Bc("ijkl,l->ijk",o,s);break;case 5:i=Bc("ijklm,m->ijkl",o,s);break;case 6:i=Bc("ijklmn,n->ijklm",o,s);break;default:throw new Error("Not a valid tensor rank.")}return i=op(i,-1),Ks(i,a)}});const Bf=jo({rotateWithOffset_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=0,r=.5){const a=Bo(e,"image","rotateWithOffset","float32");X(4===a.rank,(()=>`Error in rotateWithOffset: image must be rank 4,but got rank ${a.rank}.`));const o={image:a},s={radians:t,fillValue:n,center:r};return Mo.runKernel(sa,o,s)}});
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vf(e,t,n,r,a,o){null==r&&(r=.5),null==a&&(a=Number.NEGATIVE_INFINITY),null==o&&(o=0);const s=e.shape[0];return n=Math.min(n,s),X(0<=r&&r<=1,(()=>`iouThreshold must be in [0, 1], but was '${r}'`)),X(2===e.rank,(()=>`boxes must be a 2D tensor, but was of rank '${e.rank}'`)),X(4===e.shape[1],(()=>`boxes must have 4 columns, but 2nd dimension was ${e.shape[1]}`)),X(1===t.rank,(()=>"scores must be a 1D tensor")),X(t.shape[0]===s,(()=>`scores has incompatible shape with boxes. Expected ${s}, but was ${t.shape[0]}`)),X(0<=o&&o<=1,(()=>`softNmsSigma must be in [0, 1], but was '${o}'`)),{maxOutputSize:n,iouThreshold:r,scoreThreshold:a,softNmsSigma:o}}const Uf=jo({nonMaxSuppression_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY){const o=Bo(e,"boxes","nonMaxSuppression","float32"),s=Bo(t,"scores","nonMaxSuppression","float32"),i=Vf(o,s,n,r,a),u={maxOutputSize:n=i.maxOutputSize,iouThreshold:r=i.iouThreshold,scoreThreshold:a=i.scoreThreshold};return Mo.runKernel(Hn,{boxes:o,scores:s},u)}});
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function jf(e,t,n){const r=function(e,t,n){return function(e,t,n){let r=0,a=e.length,o=0,s=!1;for(;r<a;){o=r+(a-r>>>1);const i=n(t,e[o]);i>0?r=o+1:(a=o,s=!i)}return s?r:-r-1}(e,t,n||Wf)}(e,t,n),a=r<0?-(r+1):r;e.splice(a,0,t)}function Wf(e,t){return e>t?1:e<t?-1:0}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hf(e,t,n,r,a){return Kf(e,t,n,r,a,0)}function qf(e,t,n,r,a,o){return Kf(e,t,n,r,a,0,!1,o,!0)}function Gf(e,t,n,r,a,o){return Kf(e,t,n,r,a,o,!0)}function Kf(e,t,n,r,a,o,s=!1,i=!1,u=!1){const l=[];for(let e=0;e<t.length;e++)t[e]>a&&l.push({score:t[e],boxIndex:e,suppressBeginIndex:0});l.sort(Xf);const c=o>0?-.5/o:0,p=[],d=[];for(;p.length<n&&l.length>0;){const t=l.pop(),{score:n,boxIndex:o,suppressBeginIndex:s}=t;if(n<a)break;let i=!1;for(let n=p.length-1;n>=s;--n){const s=Qf(e,o,p[n]);if(s>=r){i=!0;break}if(t.score=t.score*Yf(r,c,s),t.score<=a)break}t.suppressBeginIndex=p.length,i||(t.score===n?(p.push(o),d.push(t.score)):t.score>a&&jf(l,t,Xf))}const f=p.length,h=n-f;i&&h>0&&(p.push(...new Array(h).fill(0)),d.push(...new Array(h).fill(0)));const m={selectedIndices:p};return s&&(m.selectedScores=d),u&&(m.validOutputs=f),m}function Qf(e,t,n){const r=e.subarray(4*t,4*t+4),a=e.subarray(4*n,4*n+4),o=Math.min(r[0],r[2]),s=Math.min(r[1],r[3]),i=Math.max(r[0],r[2]),u=Math.max(r[1],r[3]),l=Math.min(a[0],a[2]),c=Math.min(a[1],a[3]),p=Math.max(a[0],a[2]),d=Math.max(a[1],a[3]),f=(i-o)*(u-s),h=(p-l)*(d-c);if(f<=0||h<=0)return 0;const m=Math.max(o,l),g=Math.max(s,c),y=Math.min(i,p),b=Math.min(u,d),v=Math.max(y-m,0)*Math.max(b-g,0);return v/(f+h-v)}function Yf(e,t,n){const r=Math.exp(t*n*n);return n<=e?r:0}function Xf(e,t){return e.score-t.score||e.score===t.score&&t.boxIndex-e.boxIndex}const Zf=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY){const o=Bo(e,"boxes","nonMaxSuppressionAsync"),s=Bo(t,"scores","nonMaxSuppressionAsync"),i=Vf(o,s,n,r,a);n=i.maxOutputSize,r=i.iouThreshold,a=i.scoreThreshold;const u=await Promise.all([o.data(),s.data()]),l=u[0],c=u[1],{selectedIndices:p}=Hf(l,c,n,r,a);return o!==e&&o.dispose(),s!==t&&s.dispose(),Xd(p,"int32")};const Jf=jo({nonMaxSuppressionWithScore_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY,o=0){const s=Bo(e,"boxes","nonMaxSuppression"),i=Bo(t,"scores","nonMaxSuppression"),u=Vf(s,i,n,r,a,o),l={boxes:s,scores:i},c={maxOutputSize:n=u.maxOutputSize,iouThreshold:r=u.iouThreshold,scoreThreshold:a=u.scoreThreshold,softNmsSigma:o=u.softNmsSigma},p=Mo.runKernel(Gn,l,c);return{selectedIndices:p[0],selectedScores:p[1]}}});const eh=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY,o=0){const s=Bo(e,"boxes","nonMaxSuppressionAsync"),i=Bo(t,"scores","nonMaxSuppressionAsync"),u=Vf(s,i,n,r,a,o);n=u.maxOutputSize,r=u.iouThreshold,a=u.scoreThreshold,o=u.softNmsSigma;const l=await Promise.all([s.data(),i.data()]),c=l[0],p=l[1],{selectedIndices:d,selectedScores:f}=Gf(c,p,n,r,a,o);return s!==e&&s.dispose(),i!==t&&i.dispose(),{selectedIndices:Xd(d,"int32"),selectedScores:Xd(f)}};const th=jo({nonMaxSuppressionPadded_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY,o=!1){const s=Bo(e,"boxes","nonMaxSuppression"),i=Bo(t,"scores","nonMaxSuppression"),u=Vf(s,i,n,r,a,null),l={boxes:s,scores:i},c={maxOutputSize:u.maxOutputSize,iouThreshold:u.iouThreshold,scoreThreshold:u.scoreThreshold,padToMaxOutputSize:o},p=Mo.runKernel(qn,l,c);return{selectedIndices:p[0],validOutputs:p[1]}}});const nh=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function(e,t,n,r=.5,a=Number.NEGATIVE_INFINITY,o=!1){const s=Bo(e,"boxes","nonMaxSuppressionAsync"),i=Bo(t,"scores","nonMaxSuppressionAsync"),u=Vf(s,i,n,r,a,null),l=u.maxOutputSize,c=u.iouThreshold,p=u.scoreThreshold,[d,f]=await Promise.all([s.data(),i.data()]),{selectedIndices:h,validOutputs:m}=qf(d,f,l,c,p,o);return s!==e&&s.dispose(),i!==t&&i.dispose(),{selectedIndices:Xd(h,"int32"),validOutputs:Di(m,"int32")}};const rh=jo({resizeBilinear_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=!1,r=!1){const a=Bo(e,"images","resizeBilinear");X(3===a.rank||4===a.rank,(()=>`Error in resizeBilinear: x must be rank 3 or 4, but got rank ${a.rank}.`)),X(2===t.length,(()=>`Error in resizeBilinear: new shape must 2D, but got shape ${t}.`)),X(!1===r||!1===n,(()=>"Error in resizeBilinear: If halfPixelCenters is true, alignCorners must be false."));let o=a,s=!1;3===a.rank&&(s=!0,o=Xl(a,[1,a.shape[0],a.shape[1],a.shape[2]]));const[]=t,i={images:o},u={alignCorners:n,halfPixelCenters:r,size:t},l=Mo.runKernel(dr,i,u);return s?Xl(l,[l.shape[1],l.shape[2],l.shape[3]]):l}});const ah=jo({resizeNearestNeighbor_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=!1,r=!1){const a=Bo(e,"images","resizeNearestNeighbor");X(3===a.rank||4===a.rank,(()=>`Error in resizeNearestNeighbor: x must be rank 3 or 4, but got rank ${a.rank}.`)),X(2===t.length,(()=>`Error in resizeNearestNeighbor: new shape must 2D, but got shape ${t}.`)),X("float32"===a.dtype||"int32"===a.dtype,(()=>"`images` must have `int32` or `float32` as dtype")),X(!1===r||!1===n,(()=>"Error in resizeNearestNeighbor: If halfPixelCenters is true, alignCorners must be false."));let o=a,s=!1;3===a.rank&&(s=!0,o=Xl(a,[1,a.shape[0],a.shape[1],a.shape[2]]));const[]=t,i={images:o},u={alignCorners:n,halfPixelCenters:r,size:t},l=Mo.runKernel(cr,i,u);return s?Xl(l,[l.shape[1],l.shape[2],l.shape[3]]):l}});const oh=jo({threshold_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t="binary",n=!1,r=.5){const a=Bo(e,"image","threshold"),o=a.shape[0]*a.shape[1];let s,i,u,l,c=xi(Xd([r]),255);if(X(3===a.rank,(()=>`Error in threshold: image must be rank 3,but got rank ${a.rank}.`)),X(3===a.shape[2]||1===a.shape[2],(()=>`Error in threshold: image color channel must be equal to 3 or 1but got ${a.shape[2]}.`)),X("int32"===a.dtype||"float32"===a.dtype,(()=>`Error in dtype: image dtype must be int32 or float32,but got dtype ${a.dtype}.`)),X("otsu"===t||"binary"===t,(()=>`Method must be binary or otsu, but was ${t}`)),3===a.shape[2]){[s,i,u]=jd(a,[1,1,1],-1);const e=xi(s,.2989),t=xi(i,.587),n=xi(u,.114);l=bi(bi(e,t),n)}else l=e;if("otsu"===t){c=function(e,t){let n,r,a,o,s,i,u=Xd([-1]),l=Xd([0]),c=Xd([0]);for(let p=0;p<e.size-1;p++){n=nc(e,0,p+1),r=nc(e,p+1),s=wi(ep(n),t),i=wi(ep(r),t);const d=ep(xi(n,bd(0,n.size)));a=wi(d,ep(n));const f=Vi(r.shape,n.size),h=bi(bd(0,r.size),f),m=xi(r,h);o=wi(ep(m),ep(r));const g=Wi(a,o),y=Wi(a,o),b=xi(s,i);c=xi(xi(b,g),y);const v=pp(c,l);l=Pc(v,c,l),u=Pc(v,Xd([p]),u)}return u}(cc(Ks(_d(l),"int32"),qo([]),256),o)}const p=n?bp(l,c):pp(l,c);return Ks(xi(p,255),"int32")}});const sh=jo({transform_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n="nearest",r="constant",a=0,o){const s=Bo(e,"image","transform","float32"),i=Bo(t,"transforms","transform","float32");X(4===s.rank,(()=>`Error in transform: image must be rank 4,but got rank ${s.rank}.`)),X(2===i.rank&&(i.shape[0]===s.shape[0]||1===i.shape[0])&&8===i.shape[1],(()=>"Error in transform: Input transform should be batch x 8 or 1 x 8")),X(null==o||2===o.length,(()=>`Error in transform: outputShape must be [height, width] or null, but got ${o}.`));const u={image:s,transforms:i},l={interpolation:n,fillMode:r,fillValue:a,outputShape:o};return Mo.runKernel(Xr,u,l)}});const ih=jo({bandPart_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"a","bandPart");X(r.rank>=2,(()=>`bandPart(): Rank must be at least 2, got ${r.rank}.`));const a=r.shape,[o,s]=r.shape.slice(-2);let i,u;"number"==typeof t?(X(t%1==0,(()=>`bandPart(): numLower must be an integer, got ${t}.`)),X(t<=o,(()=>`bandPart(): numLower (${t}) must not be greater than the number of rows (${o}).`)),i=Bo(t<0?o:t,"numLower","bandPart")):(X("int32"===t.dtype,(()=>"bandPart(): numLower's dtype must be an int32.")),i=Pc(yp(t,0),o,Vp(t,o))),"number"==typeof n?(X(n%1==0,(()=>`bandPart(): numUpper must be an integer, got ${n}.`)),X(n<=s,(()=>`bandPart(): numUpper (${n}) must not be greater than the number of columns (${s}).`)),u=Bo(n<0?s:n,"numUpper","bandPart")):(X("int32"===n.dtype,(()=>"bandPart(): numUpper's dtype must be an int32.")),u=Pc(yp(n,0),s,Vp(n,s)));const l=Xl(bd(0,o,1,"int32"),[-1,1]),c=bd(0,s,1,"int32"),p=Wi(l,c),d=_p(bp(p,i),dp(p,Nu(u))),f=Lp([o,s],r.dtype);return Xl(Gd(uf(Xl(r,[-1,o,s])).map((e=>Pc(d,e,f)))),a)}});const uh=jo({gramSchmidt_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e){let t;if(Array.isArray(e)){t=!1,X(null!=e&&e.length>0,(()=>"Gram-Schmidt process: input must not be null, undefined, or empty"));const n=e[0].shape[0];for(let t=1;t<e.length;++t)X(e[t].shape[0]===n,(()=>`Gram-Schmidt: Non-unique lengths found in the input vectors: (${e[t].shape[0]} vs. ${n})`))}else t=!0,e=jd(e,e.shape[0],0).map((e=>qd(e,[0])));X(e.length<=e[0].shape[0],(()=>`Gram-Schmidt: Number of vectors (${e.length}) exceeds number of dimensions (${e[0].shape[0]}).`));const n=[],r=e;for(let t=0;t<e.length;++t)n.push(Mo.tidy((()=>{let e=r[t];if(t>0)for(let r=0;r<t;++r){const t=xi(ep(xi(n[r],e)),n[r]);e=Wi(e,t)}return wi(e,np(e,"euclidean"))})));return t?Gd(n,0):n}});function lh(e,t=!1){return Mo.tidy((()=>{X(2===e.shape.length,(()=>`qr2d() requires a 2D Tensor, but got a ${e.shape.length}D Tensor.`));const n=e.shape[0],r=e.shape[1];let a=up(n),o=Qs(e);const s=Zd([[1]],[1,1]);let i=Qs(s);const u=n>=r?r:n;for(let e=0;e<u;++e){const t=o,u=i,l=a;[i,o,a]=Mo.tidy((()=>{const t=nc(o,[e,e],[n-e,1]),u=np(t),l=nc(o,[e,e],[1,1]),c=Pc(pp(l,0),Zd([[-1]]),Zd([[1]])),p=Wi(l,xi(c,u)),d=wi(t,p);i=1===d.shape[0]?Qs(s):ec([s,nc(d,[1,0],[d.shape[0]-1,d.shape[1]])],0);const f=Nu(wi(ku(c,p),u)),h=nc(o,[e,0],[n-e,r]),m=xi(f,i),g=_u(i);if(0===e)o=Wi(h,ku(m,ku(g,h)));else{const t=Wi(h,ku(m,ku(g,h)));o=ec([nc(o,[0,0],[e,r]),t],0)}const y=_u(m),b=nc(a,[0,e],[n,a.shape[1]-e]);if(0===e)a=Wi(b,ku(ku(b,i),y));else{const t=Wi(b,ku(ku(b,i),y));a=ec([nc(a,[0,0],[n,e]),t],1)}return[i,o,a]})),si([t,u,l])}return!t&&n>r&&(a=nc(a,[0,0],[n,r]),o=nc(o,[0,0],[r,r])),[a,o]}))}const ch=jo({qr_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t=!1){if(X(e.rank>=2,(()=>`qr() requires input tensor to have a rank >= 2, but got rank ${e.rank}`)),2===e.rank)return lh(e,t);{const n=e.shape.slice(0,e.shape.length-2).reduce(((e,t)=>e*t)),r=uf(Xl(e,[n,e.shape[e.shape.length-2],e.shape[e.shape.length-1]]),0),a=[],o=[];r.forEach((e=>{const[n,r]=lh(e,t);a.push(n),o.push(r)}));return[Xl(Gd(a,0),e.shape),Xl(Gd(o,0),e.shape)]}}});
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var ph;!function(e){e[e.NONE=0]="NONE",e[e.MEAN=1]="MEAN",e[e.SUM=2]="SUM",e[e.SUM_BY_NONZERO_WEIGHTS=3]="SUM_BY_NONZERO_WEIGHTS"}(ph||(ph={}));const dh=jo({computeWeightedLoss_:function(e,t,n=ph.SUM_BY_NONZERO_WEIGHTS){const r=Bo(e,"losses","computeWeightedLoss");let a=null;null!=t&&(a=Bo(t,"weights","computeWeightedLoss"));const o=null==a?r:xi(r,a);if(n===ph.NONE)return o;if(n===ph.SUM)return ep(o);if(n===ph.MEAN){if(null==a)return Pp(o);{const e=r.size/a.size,t=wi(ep(o),ep(a));return e>1?wi(t,Di(e)):t}}if(n===ph.SUM_BY_NONZERO_WEIGHTS){if(null==a)return wi(ep(o),Di(r.size));{const e=xi(a,zp(r.shape)),t=Ks(ep(Gp(e,Di(0))),"float32");return wi(ep(o),t)}}throw Error(`Unknown reduction: ${n}`)}});const fh=jo({absoluteDifference_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=ph.SUM_BY_NONZERO_WEIGHTS){const a=Bo(e,"labels","absoluteDifference"),o=Bo(t,"predictions","absoluteDifference");let s=null;null!=n&&(s=Bo(n,"weights","absoluteDifference")),Z(a.shape,o.shape,"Error in absoluteDifference: ");const i=qi(Wi(a,o));return dh(i,s,r)}});const hh=jo({cosineDistance_:function(e,t,n,r,a=ph.SUM_BY_NONZERO_WEIGHTS){const o=Bo(e,"labels","cosineDistance"),s=Bo(t,"predictions","cosineDistance");let i=null;null!=r&&(i=Bo(r,"weights","cosineDistance")),Z(o.shape,s.shape,"Error in cosineDistance: ");const u=Di(1),l=Wi(u,ep(xi(o,s),n,!0));return dh(l,i,a)}});const mh=jo({hingeLoss_:function(e,t,n,r=ph.SUM_BY_NONZERO_WEIGHTS){let a=Bo(e,"labels","hingeLoss");const o=Bo(t,"predictions","hingeLoss");let s=null;null!=n&&(s=Bo(n,"weights","hingeLoss")),Z(a.shape,o.shape,"Error in hingeLoss: ");const i=Di(1);a=Wi(xi(Di(2),a),i);const u=wd(Wi(i,xi(a,o)));return dh(u,s,r)}});const gh=jo({huberLoss_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=1,a=ph.SUM_BY_NONZERO_WEIGHTS){const o=Bo(e,"labels","huberLoss"),s=Bo(t,"predictions","huberLoss");let i=null;null!=n&&(i=Bo(n,"weights","huberLoss")),Z(o.shape,s.shape,"Error in huberLoss: ");const u=Di(r),l=qi(Wi(s,o)),c=Vp(l,u),p=Wi(l,c),d=bi(xi(Di(.5),Si(c)),xi(u,p));return dh(d,i,a)}});const yh=jo({logLoss_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=1e-7,a=ph.SUM_BY_NONZERO_WEIGHTS){const o=Bo(e,"labels","logLoss"),s=Bo(t,"predictions","logLoss");let i=null;null!=n&&(i=Bo(n,"weights","logLoss")),Z(o.shape,s.shape,"Error in logLoss: ");const u=Di(1),l=Di(r),c=Nu(xi(o,xp(bi(s,l)))),p=xi(Wi(u,o),xp(bi(Wi(u,s),l))),d=Wi(c,p);return dh(d,i,a)}});const bh=jo({meanSquaredError_:
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=ph.SUM_BY_NONZERO_WEIGHTS){const a=Bo(e,"labels","meanSquaredError"),o=Bo(t,"predictions","meanSquaredError");let s=null;null!=n&&(s=Bo(n,"weights","meanSquaredError")),Z(a.shape,o.shape,"Error in meanSquaredError: ");const i=Hd(a,o);return dh(i,s,r)}});const vh=jo({sigmoidCrossEntropy_:function(e,t,n,r=0,a=ph.SUM_BY_NONZERO_WEIGHTS){let o=Bo(e,"multiClassLabels","sigmoidCrossEntropy");const s=Bo(t,"logits","sigmoidCrossEntropy");let i=null;if(null!=n&&(i=Bo(n,"weights","sigmoidCrossEntropy")),Z(o.shape,s.shape,"Error in sigmoidCrossEntropy: "),r>0){const e=Di(r),t=Di(1),n=Di(.5);o=bi(xi(o,Wi(t,e)),xi(n,e))}const u=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"labels","sigmoidCrossEntropyWithLogits"),r=Bo(t,"logits","sigmoidCrossEntropyWithLogits");Z(n.shape,r.shape,"Error in sigmoidCrossEntropyWithLogits: ");const a=wd(r),o=xi(r,n),s=kp(ap(Nu(qi(r))));return bi(Wi(a,o),s)}(o,s);return dh(u,i,a)}});const wh=jo({softmaxCrossEntropy_:function(e,t,n,r=0,a=ph.SUM_BY_NONZERO_WEIGHTS){let o=Bo(e,"onehotLabels","softmaxCrossEntropy");const s=Bo(t,"logits","softmaxCrossEntropy");let i=null;if(null!=n&&(i=Bo(n,"weights","softmaxCrossEntropy")),Z(o.shape,s.shape,"Error in softmaxCrossEntropy: "),r>0){const e=Di(r),t=Di(1),n=Di(o.shape[1]);o=bi(xi(o,Wi(t,e)),wi(e,n))}const u=
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=-1){if(-1===n&&(n=t.rank-1),n!==t.rank-1)throw Error(`Softmax cross entropy along a non-last dimension is not yet supported. Labels / logits was rank ${t.rank} and dim was ${n}`);const r=Mi(((e,t,r)=>{const a=Tp(t,[n],!0),o=Wi(Ks(t,"float32"),a);r([e,o]);const s=Nu(xi(o,e));return{value:ep(s,[n]),gradFunc:(e,t)=>{const[r,a]=t,o=Gc(e.shape,[n]);return[xi(Xl(e,o),Wi(Ks(r,"float32"),ap(a))),xi(Xl(e,o),Wi(ap(a),Ks(r,"float32")))]}}}));return r(e,t)}(o,s);return dh(u,i,a)}});const xh=jo({sparseFillEmptyRows_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r){const a=Bo(e,"indices","sparseFillEmptyRows","int32"),o=Bo(t,"values","sparseFillEmptyRows"),s=Bo(n,"denseShape","sparseFillEmptyRows","int32"),i=Bo(r,"defaultValue","sparseFillEmptyRows",o.dtype);if(2!==a.rank)throw new Error(`Indices should be Tensor2D but received shape\n        ${a.shape}`);if(1!==o.rank)throw new Error(`Values should be Tensor1D but received shape ${o.shape}`);if(1!==s.rank)throw new Error(`Dense shape should be Tensor1D but received shape ${s.shape}`);if(0!==i.rank)throw new Error(`Default value should be a scalar but received shape ${i.shape}`);const u={indices:a,values:o,denseShape:s,defaultValue:i},l=Mo.runKernel($r,u);return{outputIndices:l[0],outputValues:l[1],emptyRowIndicator:l[2],reverseIndexMap:l[3]}}});const kh=jo({sparseReshape_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"inputIndices","sparseReshape","int32"),a=Bo(t,"inputShape","sparseReshape","int32"),o=Bo(n,"newShape","sparseReshape","int32");if(2!==r.rank)throw new Error(`Input indices should be Tensor2D but received shape\n        ${r.shape}`);if(1!==a.rank)throw new Error(`Input shape should be Tensor1D but received shape ${a.shape}`);if(1!==o.rank)throw new Error(`New shape should be Tensor1D but received shape ${o.shape}`);const s={inputIndices:r,inputShape:a,newShape:o},i=Mo.runKernel(Rr,s);return{outputIndices:i[0],outputShape:i[1]}}});const Sh=jo({sparseSegmentMean_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"data","sparseSegmentMean"),a=Bo(t,"indices","sparseSegmentMean","int32"),o=Bo(n,"segmentIds","sparseSegmentMean","int32");if(r.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(1!==a.rank)throw new Error(`Indices should be Tensor1D but received shape\n          ${a.shape}`);if(1!==o.rank)throw new Error(`Segment ids should be Tensor1D but received shape\n          ${o.shape}`);const s={data:r,indices:a,segmentIds:o};return Mo.runKernel(Fr,s)}});const Eh=jo({sparseSegmentSum_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n){const r=Bo(e,"data","sparseSegmentSum"),a=Bo(t,"indices","sparseSegmentSum","int32"),o=Bo(n,"segmentIds","sparseSegmentSum","int32");if(r.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(1!==a.rank)throw new Error(`Indices should be Tensor1D but received shape\n         ${a.shape}`);if(1!==o.rank)throw new Error(`Segment ids should be Tensor1D but received shape\n         ${o.shape}`);const s={data:r,indices:a,segmentIds:o};return Mo.runKernel(Pr,s)}});const Nh=jo({stringNGrams_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r,a,o,s,i){const u=Bo(e,"data","stringNGrams","string");if("string"!==u.dtype)throw new Error("Data must be of datatype string");if(1!==u.shape.length)throw new Error(`Data must be a vector, saw: ${u.shape}`);const l=Bo(t,"dataSplits","stringNGrams");if("int32"!==l.dtype)throw new Error("Data splits must be of datatype int32");const c={separator:n,nGramWidths:r,leftPad:a,rightPad:o,padWidth:s,preserveShortSequences:i},p={data:u,dataSplits:l},d=Mo.runKernel(jr,p,c);return{nGrams:d[0],nGramsSplits:d[1]}}});const Th={fft:Bd,ifft:Vd,rfft:Wd,irfft:Ud},_h={hammingWindow:Df,hannWindow:Cf,frame:$f,stft:Rf},Ah={flipLeftRight:Pf,grayscaleToRGB:Lf,resizeNearestNeighbor:ah,resizeBilinear:rh,rgbToGrayscale:zf,rotateWithOffset:Bf,cropAndResize:Ff,nonMaxSuppression:Uf,nonMaxSuppressionAsync:Zf,nonMaxSuppressionWithScore:Jf,nonMaxSuppressionWithScoreAsync:eh,nonMaxSuppressionPadded:th,nonMaxSuppressionPaddedAsync:nh,threshold:oh,transform:sh},Ih={bandPart:ih,gramSchmidt:uh,qr:ch},Mh={absoluteDifference:fh,computeWeightedLoss:dh,cosineDistance:hh,hingeLoss:mh,huberLoss:gh,logLoss:yh,meanSquaredError:bh,sigmoidCrossEntropy:vh,softmaxCrossEntropy:wh},Oh={sparseFillEmptyRows:xh,sparseReshape:kh,sparseSegmentMean:Sh,sparseSegmentSum:Eh},Dh={stringNGrams:Nh,stringSplit:jo({stringSplit_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n=!0){const r=Bo(e,"input","stringSplit","string"),a=Bo(t,"delimiter","stringSplit","string");if(1!==r.rank)throw new Error(`Input should be Tensor1D but received shape ${r.shape}`);if(0!==a.rank)throw new Error(`Delimiter should be a scalar but received shape ${a.shape}`);const o={skipEmpty:n},s={input:r,delimiter:a},i=Mo.runKernel(Wr,s,o);return{indices:i[0],values:i[1],shape:i[2]}}}),stringToHashBucketFast:jo({stringToHashBucketFast_:
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t){const n=Bo(e,"input","stringToHashBucketFast","string"),r={numBuckets:t};if(t<=0)throw new Error("Number of buckets must be at least 1");const a={input:n};return Mo.runKernel(Hr,a,r)}}),staticRegexReplace:jo({staticRegexReplace_:
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function(e,t,n,r=!0){const a=Bo(e,"input","staticRegexReplace","string"),o={pattern:t,rewrite:n,replaceGlobal:r};return Mo.runKernel(Vr,{x:a},o)}})},Ch=Sl,$h="undefined"!=typeof requestAnimationFrame?requestAnimationFrame:"undefined"!=typeof setImmediate?setImmediate:e=>e();function Rh(){return new Promise((e=>$h((()=>e()))))}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Fh(e,t){const n=e[0].length;e.forEach(((e,t)=>{X(e.length===n,(()=>`Error in concat${n}D: rank of tensors[${t}] must be the same as the rank of the rest (${n})`))})),X(t>=0&&t<n,(()=>`Error in concat${n}D: axis must be between 0 and ${n-1}.`));const r=e[0];e.forEach(((e,a)=>{for(let o=0;o<n;o++)X(o===t||e[o]===r[o],(()=>`Error in concat${n}D: Shape of tensors[${a}] (${e}) does not match the shape of the rest (${r}) along the non-concatenated axis ${a}.`))}))}function Ph(e,t){const n=e[0].slice();for(let r=1;r<e.length;r++)n[t]+=e[r][t];return n}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var Lh;function zh(e,t,n){let r=new Array;if(null==n&&null==t)return r;if(null==t)for(;r.length<e+n.length;)r.push(-1);else r=t.slice();if(null==n)return r;if(e+n.length!==r.length)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.rank = ${e+n.length}, but shape.rank = ${r.length}`);for(let a=1;a<n.length;++a){const o=n[a],s=r[r.length-n.length+a],i=r[s];if(o>=0)if(i>=0){if(i!==o)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.shape[${a+e}] = ${o} but shape[${a+e}] = ${i}`)}else r[s]=o}return r}function Bh(e){const t={FIRST_DIM_SIZE:Lh.FIRST_DIM_SIZE,VALUE_ROWIDS:Lh.VALUE_ROWIDS,ROW_LENGTHS:Lh.ROW_LENGTHS,ROW_SPLITS:Lh.ROW_SPLITS,ROW_LIMITS:Lh.ROW_LIMITS,ROW_STARTS:Lh.ROW_STARTS},n=[];for(const r of e){if(!(r in t))break;n.push(t[r])}return n}function Vh(e){return 0===e.length?0:e[0]===Lh.FIRST_DIM_SIZE?e.length-1:e.length}function Uh(e,t){if(null==e||null==t)return;const n=e.length,r=t.length;if(n>=r)throw new Error(`defaultValue.shape=${e} and ragged tensor flatValues.shape=${t}, are incompatible: defaultValue.rank = ${n} must be less than ragged tensor input flatValues.rank = ${r})`);for(let a=0;a<Math.min(n,r-1);++a){const n=e[a],r=t[a+1];if(n>=0&&r>=0&&1!==n&&n!==r)throw new Error(`defaultValue.shape=${e}, and ragged tensor input flatValues.shape=${t} are incompatible: defaultValue.shape[${a-e.length}] = ${n} but ragged tensor input.flatValues.shape[${a-e.length}] = ${r}`)}}!function(e){e[e.FIRST_DIM_SIZE=0]="FIRST_DIM_SIZE",e[e.VALUE_ROWIDS=1]="VALUE_ROWIDS",e[e.ROW_LENGTHS=2]="ROW_LENGTHS",e[e.ROW_SPLITS=3]="ROW_SPLITS",e[e.ROW_LIMITS=4]="ROW_LIMITS",e[e.ROW_STARTS=5]="ROW_STARTS"}(Lh||(Lh={}));
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const jh=30;function Wh(e){return e<=jh?e:Ne(e,Math.floor(Math.sqrt(e)))}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hh(e,t,n){return[n*("number"==typeof e?e:e[0]),t*("number"==typeof e?e:e[1])]}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qh(e,t,n,r=!0){let a=[];if(r)a=a.concat(t.slice(0)),a.push(e[0]/n),a=a.concat(e.slice(1));else{a=a.concat(e[0]);const n=t.length;for(let r=0;r<n;++r)a=a.concat([e[r+1]/t[r],t[r]]);a=a.concat(e.slice(n+1))}return a}function Gh(e,t,n=!0){const r=[];if(n){r.push(t);for(let n=t+1;n<e;++n)n<=2*t?(r.push(n),r.push(n-(t+1))):r.push(n)}else{const n=[],a=[];for(let r=1;r<e;++r)r>=2*t+1||r%2==1?a.push(r):n.push(r);r.push(...n),r.push(0),r.push(...a)}return r}function Kh(e,t,n,r=!0){const a=[];r?a.push(e[0]/n):a.push(e[0]*n);for(let n=1;n<e.length;++n)n<=t.length?r?a.push(t[n-1]*e[n]):a.push(e[n]/t[n-1]):a.push(e[n]);return a}function Qh(e,t){const n=[0];for(let r=0;r<t;++r)n.push(e[r][0]);return n}function Yh(e,t,n){const r=e.slice(0,1);for(let a=0;a<n;++a)r.push(e[a+1]-t[a][0]-t[a][1]);return r}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Xh=1.7580993408473768,Zh=1.0507009873554805,Jh=.3275911,em=.254829592,tm=-.284496736,nm=1.421413741,rm=-1.453152027,am=1.061405429;
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function om(e,t){if(e.length!==t.length)throw new Error(`Cannot merge real and imag arrays of different lengths. real:${e.length}, imag: ${t.length}.`);const n=new Float32Array(2*e.length);for(let r=0;r<n.length;r+=2)n[r]=e[r/2],n[r+1]=t[r/2];return n}function sm(e){const t=new Float32Array(e.length/2),n=new Float32Array(e.length/2);for(let r=0;r<e.length;r+=2)t[r/2]=e[r],n[r/2]=e[r+1];return{real:t,imag:n}}function im(e){const t=Math.ceil(e.length/4),n=new Float32Array(t),r=new Float32Array(t);for(let t=0;t<e.length;t+=4)n[Math.floor(t/4)]=e[t],r[Math.floor(t/4)]=e[t+1];return{real:n,imag:r}}function um(e){const t=Math.floor(e.length/4),n=new Float32Array(t),r=new Float32Array(t);for(let t=2;t<e.length;t+=4)n[Math.floor(t/4)]=e[t],r[Math.floor(t/4)]=e[t+1];return{real:n,imag:r}}function lm(e,t){return{real:e[2*t],imag:e[2*t+1]}}function cm(e,t,n,r){e[2*r]=t,e[2*r+1]=n}function pm(e,t){const n=new Float32Array(e/2),r=new Float32Array(e/2);for(let a=0;a<Math.ceil(e/2);a++){const o=(t?2:-2)*Math.PI*(a/e);n[a]=Math.cos(o),r[a]=Math.sin(o)}return{real:n,imag:r}}function dm(e,t,n){const r=(n?2:-2)*Math.PI*(e/t);return{real:Math.cos(r),imag:Math.sin(r)}}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const fm="->",hm=/->/g,mm=",",gm="...";function ym(e,t){const n=((e=e.replace(/\s/g,"")).length-e.replace(hm,"").length)/fm.length;if(n<1)throw new Error("Equations without an arrow are not supported.");if(n>1)throw new Error(`Equation must contain exactly one arrow ("${fm}").`);const[r,a]=e.split(fm);X(-1===r.indexOf(gm),(()=>`The ellipsis notation ("${gm}") is not supported yet.`));const o=r.split(mm),s=o.length;if(t!==s)throw new Error(`Expected ${s} input tensors, received ${t}`);if(s>2)throw new Error("Support for more than 2 input tensors is not implemented yet.");const i=[];for(let e=0;e<a.length;++e){const t=a[e];if(!o.some((e=>-1!==e.indexOf(t))))throw new Error(`Output subscripts contain the label ${t} not present in the input subscripts.`);-1===i.indexOf(t)&&i.push(t)}for(let e=0;e<r.length;++e){const t=r[e];-1===i.indexOf(t)&&t!==mm&&i.push(t)}const u=new Array(o.length);for(let e=0;e<s;++e){if(new Set(o[e].split("")).size!==o[e].length)throw new Error(`Found duplicate axes in input component ${o[e]}. Support for duplicate axes in input is not implemented yet.`);u[e]=[];for(let t=0;t<o[e].length;++t)u[e].push(i.indexOf(o[e][t]))}const l=i.length,c=[];for(let e=a.length;e<l;++e)c.push(e);return{allDims:i,summedDims:c,idDims:u}}function bm(e,t){let n=new Array(e);n.fill(-1);for(let e=0;e<t.length;++e)n[t[e]]=e;const r=[];for(let t=0;t<e;++t)-1===n[t]&&r.push(t);return n=n.filter((e=>-1!==e)),{permutationIndices:n,expandDims:r}}function vm(e,t,n){const r=new Array(e);for(let e=0;e<n.length;++e){const a=n[e].shape;for(let n=0;n<t[e].length;++n)void 0===r[t[e][n]]?r[t[e][n]]=a[n]:X(r[t[e][n]]===a[n],(()=>`Expected dimension ${r[t[e][n]]} at axis ${n} of input shaped ${JSON.stringify(a)}, but got dimension ${a[n]}`))}}function wm(e,t){const n=e,r=[];let a=0;0===e.length&&n.push(-1),a=e.length+1;for(let e=0;e<a;++e)r.push([]);const o=[];for(let e=0;e<n.length;++e){const a=km(t,n[e]);for(const t of a)-1===o.indexOf(t)&&(r[e].push(t),o.push(t))}return{path:n,steps:r}}function xm(e){return e.every(((e,t)=>e===t))}function km(e,t){const n=[];for(let r=0;r<e.length;++r)0!==e[r].length&&-1===e[r].indexOf(t)&&-1!==t||n.push(r);return n}function Sm(e,t,n=0){let r=[];if("number"==typeof t)X(e.shape[n]%t==0,(()=>"Number of splits must evenly divide the axis.")),r=new Array(t).fill(e.shape[n]/t);else{X(t.reduce(((e,t)=>(-1===t&&(e+=1),e)),0)<=1,(()=>"There should be only one negative value in split array."));const a=t.indexOf(-1);if(-1!==a){const r=t.reduce(((e,t)=>t>0?e+t:e));t[a]=e.shape[n]-r}X(e.shape[n]===t.reduce(((e,t)=>e+t)),(()=>"The sum of sizes must match the size of the axis dimension.")),r=t}return r}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Em(e){return`Received SparseTensor with denseShape[0] = 0 but\n  indices.shape[0] = ${e}`}function Nm(e,t){return`indices(${e}, 0) is invalid: ${t} < 0`}function Tm(e,t,n){return`indices(${e}, 0) is invalid: ${t} >= ${n}`}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function _m(e,t){return`only one output dimension may be -1, not both ${e} and ${t}`}function Am(e,t){return`size ${e} must be non-negative, not ${t}`}function Im(){return"reshape cannot infer the missing input size for an empty tensor unless all specified input sizes are non-zero"}function Mm(e,t){return`Input to reshape is a SparseTensor with ${ee(e)}\n  dense values, but the requested shape requires a multiple of ${ee(t)}. inputShape=${e} outputShape= ${t}`}function Om(e,t){return`Input to reshape is a tensor with ${ee(e)} dense values, but the requested shape has ${ee(t)}. inputShape=${e} outputShape=${t}`}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Dm(){return"segment ids must be >= 0"}function Cm(){return"segment ids are not increasing"}function $m(e,t){return`Segment id ${e} out of range [0, ${t}), possibly because segmentIds input is not sorted.`}function Rm(e,t,n){return`Bad: indices[${e}] == ${t} out of range [0, ${n})`}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Fm(e,t){let n,r=!1;for(e<=jh?(n=e,r=!0):n=Ne(e,Math.floor(Math.sqrt(e)));!r;)n>t||n===e?r=!0:n=Ne(e,n+1);return n}function Pm(e,t,n){const r=[],a=e.length;for(let o=0;o<a;o++)o!==t?r.push(e[o]):r.push(n);return r}function Lm(e,t,n,r){const a=t.shape.length,o=e.shape.length;if(0!==r&&(r<-a||r>a))throw new Error(`Expect batchDims in the range of [-${a}, ${a}], but got ${r}`);if(r<0&&(r+=a),r>o)throw new Error(`batchDims (${r}) must be less than rank(x) (\n    ${o}).`);if(n<r)throw new Error(`batchDims (${r}) must be less than or equal to axis (${n}).`);for(let n=0;n<r;++n)if(e.shape[n]!==t.shape[n])throw new Error(`x.shape[${n}]: ${e.shape[n]} should be equal to indices.shape[${n}]: ${t.shape[n]}.`);const s=e.shape[n],i=[];let u=1,l=1,c=1;for(let t=0;t<r;++t)i.push(e.shape[t]),u*=e.shape[t];for(let t=r;t<n;t++)i.push(e.shape[t]),l*=e.shape[t];for(let e=r;e<a;e++)i.push(t.shape[e]);for(let t=n+1;t<o;t++)i.push(e.shape[t]),c*=e.shape[t];return{batchSize:u,sliceSize:c,outerSize:l,dimSize:s,outputShape:i}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zm(e){try{return e.map((e=>ja(e)))}catch(e){throw new Error(`Failed to decode encoded string bytes into utf-8, error: ${e}`)}}function Bm(e){return e.map((e=>Ua(e)))}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
!function(){for(const e of tu)Pi(e)}();
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * =============================================================================
 */
var Vm,Um;Be().registerFlag("KEEP_INTERMEDIATE_TENSORS",(()=>!1),(e=>{e&&console.warn("Keep intermediate tensors is ON. This will print the values of all intermediate tensors during model inference. Not all models support this mode. For details, check e2e/benchmarks/ model_config.js. This significantly impacts performance.")})),function(e){e[e.DT_INVALID=0]="DT_INVALID",e[e.DT_FLOAT=1]="DT_FLOAT",e[e.DT_DOUBLE=2]="DT_DOUBLE",e[e.DT_INT32=3]="DT_INT32",e[e.DT_UINT8=4]="DT_UINT8",e[e.DT_INT16=5]="DT_INT16",e[e.DT_INT8=6]="DT_INT8",e[e.DT_STRING=7]="DT_STRING",e[e.DT_COMPLEX64=8]="DT_COMPLEX64",e[e.DT_INT64=9]="DT_INT64",e[e.DT_BOOL=10]="DT_BOOL",e[e.DT_QINT8=11]="DT_QINT8",e[e.DT_QUINT8=12]="DT_QUINT8",e[e.DT_QINT32=13]="DT_QINT32",e[e.DT_BFLOAT16=14]="DT_BFLOAT16",e[e.DT_QINT16=15]="DT_QINT16",e[e.DT_QUINT16=16]="DT_QUINT16",e[e.DT_UINT16=17]="DT_UINT16",e[e.DT_COMPLEX128=18]="DT_COMPLEX128",e[e.DT_HALF=19]="DT_HALF",e[e.DT_RESOURCE=20]="DT_RESOURCE",e[e.DT_VARIANT=21]="DT_VARIANT",e[e.DT_UINT32=22]="DT_UINT32",e[e.DT_UINT64=23]="DT_UINT64",e[e.DT_FLOAT_REF=101]="DT_FLOAT_REF",e[e.DT_DOUBLE_REF=102]="DT_DOUBLE_REF",e[e.DT_INT32_REF=103]="DT_INT32_REF",e[e.DT_UINT8_REF=104]="DT_UINT8_REF",e[e.DT_INT16_REF=105]="DT_INT16_REF",e[e.DT_INT8_REF=106]="DT_INT8_REF",e[e.DT_STRING_REF=107]="DT_STRING_REF",e[e.DT_COMPLEX64_REF=108]="DT_COMPLEX64_REF",e[e.DT_INT64_REF=109]="DT_INT64_REF",e[e.DT_BOOL_REF=110]="DT_BOOL_REF",e[e.DT_QINT8_REF=111]="DT_QINT8_REF",e[e.DT_QUINT8_REF=112]="DT_QUINT8_REF",e[e.DT_QINT32_REF=113]="DT_QINT32_REF",e[e.DT_BFLOAT16_REF=114]="DT_BFLOAT16_REF",e[e.DT_QINT16_REF=115]="DT_QINT16_REF",e[e.DT_QUINT16_REF=116]="DT_QUINT16_REF",e[e.DT_UINT16_REF=117]="DT_UINT16_REF",e[e.DT_COMPLEX128_REF=118]="DT_COMPLEX128_REF",e[e.DT_HALF_REF=119]="DT_HALF_REF",e[e.DT_RESOURCE_REF=120]="DT_RESOURCE_REF",e[e.DT_VARIANT_REF=121]="DT_VARIANT_REF",e[e.DT_UINT32_REF=122]="DT_UINT32_REF",e[e.DT_UINT64_REF=123]="DT_UINT64_REF"}(Vm||(Vm={})),function(e){let t;!function(e){e[e.LEGACY=0]="LEGACY",e[e.V1=1]="V1",e[e.V2=2]="V2"}(t=e.CheckpointFormatVersion||(e.CheckpointFormatVersion={}))}(Um||(Um={}));
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const jm={};function Wm(e){return jm[e]}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hm(e,t,n,r,a){const o=t.inputParams[e];if(o&&void 0!==o.inputIndexStart){const e=o.inputIndexStart,s=0===o.inputIndexEnd?void 0:void 0===o.inputIndexEnd?e+1:o.inputIndexEnd,i=e<0?t.inputNames.length+e:e;if("tensor"===o.type)return qm(t.inputNames[i],n,r,a);if("tensors"===o.type){const o=t.inputs.slice(e,s);return t.inputNames.slice(e,s).filter(((e,t)=>{var n;return"NoOp"!==(null===(n=o[t])||void 0===n?void 0:n.op)})).map((e=>qm(e,n,r,a)))}const u=qm(t.inputNames[i],n,r,a),l=u.dataSync();return"number"===o.type?l[0]:Ae(u.shape,l)}const s=t.attrParams[e];return s&&s.value}function qm(e,t,n,r){const[a,o]=Ym(e,n);if(null!=r){const e=r.getHashTableHandleByName(a);if(null!=e)return e}const s=n.currentContextIds.find((e=>!!t[Qm(a,e)]));return void 0!==s?t[Qm(a,s)][o]:void 0}function Gm(e,t,n){return t[Qm(e,n.currentContextId)]}function Km(e,t){const[n,r,a]=Ym(e,t);return[Qm(n,t&&t.currentContextId),r,a]}function Qm(e,t){return t?`${e}-${t}`:e}function Ym(e,t){if(""===e)return["",0,void 0];const n=null!=t&&null!=t.parseNodeNameCache;if(n){const n=t.parseNodeNameCache.get(e);if(null!=n)return n}const r=e.split(":");let a;if(1===r.length)a=[e,0,void 0];else{const e=r[0],t=3===r.length?r[1]:void 0;a=[e,Number(r[r.length-1]),t]}return n&&t.parseNodeNameCache.set(e,a),a}function Xm(e,t,n){let r=Hm("pad",e,t,n);if("explicit"===r){r=Hm("explicitPaddings",e,t,n);const a=[[0,0],[0,0],[0,0],[0,0]];for(let e=0;e<4;e++)a[e][0]=r[2*e],a[e][1]=r[2*e+1];return a}return r}function Zm(e){return e.kept?e:Qs(e)}
/**
 * @license
 * Copyright 2023 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Jm=[{tfOpName:"Add",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddV2",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddN",category:"arithmetic",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"BiasAdd",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"Sub",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"RealDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Div",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"DivNoNan",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mul",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Maximum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Minimum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Pow",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SquaredDifference",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorMod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}],eg=[{tfOpName:"Abs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan2",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Ceil",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ClipByValue",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"clipValueMin",type:"number"},{start:2,name:"clipValueMax",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Complex",category:"basic_math",inputs:[{start:0,name:"real",type:"tensor"},{start:1,name:"imag",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ComplexAbs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Elu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Exp",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Floor",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Imag",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Neg",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Real",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Prelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"alpha",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu6",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Selu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sigmoid",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Rsqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Square",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sign",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Round",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Expm1",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log1p",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Reciprocal",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Softplus",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Erf",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LeakyRelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"alpha",name:"alpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsNan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsFinite",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsInf",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}],tg=[{tfOpName:"EmptyTensorList",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"maxNumElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"LoopCond",category:"control",inputs:[{start:0,name:"pred",type:"tensor"}]},{tfOpName:"Switch",category:"control",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"pred",type:"tensor"}]},{tfOpName:"Merge",category:"control",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"Enter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"frame_name",name:"frameName",type:"string"},{tfName:"is_constant",name:"isConstant",type:"bool"}]},{tfOpName:"Exit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NextIteration",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayV3",category:"control",inputs:[{start:0,name:"size",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"dynamic_size",name:"dynamicSize",type:"bool"},{tfName:"clear_after_read",name:"clearAfterRead",type:"bool"},{tfName:"identical_element_shapes",name:"identicalElementShapes",type:"bool"},{tfName:"tensor_array_name",name:"name",type:"string"}]},{tfOpName:"TensorArrayWriteV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayReadV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayGatherV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"}]},{tfOpName:"TensorArrayScatterV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArrayConcatV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape_except0",name:"elementShapeExcept0",type:"shape",notSupported:!0}]},{tfOpName:"TensorArraySplitV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"tensor",type:"tensor"},{start:2,name:"lengths",type:"number[]"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArraySizeV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}]},{tfOpName:"TensorArrayCloseV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"}]},{tfOpName:"StatelessIf",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"If",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"StatelessWhile",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"While",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"TensorListScatter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListScatterV2",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"},{start:3,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGather",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListSetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListReserve",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListFromTensor",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListStack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"},{tfName:"num_elements",name:"numElements",type:"dtype"}]},{tfOpName:"TensorListSplit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"},{start:2,name:"lengths",type:"number[]"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcat",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcatV2",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPopBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPushBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListLength",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}]},{tfOpName:"TensorListResize",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"size",type:"number"}]}],ng=[{tfOpName:"AvgPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[],notSupported:!0},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPoolWithArgmax",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"include_batch_in_index",name:"includeBatchInIndex",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AvgPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Conv1D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"stride",name:"stride",type:"number"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NWC"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"dilation",name:"dilation",type:"number",defaultValue:1}]},{tfOpName:"Conv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"useCudnnOnGpu",name:"useCudnnOnGpu",type:"bool"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"_FusedConv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"use_cudnn_on_gpu",name:"useCudnnOnGpu",type:"bool",defaultValue:!0},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2}]},{tfOpName:"Conv2DBackpropInput",category:"convolution",inputs:[{start:2,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:0,name:"outputShape",type:"number[]"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]",notSupported:!0}]},{tfOpName:"DepthwiseConv2d",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"DepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"FusedDepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]}]},{tfOpName:"Conv3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"Dilation2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"rates",name:"dilations",type:"number[]"},{tfName:"padding",name:"pad",type:"string"}]}],rg=[{tfOpName:"Fill",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"},{start:1,name:"value",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"LinSpace",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"num",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"OneHot",category:"creation",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"depth",type:"number"},{start:2,name:"onValue",type:"number",defaultValue:1},{start:3,name:"offValue",type:"number",defaultValue:0}],attrs:[{tfName:"axis",name:"axis",type:"number",notSupported:!0},{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Ones",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"OnesLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"RandomStandardNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"RandomUniform",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"minval",name:"minval",type:"number",defaultValue:0},{tfName:"maxval",name:"maxval",type:"number",defaultValue:1},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"RandomUniformInt",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"minval",name:"minval",type:"number"},{tfName:"maxval",name:"maxval",type:"number"},{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0}]},{tfOpName:"Range",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"step",type:"number",defaultValue:0}],attrs:[{tfName:"Tidx",name:"dtype",type:"dtype"}]},{tfOpName:"TruncatedNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"means",name:"mean",type:"number",defaultValue:0},{tfName:"stddev",name:"stdDev",type:"number",defaultValue:1},{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"Zeros",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"ZerosLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Multinomial",category:"creation",inputs:[{start:0,name:"logits",type:"tensor"},{start:1,name:"numSamples",type:"number"}],attrs:[{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number"},{tfName:"T",name:"dtype",type:"dtype"},{tfName:"output_dtype",name:"output_dtype",type:"dtype"}]}],ag=[{tfOpName:"NonMaxSuppressionV2",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV3",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV4",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"T_threshold",name:"threshold",type:"dtype",notSupported:!0},{tfName:"pad_to_max_output_size",name:"padToMaxOutputSize",type:"bool"}]},{tfOpName:"NonMaxSuppressionV5",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"},{start:5,name:"softNmsSigma",type:"number"}]},{tfOpName:"Where",category:"dynamic",inputs:[{start:0,name:"condition",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ListDiff",category:"dynamic",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}],og=[{tfOpName:"LowerBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"TopKV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"k",type:"number"}],attrs:[{tfName:"sorted",name:"sorted",type:"bool"}]},{tfOpName:"UpperBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"Unique",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"UniqueV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]}],sg=[{tfOpName:"PlaceholderWithDefault",category:"graph",inputs:[{start:0,name:"default",type:"tensor"}],attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Placeholder",category:"graph",attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Const",category:"graph"},{tfOpName:"Identity",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IdentityN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Snapshot",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Rank",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Size",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Shape",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"ShapeN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Print",category:"graph",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"data",type:"tensors"}],attrs:[{tfName:"message",name:"message",type:"string"},{tfName:"first_n",name:"firstN",type:"number",notSupported:!0},{tfName:"summarize",name:"summarize",type:"number",defaultValue:3}]},{tfOpName:"NoOp",category:"graph",inputs:[]},{tfOpName:"StopGradient",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"FakeQuantWithMinMaxVars",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"min",name:"min",type:"number"},{tfName:"max",name:"max",type:"number"}]}],ig=[{tfOpName:"HashTable",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"HashTableV2",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"LookupTableImport",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableImportV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFind",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFindV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableSize",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]},{tfOpName:"LookupTableSizeV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]},{tfOpName:"InitializeTable",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}]},{tfOpName:"InitializeTableV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}]}],ug=[{tfOpName:"ResizeBilinear",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ResizeNearestNeighbor",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"CropAndResize",category:"image",inputs:[{start:0,name:"image",type:"tensor"},{start:1,name:"boxes",type:"tensor"},{start:2,name:"boxInd",type:"tensor"},{start:3,name:"cropSize",type:"number[]"}],attrs:[{tfName:"method",name:"method",type:"string"},{tfName:"extrapolation_value",name:"extrapolationValue",type:"number"}]},{tfOpName:"ImageProjectiveTransformV3",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"transforms",type:"tensor"},{start:2,name:"outputShape",type:"number[]"},{start:3,name:"fillValue",type:"number"}],attrs:[{tfName:"interpolation",name:"interpolation",type:"string"},{tfName:"fill_mode",name:"fillMode",type:"string"}]}],lg=[{tfOpName:"Equal",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NotEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Greater",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"GreaterEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Less",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LessEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalAnd",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalNot",category:"logical",inputs:[{start:0,name:"a",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalOr",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Select",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SelectV2",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BitwiseAnd",category:"logical",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}]}],cg=[{tfOpName:"_FusedMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMulV2",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Transpose",category:"matrices",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"perm",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Einsum",category:"matrices",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"equation",name:"equation",type:"string"},{tfName:"N",name:"n",type:"number",defaultValue:2},{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"MatrixBandPart",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"numLower",type:"tensor"},{start:1,name:"numUpper",type:"tensor"}]}],pg=[{tfOpName:"EuclideanNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool",defaultValue:!1}]},{tfOpName:"FusedBatchNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV2",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV3",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"LRN",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"depth_radius",name:"radius",type:"number",defaultValue:5},{tfName:"bias",name:"bias",type:"number",defaultValue:1},{tfName:"alpha",name:"alpha",type:"number",defaultValue:1},{tfName:"beta",name:"beta",type:"number",defaultValue:.5}]},{tfOpName:"Softmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"LogSoftmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]}],dg=[{tfOpName:"Bincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}]},{tfOpName:"DenseBincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}],attrs:[{tfName:"binary_output",name:"binaryOutput",type:"bool"}]},{tfOpName:"Max",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Mean",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Min",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Sum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"All",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Any",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"ArgMax",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"ArgMin",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"Prod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cumprod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]},{tfOpName:"Cumsum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]}],fg=[{tfOpName:"ConcatV2",category:"slice_join",inputs:[{start:0,end:-1,name:"tensors",type:"tensors"},{start:-1,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"Concat",category:"slice_join",inputs:[{start:1,end:0,name:"tensors",type:"tensors"},{start:0,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"GatherV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"axis",type:"number",defaultValue:0}],attrs:[{tfName:"batch_dims",name:"batchDims",type:"number",defaultValue:0}]},{tfOpName:"Gather",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",notSupported:!0}]},{tfOpName:"Reverse",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"dims",type:"bool[]"}]},{tfOpName:"ReverseV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}]},{tfOpName:"Slice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"size",type:"number[]"}]},{tfOpName:"StridedSlice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"end",type:"number[]"},{start:3,name:"strides",type:"number[]"}],attrs:[{tfName:"begin_mask",name:"beginMask",type:"number",defaultValue:0},{tfName:"end_mask",name:"endMask",type:"number",defaultValue:0},{tfName:"new_axis_mask",name:"newAxisMask",type:"number",defaultValue:0},{tfName:"ellipsis_mask",name:"ellipsisMask",type:"number",defaultValue:0},{tfName:"shrink_axis_mask",name:"shrinkAxisMask",type:"number",defaultValue:0}]},{tfOpName:"Pack",category:"slice_join",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0}]},{tfOpName:"Unpack",category:"slice_join",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0},{tfName:"num",name:"num",type:"number",defaultValue:0,notSupported:!0}]},{tfOpName:"Tile",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"reps",type:"number[]"}]},{tfOpName:"Split",category:"slice_join",inputs:[{start:0,name:"axis",type:"number",defaultValue:0},{start:1,name:"x",type:"tensor"}],attrs:[{tfName:"num_split",name:"numOrSizeSplits",type:"number",defaultValue:1}]},{tfOpName:"SplitV",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"numOrSizeSplits",type:"number[]"},{start:2,name:"axis",type:"number",defaultValue:0}]},{tfOpName:"ScatterNd",category:"slice_join",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"shape",type:"number[]"}]},{tfOpName:"GatherNd",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}]},{tfOpName:"SparseToDense",category:"slice_join",inputs:[{start:0,name:"sparseIndices",type:"tensor"},{start:1,name:"outputShape",type:"number[]"},{start:2,name:"sparseValues",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",defaultValue:!1,notSupported:!0}]},{tfOpName:"TensorScatterUpdate",category:"slice_join",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"values",type:"tensor"}]}],hg=[{tfOpName:"SparseFillEmptyRows",category:"sparse",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"denseShape",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}]},{tfOpName:"SparseReshape",category:"sparse",inputs:[{start:0,name:"inputIndices",type:"tensor"},{start:1,name:"inputShape",type:"tensor"},{start:2,name:"newShape",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SparseSegmentMean",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]},{tfOpName:"SparseSegmentSum",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]}],mg=[{tfOpName:"FFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"RFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]},{tfOpName:"IRFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]}],gg=[{tfOpName:"StaticRegexReplace",category:"string",inputs:[{start:0,name:"input",type:"tensor"}],attrs:[{tfName:"pattern",name:"pattern",type:"string"},{tfName:"rewrite",name:"rewrite",type:"string"},{tfName:"replace_global",name:"replaceGlobal",type:"bool"}]},{tfOpName:"StringNGrams",category:"string",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"dataSplits",type:"tensor"}],attrs:[{tfName:"separator",name:"separator",type:"string"},{tfName:"ngram_widths",name:"nGramWidths",type:"number[]"},{tfName:"left_pad",name:"leftPad",type:"string"},{tfName:"right_pad",name:"rightPad",type:"string"},{tfName:"pad_width",name:"padWidth",type:"number"},{tfName:"preserve_short_sequences",name:"preserveShortSequences",type:"bool"}],outputs:["ngrams","ngrams_splits"]},{tfOpName:"StringSplit",category:"string",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"delimiter",type:"tensor"}],attrs:[{tfName:"skip_empty",name:"skipEmpty",type:"bool"}],outputs:["indices","values","shape"]},{tfOpName:"StringToHashBucketFast",category:"string",inputs:[{start:0,name:"input",type:"tensor"}],attrs:[{tfName:"num_buckets",name:"numBuckets",type:"number"}]}],yg=[{tfOpName:"Cast",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"SrcT",name:"sdtype",type:"dtype",notSupported:!0},{tfName:"DstT",name:"dtype",type:"dtype"}]},{tfOpName:"ExpandDims",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"MirrorPad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"mode",name:"mode",type:"string"}]},{tfOpName:"Pad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"constant_value",name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"PadV2",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"},{start:2,name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"Reshape",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}]},{tfOpName:"EnsureShape",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}]},{tfOpName:"Squeeze",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"axis",tfDeprecatedName:"squeeze_dims",name:"axis",type:"number[]"}]},{tfOpName:"SpaceToBatchND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"paddings",type:"number[]"}]},{tfOpName:"BatchToSpaceND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"crops",type:"number[]"}]},{tfOpName:"DepthToSpace",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"block_size",name:"blockSize",type:"number"},{tfName:"data_format",name:"dataFormat",type:"string"}]},{tfOpName:"BroadcastTo",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}],attrs:[]},{tfOpName:"BroadcastArgs",category:"transformation",inputs:[{start:0,name:"s0",type:"tensor"},{start:1,name:"s1",type:"tensor"}],attrs:[]}];
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class bg{static get Instance(){return this._instance||(this._instance=new this)}constructor(){const e=[].concat(...[b,v,w,x,k,S,E,N,T,_,A,I,M,O,D,C,$,R,F].map((e=>e.json)));this.opMappers=e.reduce(((e,t)=>(e[t.tfOpName]=t,e)),{})}transformGraph(e,t={}){const n=e.node,r=[],a=[],o=[],s=n.reduce(((e,t)=>(e[t.name]=this.mapNode(t),t.op.startsWith("Placeholder")?r.push(e[t.name]):"Const"===t.op?a.push(e[t.name]):null!=t.input&&0!==t.input.length||o.push(e[t.name]),e)),{});let i=[];const u=[];let l={},c={};null!=t&&(l=this.mapSignatureEntries(t.inputs),c=this.mapSignatureEntries(t.outputs));const p=Object.keys(s);p.forEach((e=>{const t=s[e];t.inputNames.forEach(((e,n)=>{const[r,,a]=Km(e),o=s[r];if(null!=o.outputs){const e=o.outputs.indexOf(a);if(-1!==e){const a=`${r}:${e}`;t.inputNames[n]=a}}t.inputs.push(o),o.children.push(t)}))})),0===Object.keys(c).length?p.forEach((e=>{const t=s[e];0===t.children.length&&u.push(t)})):Object.keys(c).forEach((e=>{const[t]=Km(e),n=s[t];null!=n&&(n.signatureKey=c[e],u.push(n))})),Object.keys(l).length>0?Object.keys(l).forEach((e=>{const[t]=Km(e),n=s[t];n&&(n.signatureKey=l[e],i.push(n))})):i=r;let d={};null!=e.library&&null!=e.library.function&&(d=e.library.function.reduce(((e,t)=>(e[t.signature.name]=this.mapFunction(t),e)),{}));const f={nodes:s,inputs:i,outputs:u,weights:a,placeholders:r,signature:t,functions:d};return o.length>0&&(f.initNodes=o),f}mapSignatureEntries(e){return Object.keys(e||{}).reduce(((t,n)=>(t[e[n].name]=n,t)),{})}mapNode(e){const t=Wm(e.op)||this.opMappers[e.op]||{};null==e.attr&&(e.attr={});const n={name:e.name,op:e.op,category:t.category,inputNames:(e.input||[]).map((e=>e.startsWith("^")?e.slice(1):e)),inputs:[],children:[],inputParams:{},attrParams:{},rawAttrs:e.attr,outputs:t.outputs};return null!=t.inputs&&(n.inputParams=t.inputs.reduce(((e,t)=>(e[t.name]={type:t.type,inputIndexStart:t.start,inputIndexEnd:t.end},e)),{})),null!=t.attrs&&(n.attrParams=t.attrs.reduce(((t,n)=>{const r=n.type;let a;switch(n.type){case"string":a=wg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=wg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"string[]":a=Mg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Mg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"number":a=kg(e.attr,n.tfName,n.defaultValue||0),void 0===a&&n.tfDeprecatedName&&(a=kg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"number[]":a=Ig(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Ig(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"bool":a=xg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=xg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"bool[]":a=Dg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Dg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"shape":a=Ag(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Ag(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"shape[]":a=Og(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Og(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"dtype":a=Ng(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Ng(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"dtype[]":a=Tg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Tg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"func":a=Eg(e.attr,n.tfName,n.defaultValue),void 0===a&&n.tfDeprecatedName&&(a=Eg(e.attr,n.tfDeprecatedName,n.defaultValue));break;case"tensor":case"tensors":break;default:throw new Error(`Unsupported param type: ${n.type} for op: ${e.op}`)}return t[n.name]={value:a,type:r},t}),{})),n}mapFunction(e){const t=e.nodeDef,n=[];let r={};null!=t&&(r=t.reduce(((e,t)=>(e[t.name]=this.mapNode(t),"Const"===t.op&&n.push(e[t.name]),e)),{}));const a=[],o=[];e.signature.inputArg.forEach((e=>{const[t]=Km(e.name),n={name:t,op:"Placeholder",inputs:[],inputNames:[],category:"graph",inputParams:{},attrParams:{dtype:{value:Sg(e.type),type:"dtype"}},children:[]};n.signatureKey=e.name,a.push(n),r[t]=n}));Object.keys(r).forEach((e=>{const t=r[e];t.inputNames.forEach(((e,n)=>{const[a,,o]=Km(e),s=r[a];if(null!=s.outputs){const e=s.outputs.indexOf(o);if(-1!==e){const r=`${a}:${e}`;t.inputNames[n]=r}}t.inputs.push(s),s.children.push(t)}))}));const s=e.ret;e.signature.outputArg.forEach((e=>{const[t,n]=Km(s[e.name]),a=r[t];null!=a&&(a.defaultOutput=n,o.push(a))}));const i=this.mapArgsToSignature(e);return{nodes:r,inputs:a,outputs:o,weights:n,placeholders:[],signature:i}}mapArgsToSignature(e){return{methodName:e.signature.name,inputs:e.signature.inputArg.reduce(((e,t)=>(e[t.name]=this.mapArgToTensorInfo(t),e)),{}),outputs:e.signature.outputArg.reduce(((t,n)=>(t[n.name]=this.mapArgToTensorInfo(n,e.ret),t)),{})}}mapArgToTensorInfo(e,t){let n=e.name;return null!=t&&(n=t[n]),{name:n,dtype:e.type}}}function vg(e,t){const n=Array.isArray(e)?String.fromCharCode.apply(null,e):function(e){const t=Be().global;if(void 0!==t.atob)return t.atob(e);if("undefined"!=typeof Buffer)return new Buffer(e,"base64").toString();throw new Error("Unable to decode base64 in this environment. Missing built-in atob() or Buffer()")}(e);return t?n:n.toLowerCase()}function wg(e,t,n,r=!1){const a=e[t];return null!=a?vg(a.s,r):n}function xg(e,t,n){const r=e[t];return r?r.b:n}function kg(e,t,n){const r=e[t]||{},a=null!=r.i?r.i:null!=r.f?r.f:n;return"number"==typeof a?a:parseInt(a,10)}function Sg(e){switch("string"==typeof e&&(e=Vm[e]),e){case Vm.DT_FLOAT:case Vm.DT_HALF:return"float32";case Vm.DT_INT32:case Vm.DT_INT64:case Vm.DT_INT8:case Vm.DT_UINT8:return"int32";case Vm.DT_BOOL:return"bool";case Vm.DT_DOUBLE:return"float32";case Vm.DT_STRING:return"string";default:return null}}function Eg(e,t,n){const r=e[t];return r&&r.func?r.func.name:n}function Ng(e,t,n){const r=e[t];return r&&r.type?Sg(r.type):n}function Tg(e,t,n){const r=e[t];return r&&r.list&&r.list.type?r.list.type.map((e=>Sg(e))):n}function _g(e){if(!e.unknownRank)return null!=e.dim?e.dim.map((e=>"number"==typeof e.size?e.size:parseInt(e.size,10))):[]}function Ag(e,t,n){const r=e[t];return r&&r.shape?_g(r.shape):n}function Ig(e,t,n){const r=e[t];return r?((r.list.f&&r.list.f.length?r.list.f:r.list.i)||[]).map((e=>"number"==typeof e?e:parseInt(e,10))):n}function Mg(e,t,n,r=!1){const a=e[t];return a&&a.list&&a.list.s?a.list.s.map((e=>vg(e,r))):n}function Og(e,t,n){const r=e[t];return r&&r.list&&r.list.shape?r.list.shape.map((e=>_g(e))):n}function Dg(e,t,n){const r=e[t];return r&&r.list&&r.list.b?r.list.b:n}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Cg{constructor(e,t,n){this.node=e,this.tensorMap=t,this.context=n,this.inputs=[],this.attrs={},this.inputs=e.inputNames.map((e=>this.getInput(e))),null!=e.rawAttrs&&(this.attrs=Object.keys(e.rawAttrs).reduce(((e,t)=>(e[t]=this.getAttr(t),e)),{}))}getInput(e){return qm(e,this.tensorMap,this.context)}getAttr(e,t){const n=this.node.rawAttrs[e];if(null!=n.tensor)return qm(e,this.tensorMap,this.context);if(null!=n.i||null!=n.f)return kg(this.node.rawAttrs,e,t);if(null!=n.s)return wg(this.node.rawAttrs,e,t);if(null!=n.b)return xg(this.node.rawAttrs,e,t);if(null!=n.shape)return Ag(this.node.rawAttrs,e,t);if(null!=n.type)return Ng(this.node.rawAttrs,e,t);if(null!=n.list){if(null!=n.list.i||null!=n.list.f)return Ig(this.node.rawAttrs,e,t);if(null!=n.list.s)return Mg(this.node.rawAttrs,e,t);if(null!=n.list.shape)return Og(this.node.rawAttrs,e,t);if(null!=n.list.b)return Dg(this.node.rawAttrs,e,t);if(null!=n.list.type)return Tg(this.node.rawAttrs,e,t)}return t}}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $g(e,t,n=""){if("number"!=typeof e&&"number"!=typeof t){X(e.length===t.length,(()=>n+` Shapes ${e} and ${t} must match`));for(let r=0;r<e.length;r++){const a=e[r],o=t[r];X(a<0||o<0||a===o,(()=>n+` Shapes ${e} and ${t} must match`))}}}function Rg(e){return"number"!=typeof e&&!e.some((e=>e<0))}function Fg(e,t,n){let r=Pg(e,n);const a=!Rg(r);if(a&&0===t.length)throw new Error(`Tried to calculate elements of an empty list with non-fully-defined elementShape: ${r}`);if(a&&t.forEach((e=>{r=Pg(e.shape,r)})),!Rg(r))throw new Error(`Non-fully-defined elementShape: ${r}`);return r}function Pg(e,t){if("number"==typeof e)return t;if("number"==typeof t)return e;if(e.length!==t.length)throw new Error(`Incompatible ranks during merge: ${e} vs. ${t}`);const n=[];for(let r=0;r<e.length;++r){const a=e[r],o=t[r];if(a>=0&&o>=0&&a!==o)throw new Error(`Incompatible shape during merge: ${e} vs. ${t}`);n[r]=a>=0?a:o}return n}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Lg{constructor(e,t,n,r,a,o,s){this.name=e,this.dtype=t,this.maxSize=n,this.elementShape=r,this.identicalElementShapes=a,this.dynamicSize=o,this.clearAfterRead=s,this.tensors=[],this.closed_=!1,this.idTensor=Di(0),ii(this.idTensor)}get id(){return this.idTensor.id}get closed(){return this.closed_}clearAndClose(e){this.tensors.forEach((t=>{null!=e&&e.has(t.tensor.id)||t.tensor.dispose()})),this.tensors=[],this.closed_=!0,this.idTensor.dispose()}size(){return this.tensors.length}read(e){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(e<0||e>=this.size())throw new Error(`Tried to read from index ${e}, but array size is: ${this.size()}`);const t=this.tensors[e];if(t.cleared)throw new Error(`TensorArray ${this.name}: Could not read index ${e} twice because it was cleared after a previous read (perhaps try setting clear_after_read = false?).`);return this.clearAfterRead&&(t.cleared=!0),t.read=!0,t.tensor}readMany(e){return e.map((e=>this.read(e)))}write(e,t){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(e<0||!this.dynamicSize&&e>=this.maxSize)throw new Error(`Tried to write to index ${e}, but array is not resizeable and size is: ${this.maxSize}`);const n=this.tensors[e]||{};if(t.dtype!==this.dtype)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${e},\n          because the value dtype is ${t.dtype}, but TensorArray dtype is ${this.dtype}.`);if(0!==this.size()||null!=this.elementShape&&0!==this.elementShape.length||(this.elementShape=t.shape),$g(this.elementShape,t.shape,`TensorArray ${this.name}: Could not write to TensorArray index ${e}.`),n.read)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${e}, because it has already been read.`);if(n.written)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${e}, because it has already been written.`);n.tensor=t,ii(t),n.written=!0,this.tensors[e]=n}writeMany(e,t){if(e.length!==t.length)throw new Error(`TensorArray ${this.name}: could not write multiple tensors,because the index size: ${e.length} is not the same as tensors size: ${t.length}.`);e.forEach(((e,n)=>this.write(e,t[n])))}gather(e,t){if(t&&t!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but gather requested dtype ${t}`);if(e)e=e.slice(0,this.size());else{e=[];for(let t=0;t<this.size();t++)e.push(t)}if(0===e.length)return qo([],[0].concat(this.elementShape));const n=this.readMany(e);return $g(this.elementShape,n[0].shape,"TensorArray shape mismatch: "),Gd(n,0)}concat(e){if(e&&e!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but concat requested dtype ${e}`);if(0===this.size())return qo([],[0].concat(this.elementShape));const t=[];for(let e=0;e<this.size();e++)t.push(e);const n=this.readMany(t);return $g(this.elementShape,n[0].shape,`TensorArray shape mismatch: tensor array shape (${this.elementShape}) vs first tensor shape (${n[0].shape})`),ec(n,0)}scatter(e,t){if(t.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${t.dtype}`);if(e.length!==t.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${e.length} vs. ${t.shape[0]}`);const n=Math.max(...e);if(!this.dynamicSize&&n>=this.maxSize)throw new Error(`Max index must be < array size (${n}  vs. ${this.maxSize})`);this.writeMany(e,uf(t,0))}split(e,t){if(t.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${t.dtype}`);let n=0;const r=e.map((e=>(n+=e,n)));if(n!==t.shape[0])throw new Error(`Expected sum of lengths to be equal to\n          tensor.shape[0], but sum of lengths is\n        ${n}, and tensor's shape is: ${t.shape}`);if(!this.dynamicSize&&e.length!==this.maxSize)throw new Error(`TensorArray's size is not equal to the size of lengths (${this.maxSize} vs. ${e.length}), and the TensorArray is not marked as dynamically resizeable`);const a=0===n?0:t.size/n,o=[];oi((()=>{t=Xl(t,[1,n,a]);for(let n=0;n<e.length;++n){const s=[0,0===n?0:r[n-1],0],i=[1,e[n],a];o[n]=Xl(nc(t,s,i),this.elementShape)}return o}));const s=[];for(let t=0;t<e.length;t++)s[t]=t;this.writeMany(s,o)}}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class zg{get id(){return this.idTensor.id}constructor(e,t,n,r=-1){this.tensors=e,this.elementShape=t,this.elementDtype=n,null!=e&&e.forEach((e=>{if(n!==e.dtype)throw new Error(`Invalid data types; op elements ${n}, but list elements ${e.dtype}`);$g(t,e.shape,"TensorList shape mismatch: "),ii(e)})),this.idTensor=Di(0),this.maxNumElements=r,ii(this.idTensor)}copy(){return new zg([...this.tensors],this.elementShape,this.elementDtype)}clearAndClose(e){this.tensors.forEach((t=>{null!=e&&e.has(t.id)||t.dispose()})),this.tensors.length=0,this.idTensor.dispose()}size(){return this.tensors.length}stack(e,t,n=-1){if(t!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t}, but list elements ${this.elementDtype}`);if(-1!==n&&this.tensors.length!==n)throw new Error(`Operation expected a list with ${n} elements but got a list with ${this.tensors.length} elements.`);$g(e,this.elementShape,"TensorList shape mismatch: ");const r=Fg(this.elementShape,this.tensors,e);return oi((()=>{const e=this.tensors.map((e=>Xl(e,r)));return Gd(e,0)}))}popBack(e,t){if(t!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t}, but list elements ${this.elementDtype}`);if(0===this.size())throw new Error("Trying to pop from an empty list.");const n=Fg(this.elementShape,this.tensors,e),r=this.tensors.pop();return r.kept=!1,$g(r.shape,e,"TensorList shape mismatch: "),Xl(r,n)}pushBack(e){if(e.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${e.dtype}, but list elements ${this.elementDtype}`);if($g(e.shape,this.elementShape,"TensorList shape mismatch: "),this.maxNumElements===this.size())throw new Error("Trying to push element into a full list.");ii(e),this.tensors.push(e)}resize(e){if(e<0)throw new Error(`TensorListResize expects size to be non-negative. Got: ${e}`);if(-1!==this.maxNumElements&&e>this.maxNumElements)throw new Error(`TensorListResize input size ${e} is greater maxNumElement ${this.maxNumElements}.`);const t=new zg([],this.elementShape,this.elementDtype,this.maxNumElements);t.tensors.length=e;for(let n=0;n<Math.min(this.tensors.length,e);++n)t.tensors[n]=this.tensors[n];return t}getItem(e,t,n){if(n!==this.elementDtype)throw new Error(`Invalid data types; op elements ${n}, but list elements ${this.elementDtype}`);if(e<0||e>this.tensors.length)throw new Error(`Trying to access element ${e} in a list with ${this.tensors.length} elements.`);if(null==this.tensors[e])throw new Error(`element at index ${e} is null.`);$g(this.tensors[e].shape,t,"TensorList shape mismatch: ");const r=Fg(this.elementShape,this.tensors,t);return Xl(this.tensors[e],r)}setItem(e,t){if(t.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t.dtype}, but list elements ${this.elementDtype}`);if(e<0||-1!==this.maxNumElements&&e>=this.maxNumElements)throw new Error(`Trying to set element ${e} in a list with max ${this.maxNumElements} elements.`);$g(this.elementShape,t.shape,"TensorList shape mismatch: "),ii(t),null!=this.tensors[e]&&(this.tensors[e].kept=!1),this.tensors[e]=t}gather(e,t,n){if(t!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t}, but list elements ${this.elementDtype}`);$g(this.elementShape,n,"TensorList shape mismatch: "),e=e.slice(0,this.size());const r=Fg(this.elementShape,this.tensors,n);return 0===e.length?qo([],[0].concat(r)):oi((()=>{const t=e.map((e=>Xl(this.tensors[e],r)));return Gd(t,0)}))}concat(e,t){if(e&&e!==this.elementDtype)throw new Error(`TensorList dtype is ${this.elementDtype} but concat requested dtype ${e}`);$g(this.elementShape,t,"TensorList shape mismatch: ");const n=Fg(this.elementShape,this.tensors,t);return 0===this.size()?qo([],[0].concat(n)):oi((()=>{const e=this.tensors.map((e=>Xl(e,n)));return ec(e,0)}))}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Bg=async(e,t,n)=>{switch(e.op){case"If":case"StatelessIf":{const r=Hm("thenBranch",e,t,n),a=Hm("elseBranch",e,t,n),o=Hm("cond",e,t,n),s=Hm("args",e,t,n);return(await o.data())[0]?n.functionMap[r].executeFunctionAsync(s,n.tensorArrayMap,n.tensorListMap):n.functionMap[a].executeFunctionAsync(s,n.tensorArrayMap,n.tensorListMap)}case"While":case"StatelessWhile":{const r=Hm("body",e,t,n),a=Hm("cond",e,t,n),o=Hm("args",e,t,n),s=await n.functionMap[a].executeFunctionAsync(o,n.tensorArrayMap,n.tensorListMap),i=o.map((e=>e.id));let u=await s[0].data();s.forEach((e=>{e.kept||-1!==i.indexOf(e.id)||e.dispose()}));let l=o;for(;u[0];){const e=l;l=await n.functionMap[r].executeFunctionAsync(l,n.tensorArrayMap,n.tensorListMap);const t=l.map((e=>e.id));e.forEach((e=>{e.kept||-1!==i.indexOf(e.id)||-1!==t.indexOf(e.id)||e.dispose()}));const o=await n.functionMap[a].executeFunctionAsync(l,n.tensorArrayMap,n.tensorListMap);u=await o[0].data(),o.forEach((e=>{e.kept||-1!==i.indexOf(e.id)||-1!==t.indexOf(e.id)||e.dispose()}))}return l}case"LoopCond":return[Zm(Hm("pred",e,t,n))];case"Switch":{const r=Hm("pred",e,t,n);let a=Hm("data",e,t,n);return a.kept||(a=Zm(a)),(await r.data())[0]?[void 0,a]:[a,void 0]}case"Merge":{const r=e.inputNames.find((e=>void 0!==qm(e,t,n)));if(r){return[Zm(qm(r,t,n))]}return}case"Enter":{const r=Hm("frameName",e,t,n),a=Hm("tensor",e,t,n);return n.enterFrame(r),[Zm(a)]}case"Exit":{const r=Hm("tensor",e,t,n);return n.exitFrame(),[Zm(r)]}case"NextIteration":{const r=Hm("tensor",e,t,n);return n.nextIteration(),[Zm(r)]}case"TensorArrayV3":{const r=Hm("size",e,t,n),a=Hm("dtype",e,t,n),o=Hm("elementShape",e,t,n),s=Hm("dynamicSize",e,t,n),i=Hm("clearAfterRead",e,t,n),u=Hm("identicalElementShapes",e,t,n),l=Hm("name",e,t,n),c=new Lg(l,a,r,o,u,s,i);return n.addTensorArray(c),[c.idTensor,Di(1)]}case"TensorArrayWriteV3":{const r=Hm("tensorArrayId",e,t,n),a=Hm("index",e,t,n),o=Hm("tensor",e,t,n),s=n.getTensorArray(r.id);return s.write(a,o),[s.idTensor]}case"TensorArrayReadV3":{const r=Hm("tensorArrayId",e,t,n),a=Hm("index",e,t,n);return[n.getTensorArray(r.id).read(a)]}case"TensorArrayGatherV3":{const r=Hm("tensorArrayId",e,t,n),a=Hm("indices",e,t,n),o=Hm("dtype",e,t,n);return[n.getTensorArray(r.id).gather(a,o)]}case"TensorArrayScatterV3":{const r=Hm("tensorArrayId",e,t,n),a=Hm("indices",e,t,n),o=Hm("tensor",e,t,n),s=n.getTensorArray(r.id);return s.scatter(a,o),[s.idTensor]}case"TensorArrayConcatV3":{const r=Hm("tensorArrayId",e,t,n),a=n.getTensorArray(r.id),o=Hm("dtype",e,t,n);return[a.concat(o)]}case"TensorArraySplitV3":{const r=Hm("tensorArrayId",e,t,n),a=Hm("tensor",e,t,n),o=Hm("lengths",e,t,n),s=n.getTensorArray(r.id);return s.split(o,a),[s.idTensor]}case"TensorArraySizeV3":{const r=Hm("tensorArrayId",e,t,n);return[Di(n.getTensorArray(r.id).size(),"int32")]}case"TensorArrayCloseV3":{const r=Hm("tensorArrayId",e,t,n),a=n.getTensorArray(r.id);return a.clearAndClose(),[a.idTensor]}case"TensorListSetItem":{const r=Hm("tensorListId",e,t,n),a=Hm("index",e,t,n),o=Hm("tensor",e,t,n),s=n.getTensorList(r.id);return s.setItem(a,o),[s.idTensor]}case"TensorListGetItem":{const r=Hm("tensorListId",e,t,n),a=Hm("index",e,t,n),o=Hm("elementShape",e,t,n),s=Hm("elementDType",e,t,n);return[n.getTensorList(r.id).getItem(a,o,s)]}case"TensorListScatterV2":case"TensorListScatter":{const r=Hm("indices",e,t,n),a=function(e,t,n,r){if(t.length!==e.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${t.length} vs. ${e.shape[0]}`);const a=Math.max(...t);if(null!=r&&-1!==r&&a>=r)throw new Error(`Max index must be < array size (${a}  vs. ${r})`);const o=new zg([],n,e.dtype,r),s=uf(e,0);return t.forEach(((e,t)=>{o.setItem(e,s[t])})),o}(Hm("tensor",e,t,n),r,Hm("elementShape",e,t,n),Hm("numElements",e,t,n));return n.addTensorList(a),[a.idTensor]}case"TensorListReserve":case"EmptyTensorList":{const r=Hm("elementShape",e,t,n),a=Hm("elementDType",e,t,n);let o;o="TensorListReserve"===e.op?"numElements":"maxNumElements";const s=Hm(o,e,t,n),i=function(e,t,n,r){return new zg([],e,t,r)}(r,a,0,"TensorListReserve"===e.op?-1:s);return n.addTensorList(i),[i.idTensor]}case"TensorListGather":{const r=Hm("tensorListId",e,t,n),a=Hm("indices",e,t,n),o=Hm("elementShape",e,t,n),s=Hm("elementDType",e,t,n);return[n.getTensorList(r.id).gather(a,s,o)]}case"TensorListStack":{const r=Hm("tensorListId",e,t,n),a=Hm("elementShape",e,t,n),o=Hm("elementDType",e,t,n),s=Hm("numElements",e,t,n);return[n.getTensorList(r.id).stack(a,o,s)]}case"TensorListFromTensor":{const r=function(e,t,n){const r=e.dtype;if(e.shape.length<1)throw new Error(`Tensor must be at least a vector, but saw shape: ${e.shape}`);if(e.dtype!==n)throw new Error(`Invalid data types; op elements ${e.dtype}, but list elements ${n}`);$g(e.shape.slice(1),t,"TensorList shape mismatch: ");const a=uf(e);return new zg(a,t,r)}(Hm("tensor",e,t,n),Hm("elementShape",e,t,n),Hm("elementDType",e,t,n));return n.addTensorList(r),[r.idTensor]}case"TensorListConcat":case"TensorListConcatV2":{const r=Hm("tensorListId",e,t,n),a=n.getTensorList(r.id),o=Hm("dtype",e,t,n),s=Hm("elementShape",e,t,n);return[a.concat(o,s)]}case"TensorListPushBack":{const r=Hm("tensorListId",e,t,n),a=Hm("tensor",e,t,n),o=n.getTensorList(r.id);return o.pushBack(a),[o.idTensor]}case"TensorListPopBack":{const r=Hm("tensorListId",e,t,n),a=Hm("elementShape",e,t,n),o=Hm("elementDType",e,t,n);return[n.getTensorList(r.id).popBack(a,o)]}case"TensorListSplit":{const r=Hm("tensor",e,t,n),a=Hm("elementShape",e,t,n),o=function(e,t,n){let r=0;const a=t.map((e=>(r+=e,r)));if(r!==e.shape[0])throw new Error(`Expected sum of lengths to be equal to\n          tensor.shape[0], but sum of lengths is\n        ${r}, and tensor's shape is: ${e.shape}`);const o=Pg(e.shape.slice(1),n),s=0===r?0:e.size/r,i=oi((()=>{const n=[];e=Xl(e,[1,r,s]);for(let r=0;r<t.length;++r){const i=[0,0===r?0:a[r-1],0],u=[1,t[r],s];n[r]=Xl(nc(e,i,u),o)}return e.dispose(),n})),u=new zg([],n,e.dtype,t.length);for(let e=0;e<i.length;e++)u.setItem(e,i[e]);return u}(r,Hm("lengths",e,t,n),a);return n.addTensorList(o),[o.idTensor]}case"TensorListLength":{const r=Hm("tensorListId",e,t,n);return[Di(n.getTensorList(r.id).size(),"int32")]}case"TensorListResize":{const r=Hm("tensorListId",e,t,n),a=Hm("size",e,t,n),o=n.getTensorList(r.id).resize(a);return n.addTensorList(o),[o.idTensor]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vg(e,t,n){const[r,a]=Hm("fusedOps",e,t,n),o="biasadd"===r,s=!o,i="prelu"===a,u="fusedbatchnorm"===r,l=Hm("numArgs",e,t,n);if(o){if(i&&2!==l)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&o&&1!==l)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd must have one extra argument: bias.")}if(u)throw new Error("FusedConv2d and DepthwiseConv2d with FusedBatchNorm is not supported");const c=Hm("strides",e,t,n),p=Xm(e,t,n),d=Hm("dataFormat",e,t,n).toUpperCase(),f=Hm("dilations",e,t,n);let[h,m]=Hm("args",e,t,n);s&&(m=h,h=void 0);return{stride:c,pad:p,dataFormat:d,dilations:f,biasArg:h,preluArg:m,activationFunc:a,leakyreluAlpha:Hm("leakyreluAlpha",e,t,n)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ug(e,t,n){return{boxes:Hm("boxes",e,t,n),scores:Hm("scores",e,t,n),maxOutputSize:Hm("maxOutputSize",e,t,n),iouThreshold:Hm("iouThreshold",e,t,n),scoreThreshold:Hm("scoreThreshold",e,t,n),softNmsSigma:Hm("softNmsSigma",e,t,n)}}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class jg{get id(){return this.handle.id}constructor(e,t){this.keyDType=e,this.valueDType=t,this.handle=Di(0),this.tensorMap=new Map,ii(this.handle)}clearAndClose(){this.tensorMap.forEach((e=>e.dispose())),this.tensorMap.clear(),this.handle.dispose()}size(){return this.tensorMap.size}tensorSize(){return Di(this.size(),"int32")}async import(e,t){this.checkKeyAndValueTensor(e,t);const n=await e.data();return this.tensorMap.forEach((e=>e.dispose())),this.tensorMap.clear(),oi((()=>{const e=uf(t),r=n.length,a=e.length;X(r===a,(()=>`The number of elements doesn't match, keys has ${r} elements, the values has ${a} elements.`));for(let t=0;t<r;t++){const r=n[t],a=e[t];ii(a),this.tensorMap.set(r,a)}return this.handle}))}async find(e,t){this.checkKeyAndValueTensor(e,t);const n=await e.data();return oi((()=>{const e=[];for(let r=0;r<n.length;r++){const a=n[r],o=this.findWithDefault(a,t);e.push(o)}return Gd(e)}))}findWithDefault(e,t){const n=this.tensorMap.get(e);return null!=n?n:t}checkKeyAndValueTensor(e,t){if(e.dtype!==this.keyDType)throw new Error(`Expect key dtype ${this.keyDType}, but got ${e.dtype}`);if(t.dtype!==this.valueDType)throw new Error(`Expect value dtype ${this.valueDType}, but got ${t.dtype}`)}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wg(e,t,n,r,a=oi){const o=((e,t,n)=>{switch(e.category){case"arithmetic":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"BiasAdd":case"AddV2":case"Add":return[r.add(Hm("a",e,t,n),Hm("b",e,t,n))];case"AddN":return[r.addN(Hm("tensors",e,t,n))];case"FloorMod":case"Mod":return[r.mod(Hm("a",e,t,n),Hm("b",e,t,n))];case"Mul":return[r.mul(Hm("a",e,t,n),Hm("b",e,t,n))];case"RealDiv":case"Div":return[r.div(Hm("a",e,t,n),Hm("b",e,t,n))];case"DivNoNan":return[r.divNoNan(Hm("a",e,t,n),Hm("b",e,t,n))];case"FloorDiv":return[r.floorDiv(Hm("a",e,t,n),Hm("b",e,t,n))];case"Sub":return[r.sub(Hm("a",e,t,n),Hm("b",e,t,n))];case"Minimum":return[r.minimum(Hm("a",e,t,n),Hm("b",e,t,n))];case"Maximum":return[r.maximum(Hm("a",e,t,n),Hm("b",e,t,n))];case"Pow":return[r.pow(Hm("a",e,t,n),Hm("b",e,t,n))];case"SquaredDifference":return[r.squaredDifference(Hm("a",e,t,n),Hm("b",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"basic_math":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Abs":case"ComplexAbs":return[r.abs(Hm("x",e,t,n))];case"Acos":return[r.acos(Hm("x",e,t,n))];case"Acosh":return[r.acosh(Hm("x",e,t,n))];case"Asin":return[r.asin(Hm("x",e,t,n))];case"Asinh":return[r.asinh(Hm("x",e,t,n))];case"Atan":return[r.atan(Hm("x",e,t,n))];case"Atan2":return[r.atan2(Hm("x",e,t,n),Hm("y",e,t,n))];case"Atanh":return[r.atanh(Hm("x",e,t,n))];case"Ceil":return[r.ceil(Hm("x",e,t,n))];case"Complex":return[r.complex(Hm("real",e,t,n),Hm("imag",e,t,n))];case"Cos":return[r.cos(Hm("x",e,t,n))];case"Cosh":return[r.cosh(Hm("x",e,t,n))];case"Elu":return[r.elu(Hm("x",e,t,n))];case"Erf":return[r.erf(Hm("x",e,t,n))];case"Exp":return[r.exp(Hm("x",e,t,n))];case"Expm1":return[r.expm1(Hm("x",e,t,n))];case"Floor":return[r.floor(Hm("x",e,t,n))];case"Log":return[r.log(Hm("x",e,t,n))];case"Log1p":return[r.log1p(Hm("x",e,t,n))];case"Imag":return[r.imag(Hm("x",e,t,n))];case"Neg":return[r.neg(Hm("x",e,t,n))];case"Reciprocal":return[r.reciprocal(Hm("x",e,t,n))];case"Real":return[r.real(Hm("x",e,t,n))];case"Relu":return[r.relu(Hm("x",e,t,n))];case"Round":return[r.round(Hm("x",e,t,n))];case"Selu":return[r.selu(Hm("x",e,t,n))];case"Sigmoid":return[r.sigmoid(Hm("x",e,t,n))];case"Sin":return[r.sin(Hm("x",e,t,n))];case"Sign":return[r.sign(Hm("x",e,t,n))];case"Sinh":return[r.sinh(Hm("x",e,t,n))];case"Softplus":return[r.softplus(Hm("x",e,t,n))];case"Sqrt":return[r.sqrt(Hm("x",e,t,n))];case"Square":return[r.square(Hm("x",e,t,n))];case"Tanh":return[r.tanh(Hm("x",e,t,n))];case"Tan":return[r.tan(Hm("x",e,t,n))];case"ClipByValue":return[r.clipByValue(Hm("x",e,t,n),Hm("clipValueMin",e,t,n),Hm("clipValueMax",e,t,n))];case"Relu6":return[r.relu6(Hm("x",e,t,n))];case"Rsqrt":return[r.rsqrt(qm(e.inputNames[0],t,n))];case"LeakyRelu":return[r.leakyRelu(Hm("x",e,t,n),Hm("alpha",e,t,n))];case"Prelu":return[r.prelu(Hm("x",e,t,n),Hm("alpha",e,t,n))];case"IsNan":return[r.isNaN(qm(e.inputNames[0],t,n))];case"IsInf":return[r.isInf(qm(e.inputNames[0],t,n))];case"IsFinite":return[r.isFinite(qm(e.inputNames[0],t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"control":return Bg(e,t,n);case"convolution":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Conv1D":{const a=Hm("stride",e,t,n),o=Hm("pad",e,t,n),s=Hm("dataFormat",e,t,n).toUpperCase(),i=Hm("dilation",e,t,n);return[r.conv1d(Hm("x",e,t,n),Hm("filter",e,t,n),a,o,s,i)]}case"Conv2D":{const a=Hm("strides",e,t,n),o=Xm(e,t,n),s=Hm("dataFormat",e,t,n).toUpperCase(),i=Hm("dilations",e,t,n);return[r.conv2d(Hm("x",e,t,n),Hm("filter",e,t,n),[a[1],a[2]],o,s,[i[1],i[2]])]}case"_FusedConv2D":{const{stride:a,pad:o,dataFormat:s,dilations:i,biasArg:u,preluArg:l,activationFunc:c,leakyreluAlpha:p}=Vg(e,t,n);return[r.fused.conv2d({x:Hm("x",e,t,n),filter:Hm("filter",e,t,n),strides:[a[1],a[2]],pad:o,dataFormat:s,dilations:[i[1],i[2]],bias:u,activation:c,preluActivationWeights:l,leakyreluAlpha:p})]}case"FusedDepthwiseConv2dNative":{const{stride:a,pad:o,dataFormat:s,dilations:i,biasArg:u,preluArg:l,activationFunc:c,leakyreluAlpha:p}=Vg(e,t,n);return[r.fused.depthwiseConv2d({x:Hm("x",e,t,n),filter:Hm("filter",e,t,n),strides:[a[1],a[2]],pad:o,dataFormat:s,dilations:[i[1],i[2]],bias:u,activation:c,preluActivationWeights:l,leakyreluAlpha:p})]}case"Conv2DBackpropInput":case"Conv2dTranspose":{const a=Hm("outputShape",e,t,n),o=Hm("strides",e,t,n),s=Xm(e,t,n);return[r.conv2dTranspose(Hm("x",e,t,n),Hm("filter",e,t,n),a,[o[1],o[2]],s)]}case"DepthwiseConv2dNative":case"DepthwiseConv2d":{const a=Hm("strides",e,t,n),o=Xm(e,t,n),s=Hm("dilations",e,t,n),i=Hm("dataFormat",e,t,n).toUpperCase();return[r.depthwiseConv2d(Hm("input",e,t,n),Hm("filter",e,t,n),[a[1],a[2]],o,i,[s[1],s[2]])]}case"Conv3D":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("dataFormat",e,t,n).toUpperCase(),i=Hm("dilations",e,t,n);return[r.conv3d(Hm("x",e,t,n),Hm("filter",e,t,n),[a[1],a[2],a[3]],o,s,[i[1],i[2],i[3]])]}case"AvgPool":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("kernelSize",e,t,n);return[r.avgPool(Hm("x",e,t,n),[s[1],s[2]],[a[1],a[2]],o)]}case"MaxPool":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("kernelSize",e,t,n);return[r.maxPool(Hm("x",e,t,n),[s[1],s[2]],[a[1],a[2]],o)]}case"MaxPoolWithArgmax":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("kernelSize",e,t,n),i=Hm("includeBatchInIndex",e,t,n),{result:u,indexes:l}=r.maxPoolWithArgmax(Hm("x",e,t,n),[s[1],s[2]],[a[1],a[2]],o,i);return[u,l]}case"AvgPool3D":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("kernelSize",e,t,n);return[r.avgPool3d(Hm("x",e,t,n),[s[1],s[2],s[3]],[a[1],a[2],a[3]],o)]}case"MaxPool3D":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("kernelSize",e,t,n);return[r.maxPool3d(Hm("x",e,t,n),[s[1],s[2],s[3]],[a[1],a[2],a[3]],o)]}case"Dilation2D":{const a=Hm("strides",e,t,n),o=Hm("pad",e,t,n),s=Hm("dilations",e,t,n),i=a[1],u=a[2],l=s[1],c=s[2];return[r.dilation2d(Hm("x",e,t,n),Hm("filter",e,t,n),[i,u],o,[l,c],"NHWC")]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"creation":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Fill":{const a=Hm("shape",e,t,n),o=Hm("dtype",e,t,n),s=Hm("value",e,t,n);return[r.fill(a,s,o)]}case"LinSpace":{const a=Hm("start",e,t,n),o=Hm("stop",e,t,n),s=Hm("num",e,t,n);return[r.linspace(a,o,s)]}case"Multinomial":{const a=Hm("logits",e,t,n),o=Hm("numSamples",e,t,n),s=Hm("seed",e,t,n);return[r.multinomial(a,o,s)]}case"OneHot":{const a=Hm("indices",e,t,n),o=Hm("depth",e,t,n),s=Hm("onValue",e,t,n),i=Hm("offValue",e,t,n),u=Hm("dtype",e,t,n);return[r.oneHot(a,o,s,i,u)]}case"Ones":return[r.ones(Hm("shape",e,t,n),Hm("dtype",e,t,n))];case"OnesLike":return[r.onesLike(Hm("x",e,t,n))];case"RandomStandardNormal":return[r.randomStandardNormal(Hm("shape",e,t,n),Hm("dtype",e,t,n),Hm("seed",e,t,n))];case"RandomUniform":return[r.randomUniform(Hm("shape",e,t,n),Hm("minval",e,t,n),Hm("maxval",e,t,n),Hm("dtype",e,t,n))];case"RandomUniformInt":return[r.randomUniformInt(Hm("shape",e,t,n),Hm("minval",e,t,n),Hm("maxval",e,t,n),Hm("seed",e,t,n))];case"Range":{const a=Hm("start",e,t,n),o=Hm("stop",e,t,n),s=Hm("step",e,t,n);return[r.range(a,o,s,Hm("dtype",e,t,n))]}case"TruncatedNormal":{const a=Hm("shape",e,t,n),o=Hm("mean",e,t,n),s=Hm("stdDev",e,t,n),i=Hm("seed",e,t,n);return[r.truncatedNormal(a,o,s,Hm("dtype",e,t,n),i)]}case"Zeros":return[r.zeros(Hm("shape",e,t,n),Hm("dtype",e,t,n))];case"ZerosLike":return[r.zerosLike(Hm("x",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"dynamic":return(async(e,t,n,r,a=P)=>{switch(e.op){case"NonMaxSuppressionV5":{const{boxes:r,scores:o,maxOutputSize:s,iouThreshold:i,scoreThreshold:u,softNmsSigma:l}=Ug(e,t,n),c=await a.image.nonMaxSuppressionWithScoreAsync(r,o,s,i,u,l);return[c.selectedIndices,c.selectedScores]}case"NonMaxSuppressionV4":{const{boxes:r,scores:o,maxOutputSize:s,iouThreshold:i,scoreThreshold:u}=Ug(e,t,n),l=Hm("padToMaxOutputSize",e,t,n),c=await a.image.nonMaxSuppressionPaddedAsync(r,o,s,i,u,l);return[c.selectedIndices,c.validOutputs]}case"NonMaxSuppressionV3":case"NonMaxSuppressionV2":{const{boxes:r,scores:o,maxOutputSize:s,iouThreshold:i,scoreThreshold:u}=Ug(e,t,n);return[await a.image.nonMaxSuppressionAsync(r,o,s,i,u)]}case"Where":{const r=a.cast(Hm("condition",e,t,n),"bool"),o=[await a.whereAsync(r)];return r.dispose(),o}case"ListDiff":return a.setdiff1dAsync(Hm("x",e,t,n),Hm("y",e,t,n));default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n);case"evaluation":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"LowerBound":{const a=Hm("sortedSequence",e,t,n),o=Hm("values",e,t,n);return[r.lowerBound(a,o)]}case"TopKV2":{const a=Hm("x",e,t,n),o=Hm("k",e,t,n),s=Hm("sorted",e,t,n),i=r.topk(a,o,s);return[i.values,i.indices]}case"UpperBound":{const a=Hm("sortedSequence",e,t,n),o=Hm("values",e,t,n);return[r.upperBound(a,o)]}case"Unique":{const a=Hm("x",e,t,n),o=r.unique(a);return[o.values,o.indices]}case"UniqueV2":{const a=Hm("x",e,t,n),o=Hm("axis",e,t,n),s=r.unique(a,o);return[s.values,s.indices]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"image":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"ResizeBilinear":{const a=Hm("images",e,t,n),o=Hm("size",e,t,n),s=Hm("alignCorners",e,t,n),i=Hm("halfPixelCenters",e,t,n);return[r.image.resizeBilinear(a,[o[0],o[1]],s,i)]}case"ResizeNearestNeighbor":{const a=Hm("images",e,t,n),o=Hm("size",e,t,n),s=Hm("alignCorners",e,t,n),i=Hm("halfPixelCenters",e,t,n);return[r.image.resizeNearestNeighbor(a,[o[0],o[1]],s,i)]}case"CropAndResize":{const a=Hm("image",e,t,n),o=Hm("boxes",e,t,n),s=Hm("boxInd",e,t,n),i=Hm("cropSize",e,t,n),u=Hm("method",e,t,n),l=Hm("extrapolationValue",e,t,n);return[r.image.cropAndResize(a,o,s,i,u,l)]}case"ImageProjectiveTransformV3":{const a=Hm("images",e,t,n),o=Hm("transforms",e,t,n),s=Hm("outputShape",e,t,n),i=Hm("fillValue",e,t,n),u=Hm("interpolation",e,t,n),l=Hm("fillMode",e,t,n);return[r.image.transform(a,o,u.toLowerCase(),l.toLowerCase(),i,s)]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"graph":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Const":return t[e.name];case"PlaceholderWithDefault":const a=Hm("default",e,t,n);return[qm(e.name,t,n)||a];case"Placeholder":return[qm(e.name,t,n)];case"Identity":case"StopGradient":case"FakeQuantWithMinMaxVars":case"Snapshot":return[Zm(Hm("x",e,t,n))];case"IdentityN":return Hm("x",e,t,n).map((e=>Zm(e)));case"Shape":return[r.tensor1d(Hm("x",e,t,n).shape,"int32")];case"ShapeN":return Hm("x",e,t,n).map((e=>r.tensor1d(e.shape)));case"Size":return[r.scalar(Hm("x",e,t,n).size,"int32")];case"Rank":return[r.scalar(Hm("x",e,t,n).rank,"int32")];case"NoOp":return[r.scalar(1)];case"Print":const o=Hm("x",e,t,n),s=Hm("data",e,t,n),i=Hm("message",e,t,n),u=Hm("summarize",e,t,n);console.warn("The graph has a tf.print() operation,usually used for debugging, which slows down performance."),console.log(i);for(let e=0;e<s.length;e++)console.log(Array.prototype.slice.call(s[e].dataSync()).slice(0,u));return[o];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"logical":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Equal":return[r.equal(Hm("a",e,t,n),Hm("b",e,t,n))];case"NotEqual":return[r.notEqual(Hm("a",e,t,n),Hm("b",e,t,n))];case"Greater":return[r.greater(Hm("a",e,t,n),Hm("b",e,t,n))];case"GreaterEqual":return[r.greaterEqual(Hm("a",e,t,n),Hm("b",e,t,n))];case"Less":return[r.less(Hm("a",e,t,n),Hm("b",e,t,n))];case"LessEqual":return[r.lessEqual(Hm("a",e,t,n),Hm("b",e,t,n))];case"LogicalAnd":return[r.logicalAnd(Hm("a",e,t,n),Hm("b",e,t,n))];case"LogicalNot":return[r.logicalNot(Hm("a",e,t,n))];case"LogicalOr":return[r.logicalOr(Hm("a",e,t,n),Hm("b",e,t,n))];case"Select":case"SelectV2":return[r.where(Hm("condition",e,t,n),Hm("a",e,t,n),Hm("b",e,t,n))];case"BitwiseAnd":return[r.bitwiseAnd(Hm("a",e,t,n),Hm("b",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"matrices":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"BatchMatMul":case"BatchMatMulV2":case"MatMul":return[r.matMul(Hm("a",e,t,n),Hm("b",e,t,n),Hm("transposeA",e,t,n),Hm("transposeB",e,t,n))];case"Einsum":return[r.einsum(Hm("equation",e,t,n),...Hm("tensors",e,t,n))];case"Transpose":return[r.transpose(Hm("x",e,t,n),Hm("perm",e,t,n))];case"_FusedMatMul":const[a,o]=Hm("fusedOps",e,t,n),s="biasadd"===a,i="prelu"===o,u=Hm("numArgs",e,t,n),l=Hm("leakyreluAlpha",e,t,n);if(s){if(i&&2!==u)throw new Error("Fused MatMul with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&1!==u)throw new Error("Fused MatMul with BiasAdd must have one extra argument: bias.")}const[c,p]=Hm("args",e,t,n);return[r.fused.matMul({a:Hm("a",e,t,n),b:Hm("b",e,t,n),transposeA:Hm("transposeA",e,t,n),transposeB:Hm("transposeB",e,t,n),bias:c,activation:o,preluActivationWeights:p,leakyreluAlpha:l})];case"MatrixBandPart":return[r.linalg.bandPart(Hm("a",e,t,n),Hm("numLower",e,t,n),Hm("numUpper",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"normalization":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"EuclideanNorm":return[r.euclideanNorm(Hm("x",e,t,n),Hm("axis",e,t,n),Hm("keepDims",e,t,n))];case"FusedBatchNorm":case"FusedBatchNormV2":case"FusedBatchNormV3":return[r.batchNorm(Hm("x",e,t,n),Hm("mean",e,t,n),Hm("variance",e,t,n),Hm("offset",e,t,n),Hm("scale",e,t,n),Hm("epsilon",e,t,n))];case"LRN":return[r.localResponseNormalization(Hm("x",e,t,n),Hm("radius",e,t,n),Hm("bias",e,t,n),Hm("alpha",e,t,n),Hm("beta",e,t,n))];case"Softmax":return[r.softmax(Hm("x",e,t,n))];case"LogSoftmax":return[r.logSoftmax(Hm("x",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"ragged":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"RaggedGather":{const{outputNestedSplits:a,outputDenseValues:o}=r.raggedGather(Hm("paramsNestedSplits",e,t,n),Hm("paramsDenseValues",e,t,n),Hm("indices",e,t,n),Hm("outputRaggedRank",e,t,n));return a.concat(o)}case"RaggedRange":{const{rtNestedSplits:a,rtDenseValues:o}=r.raggedRange(Hm("starts",e,t,n),Hm("limits",e,t,n),Hm("splits",e,t,n));return[a,o]}case"RaggedTensorToTensor":return[r.raggedTensorToTensor(Hm("shape",e,t,n),Hm("values",e,t,n),Hm("defaultValue",e,t,n),Hm("rowPartitionTensors",e,t,n),Hm("rowPartitionTypes",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"reduction":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Max":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.max(Hm("x",e,t,n),a,o)]}case"Mean":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.mean(Hm("x",e,t,n),a,o)]}case"Min":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.min(Hm("x",e,t,n),a,o)]}case"Sum":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.sum(Hm("x",e,t,n),a,o)]}case"All":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.all(Hm("x",e,t,n),a,o)]}case"Any":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.any(Hm("x",e,t,n),a,o)]}case"ArgMax":{const a=Hm("axis",e,t,n);return[r.argMax(Hm("x",e,t,n),a)]}case"ArgMin":{const a=Hm("axis",e,t,n);return[r.argMin(Hm("x",e,t,n),a)]}case"Prod":{const a=Hm("axis",e,t,n),o=Hm("keepDims",e,t,n);return[r.prod(Hm("x",e,t,n),a,o)]}case"Cumprod":{const a=Hm("axis",e,t,n),o=Hm("exclusive",e,t,n),s=Hm("reverse",e,t,n);return[r.cumprod(Hm("x",e,t,n),a,o,s)]}case"Cumsum":{const a=Hm("axis",e,t,n),o=Hm("exclusive",e,t,n),s=Hm("reverse",e,t,n);return[r.cumsum(Hm("x",e,t,n),a,o,s)]}case"Bincount":const a=Hm("x",e,t,n),o=Hm("weights",e,t,n),s=Hm("size",e,t,n);return[r.bincount(a,o,s)];case"DenseBincount":{const a=Hm("x",e,t,n),o=Hm("weights",e,t,n),s=Hm("size",e,t,n),i=Hm("binaryOutput",e,t,n);return[r.denseBincount(a,o,s,i)]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"slice_join":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"ConcatV2":case"Concat":{const a=Hm("n",e,t,n),o=Hm("axis",e,t,n);let s=Hm("tensors",e,t,n);return s=s.slice(0,a),[r.concat(s,o)]}case"Gather":{const a=Hm("x",e,t,n),o=Hm("indices",e,t,n);return[r.gather(a,r.cast(o,"int32"),0)]}case"GatherV2":{const a=Hm("axis",e,t,n),o=Hm("batchDims",e,t,n),s=Hm("x",e,t,n),i=Hm("indices",e,t,n);return[r.gather(s,r.cast(i,"int32"),a,o)]}case"Reverse":{const a=Hm("dims",e,t,n),o=[];for(let e=0;e<a.length;e++)a[e]&&o.push(e);const s=Hm("x",e,t,n);return[r.reverse(s,o)]}case"ReverseV2":{const a=Hm("axis",e,t,n),o=Hm("x",e,t,n);return[r.reverse(o,a)]}case"Slice":{const a=Hm("begin",e,t,n),o=Hm("size",e,t,n);return[r.slice(Hm("x",e,t,n),a,o)]}case"StridedSlice":{const a=Hm("begin",e,t,n),o=Hm("end",e,t,n),s=Hm("strides",e,t,n),i=Hm("beginMask",e,t,n),u=Hm("endMask",e,t,n),l=Hm("ellipsisMask",e,t,n),c=Hm("newAxisMask",e,t,n),p=Hm("shrinkAxisMask",e,t,n),d=Hm("x",e,t,n);return[r.stridedSlice(d,a,o,s,i,u,l,c,p)]}case"Pack":return oi((()=>{const a=Hm("axis",e,t,n),o=Hm("tensors",e,t,n),s=o[0].shape,i=r.squeeze(o[0]).shape,u=o.map((e=>{const t=re(e.shape,s);if(!t&&!re(r.squeeze(e).shape,i))throw new Error("the input tensors shape does not match");return t?e:r.reshape(e,s)}));return[r.stack(u,a)]}));case"Unpack":{const a=Hm("axis",e,t,n),o=Hm("tensor",e,t,n);return r.unstack(o,a)}case"Tile":{const a=Hm("reps",e,t,n);return[r.tile(Hm("x",e,t,n),a)]}case"Split":case"SplitV":{const a=Hm("axis",e,t,n),o=Hm("numOrSizeSplits",e,t,n),s=Hm("x",e,t,n);return r.split(s,o,a)}case"ScatterNd":{const a=Hm("indices",e,t,n),o=Hm("values",e,t,n),s=Hm("shape",e,t,n);return[r.scatterND(a,o,s)]}case"GatherNd":{const a=Hm("x",e,t,n),o=Hm("indices",e,t,n);return[r.gatherND(a,o)]}case"SparseToDense":{const a=Hm("sparseIndices",e,t,n),o=Hm("outputShape",e,t,n),s=Hm("sparseValues",e,t,n),i=Hm("defaultValue",e,t,n);return[r.sparseToDense(a,s,o,s.dtype===i.dtype?i:r.cast(i,s.dtype))]}case"TensorScatterUpdate":{const a=Hm("indices",e,t,n),o=Hm("values",e,t,n),s=Hm("tensor",e,t,n);return[r.tensorScatterUpdate(s,a,o)]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"sparse":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"SparseFillEmptyRows":{const{outputIndices:a,outputValues:o,emptyRowIndicator:s,reverseIndexMap:i}=r.sparse.sparseFillEmptyRows(Hm("indices",e,t,n),Hm("values",e,t,n),Hm("denseShape",e,t,n),Hm("defaultValue",e,t,n));return[a,o,s,i]}case"SparseReshape":{const{outputIndices:a,outputShape:o}=r.sparse.sparseReshape(Hm("inputIndices",e,t,n),Hm("inputShape",e,t,n),Hm("newShape",e,t,n));return[a,o]}case"SparseSegmentMean":return[r.sparse.sparseSegmentMean(Hm("data",e,t,n),Hm("indices",e,t,n),Hm("segmentIds",e,t,n))];case"SparseSegmentSum":return[r.sparse.sparseSegmentSum(Hm("data",e,t,n),Hm("indices",e,t,n),Hm("segmentIds",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"spectral":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"FFT":return[r.fft(Hm("x",e,t,n))];case"IFFT":return[r.ifft(Hm("x",e,t,n))];case"RFFT":return[r.rfft(Hm("x",e,t,n))];case"IRFFT":return[r.irfft(Hm("x",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"string":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"StaticRegexReplace":return[r.string.staticRegexReplace(Hm("input",e,t,n),Hm("pattern",e,t,n),Hm("rewrite",e,t,n),Hm("replaceGlobal",e,t,n))];case"StringNGrams":{const{nGrams:a,nGramsSplits:o}=r.string.stringNGrams(Hm("data",e,t,n),Hm("dataSplits",e,t,n),Hm("separator",e,t,n),Hm("nGramWidths",e,t,n),Hm("leftPad",e,t,n),Hm("rightPad",e,t,n),Hm("padWidth",e,t,n),Hm("preserveShortSequences",e,t,n));return[a,o]}case"StringSplit":{const{indices:a,values:o,shape:s}=r.string.stringSplit(Hm("input",e,t,n),Hm("delimiter",e,t,n),Hm("skipEmpty",e,t,n));return[a,o,s]}case"StringToHashBucketFast":return[r.string.stringToHashBucketFast(Hm("input",e,t,n),Hm("numBuckets",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"transformation":return a((()=>((e,t,n,r=P)=>{switch(e.op){case"Cast":return[r.cast(Hm("x",e,t,n),Hm("dtype",e,t,n))];case"ExpandDims":{const a=Hm("axis",e,t,n);return[r.expandDims(Hm("x",e,t,n),a)]}case"Squeeze":{const a=Hm("axis",e,t,n);return[r.squeeze(Hm("x",e,t,n),a)]}case"Reshape":return[r.reshape(Hm("x",e,t,n),Hm("shape",e,t,n))];case"EnsureShape":return[r.ensureShape(Hm("x",e,t,n),Hm("shape",e,t,n))];case"MirrorPad":return[r.mirrorPad(Hm("x",e,t,n),Hm("padding",e,t,n),Hm("mode",e,t,n))];case"PadV2":case"Pad":return[r.pad(Hm("x",e,t,n),Hm("padding",e,t,n),Hm("constantValue",e,t,n))];case"SpaceToBatchND":{const a=Hm("blockShape",e,t,n),o=Hm("paddings",e,t,n);return[r.spaceToBatchND(Hm("x",e,t,n),a,o)]}case"BatchToSpaceND":{const a=Hm("blockShape",e,t,n),o=Hm("crops",e,t,n);return[r.batchToSpaceND(Hm("x",e,t,n),a,o)]}case"DepthToSpace":{const a=Hm("blockSize",e,t,n),o=Hm("dataFormat",e,t,n).toUpperCase();return[r.depthToSpace(Hm("x",e,t,n),a,o)]}case"BroadcastTo":return[r.broadcastTo(Hm("x",e,t,n),Hm("shape",e,t,n))];case"BroadcastArgs":return[r.broadcastArgs(Hm("s0",e,t,n),Hm("s1",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n)));case"hash_table":return(async(e,t,n,r)=>{switch(e.op){case"HashTable":case"HashTableV2":{const a=r.getHashTableHandleByName(e.name);if(null!=a)return[a];{const a=Hm("keyDType",e,t,n),o=Hm("valueDType",e,t,n),s=new jg(a,o);return r.addHashTable(e.name,s),[s.handle]}}case"InitializeTable":case"InitializeTableV2":case"LookupTableImport":case"LookupTableImportV2":{const a=Hm("tableHandle",e,t,n,r),o=Hm("keys",e,t,n),s=Hm("values",e,t,n),i=r.getHashTableById(a.id);return[await i.import(o,s)]}case"LookupTableFind":case"LookupTableFindV2":{const a=Hm("tableHandle",e,t,n,r),o=Hm("keys",e,t,n),s=Hm("defaultValue",e,t,n),i=r.getHashTableById(a.id);return[await i.find(o,s)]}case"LookupTableSize":case"LookupTableSizeV2":{const a=Hm("tableHandle",e,t,n,r);return[r.getHashTableById(a.id).tensorSize()]}default:throw TypeError(`Node type ${e.op} is not implemented`)}})(e,t,n,r);case"custom":const o=Wm(e.op);if(o&&o.customExecutor)return o.customExecutor(new Cg(e,t,n));throw TypeError(`Custom op ${e.op} is not registered.`);default:throw TypeError(`Unknown op '${e.op}'. File an issue at https://github.com/tensorflow/tfjs/issues so we can add it, or register a custom execution with tf.registerOp()`)}})(e,t,n);return Fe(o)?o.then((e=>[].concat(e))):[].concat(o)}class Hg{constructor(e={},t={},n={},r={},a){this.weightMap=e,this.tensorArrayMap=t,this.tensorListMap=n,this.functionMap=r,this.parseNodeNameCache=a,this.rootContext={id:0,frameName:"",iterationId:0},this.contexts=[this.rootContext],this.lastId=0,this.generateCurrentContextIds()}newFrame(e,t){return{id:e,frameName:t,iterationId:0}}set currentContext(e){this.contexts!==e&&(this.contexts=e,this.generateCurrentContextIds())}get currentContext(){return this.contexts}get currentContextId(){return this._currentContextIds[0]}get currentContextIds(){return this._currentContextIds}generateCurrentContextIds(){const e=[];for(let t=0;t<this.contexts.length-1;t++){const n=this.contexts.slice(0,this.contexts.length-t);e.push(this.contextIdforContexts(n))}e.push(""),this._currentContextIds=e}contextIdforContexts(e){return e?e.map((e=>0===e.id&&0===e.iterationId?"":`${e.frameName}-${e.iterationId}`)).join("/"):""}enterFrame(e){this.contexts&&(this.lastId++,this.contexts=this.contexts.slice(),this.contexts.push(this.newFrame(this.lastId,e)),this._currentContextIds.unshift(this.contextIdforContexts(this.contexts)))}exitFrame(){if(!(this.contexts&&this.contexts.length>1))throw new Error("Cannot exit frame, the context is empty");this.contexts=this.contexts.slice(),this.contexts.splice(-1),this.currentContextIds.shift()}nextIteration(){if(!(this.contexts&&this.contexts.length>0))throw new Error("Cannot increase frame iteration, the context is empty");{this.contexts=this.contexts.slice(),this.lastId++;const e=Object.assign({},this.contexts[this.contexts.length-1]);e.iterationId+=1,e.id=this.lastId,this.contexts.splice(-1,1,e),this._currentContextIds.splice(0,1,this.contextIdforContexts(this.contexts))}}getWeight(e){return this.weightMap[e]}addTensorArray(e){this.tensorArrayMap[e.id]=e}getTensorArray(e){return this.tensorArrayMap[e]}addTensorList(e){this.tensorListMap[e.id]=e}getTensorList(e){return this.tensorListMap[e]}dispose(e){for(const t in this.tensorArrayMap)this.tensorArrayMap[t].clearAndClose(e);for(const t in this.tensorListMap)this.tensorListMap[t].clearAndClose(e)}}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qg(e,t,n,r){const a=new Set,o=[];let s=null,i=null;const u=new Set,l=new Set(Object.keys(e).map((e=>Ym(e)[0])));r=r||[];const c=new Set(r.map((e=>Ym(e.name)[0]))),p=[...t];for(;p.length>0;){const e=p.pop();(Zg(e)||Jg(e)||ey(e))&&null==s&&(s=e,i=s.children.map((e=>e.name)).filter((e=>a.has(e)))),a.add(e.name),null==n[e.name]&&(l.has(e.name)||c.has(e.name)||(0!==e.inputs.length?e.inputs.forEach((e=>{u.has(e.name)||(u.add(e.name),p.push(e))})):o.push(e.name)))}return{inputs:e,outputs:t,usedNodes:a,missingInputs:o,dynamicNode:s,syncInputs:i}}function Gg(e,t){const{usedNodes:n,inputs:r}=t,a=Object.keys(r).map((e=>Ym(e)[0])).map((t=>e.nodes[t])),o=e.initNodes||[],s=e=>n.has("string"==typeof e?e:e.name);function i(e){return[...new Map(e.map((e=>[e.name,e]))).values()]}const u=i([...a,...e.weights,...o]).filter(s),l=i([...u,...Object.values(e.nodes)]).filter(s),c=new Map(l.map((e=>[e.name,e]))),p={};for(const e of l){p[e.name]=p[e.name]||0;for(const t of e.children)s(t)||(p[t.name]=Number.POSITIVE_INFINITY),p[t.name]=(p[t.name]||0)+1}const d=Object.entries(p).filter((([,e])=>0===e)).map((([e])=>e)),f=[...d];for(;d.length>0;){const e=d.pop(),t=c.get(e);for(const e of t.children.filter(s))0==--p[e.name]&&(f.push(e.name),d.push(e.name))}const h=function(e,t){const n=new Map(e.map((e=>[e.name,e]))),r=t.map((e=>e.name)),a=new Set(r);for(;r.length>0;){const e=r.pop(),t=n.get(e);for(const e of t.children)n.has(e.name)&&!a.has(e.name)&&(a.add(e.name),r.push(e.name))}const o=e.filter((e=>a.has(e.name)));return o}(f.map((e=>c.get(e))),u);return function(e,t){const n=new Map(e.map(((e,t)=>[e.name,t]))),r=new Set(t.map((e=>e.name))),a=e=>r.has("string"==typeof e?e:e.name),o=new Set(e.map((e=>e.name))),s=e=>o.has("string"==typeof e?e:e.name);for(const t of e){for(const e of t.children.filter(s)){if(!n.has(e.name))throw new Kg(`Child ${e.name} of node ${t.name} is unreachable.`);if(n.get(t.name)>n.get(e.name))throw new Kg(`Node ${t.name} is scheduled to run after its child ${e.name}.`)}if(!a(t))for(const e of t.inputs){if(!n.has(e.name))throw new Kg(`Input ${e.name} of node ${t.name} is unreachable.`);if(n.get(e.name)>n.get(t.name))throw new Kg(`Node ${t.name} is scheduled to run before its input ${e.name}.`)}}}(h,u),h}class Kg extends Error{constructor(e){super(`NodesExecutionOrderError: ${e}`)}}const Qg=new Set(["Switch","Merge","Enter","Exit","NextIteration","StatelessIf","StatelessWhile","if","While"]),Yg=new Set(["NonMaxSuppressionV2","NonMaxSuppressionV3","NonMaxSuppressionV5","Where"]),Xg=new Set(["HashTable","HashTableV2","LookupTableImport","LookupTableImportV2","LookupTableFind","LookupTableFindV2","LookupTableSize","LookupTableSizeV2"]);function Zg(e){return Qg.has(e.op)}function Jg(e){return Yg.has(e.op)}function ey(e){return Xg.has(e.op)}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ty{get weightIds(){return this.parent?this.parent.weightIds:this._weightIds}get functionExecutorMap(){return this.parent?this.parent.functionExecutorMap:this._functionExecutorMap}get weightMap(){return this.parent?this.parent.weightMap:this._weightMap}set weightMap(e){const t=Object.keys(e).map((t=>e[t].map((e=>e.id))));this._weightIds=[].concat(...t),this._weightMap=e}set resourceManager(e){this._resourceManager=e}get inputs(){return this._inputs.map((e=>({name:e.name,shape:e.attrParams.shape?e.attrParams.shape.value:void 0,dtype:e.attrParams.dtype?e.attrParams.dtype.value:void 0})))}get outputs(){return this._outputs.map((e=>({name:e.name,shape:e.attrParams.shape?e.attrParams.shape.value:void 0,dtype:e.attrParams.dtype?e.attrParams.dtype.value:void 0})))}get inputNodes(){return this._inputs.map((e=>e.signatureKey||e.name))}get outputNodes(){return this._outputs.map((e=>{const t=e.signatureKey||e.name;return e.defaultOutput?`${t}:${e.defaultOutput}`:t}))}get functions(){return Object.keys(this._functions).reduce(((e,t)=>(e[t]=this._functions[t].signature,e)),{})}constructor(e,t){this.graph=e,this.parent=t,this.compiledMap=new Map,this.parseNodeNameCache=new Map,this._weightMap={},this.SEPARATOR=",",this._functions={},this._functionExecutorMap={},this.keepIntermediateTensors=!1,this._outputs=e.outputs,this._inputs=e.inputs,this._initNodes=e.initNodes,this._signature=e.signature,this._functions=e.functions,null!=e.functions&&Object.keys(e.functions).forEach((t=>{this._functionExecutorMap[t]=new ty(e.functions[t],this)}))}getCompilationKey(e,t){const n=e.map((e=>e.name)).sort(),r=t.map((e=>e.name)).sort();return n.join(this.SEPARATOR)+"--"+r.join(this.SEPARATOR)}compile(e,t){const n=qg(e,t,this.weightMap,this._initNodes),{missingInputs:r,dynamicNode:a,syncInputs:o}=n;if(null!=a)throw new Error(`This execution contains the node '${a.name}', which has the dynamic op '${a.op}'. Please use model.executeAsync() instead. Alternatively, to avoid the dynamic ops, specify the inputs [${o}]`);if(r.length>0){const n=t.map((e=>e.name)),a=Object.keys(e);throw new Error(`Cannot compute the outputs [${n}] from the provided inputs [${a}]. Missing the following inputs: [${r}]`)}const s=Gg(this.graph,n),i=function(e){const t=new Map(e.map(((e,t)=>[e.name,t]))),n=Number.MAX_SAFE_INTEGER,r=e.map(((e,t)=>Zg(e)?n:t)),a=e=>{const n=r[t.get(e.name)];return null==n?-1:n},o=e.map(((e,t)=>e.children.map(a).reduce(((e,t)=>Math.max(e,t)),r[t]))),s=new Map;for(let t=0;t<e.length;++t){const r=o[t];if(r===n)continue;const a=e[t],i=e[r];s.has(i.name)||s.set(i.name,[]),s.get(i.name).push(a)}return s}(s);return{orderedNodes:s,nodeLiveUntilMap:i}}cloneAndKeepTensor(e){if(null==e)return null;const t=e.clone();return ii(t),t}cloneTensorList(e){if(!e)return null;const t=e.map((e=>this.cloneAndKeepTensor(e)));return t}cloneTensorMap(e){return Object.fromEntries(Object.entries(e).map((([e,t])=>[e,this.cloneTensorList(t)])))}execute(e,t){this.disposeIntermediateTensors(),e=this.mapInputs(e);const n=Object.keys(e).sort();this.checkInputs(e),this.checkInputShapeAndType(e),t=this.mapOutputs(t),this.checkOutputs(t);const r=n.map((e=>this.graph.nodes[Ym(e)[0]])),a=t.map((e=>Ym(e)[0])),o=new Set(a);let s=a.map((e=>this.graph.nodes[e]));0===s.length&&(s=this._outputs);const i=this.getCompilationKey(r,s);let u=this.compiledMap.get(i);null==u&&(u=this.compile(e,s),this.compiledMap.set(i,u));try{this.keepIntermediateTensors=Be().getBool("KEEP_INTERMEDIATE_TENSORS")}catch(e){this.keepIntermediateTensors=!1,console.warn(e.message)}const l={},c={};return oi((()=>{const n=new Hg(this.weightMap,l,c,this.functionExecutorMap,this.parseNodeNameCache),r=Object.assign({},this.weightMap);this.keepIntermediateTensors&&(this.clonedTensorsMap=this.cloneTensorMap(this.weightMap)),Object.keys(e).forEach((t=>{const[a,o]=Ym(t,n),s=[];s[o]=e[t],r[a]=s,this.keepIntermediateTensors&&(this.clonedTensorsMap[a]=this.cloneTensorList(s))}));const a=this.getFrozenTensorIds(r),{orderedNodes:s,nodeLiveUntilMap:i}=u;for(const e of s){if(r[e.name])continue;const t=Wg(e,r,n,this._resourceManager);if(Fe(t))throw new Error(`The execution of the op '${e.op}' returned a promise. Please use model.executeAsync() instead.`);r[e.name]=t,this.keepIntermediateTensors&&(this.clonedTensorsMap[e.name]=this.cloneTensorList(t)),this.checkTensorForDisposalWithNodeLiveUntilInfo(e,r,n,a,o,i.get(e.name))}return null==this.parent&&n.dispose(a),t.map((e=>qm(e,r,n)))}))}getFrozenTensorIds(e){const t=[].concat.apply([],Object.keys(e).map((t=>e[t])).map((e=>e.map((e=>e.id)))));return new Set(t)}checkTensorForDisposal(e,t,n,r,a,o,s){if(!Zg(t)&&!o.has(e)){for(const r of n[e])null!=r&&(s[r.id]=(s[r.id]||0)+t.children.length);for(const e of t.inputs){if(Zg(e))continue;const t=Gm(e.name,n,r);if(null!=t)for(const e of t){if(!e||e.kept||a.has(e.id))continue;const t=s[e.id];1===t?(e.dispose(),delete s[e.id]):null!=t&&s[e.id]--}}}}checkTensorForDisposalWithNodeLiveUntilInfo(e,t,n,r,a,o){function s(e){return Zg(e)||a.has(e.name)}if(!Zg(e)&&null!=o)for(const e of o){if(s(e))continue;const a=Gm(e.name,t,n);for(const e of a)!e||e.kept||r.has(e.id)||e.dispose()}}async executeAsync(e,t){return this._executeAsync(e,t)}disposeIntermediateTensors(){this.clonedTensorsMap&&(Object.values(this.clonedTensorsMap).forEach((e=>{for(const t of e)t&&!t.isDisposed&&t.dispose()})),this.clonedTensorsMap=null)}getIntermediateTensors(){return this.clonedTensorsMap}async _executeAsync(e,t,n=!1,r={},a={}){this.disposeIntermediateTensors(),n||(e=this.mapInputs(e),this.checkInputs(e),this.checkInputShapeAndType(e),t=this.mapOutputs(t),this.checkOutputs(t));try{this.keepIntermediateTensors=Be().getBool("KEEP_INTERMEDIATE_TENSORS")}catch(e){this.keepIntermediateTensors=!1,console.warn(e.message)}const o=new Hg(this.weightMap,r,a,this.functionExecutorMap,this.parseNodeNameCache);this.keepIntermediateTensors&&(this.clonedTensorsMap=this.cloneTensorMap(this.weightMap));const s=await this.executeWithControlFlow(e,o,t,n),i=t.map((e=>qm(e,s,o))),u=i.map((e=>e.id)),l=Object.keys(e).map((t=>e[t].id)),c=new Set([...u,...l,...this.weightIds]);return Object.values(s).forEach((e=>{e.forEach((e=>{!e||e.isDisposed||c.has(e.id)||e.dispose()}))})),null==this.parent&&o.dispose(c),i}async executeFunctionAsync(e,t,n){const r=e.reduce(((e,t,n)=>(e[this.inputs[n].name]=t,e)),{});return this._executeAsync(r,this.outputNodes,!0,t,n)}async executeWithControlFlow(e,t,n,r){const a=Object.keys(e),o=a.map((e=>this.graph.nodes[Ym(e)[0]])),s=n.map((e=>Ym(e)[0])),i=new Set(s);let u=s.map((e=>this.graph.nodes[e]));0===u.length&&(u=this._outputs);const{usedNodes:l,missingInputs:c,dynamicNode:p,syncInputs:d}=qg(e,u,this.weightMap,this._initNodes),f=[...o,...this.graph.weights,...this._initNodes||[]].map((e=>({node:e,contexts:t.currentContext}))),h=Object.assign({},this.weightMap);Object.keys(e).forEach((t=>{const[n,r]=Ym(t),a=[];a[r]=e[t],h[n]=a}));const m={},g=this.getFrozenTensorIds(h),y={};for(;f.length>0;){const e=this.processStack(o,f,t,h,y,g,i,m,l);await Promise.all(e)}null!=p||r||console.warn("This model execution did not contain any nodes with control flow or dynamic output shapes. You can use model.execute() instead.");const b=u.filter((e=>!Zg(e)&&!qm(e.name,h,t))).map((e=>e.name));if(b.length>0){let e="";throw null!=p&&(e=`Alternatively, to avoid the dynamic ops, use model.execute() and specify the inputs [${d}]`),new Error(`Cannot compute the outputs [${b}] from the provided inputs [${a}]. Consider providing the following inputs: [${c}]. ${e}`)}return h}processStack(e,t,n,r,a,o,s,i,u){const l=[];for(;t.length>0;){const e=t.pop();n.currentContext=e.contexts;let c="";if("Enter"===e.node.op&&Hm("isConstant",e.node,r,n)&&([c]=Km(e.node.name,n)),null==r[e.node.name]){const p=Wg(e.node,r,n,this._resourceManager);c||([c]=Km(e.node.name,n));const d=n.currentContext;Fe(p)?l.push(p.then((l=>(r[c]=l,this.keepIntermediateTensors&&(this.clonedTensorsMap[c]=this.cloneTensorList(l)),n.currentContext=d,this.checkTensorForDisposal(c,e.node,r,n,o,s,i),this.processChildNodes(e.node,t,n,r,a,u),l)))):(r[c]=p,this.keepIntermediateTensors&&(this.clonedTensorsMap[c]=this.cloneTensorList(p)),this.checkTensorForDisposal(c,e.node,r,n,o,s,i),this.processChildNodes(e.node,t,n,r,a,u))}else this.processChildNodes(e.node,t,n,r,a,u)}return l}processChildNodes(e,t,n,r,a,o){e.children.forEach((e=>{const[s]=Km(e.name,n);!a[s]&&o.has(e.name)&&("Merge"===e.op?e.inputNames.some((e=>!!qm(e,r,n)))&&(a[s]=!0,t.push({contexts:n.currentContext,node:e})):e.inputNames.every((e=>!!qm(e,r,n)))&&(a[s]=!0,t.push({contexts:n.currentContext,node:e})))}))}dispose(){Object.keys(this.weightMap).forEach((e=>this.weightMap[e].forEach((e=>e.dispose()))))}checkInputShapeAndType(e){Object.keys(e).forEach((t=>{const n=e[t],[r]=Ym(t),a=this.graph.nodes[r];if(a.attrParams.shape&&a.attrParams.shape.value){const e=a.attrParams.shape.value;X(e.length===n.shape.length&&n.shape.every(((t,n)=>-1===e[n]||e[n]===t)),(()=>`The shape of dict['${a.name}'] provided in model.execute(dict) must be [${e}], but was [${n.shape}]`))}a.attrParams.dtype&&a.attrParams.dtype.value&&X(n.dtype===a.attrParams.dtype.value,(()=>`The dtype of dict['${a.name}'] provided in model.execute(dict) must be ${a.attrParams.dtype.value}, but was ${n.dtype}`))}))}mapInputs(e){var t,n;const r={};for(const a in e){const o=null===(n=null===(t=this._signature)||void 0===t?void 0:t.inputs)||void 0===n?void 0:n[a];null!=o?r[o.name]=e[a]:r[a]=e[a]}return r}checkInputs(e){const t=Object.keys(e).filter((e=>{const[t]=Ym(e);return null==this.graph.nodes[t]}));if(t.length>0)throw new Error(`The dict provided in model.execute(dict) has keys: [${t}] that are not part of graph`)}mapOutputs(e){return e.map((e=>{var t,n;const r=null===(n=null===(t=this._signature)||void 0===t?void 0:t.outputs)||void 0===n?void 0:n[e];return null!=r?r.name:e}),{})}checkOutputs(e){e.forEach((e=>{const[t]=Ym(e);if(!this.graph.nodes[t])throw new Error(`The output '${e}' is not found in the graph`)}))}}class ny{constructor(e={},t={}){this.hashTableNameToHandle=e,this.hashTableMap=t}addHashTable(e,t){this.hashTableNameToHandle[e]=t.handle,this.hashTableMap[t.id]=t}getHashTableHandleByName(e){return this.hashTableNameToHandle[e]}getHashTableById(e){return this.hashTableMap[e]}dispose(){for(const e in this.hashTableMap)this.hashTableMap[e].clearAndClose(),delete this.hashTableMap[e];for(const e in this.hashTableNameToHandle)this.hashTableNameToHandle[e].dispose(),delete this.hashTableNameToHandle[e]}}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ry="?tfjs-format=file",ay="model.json";class oy{get modelVersion(){return this.version}get inputNodes(){return this.executor.inputNodes}get outputNodes(){return this.executor.outputNodes}get inputs(){return this.executor.inputs}get outputs(){return this.executor.outputs}get weights(){return this.executor.weightMap}get metadata(){return this.artifacts.userDefinedMetadata}get modelSignature(){return this.signature}get modelStructuredOutputKeys(){return this.structuredOutputKeys}constructor(e,t={},n=s){this.modelUrl=e,this.loadOptions=t,this.version="n/a",this.io=n,null==t&&(this.loadOptions={}),this.resourceManager=new ny}findIOHandler(){const e=this.modelUrl;if(null!=e.load)this.handler=e;else if(null!=this.loadOptions.requestInit)this.handler=this.io.browserHTTPRequest(e,this.loadOptions);else{const t=this.io.getLoadHandlers(e,this.loadOptions);if(0===t.length)t.push(this.io.browserHTTPRequest(e,this.loadOptions));else if(t.length>1)throw new Error(`Found more than one (${t.length}) load handlers for URL '${[e]}'`);this.handler=t[0]}}load(){if(this.findIOHandler(),null==this.handler.load)throw new Error("Cannot proceed with model loading because the IOHandler provided does not have the `load` method implemented.");const e=this.handler.load();return Fe(e)?e.then((e=>this.loadSync(e))):this.loadSync(e)}loadSync(e){this.artifacts=e;const t=this.artifacts.modelTopology;let n=this.artifacts.signature;if(null!=this.artifacts.userDefinedMetadata){const e=this.artifacts.userDefinedMetadata;null!=e.signature&&(n=e.signature),null!=e.structuredOutputKeys&&(this.structuredOutputKeys=e.structuredOutputKeys)}this.signature=n,this.version=`${t.versions.producer}.${t.versions.minConsumer}`;const r=this.io.decodeWeights(this.artifacts.weightData,this.artifacts.weightSpecs);if(this.executor=new ty(bg.Instance.transformGraph(t,this.signature)),this.executor.weightMap=this.convertTensorMapToTensorsMap(r),this.executor.resourceManager=this.resourceManager,null!=e.modelInitializer&&null!=e.modelInitializer.node){const t=bg.Instance.transformGraph(e.modelInitializer);this.initializer=new ty(t),this.initializer.weightMap=this.executor.weightMap,this.initializer.resourceManager=this.resourceManager,this.initializerSignature=e.initializerSignature}return!0}async save(e,t){if("string"==typeof e){const t=this.io.getSaveHandlers(e);if(0===t.length)throw new Error(`Cannot find any save handlers for URL '${e}'`);if(t.length>1)throw new Error(`Found more than one (${t.length}) save handlers for URL '${e}'`);e=t[0]}if(null==e.save)throw new Error("GraphModel.save() cannot proceed because the IOHandler provided does not have the `save` attribute defined.");return e.save(this.artifacts)}addStructuredOutputNames(e){if(this.structuredOutputKeys){const t={};return(e instanceof io?[e]:e).forEach(((e,n)=>t[this.structuredOutputKeys[n]]=e)),t}return e}predict(e,t){const n=this.execute(e,this.outputNodes);return this.addStructuredOutputNames(n)}async predictAsync(e,t){const n=await this.executeAsync(e,this.outputNodes);return this.addStructuredOutputNames(n)}normalizeInputs(e){var t;if(!(e instanceof io||Array.isArray(e))){const n=null===(t=this.signature)||void 0===t?void 0:t.inputs;if(null!=n)for(const t in n){const r=n[t];null!=r.resourceId&&(e[t]=this.resourceIdToCapturedInput[r.resourceId])}return e}e=Array.isArray(e)?e:[e];const n=Object.keys(this.resourceIdToCapturedInput).length;if(e.length+n!==this.inputNodes.length)throw new Error(`Input tensor count mismatch, the graph model has ${this.inputNodes.length-n} non-resource placeholders, while there are ${e.length} input tensors provided.`);let r=0;return this.inputNodes.reduce(((t,n)=>{var a,o,s;const i=null===(s=null===(o=null===(a=this.signature)||void 0===a?void 0:a.inputs)||void 0===o?void 0:o[n])||void 0===s?void 0:s.resourceId;return t[n]=null!=i?this.resourceIdToCapturedInput[i]:e[r++],t}),{})}normalizeOutputs(e){return e=e||this.outputNodes,Array.isArray(e)?e:[e]}executeInitializerGraph(){return null==this.initializer?[]:null==this.initializerSignature?this.initializer.execute({},[]):this.initializer.execute({},Object.keys(this.initializerSignature.outputs))}async executeInitializerGraphAsync(){return null==this.initializer?[]:null==this.initializerSignature?this.initializer.executeAsync({},[]):this.initializer.executeAsync({},Object.keys(this.initializerSignature.outputs))}setResourceIdToCapturedInput(e){if(this.resourceIdToCapturedInput={},this.initializerSignature){const t=this.initializerSignature.outputs,n=Object.keys(t);for(let r=0;r<n.length;r++){const a=t[n[r]];this.resourceIdToCapturedInput[a.resourceId]=e[r]}}}execute(e,t){null==this.resourceIdToCapturedInput&&this.setResourceIdToCapturedInput(this.executeInitializerGraph()),e=this.normalizeInputs(e),t=this.normalizeOutputs(t);const n=this.executor.execute(e,t);return n.length>1?n:n[0]}async executeAsync(e,t){null==this.resourceIdToCapturedInput&&this.setResourceIdToCapturedInput(await this.executeInitializerGraphAsync()),e=this.normalizeInputs(e),t=this.normalizeOutputs(t);const n=await this.executor.executeAsync(e,t);return n.length>1?n:n[0]}getIntermediateTensors(){return this.executor.getIntermediateTensors()}disposeIntermediateTensors(){this.executor.disposeIntermediateTensors()}convertTensorMapToTensorsMap(e){return Object.keys(e).reduce(((t,n)=>(t[n]=[e[n]],t)),{})}dispose(){this.executor.dispose(),this.initializer&&(this.initializer.dispose(),this.resourceIdToCapturedInput&&si(this.resourceIdToCapturedInput)),this.resourceManager.dispose()}}async function sy(e,t={},n=s){if(null==e)throw new Error("modelUrl in loadGraphModel() cannot be null. Please provide a url or an IOHandler that loads the model");null==t&&(t={}),t.fromTFHub&&"string"==typeof e&&(e=function(e){e.endsWith("/")||(e+="/");return`${e}${ay}${ry}`}(e));const r=new oy(e,t,n);return await r.load(),r}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var iy=n(513),uy=function(e,t){return uy=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])},uy(e,t)};function ly(e,t){function n(){this.constructor=e}uy(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n)}var cy=function(){return cy=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var a in t=arguments[n])Object.prototype.hasOwnProperty.call(t,a)&&(e[a]=t[a]);return e},cy.apply(this,arguments)};function py(e,t,n,r){return new(n||(n=Promise))((function(a,o){function s(e){try{u(r.next(e))}catch(e){o(e)}}function i(e){try{u(r.throw(e))}catch(e){o(e)}}function u(e){var t;e.done?a(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(s,i)}u((r=r.apply(e,t||[])).next())}))}function dy(e,t){var n,r,a,o,s={label:0,sent:function(){if(1&a[0])throw a[1];return a[1]},trys:[],ops:[]};return o={next:i(0),throw:i(1),return:i(2)},"function"==typeof Symbol&&(o[Symbol.iterator]=function(){return this}),o;function i(o){return function(i){return function(o){if(n)throw new TypeError("Generator is already executing.");for(;s;)try{if(n=1,r&&(a=2&o[0]?r.return:o[0]?r.throw||((a=r.return)&&a.call(r),0):r.next)&&!(a=a.call(r,o[1])).done)return a;switch(r=0,a&&(o=[2&o[0],a.value]),o[0]){case 0:case 1:a=o;break;case 4:return s.label++,{value:o[1],done:!1};case 5:s.label++,r=o[1],o=[0];continue;case 7:o=s.ops.pop(),s.trys.pop();continue;default:if(!((a=(a=s.trys).length>0&&a[a.length-1])||6!==o[0]&&2!==o[0])){s=0;continue}if(3===o[0]&&(!a||o[1]>a[0]&&o[1]<a[3])){s.label=o[1];break}if(6===o[0]&&s.label<a[1]){s.label=a[1],a=o;break}if(a&&s.label<a[2]){s.label=a[2],s.ops.push(o);break}a[2]&&s.ops.pop(),s.trys.pop();continue}o=t.call(e,s)}catch(e){o=[6,e],r=0}finally{n=a=0}if(5&o[0])throw o[1];return{value:o[0]?o[1]:void 0,done:!0}}([o,i])}}}function fy(e){return e instanceof SVGAnimatedLength?e.baseVal.value:e}function hy(e){return py(this,void 0,void 0,(function(){var t,n;return dy(this,(function(r){switch(r.label){case 0:return t=document.createElement("canvas"),e instanceof io?[4,Fu(e,t)]:[3,2];case 1:return r.sent(),[3,3];case 2:t.width=fy(e.width),t.height=fy(e.height),n=t.getContext("2d"),e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0),r.label=3;case 3:return[2,t]}}))}))}function my(e){return py(this,void 0,void 0,(function(){var t,n,r,a,o,s;return dy(this,(function(i){switch(i.label){case 0:return e instanceof io?(t=e.shape.slice(0,2),n=t[0],r=t[1],a=ImageData.bind,[4,Fu(e)]):[3,2];case 1:return[2,new(a.apply(ImageData,[void 0,i.sent(),r,n]))];case 2:return o=document.createElement("canvas"),s=o.getContext("2d"),o.width=fy(e.width),o.height=fy(e.height),s.drawImage(e,0,0),[2,s.getImageData(0,0,o.width,o.height)]}}))}))}function gy(e){return py(this,void 0,void 0,(function(){var t;return dy(this,(function(n){switch(n.label){case 0:return e instanceof SVGImageElement||e instanceof OffscreenCanvas?[4,hy(e)]:[3,2];case 1:return t=n.sent(),[3,3];case 2:t=e,n.label=3;case 3:return[2,Lu(t,4)]}}))}))}function yy(e){if(e<0||e>=256)throw new Error("Mask value must be in range [0, 255] but got "+e);if(!Number.isInteger(e))throw new Error("Mask value must be an integer but got "+e)}function by(e){var t=e.shape[2],n=Il(e,2),r=Xl(n,[-1]);return Su(r,t)}function vy(e,t){return oi((function(){return Ks(pp(e,Di(t)),"int32")}))}function wy(e,t){var n=t.shape,r=n[0],a=n[1],o=n[2];return oi((function(){var n=by(t),s=op(bd(0,o,1,"int32"),1),i=Ks(ku(n,s),"int32"),u=Xl(i,[r,a]),l=bi(u,Di(1,"int32"));return Wi(function(e,t){return xi(e,t)}(l,e),Di(1,"int32"))}))}var xy=function(){function e(e,t){this.model=e,this.outputStride=t;var n=this.model.inputs[0].shape;X(-1===n[1]&&-1===n[2],(function(){return"Input shape ["+n[1]+", "+n[2]+"] must both be equal to or -1"}))}return e.prototype.predict=function(e){var t=this;return oi((function(){var n=t.preprocessInput(Ks(e,"float32")),r=op(n,0),a=t.model.predict(r).map((function(e){return qd(e,[0])})),o=t.nameOutputResults(a);return{heatmapScores:tc(o.heatmap),offsets:o.offsets,displacementFwd:o.displacementFwd,displacementBwd:o.displacementBwd,segmentation:o.segmentation,partHeatmaps:o.partHeatmaps,longOffsets:o.longOffsets,partOffsets:o.partOffsets}}))},e.prototype.dispose=function(){this.model.dispose()},e}(),ky=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return ly(t,e),t.prototype.preprocessInput=function(e){return oi((function(){return Wi(wi(e,127.5),1)}))},t.prototype.nameOutputResults=function(e){return{offsets:e[0],segmentation:e[1],partHeatmaps:e[2],longOffsets:e[3],heatmap:e[4],displacementFwd:e[5],displacementBwd:e[6],partOffsets:e[7]}},t}(xy),Sy=["nose","leftEye","rightEye","leftEar","rightEar","leftShoulder","rightShoulder","leftElbow","rightElbow","leftWrist","rightWrist","leftHip","rightHip","leftKnee","rightKnee","leftAnkle","rightAnkle"],Ey=Sy.length,Ny=Sy.reduce((function(e,t,n){return e[t]=n,e}),{});function Ty(e,t,n){var r=e[0],a=e[1],o=t[0],s=t[1],i=n.top,u=n.bottom;return[s/(n.left+n.right+a),o/(i+u+r)]}function _y(e,t,n,r){return{y:r.get(e,t,n),x:r.get(e,t,n+Ey)}}function Ay(e,t,n){var r=_y(e.heatmapY,e.heatmapX,e.id,n),a=r.y,o=r.x;return{x:e.heatmapX*t+o,y:e.heatmapY*t+a}}function Iy(e,t,n){return e<t?t:e>n?n:e}function My(e,t){return{x:e.x+t.x,y:e.y+t.y}}function Oy(e,t,n){void 0===n&&(n=.3);for(var r=0,a=0,o=0;o<e.length;o++)t.keypoints[o].score>n&&(a+=1,r+=Math.pow(e[o].x-t.keypoints[o].position.x,2)+Math.pow(e[o].y-t.keypoints[o].position.y,2));return 0===a?r=1/0:r/=a,r}function Dy(e,t,n,r,a,o,s){for(var i=s[0],u=s[1],l=n(e),c=l.y*r+l.x,p=a[Ey*(2*c)+t],d=a[Ey*(2*c+1)+t],f=e.y+p,h=e.x+d,m=0;m<o;m++){f=Math.min(f,i-1);var g=n({x:h=Math.min(h,u-1),y:f}),y=g.y*r+g.x;f+=p=a[Ey*(2*y)+t],h+=d=a[Ey*(2*y+1)+t]}return{x:h,y:f}}function Cy(e,t,n,r,a,o,s,i,u,l){for(var c=a[0],p=a[1],d=o[0],f=o[1],h=i[0],m=i[1],g=[],y=function(e){return function(e,t,n,r){var a=t[0],o=t[1],s=n[0],i=n[1],u=Math.round(((a+e.y+1)*i-1)/r);return{x:Math.round(((o+e.x+1)*s-1)/r),y:u}}(e,[c,p],[d,f],u)},b=0;b<r;b++){var v=Dy(e,b,y,s,t,l,[h,m]);g.push(v)}for(var w=-1,x=1/0,k=0;k<n.length;k++){var S=Oy(g,n[k]);S<x&&(w=k,x=S)}return w}function $y(e,t){var n=e[0],r=e[1];return[Math.round((r-1)/t+1),Math.round((n-1)/t+1)]}function Ry(e,t,n,r,a,o,s,i,u,l,c){for(var p=s[0],d=s[1],f=e.shape,h=f[0],m=f[1],g=t.shape.slice(0,2),y=g[0],b=g[1],v=Xl(t,[y,b,2,Ey]),w=new Float32Array(c*Ey*3).fill(0),x=0;x<n.length;x++)for(var k=x*Ey*3,S=n[x],E=0;E<Ey;E++){var N=S.keypoints[E],T=k+3*E;w[T]=N.score,w[T+1]=N.position.y,w[T+2]=N.position.x}var _=Ty([r,a],[p,d],i),A=_[0],I=_[1],M=qo(w,[c,Ey,3]),O=i.top,D=i.left,C={variableNames:["segmentation","longOffsets","poses"],outputShape:[h,m],userCode:"\n    int convertToPositionInOutput(int pos, int pad, float scale, int stride) {\n      return round(((float(pos + pad) + 1.0) * scale - 1.0) / float(stride));\n    }\n\n    float convertToPositionInOutputFloat(\n        int pos, int pad, float scale, int stride) {\n      return ((float(pos + pad) + 1.0) * scale - 1.0) / float(stride);\n    }\n\n    float dist(float x1, float y1, float x2, float y2) {\n      return pow(x1 - x2, 2.0) + pow(y1 - y2, 2.0);\n    }\n\n    float sampleLongOffsets(float h, float w, int d, int k) {\n      float fh = fract(h);\n      float fw = fract(w);\n      int clH = int(ceil(h));\n      int clW = int(ceil(w));\n      int flH = int(floor(h));\n      int flW = int(floor(w));\n      float o11 = getLongOffsets(flH, flW, d, k);\n      float o12 = getLongOffsets(flH, clW, d, k);\n      float o21 = getLongOffsets(clH, flW, d, k);\n      float o22 = getLongOffsets(clH, clW, d, k);\n      float o1 = mix(o11, o12, fw);\n      float o2 = mix(o21, o22, fw);\n      return mix(o1, o2, fh);\n    }\n\n    int findNearestPose(int h, int w) {\n      float prob = getSegmentation(h, w);\n      if (prob < 1.0) {\n        return -1;\n      }\n\n      // Done(Tyler): convert from output space h/w to strided space.\n      float stridedH = convertToPositionInOutputFloat(\n        h, "+O+", "+I+", "+o+");\n      float stridedW = convertToPositionInOutputFloat(\n        w, "+D+", "+A+", "+o+");\n\n      float minDist = 1000000.0;\n      int iMin = -1;\n      for (int i = 0; i < "+c+"; i++) {\n        float curDistSum = 0.0;\n        int numKpt = 0;\n        for (int k = 0; k < "+Ey+"; k++) {\n          float dy = sampleLongOffsets(stridedH, stridedW, 0, k);\n          float dx = sampleLongOffsets(stridedH, stridedW, 1, k);\n\n          float y = float(h) + dy;\n          float x = float(w) + dx;\n\n          for (int s = 0; s < "+u+"; s++) {\n            int yRounded = round(min(y, float("+(r-1)+")));\n            int xRounded = round(min(x, float("+(a-1)+")));\n\n            float yStrided = convertToPositionInOutputFloat(\n              yRounded, "+O+", "+I+", "+o+");\n            float xStrided = convertToPositionInOutputFloat(\n              xRounded, "+D+", "+A+", "+o+");\n\n            float dy = sampleLongOffsets(yStrided, xStrided, 0, k);\n            float dx = sampleLongOffsets(yStrided, xStrided, 1, k);\n\n            y = y + dy;\n            x = x + dx;\n          }\n\n          float poseScore = getPoses(i, k, 0);\n          float poseY = getPoses(i, k, 1);\n          float poseX = getPoses(i, k, 2);\n          if (poseScore > "+l+") {\n            numKpt = numKpt + 1;\n            curDistSum = curDistSum + dist(x, y, poseX, poseY);\n          }\n        }\n        if (numKpt > 0 && curDistSum / float(numKpt) < minDist) {\n          minDist = curDistSum / float(numKpt);\n          iMin = i;\n        }\n      }\n      return iMin;\n    }\n\n    void main() {\n        ivec2 coords = getOutputCoords();\n        int nearestPose = findNearestPose(coords[0], coords[1]);\n        setOutput(float(nearestPose));\n      }\n  "};return gi().compileAndRun(C,[e,v,M])}function Fy(){return"webgl"===pi()}function Py(e,t,n,r,a,o,s,i,u,l,c,p){var d=s[0],f=s[1];return void 0===u&&(u=.2),void 0===l&&(l=8),void 0===c&&(c=.3),void 0===p&&(p=10),py(this,void 0,void 0,(function(){var s,h,m,g,y;return dy(this,(function(b){switch(b.label){case 0:return s=n.filter((function(e){return e.score>=u})),Fy()?(m=oi((function(){var n=Ry(e,t,s,r,a,o,[d,f],i,l,c,p),u=ni().makeTensorFromDataId(n.dataId,n.shape,n.dtype);return s.map((function(e,t){return function(e,t){return oi((function(){return Ks(Fc(e,Di(t)),"int32")}))}(u,t)}))})),[4,Promise.all(m.map((function(e){return e.data()})))]):[3,2];case 1:return h=b.sent(),m.forEach((function(e){return e.dispose()})),[3,5];case 2:return[4,e.data()];case 3:return g=b.sent(),[4,t.data()];case 4:y=b.sent(),h=function(e,t,n,r,a,o,s,i,u,l){var c=s[0],p=s[1];void 0===l&&(l=5);for(var d=n.map((function(e){return new Uint8Array(r*a).fill(0)})),f=i.top,h=i.left,m=Ty([r,a],[c,p],i),g=m[0],y=m[1],b=$y([c,p],o)[0],v=0;v<r;v+=1)for(var w=0;w<a;w+=1){var x=v*a+w;if(1===e[x]){var k=Cy({x:w,y:v},t,n,l,[f,h],[g,y],b,[r,a],o,u);k>=0&&(d[k][x]=1)}}return d}(g,y,s,r,a,o,[d,f],i,l),b.label=5;case 5:return[2,h.map((function(e,t){return{data:e,pose:s[t],width:a,height:r}}))]}}))}))}function Ly(e,t,n,r,a,o,s,i,u,l,c,p,d){var f=i[0],h=i[1];return void 0===l&&(l=.2),void 0===c&&(c=8),void 0===p&&(p=.3),void 0===d&&(d=10),py(this,void 0,void 0,(function(){var i,m,g,y,b,v;return dy(this,(function(w){switch(w.label){case 0:return i=r.filter((function(e){return e.score>=l})),Fy()?(g=oi((function(){var r=Ry(e,t,i,a,o,s,[f,h],u,c,p,d),l=ni().makeTensorFromDataId(r.dataId,r.shape,r.dtype);return i.map((function(e,t){return function(e,t,n){return oi((function(){return Wi(xi(Ks(Fc(e,Di(n)),"int32"),bi(t,1)),1)}))}(l,n,t)}))})),[4,Promise.all(g.map((function(e){return e.data()})))]):[3,2];case 1:return m=w.sent(),g.forEach((function(e){return e.dispose()})),[3,6];case 2:return[4,e.data()];case 3:return y=w.sent(),[4,t.data()];case 4:return b=w.sent(),[4,n.data()];case 5:v=w.sent(),m=function(e,t,n,r,a,o,s,i,u,l,c){var p=i[0],d=i[1];void 0===c&&(c=5);for(var f=r.map((function(e){return new Int32Array(a*o).fill(-1)})),h=u.top,m=u.left,g=Ty([a,o],[p,d],u),y=g[0],b=g[1],v=$y([p,d],s)[0],w=0;w<a;w+=1)for(var x=0;x<o;x+=1){var k=w*o+x;if(1===e[k]){var S=Cy({x,y:w},t,r,c,[h,m],[y,b],v,[a,o],s,l);S>=0&&(f[S][k]=n[k])}}return f}(y,b,v,i,a,o,s,[f,h],u,c),w.label=6;case 6:return[2,m.map((function(e,t){return{pose:i[t],data:e,height:a,width:o}}))]}}))}))}function zy(e){return Math.floor(e/2)}[["leftHip","leftShoulder"],["leftElbow","leftShoulder"],["leftElbow","leftWrist"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["rightHip","rightShoulder"],["rightElbow","rightShoulder"],["rightElbow","rightWrist"],["rightHip","rightKnee"],["rightKnee","rightAnkle"],["leftShoulder","rightShoulder"],["leftHip","rightHip"]].map((function(e){var t=e[0],n=e[1];return[Ny[t],Ny[n]]}));var By=function(){function e(e,t){this.priorityQueue=new Array(e),this.numberOfElements=-1,this.getElementValue=t}return e.prototype.enqueue=function(e){this.priorityQueue[++this.numberOfElements]=e,this.swim(this.numberOfElements)},e.prototype.dequeue=function(){var e=this.priorityQueue[0];return this.exchange(0,this.numberOfElements--),this.sink(0),this.priorityQueue[this.numberOfElements+1]=null,e},e.prototype.empty=function(){return-1===this.numberOfElements},e.prototype.size=function(){return this.numberOfElements+1},e.prototype.all=function(){return this.priorityQueue.slice(0,this.numberOfElements+1)},e.prototype.max=function(){return this.priorityQueue[0]},e.prototype.swim=function(e){for(;e>0&&this.less(zy(e),e);)this.exchange(e,zy(e)),e=zy(e)},e.prototype.sink=function(e){for(;2*e<=this.numberOfElements;){var t=2*e;if(t<this.numberOfElements&&this.less(t,t+1)&&t++,!this.less(e,t))break;this.exchange(e,t),e=t}},e.prototype.getValueAt=function(e){return this.getElementValue(this.priorityQueue[e])},e.prototype.less=function(e,t){return this.getValueAt(e)<this.getValueAt(t)},e.prototype.exchange=function(e,t){var n=this.priorityQueue[e];this.priorityQueue[e]=this.priorityQueue[t],this.priorityQueue[t]=n},e}();function Vy(e,t,n,r,a,o){for(var s=o.shape,i=s[0],u=s[1],l=!0,c=Math.max(n-a,0),p=Math.min(n+a+1,i),d=c;d<p;++d){for(var f=Math.max(r-a,0),h=Math.min(r+a+1,u),m=f;m<h;++m)if(o.get(d,m,e)>t){l=!1;break}if(!l)break}return l}var Uy=[["nose","leftEye"],["leftEye","leftEar"],["nose","rightEye"],["rightEye","rightEar"],["nose","leftShoulder"],["leftShoulder","leftElbow"],["leftElbow","leftWrist"],["leftShoulder","leftHip"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],["nose","rightShoulder"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],["rightShoulder","rightHip"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]].map((function(e){var t=e[0],n=e[1];return[Ny[t],Ny[n]]})),jy=Uy.map((function(e){return e[1]})),Wy=Uy.map((function(e){return e[0]}));function Hy(e,t,n,r){return{y:Iy(Math.round(e.y/t),0,n-1),x:Iy(Math.round(e.x/t),0,r-1)}}function qy(e,t,n,r,a,o,s,i){void 0===i&&(i=2);for(var u=r.shape,l=u[0],c=u[1],p=function(e,t,n){var r=n.shape[2]/2;return{y:n.get(t.y,t.x,e),x:n.get(t.y,t.x,r+e)}}(e,Hy(t.position,o,l,c),s),d=My(t.position,p),f=0;f<i;f++){var h=Hy(d,o,l,c),m=_y(h.y,h.x,n,a);d=My({x:h.x*o,y:h.y*o},{x:m.x,y:m.y})}var g=Hy(d,o,l,c),y=r.get(g.y,g.x,n);return{position:d,part:Sy[n],score:y}}function Gy(e,t,n,r,a,o){var s=t.shape[2],i=jy.length,u=new Array(s),l=e.part,c=e.score,p=Ay(l,r,n);u[l.id]={score:c,part:Sy[l.id],position:p};for(var d=i-1;d>=0;--d){var f=jy[d],h=Wy[d];u[f]&&!u[h]&&(u[h]=qy(d,u[f],h,t,n,r,o))}for(d=0;d<i;++d)f=Wy[d],h=jy[d],u[f]&&!u[h]&&(u[h]=qy(d,u[f],h,t,n,r,a));return u}function Ky(e,t,n,r){var a=n.x,o=n.y;return e.some((function(e){var n,s,i,u,l=e.keypoints[r].position;return n=o,s=a,(i=l.y-n)*i+(u=l.x-s)*u<=t}))}function Qy(e,t,n){var r=n.reduce((function(n,r,a){var o=r.position,s=r.score;return Ky(e,t,o,a)||(n+=s),n}),0);return r/n.length}function Yy(e,t,n,r,a,o,s,i){void 0===s&&(s=.5),void 0===i&&(i=20);for(var u=[],l=function(e,t,n){for(var r=n.shape,a=r[0],o=r[1],s=r[2],i=new By(a*o*s,(function(e){return e.score})),u=0;u<a;++u)for(var l=0;l<o;++l)for(var c=0;c<s;++c){var p=n.get(u,l,c);p<e||Vy(c,p,u,l,1,n)&&i.enqueue({score:p,part:{heatmapY:u,heatmapX:l,id:c}})}return i}(s,0,e),c=i*i;u.length<o&&!l.empty();){var p=l.dequeue();if(!Ky(u,c,Ay(p.part,a,t),p.part.id)){var d=Gy(p,e,t,a,n,r),f=Qy(u,c,d);u.push({keypoints:d,score:f})}}return u}var Xy,Zy=[-123.15,-115.9,-103.06],Jy=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return ly(t,e),t.prototype.preprocessInput=function(e){return bi(e,Zy)},t.prototype.nameOutputResults=function(e){var t=e[0],n=e[1],r=e[2],a=e[3],o=e[4],s=e[5];return{offsets:o,segmentation:e[6],partHeatmaps:s,longOffsets:a,heatmap:r,displacementFwd:n,displacementBwd:t,partOffsets:e[7]}},t}(xy),eb="https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/resnet50/",tb="https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/";function nb(e){if("undefined"!=typeof HTMLCanvasElement&&e instanceof HTMLCanvasElement||"undefined"!=typeof OffscreenCanvas&&e instanceof OffscreenCanvas||"undefined"!=typeof HTMLImageElement&&e instanceof HTMLImageElement)return function(e){if("offsetHeight"in e&&0!==e.offsetHeight&&"offsetWidth"in e&&0!==e.offsetWidth)return[e.offsetHeight,e.offsetWidth];if(null!=e.height&&null!=e.width)return[e.height,e.width];throw new Error("HTMLImageElement must have height and width attributes set.")}(e);if("undefined"!=typeof ImageData&&e instanceof ImageData)return[e.height,e.width];if("undefined"!=typeof HTMLVideoElement&&e instanceof HTMLVideoElement)return function(e){return e.hasAttribute("height")&&e.hasAttribute("width")?[e.height,e.width]:[e.videoHeight,e.videoWidth]}(e);if(e instanceof io)return[e.shape[0],e.shape[1]];throw new Error("error: Unknown input type: "+e+".")}function rb(e,t){return function(e,t){return(e-1)%t==0}(e,t)?e:Math.floor(e/t)*t+1}var ab={low:"low",medium:"medium",high:"high",full:"full"},ob=((Xy={})[ab.low]=.25,Xy[ab.medium]=.5,Xy[ab.high]=.75,Xy[ab.full]=1,Xy);function sb(e,t,n){var r=n[0],a=n[1],o=function(e){if("string"==typeof e){var t=ob[e];return X("number"==typeof t,(function(){return"string value of inputResolution must be one of "+Object.values(ab).join(",")+" but was "+e+"."})),t}return X("number"==typeof e&&e<=2&&e>=.1,(function(){return"inputResolution must be a string or number between 0.1 and 2, but was "+e})),e}(e);return[rb(r*o,t),rb(a*o,t)]}function ib(e,t,n,r,a){var o=t[0],s=t[1],i=n[0],u=n[1],l=r[0],c=l[0],p=l[1],d=r[1],f=d[0],h=d[1];return void 0===a&&(a=!1),oi((function(){var t=Ah.resizeBilinear(e,[i,u],!0);return a&&(t=tc(t)),function(e,t,n){var r=t[0],a=t[1],o=n[0],s=o[0],i=o[1],u=n[1],l=u[0],c=u[1];return oi((function(){var t=op(e);return qd(Ah.cropAndResize(t,[[s/(r+s+i-1),l/(a+l+c-1),(s+r-1)/(r+s+i-1),(l+a-1)/(a+l+c-1)]],[0],[r,a]),[0])}))}(t,[o,s],[[c,p],[f,h]])}))}function ub(e,t){var n=t[0],r=t[1],a=nb(e),o=a[0],s=a[1],i=r/n,u=[0,0,0,0],l=u[0],c=u[1],p=u[2],d=u[3];s/o<i?(l=0,c=0,p=Math.round(.5*(i*o-s)),d=Math.round(.5*(i*o-s))):(l=Math.round(.5*(1/i*s-o)),c=Math.round(.5*(1/i*s-o)),p=0,d=0);var f=oi((function(){var t=function(e){return e instanceof io?e:Lu(e)}(e);return t=Jp(t,[[l,c],[p,d],[0,0]]),Ah.resizeBilinear(t,[n,r])}));return{resized:f,padding:{top:l,left:p,right:d,bottom:c}}}function lb(e){return py(this,void 0,void 0,(function(){return dy(this,(function(t){return[2,Promise.all(e.map((function(e){return e.buffer()})))]}))}))}function cb(e,t,n,r,a){var o=t[0],s=t[1],i=n[0],u=n[1],l=function(e,t,n,r,a){return void 0===r&&(r=0),void 0===a&&(a=0),1===n&&1===t&&0===r&&0===a?e:e.map((function(e){return function(e,t,n,r,a){return void 0===r&&(r=0),void 0===a&&(a=0),{score:e.score,keypoints:e.keypoints.map((function(e){var o=e.score,s=e.part,i=e.position;return{score:o,part:s,position:{x:i.x*n+a,y:i.y*t+r}}}))}}(e,t,n,r,a)}))}(e,(o+r.top+r.bottom)/i,(s+r.left+r.right)/u,-r.top,-r.left);return a?function(e,t){return t<=0?e:e.map((function(e){return function(e,t){return{score:e.score,keypoints:e.keypoints.map((function(e){var n=e.score,r=e.part,a=e.position;return{score:n,part:r,position:{x:t-1-a.x,y:a.y}}}))}}(e,t)}))}(l,s):l}var pb={architecture:"MobileNetV1",outputStride:16,quantBytes:4,multiplier:.75},db=["MobileNetV1","ResNet50"],fb={MobileNetV1:[8,16,32],ResNet50:[32,16]},hb={MobileNetV1:[.5,.75,1],ResNet50:[1]},mb=[1,2,4],gb={flipHorizontal:!1,internalResolution:"medium",segmentationThreshold:.7,maxDetections:10,scoreThreshold:.4,nmsRadius:20},yb={flipHorizontal:!1,internalResolution:"medium",segmentationThreshold:.7,maxDetections:10,scoreThreshold:.4,nmsRadius:20,minKeypointScore:.3,refineSteps:10};function bb(e){var t=e.segmentationThreshold,n=e.maxDetections,r=e.scoreThreshold,a=e.nmsRadius;if(t<0||t>1)throw new Error("segmentationThreshold "+t+". Should be in range [0.0, 1.0]");if(n<=0)throw new Error("Invalid maxDetections "+n+". Should be > 0");if(r<0||r>1)throw new Error("Invalid scoreThreshold "+r+". Should be in range [0.0, 1.0]");if(a<=0)throw new Error("Invalid nmsRadius "+a+".")}function vb(e){var t=e.segmentationThreshold,n=e.maxDetections,r=e.scoreThreshold,a=e.nmsRadius,o=e.minKeypointScore,s=e.refineSteps;if(t<0||t>1)throw new Error("segmentationThreshold "+t+". Should be in range [0.0, 1.0]");if(n<=0)throw new Error("Invalid maxDetections "+n+". Should be > 0");if(r<0||r>1)throw new Error("Invalid scoreThreshold "+r+". Should be in range [0.0, 1.0]");if(a<=0)throw new Error("Invalid nmsRadius "+a+".");if(o<0||o>1)throw new Error("Invalid minKeypointScore "+o+".Should be in range [0.0, 1.0]");if(s<=0||s>20)throw new Error("Invalid refineSteps "+s+".Should be in range [1, 20]")}var wb=function(){function e(e){this.baseModel=e}return e.prototype.predictForPersonSegmentation=function(e){var t=this.baseModel.predict(e);return{segmentLogits:t.segmentation,heatmapScores:t.heatmapScores,offsets:t.offsets,displacementFwd:t.displacementFwd,displacementBwd:t.displacementBwd}},e.prototype.predictForPersonSegmentationAndPart=function(e){var t=this.baseModel.predict(e);return{segmentLogits:t.segmentation,partHeatmapLogits:t.partHeatmaps,heatmapScores:t.heatmapScores,offsets:t.offsets,displacementFwd:t.displacementFwd,displacementBwd:t.displacementBwd}},e.prototype.predictForMultiPersonInstanceSegmentationAndPart=function(e){var t=this.baseModel.predict(e);return{segmentLogits:t.segmentation,longOffsets:t.longOffsets,heatmapScores:t.heatmapScores,offsets:t.offsets,displacementFwd:t.displacementFwd,displacementBwd:t.displacementBwd,partHeatmaps:t.partHeatmaps}},e.prototype.segmentPersonActivation=function(e,t,n){var r=this;void 0===n&&(n=.5);var a=nb(e),o=a[0],s=a[1],i=sb(t,this.baseModel.outputStride,[o,s]),u=ub(e,i),l=u.resized,c=u.padding,p=oi((function(){var e=r.predictForPersonSegmentation(l),t=e.segmentLogits,a=e.heatmapScores,i=e.offsets,u=e.displacementFwd,p=e.displacementBwd,d=l.shape,f=d[0],h=d[1],m=ib(t,[o,s],[f,h],[[c.top,c.bottom],[c.left,c.right]],!0);return{segmentation:vy(qd(m),n),heatmapScores:a,offsets:i,displacementFwd:u,displacementBwd:p}})),d=p.segmentation,f=p.heatmapScores,h=p.offsets,m=p.displacementFwd,g=p.displacementBwd;return l.dispose(),{segmentation:d,heatmapScores:f,offsets:h,displacementFwd:m,displacementBwd:g,padding:c,internalResolutionHeightAndWidth:i}},e.prototype.segmentPerson=function(e,t){return void 0===t&&(t=gb),py(this,void 0,void 0,(function(){var n,r,a,o,s,i,u,l,c,p,d,f,h,m,g,y,b,v;return dy(this,(function(w){switch(w.label){case 0:return bb(t=cy(cy({},gb),t)),n=this.segmentPersonActivation(e,t.internalResolution,t.segmentationThreshold),r=n.segmentation,a=n.heatmapScores,o=n.offsets,s=n.displacementFwd,i=n.displacementBwd,u=n.padding,l=n.internalResolutionHeightAndWidth,c=r.shape,p=c[0],d=c[1],[4,r.data()];case 1:return f=w.sent(),r.dispose(),[4,lb([a,o,s,i])];case 2:return h=w.sent(),m=h[0],g=h[1],y=h[2],b=h[3],v=cb(v=Yy(m,g,y,b,this.baseModel.outputStride,t.maxDetections,t.scoreThreshold,t.nmsRadius),[p,d],l,u,!1),a.dispose(),o.dispose(),s.dispose(),i.dispose(),[2,{height:p,width:d,data:f,allPoses:v}]}}))}))},e.prototype.segmentMultiPerson=function(e,t){return void 0===t&&(t=yb),py(this,void 0,void 0,(function(){var n,r,a,o,s,i,u,l,c,p,d,f,h,m,g,y,b,v,w,x,k,S=this;return dy(this,(function(E){switch(E.label){case 0:return vb(t=cy(cy({},yb),t)),n=nb(e),r=n[0],a=n[1],o=sb(t.internalResolution,this.baseModel.outputStride,[r,a]),s=ub(e,o),i=s.resized,u=s.padding,l=oi((function(){var e,n=S.predictForMultiPersonInstanceSegmentationAndPart(i),s=n.segmentLogits,l=n.longOffsets,c=n.heatmapScores,p=n.offsets,d=n.displacementFwd,f=n.displacementBwd,h=ib(s,[r,a],o,[[u.top,u.bottom],[u.left,u.right]],!0);return e=l,{segmentation:vy(qd(h),t.segmentationThreshold),longOffsets:e,heatmapScoresRaw:c,offsetsRaw:p,displacementFwdRaw:d,displacementBwdRaw:f}})),c=l.segmentation,p=l.longOffsets,d=l.heatmapScoresRaw,f=l.offsetsRaw,h=l.displacementFwdRaw,m=l.displacementBwdRaw,[4,lb([d,f,h,m])];case 1:return g=E.sent(),y=g[0],b=g[1],v=g[2],w=g[3],x=cb(x=Yy(y,b,v,w,this.baseModel.outputStride,t.maxDetections,t.scoreThreshold,t.nmsRadius),[r,a],o,u,!1),[4,Py(c,p,x,r,a,this.baseModel.outputStride,o,u,t.scoreThreshold,t.refineSteps,t.minKeypointScore,t.maxDetections)];case 2:return k=E.sent(),i.dispose(),c.dispose(),p.dispose(),d.dispose(),f.dispose(),h.dispose(),m.dispose(),[2,k]}}))}))},e.prototype.segmentPersonPartsActivation=function(e,t,n){var r=this;void 0===n&&(n=.5);var a=nb(e),o=a[0],s=a[1],i=sb(t,this.baseModel.outputStride,[o,s]),u=ub(e,i),l=u.resized,c=u.padding,p=oi((function(){var e=r.predictForPersonSegmentationAndPart(l),t=e.segmentLogits,a=e.partHeatmapLogits,i=e.heatmapScores,u=e.offsets,p=e.displacementFwd,d=e.displacementBwd,f=l.shape,h=f[0],m=f[1],g=ib(t,[o,s],[h,m],[[c.top,c.bottom],[c.left,c.right]],!0),y=ib(a,[o,s],[h,m],[[c.top,c.bottom],[c.left,c.right]],!0);return{partSegmentation:wy(vy(qd(g),n),y),heatmapScores:i,offsets:u,displacementFwd:p,displacementBwd:d}})),d=p.partSegmentation,f=p.heatmapScores,h=p.offsets,m=p.displacementFwd,g=p.displacementBwd;return l.dispose(),{partSegmentation:d,heatmapScores:f,offsets:h,displacementFwd:m,displacementBwd:g,padding:c,internalResolutionHeightAndWidth:i}},e.prototype.segmentPersonParts=function(e,t){return void 0===t&&(t=gb),py(this,void 0,void 0,(function(){var n,r,a,o,s,i,u,l,c,p,d,f,h,m,g,y,b,v;return dy(this,(function(w){switch(w.label){case 0:return bb(t=cy(cy({},gb),t)),n=this.segmentPersonPartsActivation(e,t.internalResolution,t.segmentationThreshold),r=n.partSegmentation,a=n.heatmapScores,o=n.offsets,s=n.displacementFwd,i=n.displacementBwd,u=n.padding,l=n.internalResolutionHeightAndWidth,c=r.shape,p=c[0],d=c[1],[4,r.data()];case 1:return f=w.sent(),r.dispose(),[4,lb([a,o,s,i])];case 2:return h=w.sent(),m=h[0],g=h[1],y=h[2],b=h[3],v=cb(v=Yy(m,g,y,b,this.baseModel.outputStride,t.maxDetections,t.scoreThreshold,t.nmsRadius),[p,d],l,u,!1),a.dispose(),o.dispose(),s.dispose(),i.dispose(),[2,{height:p,width:d,data:f,allPoses:v}]}}))}))},e.prototype.segmentMultiPersonParts=function(e,t){return void 0===t&&(t=yb),py(this,void 0,void 0,(function(){var n,r,a,o,s,i,u,l,c,p,d,f,h,m,g,y,b,v,w,x,k,S,E=this;return dy(this,(function(N){switch(N.label){case 0:return vb(t=cy(cy({},yb),t)),n=nb(e),r=n[0],a=n[1],o=sb(t.internalResolution,this.baseModel.outputStride,[r,a]),s=ub(e,o),i=s.resized,u=s.padding,l=oi((function(){var e=E.predictForMultiPersonInstanceSegmentationAndPart(i),n=e.segmentLogits,s=e.longOffsets,l=e.heatmapScores,c=e.offsets,p=e.displacementFwd,d=e.displacementBwd,f=e.partHeatmaps,h=ib(n,[r,a],o,[[u.top,u.bottom],[u.left,u.right]],!0),m=ib(f,[r,a],o,[[u.top,u.bottom],[u.left,u.right]],!0),g=s,y=vy(qd(h),t.segmentationThreshold),b=function(e){var t=e.shape,n=t[0],r=t[1],a=t[2];return oi((function(){var t=by(e),o=op(bd(0,a,1,"int32"),1),s=Ks(ku(t,o),"int32");return Xl(s,[n,r])}))}(m);return{segmentation:y,longOffsets:g,heatmapScoresRaw:l,offsetsRaw:c,displacementFwdRaw:p,displacementBwdRaw:d,partSegmentation:b}})),c=l.segmentation,p=l.longOffsets,d=l.heatmapScoresRaw,f=l.offsetsRaw,h=l.displacementFwdRaw,m=l.displacementBwdRaw,g=l.partSegmentation,[4,lb([d,f,h,m])];case 1:return y=N.sent(),b=y[0],v=y[1],w=y[2],x=y[3],k=cb(k=Yy(b,v,w,x,this.baseModel.outputStride,t.maxDetections,t.scoreThreshold,t.nmsRadius),[r,a],o,u,!1),[4,Ly(c,p,g,k,r,a,this.baseModel.outputStride,o,u,t.scoreThreshold,t.refineSteps,t.minKeypointScore,t.maxDetections)];case 2:return S=N.sent(),i.dispose(),c.dispose(),p.dispose(),d.dispose(),f.dispose(),h.dispose(),m.dispose(),g.dispose(),[2,S]}}))}))},e.prototype.dispose=function(){this.baseModel.dispose()},e}();function xb(e){return py(this,void 0,void 0,(function(){var t,n,r,a,o,s;return dy(this,(function(i){switch(i.label){case 0:if(t=e.outputStride,n=e.quantBytes,r=e.multiplier,null==y)throw new Error("Cannot find TensorFlow.js. If you are using a <script> tag, please also include @tensorflow/tfjs on the page before using this\n        model.");return a=function(e,t,n){var r={1:"100",.75:"075",.5:"050"},a="model-stride"+e+".json";return 4===n?tb+"float/"+r[t]+"/"+a:tb+"quant"+n+"/"+r[t]+"/"+a}(t,r,n),[4,sy(e.modelUrl||a)];case 1:return o=i.sent(),s=new ky(o,t),[2,new wb(s)]}}))}))}function kb(e){return py(this,void 0,void 0,(function(){var t,n,r,a,o;return dy(this,(function(s){switch(s.label){case 0:if(t=e.outputStride,n=e.quantBytes,null==y)throw new Error("Cannot find TensorFlow.js. If you are using a <script> tag, please also include @tensorflow/tfjs on the page before using this\n        model.");return r=function(e,t){var n="model-stride"+e+".json";return 4===t?eb+"float/"+n:eb+"quant"+t+"/"+n}(t,n),[4,sy(e.modelUrl||r)];case 1:return a=s.sent(),o=new Jy(a,t),[2,new wb(o)]}}))}))}function Sb(e){return void 0===e&&(e=pb),py(this,void 0,void 0,(function(){return dy(this,(function(t){return"ResNet50"===(e=function(e){if(null==(e=e||pb).architecture&&(e.architecture="MobileNetV1"),db.indexOf(e.architecture)<0)throw new Error("Invalid architecture "+e.architecture+". Should be one of "+db);if(null==e.outputStride&&(e.outputStride=16),fb[e.architecture].indexOf(e.outputStride)<0)throw new Error("Invalid outputStride "+e.outputStride+". Should be one of "+fb[e.architecture]+" for architecture "+e.architecture+".");if(null==e.multiplier&&(e.multiplier=1),hb[e.architecture].indexOf(e.multiplier)<0)throw new Error("Invalid multiplier "+e.multiplier+". Should be one of "+hb[e.architecture]+" for architecture "+e.architecture+".");if(null==e.quantBytes&&(e.quantBytes=4),mb.indexOf(e.quantBytes)<0)throw new Error("Invalid quantBytes "+e.quantBytes+". Should be one of "+mb+" for architecture "+e.architecture+".");return e}(e)).architecture?[2,kb(e)]:"MobileNetV1"===e.architecture?[2,xb(e)]:[2,null]}))}))}var Eb=["left_face","right_face","left_upper_arm_front","left_upper_arm_back","right_upper_arm_front","right_upper_arm_back","left_lower_arm_front","left_lower_arm_back","right_lower_arm_front","right_lower_arm_back","left_hand","right_hand","torso_front","torso_back","left_upper_leg_front","left_upper_leg_back","right_upper_leg_front","right_upper_leg_back","left_lower_leg_front","left_lower_leg_back","right_lower_leg_front","right_lower_leg_back","left_feet","right_feet"],Nb=function(){function e(e){this.mask=e}return e.prototype.toCanvasImageSource=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,hy(this.mask)]}))}))},e.prototype.toImageData=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,this.mask]}))}))},e.prototype.toTensor=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,gy(this.mask)]}))}))},e.prototype.getUnderlyingType=function(){return"imagedata"},e}();function Tb(e){if(yy(e),255!==e)throw new Error("Foreground id must be 255 but got "+e);return"person"}function _b(e){if(yy(e),e>=Eb.length)throw new Error("Invalid body part value "+e);return Eb[e]}var Ab=function(){function e(e){this.bodyPixModel=e}return e.prototype.segmentPeople=function(e,t){return py(this,void 0,void 0,(function(){var n,r,a,o;return dy(this,(function(s){switch(s.label){case 0:return e instanceof ImageBitmap&&((n=document.createElement("canvas")).getContext("2d").drawImage(e,0,0),e=n),t.segmentBodyParts?t.multiSegmentation?[4,this.bodyPixModel.segmentMultiPersonParts(e,t)]:[3,2]:[3,5];case 1:return a=s.sent(),[3,4];case 2:return[4,this.bodyPixModel.segmentPersonParts(e,t)];case 3:a=[s.sent()],s.label=4;case 4:return r=a.map((function(e){var t=e.data,n=e.width,r=e.height,a=new Uint8ClampedArray(n*r*4).fill(0);return t.forEach((function(e,t){-1===e?(a[4*t]=Eb.length,a[4*t+3]=0):(a[4*t]=e,a[4*t+3]=255)})),{maskValueToLabel:_b,mask:new Nb(new ImageData(a,n,r))}})),[3,10];case 5:return t.multiSegmentation?[4,this.bodyPixModel.segmentMultiPerson(e,t)]:[3,7];case 6:return o=s.sent(),[3,9];case 7:return[4,this.bodyPixModel.segmentPerson(e,t)];case 8:o=[s.sent()],s.label=9;case 9:r=o.map((function(e){var t=e.data,n=e.width,r=e.height,a=new Uint8ClampedArray(n*r*4).fill(0);return t.forEach((function(e,t){0===e?(a[4*t]=0,a[4*t+3]=0):(a[4*t]=255,a[4*t+3]=255)})),{maskValueToLabel:Tb,mask:new Nb(new ImageData(a,n,r))}})),s.label=10;case 10:return[2,r]}}))}))},e.prototype.dispose=function(){this.bodyPixModel.dispose()},e.prototype.reset=function(){},e}();function Ib(e){return py(this,void 0,void 0,(function(){return dy(this,(function(t){return[2,Sb(e).then((function(e){return new Ab(e)}))]}))}))}var Mb={runtime:"mediapipe",modelType:"general"},Ob=function(){function e(e){this.mask=e}return e.prototype.toCanvasImageSource=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,this.mask]}))}))},e.prototype.toImageData=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,my(this.mask)]}))}))},e.prototype.toTensor=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,gy(this.mask)]}))}))},e.prototype.getUnderlyingType=function(){return"canvasimagesource"},e}();function Db(e){return yy(e),"person"}var Cb=function(){function e(e){var t,n,r=this;this.selfieMode=!1,this.selfieSegmentationSolution=new iy.SelfieSegmentation({locateFile:null!==(t=e.locateFile)&&void 0!==t?t:function(t,n){return e.solutionPath?e.solutionPath.replace(/\/+$/,"")+"/"+t:n+"/"+t}}),n="landscape"===e.modelType?1:0,this.selfieSegmentationSolution.setOptions({modelSelection:n,selfieMode:this.selfieMode}),this.selfieSegmentationSolution.onResults((function(e){r.segmentation=[{maskValueToLabel:Db,mask:new Ob(e.segmentationMask)}]}))}return e.prototype.segmentPeople=function(e,t){return py(this,void 0,void 0,(function(){var n,r;return dy(this,(function(a){switch(a.label){case 0:return t&&t.flipHorizontal&&t.flipHorizontal!==this.selfieMode&&(this.selfieMode=t.flipHorizontal,this.selfieSegmentationSolution.setOptions({selfieMode:this.selfieMode})),e instanceof io?(r=ImageData.bind,[4,Fu(e)]):[3,2];case 1:return n=new(r.apply(ImageData,[void 0,a.sent(),e.shape[1],e.shape[0]])),[3,3];case 2:n=e,a.label=3;case 3:return e=n,[4,this.selfieSegmentationSolution.send({image:e})];case 4:return a.sent(),[2,this.segmentation]}}))}))},e.prototype.dispose=function(){this.selfieSegmentationSolution.close()},e.prototype.reset=function(){this.selfieSegmentationSolution.reset(),this.segmentation=null,this.selfieMode=!1},e.prototype.initialize=function(){return this.selfieSegmentationSolution.initialize()},e}();function $b(e){return py(this,void 0,void 0,(function(){var t,n;return dy(this,(function(r){switch(r.label){case 0:return t=function(e){if(null==e)return cy({},Mb);var t=cy({},e);return t.runtime="mediapipe",null==t.modelType&&(t.modelType=Mb.modelType),t}(e),[4,(n=new Cb(t)).initialize()];case 1:return r.sent(),[2,n]}}))}))}function Rb(e){return e instanceof io?{height:e.shape[0],width:e.shape[1]}:{height:e.height,width:e.width}}function Fb(e,t){X(0!==e.width,(function(){return t+" width cannot be 0."})),X(0!==e.height,(function(){return t+" height cannot be 0."}))}function Pb(e,t,n){var r=t.outputTensorSize,a=t.keepAspectRatio,o=t.borderMode,s=t.outputTensorFloatRange,i=Rb(e),u=function(e,t){return t?{xCenter:t.xCenter*e.width,yCenter:t.yCenter*e.height,width:t.width*e.width,height:t.height*e.height,rotation:t.rotation}:{xCenter:.5*e.width,yCenter:.5*e.height,width:e.width,height:e.height,rotation:0}}(i,n),l=function(e,t,n){if(void 0===n&&(n=!1),!n)return{top:0,left:0,right:0,bottom:0};var r=t.height,a=t.width;Fb(t,"targetSize"),Fb(e,"roi");var o,s,i=r/a,u=e.height/e.width,l=0,c=0;return i>u?(o=e.width,s=e.width*i,c=(1-u/i)/2):(o=e.height/i,s=e.height,l=(1-i/u)/2),e.width=o,e.height=s,{top:c,left:l,right:l,bottom:c}}(u,r,a),c=function(e,t,n,r){var a=e.width,o=e.height,s=r?-1:1,i=Math.cos(e.rotation),u=Math.sin(e.rotation),l=e.xCenter,c=e.yCenter,p=1/t,d=1/n,f=new Array(16);return f[0]=a*i*s*p,f[1]=-o*u*p,f[2]=0,f[3]=(-.5*a*i*s+.5*o*u+l)*p,f[4]=a*u*s*d,f[5]=o*i*d,f[6]=0,f[7]=(-.5*o*i-.5*a*u*s+c)*d,f[8]=0,f[9]=0,f[10]=a*p,f[11]=0,f[12]=0,f[13]=0,f[14]=0,f[15]=1,function(e){if(16!==e.length)throw new Error("Array length must be 16 but got "+e.length);return[[e[0],e[1],e[2],e[3]],[e[4],e[5],e[6],e[7]],[e[8],e[9],e[10],e[11]],[e[12],e[13],e[14],e[15]]]}(f)}(u,i.width,i.height,!1),p=oi((function(){var t,n=(t=e)instanceof io?t:Lu(t),a=Zd(function(e,t,n){return Fb(n,"inputResolution"),[1/n.width*e[0][0]*t.width,1/n.height*e[0][1]*t.width,e[0][3]*t.width,1/n.width*e[1][0]*t.height,1/n.height*e[1][1]*t.height,e[1][3]*t.height,0,0]}(c,i,r),[1,8]),u="zero"===o?"constant":"nearest",l=Ah.transform(op(Ks(n,"float32")),a,"bilinear",u,0,[r.height,r.width]);return null!=s?function(e,t){var n=function(e,t,n,r){var a=(r-n)/255;return{scale:a,offset:n-0*a}}(0,0,t[0],t[1]);return oi((function(){return bi(xi(e,n.scale),n.offset)}))}(l,s):l}));return{imageTensor:p,padding:l,transformationMatrix:c}}var Lb={runtime:"tfjs",modelType:"general",modelUrl:"https://tfhub.dev/mediapipe/tfjs-model/selfie_segmentation/general/1"},zb={flipHorizontal:!1},Bb={outputTensorSize:{width:256,height:256},keepAspectRatio:!1,borderMode:"zero",outputTensorFloatRange:[0,1]},Vb={outputTensorSize:{width:256,height:144},keepAspectRatio:!1,borderMode:"zero",outputTensorFloatRange:[0,1]},Ub={activation:"none"},jb=function(){function e(e){this.mask=e}return e.prototype.toCanvasImageSource=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,hy(this.mask)]}))}))},e.prototype.toImageData=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,my(this.mask)]}))}))},e.prototype.toTensor=function(){return py(this,void 0,void 0,(function(){return dy(this,(function(e){return[2,this.mask]}))}))},e.prototype.getUnderlyingType=function(){return"tensor"},e}();function Wb(e){return yy(e),"person"}var Hb,qb,Gb=function(){function e(e,t){this.modelType=e,this.model=t}return e.prototype.segmentPeople=function(e,t){return py(this,void 0,void 0,(function(){var n,r=this;return dy(this,(function(a){return t=function(e){if(null==e)return cy({},zb);var t=cy({},e);return null==t.flipHorizontal&&(t.flipHorizontal=zb.flipHorizontal),t}(t),null==e?(this.reset(),[2,[]]):(n=oi((function(){var t=Pb(e,"general"===r.modelType?Bb:Vb).imageTensor,n=nc(r.model.predict(t),[0,0,0,1],-1),a=Rb(e),o=function(e,t,n){return oi((function(){var r=qd(e,[0]),a=r.shape[2];if(1===a){var o=r;switch(t.activation){case"none":break;case"sigmoid":o=tc(o);break;case"softmax":throw new Error("Softmax activation requires two channels.");default:throw new Error("Activation not supported ("+t.activation+")")}var s=n?Ah.resizeBilinear(o,[n.height,n.width]):o;return qd(s,[2])}throw new Error("Unsupported number of tensor channels "+a)}))}(n,Ub,a),s=op(o,2),i=Yp(s,[[0,0],[0,0],[0,1]]);return Up(i,[[0,0],[0,0],[0,2]],"symmetric")})),[2,[{maskValueToLabel:Wb,mask:new jb(n)}]])}))}))},e.prototype.dispose=function(){this.model.dispose()},e.prototype.reset=function(){},e}();function Kb(e){return py(this,void 0,void 0,(function(){var t,n,r;return dy(this,(function(a){switch(a.label){case 0:return t=function(e){if(null==e)return cy({},Lb);var t=cy({},e);if(t.runtime="tfjs",null==t.modelType&&(t.modelType=Lb.modelType),"general"!==t.modelType&&"landscape"!==t.modelType)throw new Error("Model type must be one of general or landscape, but got "+t.modelType);return null==t.modelUrl&&("general"===t.modelType?t.modelUrl="https://tfhub.dev/mediapipe/tfjs-model/selfie_segmentation/general/1":t.modelUrl="https://tfhub.dev/mediapipe/tfjs-model/selfie_segmentation/landscape/1"),t}(e),n="string"==typeof t.modelUrl&&t.modelUrl.indexOf("https://tfhub.dev")>-1,[4,sy(t.modelUrl,{fromTFHub:n})];case 1:return r=a.sent(),[2,new Gb(t.modelType,r)]}}))}))}function Qb(e,t){return py(this,void 0,void 0,(function(){var n,r;return dy(this,(function(a){switch(e){case Hb.MediaPipeSelfieSegmentation:if(n=void 0,null!=(r=t)){if("tfjs"===r.runtime)return[2,Kb(r)];if("mediapipe"===r.runtime)return[2,$b(r)];n=r.runtime}throw new Error("Expect modelConfig.runtime to be either 'tfjs' or 'mediapipe', but got "+n);case Hb.BodyPix:return[2,Ib(r=t)];default:throw new Error(e+" is not a supported model name.")}}))}))}(qb=Hb||(Hb={})).BodyPix="BodyPix",qb.MediaPipeSelfieSegmentation="MediaPipeSelfieSegmentation";var Yb="blurred",Xb="blurred-mask",Zb="mask",Jb="draw-image",ev={};function tv(e,t,n,r){var a=e.width,o=e.height,s=t.width,i=t.height;if(a!==s||o!==i)throw new Error("error: dimensions must match. "+n+" has dimensions "+a+"x"+o+", "+r+" has dimensions "+s+"x"+i)}function nv(e){if("undefined"!=typeof HTMLCanvasElement&&e instanceof HTMLCanvasElement||"undefined"!=typeof OffscreenCanvas&&e instanceof OffscreenCanvas||"undefined"!=typeof HTMLImageElement&&e instanceof HTMLImageElement)return function(e){if("offsetHeight"in e&&0!==e.offsetHeight&&"offsetWidth"in e&&0!==e.offsetWidth)return[e.offsetHeight,e.offsetWidth];if(null!=e.height&&null!=e.width)return[e.height,e.width];throw new Error("HTMLImageElement must have height and width attributes set.")}(e);if("undefined"!=typeof ImageData&&e instanceof ImageData)return[e.height,e.width];if("undefined"!=typeof HTMLVideoElement&&e instanceof HTMLVideoElement)return function(e){return e.hasAttribute("height")&&e.hasAttribute("width")?[e.height,e.width]:[e.videoHeight,e.videoWidth]}(e);if(e instanceof io)return[e.shape[0],e.shape[1]];throw new Error("error: Unknown input type: "+e+".")}function rv(e){return ev[e]||(ev[e]=function(){if("undefined"!=typeof document)return document.createElement("canvas");if("undefined"!=typeof OffscreenCanvas)return new OffscreenCanvas(0,0);throw new Error("Cannot create a canvas in this context")}()),ev[e]}function av(e,t){var n=rv(t);return function(e,t){t.width=e.width,t.height=e.height,t.getContext("2d").putImageData(e,0,0)}(e,n),n}function ov(e,t,n,r,a,o){return py(this,void 0,void 0,(function(){var s,i,u,l;return dy(this,(function(c){switch(c.label){case 0:return t instanceof io?[4,Fu(t)]:[3,2];case 1:s=c.sent(),i=nv(t),u=i[0],l=i[1],t=new ImageData(s,l,u),c.label=2;case 2:return t instanceof ImageData&&(t=av(t,Jb)),null==a||null==o?e.drawImage(t,n,r):e.drawImage(t,n,r,a,o),[2]}}))}))}function sv(e,t){return py(this,void 0,void 0,(function(){var n,r,a;return dy(this,(function(o){switch(o.label){case 0:return n=nv(e),r=n[0],a=n[1],t.width=a,t.height=r,[4,ov(t.getContext("2d"),e,0,0,a,r)];case 1:return o.sent(),[2]}}))}))}function iv(e){var t=e.getContext("2d");t.scale(-1,1),t.translate(-e.width,0)}function uv(e,t,n){return py(this,void 0,void 0,(function(){return dy(this,(function(r){switch(r.label){case 0:return e.globalCompositeOperation=n,[4,ov(e,t,0,0)];case 1:return r.sent(),[2]}}))}))}function lv(e,t,n){return py(this,void 0,void 0,(function(){var r,a,o,s,i,u,l,c;return dy(this,(function(p){switch(p.label){case 0:for(r=e.getContext("2d"),a=0,o=5,s=1/(2*Math.PI*o*o),i=n<3?1:2,l=-n;l<=n;l+=i)for(c=-n;c<=n;c+=i)u=s*Math.exp(-(c*c+l*l)/(2*o*o)),a+=u;l=-n,p.label=1;case 1:if(!(l<=n))return[3,6];c=-n,p.label=2;case 2:return c<=n?(r.globalAlpha=s*Math.exp(-(c*c+l*l)/(2*o*o))/a*n,[4,ov(r,t,c,l)]):[3,5];case 3:p.sent(),p.label=4;case 4:return c+=i,[3,2];case 5:return l+=i,[3,1];case 6:return r.globalAlpha=1,[2]}}))}))}function cv(e,t,n){return py(this,void 0,void 0,(function(){var r,a,o,s;return dy(this,(function(i){switch(i.label){case 0:return r=nv(e),a=r[0],o=r[1],s=n.getContext("2d"),n.width=o,n.height=a,s.clearRect(0,0,o,a),s.save(),/^((?!chrome|android).)*safari/i.test(navigator.userAgent)?[4,lv(n,e,t)]:[3,2];case 1:return i.sent(),[3,4];case 2:return s.filter="blur("+t+"px)",[4,ov(s,e,0,0,o,a)];case 3:i.sent(),i.label=4;case 4:return s.restore(),[2]}}))}))}function pv(e,t,n){return py(this,void 0,void 0,(function(){var r;return dy(this,(function(a){switch(a.label){case 0:return r=rv(n),0!==t?[3,2]:[4,sv(e,r)];case 1:return a.sent(),[3,4];case 2:return[4,cv(e,t,r)];case 3:a.sent(),a.label=4;case 4:return[2,r]}}))}))}function dv(e,t,n,r,a,o){void 0===o&&(o={r:0,g:255,b:255,a:255});for(var s=-a;s<=a;s++)for(var i=-a;i<=a;i++)if(0!==s&&0!==i){var u=(t+s)*r+(n+i);e[4*u+0]=o.r,e[4*u+1]=o.g,e[4*u+2]=o.b,e[4*u+3]=o.a}}function fv(e,t,n,r,a,o,s){void 0===s&&(s=1);for(var i=0,u=-s;u<=s;u++)for(var l=-s;l<=s;l++)if(0!==u&&0!==l){var c=(t+u)*r+(n+l);(!a[e[4*c]]||e[4*c+3]<o)&&(i+=1)}return i>0}function hv(e,t,n,r,a,o){return void 0===t&&(t={r:0,g:0,b:0,a:0}),void 0===n&&(n={r:0,g:0,b:0,a:255}),void 0===r&&(r=!1),void 0===a&&(a=.5),void 0===o&&(o=Array.from(Array(256).keys())),py(this,void 0,void 0,(function(){var s,i,u,l,c,p,d,f,h,m,g,y,b,v;return dy(this,(function(w){switch(w.label){case 0:return 0===(s=Array.isArray(e)?e:[e]).length?[2,null]:[4,Promise.all(s.map((function(e){return e.mask.toImageData()})))];case 1:for(i=w.sent(),u=i[0],l=u.width,c=u.height,p=new Uint8ClampedArray(l*c*4),d=Math.round(255*a),f=new Array(256).fill(!1),o.forEach((function(e){return f[e]=!0})),h=0;h<c;h++)for(m=0;m<l;m++)for(p[4*(g=h*l+m)+0]=n.r,p[4*g+1]=n.g,p[4*g+2]=n.b,p[4*g+3]=n.a,y=0,b=i;y<b.length;y++)v=b[y],f[v.data[4*g]]&&v.data[4*g+3]>=d&&(p[4*g]=t.r,p[4*g+1]=t.g,p[4*g+2]=t.b,p[4*g+3]=t.a,r&&h-1>=0&&h+1<c&&m-1>=0&&m+1<l&&fv(v.data,h,m,l,f,d)&&dv(p,h,m,l,1));return[2,new ImageData(p,l,c)]}}))}))}function mv(e,t,n,r,a,o){return void 0===r&&(r=.7),void 0===a&&(a=0),void 0===o&&(o=!1),py(this,void 0,void 0,(function(){var s,i,u,l,c;return dy(this,(function(p){switch(p.label){case 0:return s=nv(t),i=s[0],u=s[1],e.width=u,e.height=i,(l=e.getContext("2d")).save(),o&&iv(e),[4,ov(l,t,0,0)];case 1:return p.sent(),l.globalAlpha=r,n?(tv({width:u,height:i},n,"image","mask"),[4,pv(av(n,Zb),a,Xb)]):[3,3];case 2:c=p.sent(),l.drawImage(c,0,0,u,i),p.label=3;case 3:return l.restore(),[2]}}))}))}function gv(e,t,n){return py(this,void 0,void 0,(function(){var r,a;return dy(this,(function(o){switch(o.label){case 0:return[4,hv(e,{r:0,g:0,b:0,a:255},{r:0,g:0,b:0,a:0},!1,t)];case 1:return r=o.sent(),a=av(r,Zb),0===n?[2,a]:[2,pv(a,n,Xb)]}}))}))}function yv(e,t,n,r,a,o,s){return void 0===r&&(r=.5),void 0===a&&(a=3),void 0===o&&(o=3),void 0===s&&(s=!1),py(this,void 0,void 0,(function(){var i,u,l,c,p,d;return dy(this,(function(f){switch(f.label){case 0:return[4,pv(t,a,Yb)];case 1:return i=f.sent(),e.width=i.width,e.height=i.height,u=e.getContext("2d"),Array.isArray(n)&&0===n.length?(u.drawImage(i,0,0),[2]):[4,gv(n,r,o)];case 2:return l=f.sent(),u.save(),s&&iv(e),c=nv(t),p=c[0],d=c[1],[4,ov(u,t,0,0,d,p)];case 3:return f.sent(),[4,uv(u,l,"destination-in")];case 4:return f.sent(),[4,uv(u,i,"destination-over")];case 5:return f.sent(),u.restore(),[2]}}))}))}function bv(e){return bv="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},bv(e)}function vv(){/*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */vv=function(){return t};var e,t={},n=Object.prototype,r=n.hasOwnProperty,a=Object.defineProperty||function(e,t,n){e[t]=n.value},o="function"==typeof Symbol?Symbol:{},s=o.iterator||"@@iterator",i=o.asyncIterator||"@@asyncIterator",u=o.toStringTag||"@@toStringTag";function l(e,t,n){return Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}),e[t]}try{l({},"")}catch(e){l=function(e,t,n){return e[t]=n}}function c(e,t,n,r){var o=t&&t.prototype instanceof y?t:y,s=Object.create(o.prototype),i=new M(r||[]);return a(s,"_invoke",{value:T(e,n,i)}),s}function p(e,t,n){try{return{type:"normal",arg:e.call(t,n)}}catch(e){return{type:"throw",arg:e}}}t.wrap=c;var d="suspendedStart",f="suspendedYield",h="executing",m="completed",g={};function y(){}function b(){}function v(){}var w={};l(w,s,(function(){return this}));var x=Object.getPrototypeOf,k=x&&x(x(O([])));k&&k!==n&&r.call(k,s)&&(w=k);var S=v.prototype=y.prototype=Object.create(w);function E(e){["next","throw","return"].forEach((function(t){l(e,t,(function(e){return this._invoke(t,e)}))}))}function N(e,t){function n(a,o,s,i){var u=p(e[a],e,o);if("throw"!==u.type){var l=u.arg,c=l.value;return c&&"object"==bv(c)&&r.call(c,"__await")?t.resolve(c.__await).then((function(e){n("next",e,s,i)}),(function(e){n("throw",e,s,i)})):t.resolve(c).then((function(e){l.value=e,s(l)}),(function(e){return n("throw",e,s,i)}))}i(u.arg)}var o;a(this,"_invoke",{value:function(e,r){function a(){return new t((function(t,a){n(e,r,t,a)}))}return o=o?o.then(a,a):a()}})}function T(t,n,r){var a=d;return function(o,s){if(a===h)throw new Error("Generator is already running");if(a===m){if("throw"===o)throw s;return{value:e,done:!0}}for(r.method=o,r.arg=s;;){var i=r.delegate;if(i){var u=_(i,r);if(u){if(u===g)continue;return u}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if(a===d)throw a=m,r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);a=h;var l=p(t,n,r);if("normal"===l.type){if(a=r.done?m:f,l.arg===g)continue;return{value:l.arg,done:r.done}}"throw"===l.type&&(a=m,r.method="throw",r.arg=l.arg)}}}function _(t,n){var r=n.method,a=t.iterator[r];if(a===e)return n.delegate=null,"throw"===r&&t.iterator.return&&(n.method="return",n.arg=e,_(t,n),"throw"===n.method)||"return"!==r&&(n.method="throw",n.arg=new TypeError("The iterator does not provide a '"+r+"' method")),g;var o=p(a,t.iterator,n.arg);if("throw"===o.type)return n.method="throw",n.arg=o.arg,n.delegate=null,g;var s=o.arg;return s?s.done?(n[t.resultName]=s.value,n.next=t.nextLoc,"return"!==n.method&&(n.method="next",n.arg=e),n.delegate=null,g):s:(n.method="throw",n.arg=new TypeError("iterator result is not an object"),n.delegate=null,g)}function A(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t)}function I(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t}function M(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(A,this),this.reset(!0)}function O(t){if(t||""===t){var n=t[s];if(n)return n.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var a=-1,o=function n(){for(;++a<t.length;)if(r.call(t,a))return n.value=t[a],n.done=!1,n;return n.value=e,n.done=!0,n};return o.next=o}}throw new TypeError(bv(t)+" is not iterable")}return b.prototype=v,a(S,"constructor",{value:v,configurable:!0}),a(v,"constructor",{value:b,configurable:!0}),b.displayName=l(v,u,"GeneratorFunction"),t.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return!!t&&(t===b||"GeneratorFunction"===(t.displayName||t.name))},t.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,v):(e.__proto__=v,l(e,u,"GeneratorFunction")),e.prototype=Object.create(S),e},t.awrap=function(e){return{__await:e}},E(N.prototype),l(N.prototype,i,(function(){return this})),t.AsyncIterator=N,t.async=function(e,n,r,a,o){void 0===o&&(o=Promise);var s=new N(c(e,n,r,a),o);return t.isGeneratorFunction(n)?s:s.next().then((function(e){return e.done?e.value:s.next()}))},E(S),l(S,u,"Generator"),l(S,s,(function(){return this})),l(S,"toString",(function(){return"[object Generator]"})),t.keys=function(e){var t=Object(e),n=[];for(var r in t)n.push(r);return n.reverse(),function e(){for(;n.length;){var r=n.pop();if(r in t)return e.value=r,e.done=!1,e}return e.done=!0,e}},t.values=O,M.prototype={constructor:M,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=e,this.done=!1,this.delegate=null,this.method="next",this.arg=e,this.tryEntries.forEach(I),!t)for(var n in this)"t"===n.charAt(0)&&r.call(this,n)&&!isNaN(+n.slice(1))&&(this[n]=e)},stop:function(){this.done=!0;var e=this.tryEntries[0].completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var n=this;function a(r,a){return i.type="throw",i.arg=t,n.next=r,a&&(n.method="next",n.arg=e),!!a}for(var o=this.tryEntries.length-1;o>=0;--o){var s=this.tryEntries[o],i=s.completion;if("root"===s.tryLoc)return a("end");if(s.tryLoc<=this.prev){var u=r.call(s,"catchLoc"),l=r.call(s,"finallyLoc");if(u&&l){if(this.prev<s.catchLoc)return a(s.catchLoc,!0);if(this.prev<s.finallyLoc)return a(s.finallyLoc)}else if(u){if(this.prev<s.catchLoc)return a(s.catchLoc,!0)}else{if(!l)throw new Error("try statement without catch or finally");if(this.prev<s.finallyLoc)return a(s.finallyLoc)}}}},abrupt:function(e,t){for(var n=this.tryEntries.length-1;n>=0;--n){var a=this.tryEntries[n];if(a.tryLoc<=this.prev&&r.call(a,"finallyLoc")&&this.prev<a.finallyLoc){var o=a;break}}o&&("break"===e||"continue"===e)&&o.tryLoc<=t&&t<=o.finallyLoc&&(o=null);var s=o?o.completion:{};return s.type=e,s.arg=t,o?(this.method="next",this.next=o.finallyLoc,g):this.complete(s)},complete:function(e,t){if("throw"===e.type)throw e.arg;return"break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),g},finish:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var n=this.tryEntries[t];if(n.finallyLoc===e)return this.complete(n.completion,n.afterLoc),I(n),g}},catch:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var n=this.tryEntries[t];if(n.tryLoc===e){var r=n.completion;if("throw"===r.type){var a=r.arg;I(n)}return a}}throw new Error("illegal catch attempt")},delegateYield:function(t,n,r){return this.delegate={iterator:O(t),resultName:n,nextLoc:r},"next"===this.method&&(this.arg=e),g}},t}function wv(e,t,n,r,a,o,s){try{var i=e[o](s),u=i.value}catch(e){return void n(e)}i.done?t(u):Promise.resolve(u).then(r,a)}function xv(e){return function(){var t=this,n=arguments;return new Promise((function(r,a){var o=e.apply(t,n);function s(e){wv(o,r,a,s,i,"next",e)}function i(e){wv(o,r,a,s,i,"throw",e)}s(void 0)}))}}function kv(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var n=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=n){var r,a,o,s,i=[],u=!0,l=!1;try{if(o=(n=n.call(e)).next,0===t){if(Object(n)!==n)return;u=!1}else for(;!(u=(r=o.call(n)).done)&&(i.push(r.value),i.length!==t);u=!0);}catch(e){l=!0,a=e}finally{try{if(!u&&null!=n.return&&(s=n.return(),Object(s)!==s))return}finally{if(l)throw a}}return i}}(e,t)||function(e,t){if(!e)return;if("string"==typeof e)return Sv(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);"Object"===n&&e.constructor&&(n=e.constructor.name);if("Map"===n||"Set"===n)return Array.from(e);if("Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return Sv(e,t)}(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Sv(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=new Array(t);n<t;n++)r[n]=e[n];return r}const Ev=function(e){var t=(0,L.useRef)(null),n=(0,L.useRef)(null),r=(0,L.useRef)(null),a=(0,L.useRef)(null),o=(0,L.useRef)(null),s=(0,L.useRef)(null),i=(0,L.useRef)(null),u=(0,L.useRef)(null),l=(0,L.useRef)(!1),c=(0,L.useRef)(!1),p=(0,L.useRef)(null);(0,L.useEffect)((function(){t.current=document.createElement("canvas"),n.current=t.current.getContext("2d",{willReadFrequently:!0}),a.current=r.current.getContext("2d",{willReadFrequently:!0}),s.current=o.current.getContext("2d",{willReadFrequently:!0})}),[]);var d=kv((0,L.useState)({width:innerWidth,height:innerHeight}),2),f=d[0],h=d[1];(0,L.useEffect)((function(){var e=function(){h({width:innerWidth,height:innerHeight})};return window.addEventListener("resize",e),function(){window.removeEventListener("resize",e)}}),[]),(0,L.useEffect)((function(){chrome.storage.local.get(["backgroundEffect"],(function(e){"blur"!=e.backgroundEffect?(c.current=!1,g(e.backgroundEffect)):c.current=!0}))}),[]),(0,L.useEffect)((function(){chrome.runtime.onMessage.addListener((function(e,t,n){"set-background-effect"===e.type&&("blur"===e.effect?(c.current=!0,p.current=null):""!=e.effect&&(c.current=!1,g(e.effect)))}))}),[]),(0,L.useEffect)((function(){c.current||p.current&&o.current&&m()}),[f]);var m=function(){o.current.width=innerWidth,o.current.height=innerHeight,s.current.drawImage(p.current,0,0,p.current.width,p.current.height,0,0,innerWidth,innerHeight)},g=function(e){var t=new Image;t.src=e,t.onload=function(){p.current=t,m()}};(0,L.useEffect)((function(){y()}),[]);var y=function(){var e=xv(vv().mark((function e(){var t,n;return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return t=Hb.MediaPipeSelfieSegmentation,n={runtime:"mediapipe",solutionPath:"./assets/selfieSegmentation",modelType:"general"},e.next=4,Qb(t,n);case 4:i.current=e.sent;case 5:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}}();(0,L.useEffect)((function(){null!==e.frame&&(u.current=e.frame,b())}),[e.frame]);var b=(0,L.useCallback)((function(){l.current||(l.current=!0,requestAnimationFrame((function(){l.current=!1,v()})))}),[l.current]),v=function(){var e=xv(vv().mark((function e(){return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(e.prev=0,u.current){e.next=3;break}return e.abrupt("return");case 3:if(i.current){e.next=5;break}return e.abrupt("return");case 5:w(u.current),e.next=11;break;case 8:e.prev=8,e.t0=e.catch(0),console.error(e.t0);case 11:case"end":return e.stop()}}),e,null,[[0,8]])})));return function(){return e.apply(this,arguments)}}(),w=function(){var e=xv(vv().mark((function e(t){var n,r,a;return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(e.prev=0,c.current||p.current){e.next=3;break}return e.abrupt("return");case 3:if(u.current){e.next=5;break}return e.abrupt("return");case 5:if(i.current){e.next=7;break}return e.abrupt("return");case 7:return e.next=9,i.current.segmentPeople(t);case 9:if(0!==(n=e.sent).length){e.next=12;break}return e.abrupt("return");case 12:r=n[0].mask.mask.width,a=n[0].mask.mask.height,c.current?x(t,n):k(t,n,r,a),e.next=20;break;case 17:e.prev=17,e.t0=e.catch(0),console.error(e.t0);case 20:case"end":return e.stop()}}),e,null,[[0,17]])})));return function(t){return e.apply(this,arguments)}}(),x=function(){var e=xv(vv().mark((function e(t,n){var a;return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,16,10,!1,.6,a=t.width/t.height,r.current.width=innerHeight*a,r.current.height=innerHeight,e.next=10,yv(r.current,t,n,.6,16,10,false);case 10:u.current=null,e.next=16;break;case 13:e.prev=13,e.t0=e.catch(0),console.error(e.t0);case 16:case"end":return e.stop()}}),e,null,[[0,13]])})));return function(t,n){return e.apply(this,arguments)}}(),k=function(){var e=xv(vv().mark((function e(o,s,i,l){var c,p,d,f,h;return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,c=o.width/o.height,p={r:0,g:0,b:0,a:0},d={r:0,g:0,b:0,a:255},!1,.7,e.next=8,hv(s,p,d,false,.7);case 8:f=e.sent,(h=new Image).src=S(f),h.onload=xv(vv().mark((function e(){return vv().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return 0,10,r.current.width=innerHeight*c,r.current.height=innerHeight,e.next=6,mv(t.current,o,f,0,10);case 6:n.current.save(),n.current.globalCompositeOperation="destination-out",n.current.drawImage(h,0,0,t.current.width,t.current.height),n.current.restore(),r.current.width=innerHeight*c,r.current.height=innerHeight,a.current.drawImage(t.current,0,0,t.current.width,t.current.height,0,0,r.current.width,r.current.height),u.current=null;case 14:case"end":return e.stop()}}),e)}))),e.next=17;break;case 14:e.prev=14,e.t0=e.catch(0),console.error(e.t0);case 17:case"end":return e.stop()}}),e,null,[[0,14]])})));return function(t,n,r,a){return e.apply(this,arguments)}}(),S=function(e){var t=document.createElement("canvas");return t.width=e.width,t.height=e.height,t.getContext("2d").putImageData(e,0,0),t.toDataURL()};return L.createElement("div",{style:{zIndex:99999,top:"0px",left:"0px",height:"100%",width:"100%",position:"absolute",overflow:"hidden"}},L.createElement("div",null,L.createElement("div",null,L.createElement("canvas",{style:{position:"absolute",top:"50%",left:"50%",height:"100%",zIndex:999999,transform:"translate(-50%, -50%)"},ref:r}),L.createElement("canvas",{style:{position:"absolute",top:"50%",left:"50%",height:"100%",transform:"translate(-50%, -50%)"},ref:o}))))};function Nv(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var n=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=n){var r,a,o,s,i=[],u=!0,l=!1;try{if(o=(n=n.call(e)).next,0===t){if(Object(n)!==n)return;u=!1}else for(;!(u=(r=o.call(n)).done)&&(i.push(r.value),i.length!==t);u=!0);}catch(e){l=!0,a=e}finally{try{if(!u&&null!=n.return&&(s=n.return(),Object(s)!==s))return}finally{if(l)throw a}}return i}}(e,t)||function(e,t){if(!e)return;if("string"==typeof e)return Tv(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);"Object"===n&&e.constructor&&(n=e.constructor.name);if("Map"===n||"Set"===n)return Array.from(e);if("Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return Tv(e,t)}(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Tv(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=new Array(t);n<t;n++)r[n]=e[n];return r}const _v=function(){var e=Nv((0,L.useState)(0),2),t=e[0],n=e[1],r=Nv((0,L.useState)(0),2),a=r[0],o=r[1],s=Nv((0,L.useState)(!1),2),i=s[0],u=s[1],l=(0,L.useRef)(!1),c=(0,L.useRef)(null),p=(0,L.useRef)(null),d=Nv((0,L.useState)(null),2),f=d[0],h=d[1],m=Nv((0,L.useState)(!1),2),g=m[0],y=m[1],b=(0,L.useRef)("screen"),v=(0,L.useRef)(null),w=(0,L.useRef)(null);(0,L.useEffect)((function(){v.current=document.createElement("canvas")}),[]);var x=function(e){navigator.mediaDevices.getUserMedia(e).then((function(e){c.current=e;var t=e.getVideoTracks()[0].getSettings(),r=t.width,a=t.height;"camera"===b.current?(n("100%"),o("auto")):(n(r/a<1?"100%":"auto"),o(r/a<1?"auto":"100%"));var s=p.current;s.srcObject=e,s.onloadedmetadata=function(e){s.play();var t=v.current;t.width=s.videoWidth,t.height=s.videoHeight,w.current=t.getContext("2d"),requestAnimationFrame(S)}})).catch((function(e){}))},k=function(){c.current&&(c.current.getTracks().forEach((function(e){return e.stop()})),p.current.srcObject=null)};(0,L.useEffect)((function(){l.current=i}),[i]);var S=function e(){if(l.current&&w.current&&v.current){var t=p.current;w.current.drawImage(t,0,0,v.current.width,v.current.height),h(w.current.getImageData(0,0,v.current.width,v.current.height))}requestAnimationFrame(e)};return(0,L.useEffect)((function(){chrome.runtime.onMessage.addListener((function(e,t,r){if("switch-camera"===e.type)"none"!==e.id&&(k(),setTimeout((function(){x({video:{deviceId:{exact:e.id}}})}),2e3));else if("background-effects-active"===e.type)u(!0);else if("background-effects-inactive"===e.type)u(!1);else if("camera-only-update"===e.type)n("auto"),o("100%"),b.current="camera";else if("screen-update"===e.type){var a=p.current;a.videoWidth>a.videoHeight?(n("auto"),o("100%")):(n("100%"),o("auto")),b.current="screen"}else if("toggle-pip"===e.type)if(document.pictureInPictureElement)document.exitPictureInPicture();else try{p.current.requestPictureInPicture().catch((function(){y(!1),chrome.runtime.sendMessage({type:"pip-ended"})}))}catch(e){y(!1),chrome.runtime.sendMessage({type:"pip-ended"})}else if("set-surface"===e.type){if("monitor"===e.surface)try{p.current.requestPictureInPicture().catch((function(){y(!1),chrome.runtime.sendMessage({type:"pip-ended"})}))}catch(e){y(!1),chrome.runtime.sendMessage({type:"pip-ended"})}}else"camera-toggled-toolbar"===e.type&&e.active&&(k(),setTimeout((function(){x({video:{deviceId:{exact:e.id}}})}),2e3),y(!1))}))}),[]),(0,L.useEffect)((function(){chrome.storage.local.get(["recordingType"],(function(e){"camera"===e.recordingType?b.current="camera":b.current="screen"}))}),[]),(0,L.useEffect)((function(){chrome.storage.local.get(["backgroundEffectsActive"],(function(e){u(e.backgroundEffectsActive)}))}),[]),(0,L.useEffect)((function(){chrome.storage.local.get(["defaultVideoInput"],(function(e){"none"!==e.defaultVideoInput?x({video:{deviceId:{exact:e.defaultVideoInput}}}):x({video:!0})}))}),[]),(0,L.useEffect)((function(){var e=function(){y(!0),chrome.runtime.sendMessage({type:"pip-started"})},t=function(){y(!1),chrome.runtime.sendMessage({type:"pip-ended"})};return p.current.addEventListener("enterpictureinpicture",e),p.current.addEventListener("leavepictureinpicture",t),function(){p.current.removeEventListener("enterpictureinpicture",e),p.current.removeEventListener("leavepictureinpicture",t)}}),[]),L.createElement("div",{style:{width:"100%",height:"100%",overflow:"hidden"}},i&&L.createElement(Ev,{frame:f}),L.createElement("video",{style:{height:a,width:t,position:"absolute",top:"50%",left:"50%",right:0,transform:"translateY(-50%) translateX(-50%)",margin:"auto",zIndex:99,display:i?"none":"block"},ref:p}),"camera"!=b.current&&L.createElement("div",{style:{width:"100%",height:"100%",backgroundColor:"#CBD0D8",zIndex:9,position:"absolute",top:"0px",left:"0px",margin:"auto",display:"flex",alignContent:"center",alignItems:"center",justifyContent:"center"}},L.createElement("div",{className:"loader"})),g&&L.createElement("img",{src:chrome.runtime.getURL("assets/pip-mode.svg"),style:{width:"100%",height:"100%",position:"absolute",top:"0px",left:"0px",margin:"auto",zIndex:999}}),L.createElement("style",null,".loader {\n  font-size: 10px;\n  width: 1em;\n  height: 1em;\n\tmargin: auto;\n  border-radius: 50%;\n  position: relative;\n  text-indent: -9999em;\n  animation: mulShdSpin 1.1s infinite ease;\n  transform: translateZ(0);\n}\n@keyframes mulShdSpin {\n  0%,\n  100% {\n    box-shadow: 0em -2.6em 0em 0em #ffffff, 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.5), -1.8em -1.8em 0 0em rgba(255,255,255, 0.7);\n  }\n  12.5% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.7), 1.8em -1.8em 0 0em #ffffff, 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.5);\n  }\n  25% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.5), 1.8em -1.8em 0 0em rgba(255,255,255, 0.7), 2.5em 0em 0 0em #ffffff, 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);\n  }\n  37.5% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.5), 2.5em 0em 0 0em rgba(255,255,255, 0.7), 1.75em 1.75em 0 0em #ffffff, 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);\n  }\n  50% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.5), 1.75em 1.75em 0 0em rgba(255,255,255, 0.7), 0em 2.5em 0 0em #ffffff, -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);\n  }\n  62.5% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.5), 0em 2.5em 0 0em rgba(255,255,255, 0.7), -1.8em 1.8em 0 0em #ffffff, -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);\n  }\n  75% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.5), -1.8em 1.8em 0 0em rgba(255,255,255, 0.7), -2.6em 0em 0 0em #ffffff, -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);\n  }\n  87.5% {\n    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.5), -2.6em 0em 0 0em rgba(255,255,255, 0.7), -1.8em -1.8em 0 0em #ffffff;\n  }\n}"))};(0,z.render)(L.createElement(_v,null),window.document.querySelector("#app-container"))})()})();