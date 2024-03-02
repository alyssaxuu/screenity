// Work in progress...

// import React, { useState, useEffect } from "react";
// import { PhoneTest, wallpaper } from "./utils/DeviceImages";

// const devices = [
//   {
//     name: "iPhone",
//     image: PhoneTest,
//     width: 340,
//     height: 760,
//   },
//   // Add more device options here
// ];

// const MockupContainer = () => {
//   const [selectedDevice, setSelectedDevice] = useState(devices[0]);
//   const [src, setSrc] = useState("");
//   const [width, setWidth] = useState(0);
//   const [height, setHeight] = useState(0);
//   const useragent =
//     "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";

//   useEffect(() => {
//     setSrc(window.location.href);
//     document.body.style.overflow = "hidden"; // Hide the body overflow
//     document.body.style.display = "none"; // Hide the body
//     return () => {
//       document.body.style.overflow = "auto"; // Restore the body overflow on component unmount
//       document.body.style.display = "block"; // Restore the body
//     };
//   }, []);

//   const handleDeviceChange = (device) => {
//     setSelectedDevice(device);
//   };

//   useEffect(() => {
//     setWidth(selectedDevice.width);
//     setHeight(selectedDevice.height);
//   }, [selectedDevice]);

//   useEffect(() => {
//     Object.defineProperty(navigator, "userAgent", {
//       value:
//         "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
//       configurable: false,
//       writable: false,
//     });
//   }, []);

//   return (
//     <div style={styles.container} id="mockup-wrapper">
//       <div style={styles.deviceContainer}>
//         <div style={{ ...styles.device, width, height }}>
//           <div style={styles.screen}>
//             <iframe
//               src={src}
//               style={styles.iframe}
//               scrolling="auto"
//               sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-orientation-lock allow-modals allow-popups-to-escape-sandbox allow-pointer-lock"
//               seamless
//               ref={(iframe) => {}}
//             />
//           </div>
//         </div>
//         <div style={styles.deviceSwitcher}>
//           {devices.map((device) => (
//             <button
//               key={device.name}
//               style={styles.deviceSwitch}
//               onClick={() => handleDeviceChange(device)}
//             >
//               {device.name}
//             </button>
//           ))}
//         </div>
//       </div>
//       <div
//         style={{
//           ...styles.mockupOverlay,
//           backgroundImage: `url(${selectedDevice.image})`,
//           width,
//           height,
//         }}
//       />
//       <div className="wallpaper" styles={styles.wallpaper}>
//         <img src={wallpaper} alt="wallpaper" />
//       </div>
//     </div>
//   );
// };

// const styles = {
//   wallpaper: {
//     position: "absolute",
//     top: "0",
//     left: "0",
//     width: "100%",
//     height: "100%",
//     zIndex: "-999",
//   },
//   container: {
//     position: "fixed",
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     display: "flex",
//     justifyContent: "center",
//     alignItems: "center",
//     background: "#f0f0f0",
//     pointerEvents: "none",
//   },
//   deviceContainer: {
//     position: "absolute",
//     margin: "0 auto",
//     borderRadius: "30px",
//     overflow: "hidden",
//   },
//   device: {
//     position: "relative",
//   },
//   screen: {
//     position: "absolute",
//     top: "80px",
//     left: "20px",
//     right: "20px",
//     bottom: "80px",
//     overflow: "hidden",
//     background: "#fff",
//     borderRadius: "30px",
//   },
//   iframe: {
//     border: "none",
//     overflowClipMargin: "content-box",
//     overflow: "clip",
//     width: "100%",
//     height: "100%",
//   },
//   mockupOverlay: {
//     position: "absolute",
//     top: "50%",
//     left: "50%",
//     transform: "translate(-50%, -50%)",
//     backgroundPosition: "center",
//     backgroundSize: "contain",
//     backgroundRepeat: "no-repeat",
//     opacity: "0.8",
//     pointerEvents: "none",
//   },
//   deviceSwitcher: {
//     position: "absolute",
//     bottom: "20px",
//     left: "50%",
//     transform: "translateX(-50%)",
//     display: "flex",
//     justifyContent: "center",
//   },
//   deviceSwitch: {
//     margin: "0 10px",
//     padding: "5px 10px",
//     border: "none",
//     borderRadius: "5px",
//     background: "transparent",
//     cursor: "pointer",
//   },
// };

// export default MockupContainer;
