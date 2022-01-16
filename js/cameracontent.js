$(document).ready(function(){
    const uniqueid = "screenity-screen-recorder-extension-camera";
    var micon = false;
    var recording = false;
    var cameradevices = [];
    var audiodevices = [];
    var alt = false;
    var mdown = false;
    var holdtalk = false;
    var moretools = false;
    var persistent = true;
    
    injectCode(true, countdownactive);
    micEnabled(true);

		// Temporary workaround. Seems to not work if the user hasn't interacted with the page before starting recording the camera
		alert("Starting recording")
		chrome.runtime.sendMessage({type: "test"});
    
    // Inject all the content
    function injectCode(inject, active) {
        if (inject) {
            // Reset to start a new recording
            micon = false;
            recording = false;
            alt = false;
            mdown = false;
            holdtalk = false;
            moretools = false;
            persistent = true;
            
            // Get defaults
            chrome.storage.sync.get(['pushtotalk'], function(result) {
               if (result.pushtotalk) {
                   holdtalk = true;
                   micEnabled(false);
               } 
            });
            chrome.storage.sync.get(['toolbar'], function(result) {
               persistent = result.toolbar;
                if (persistent) {
                    $("#toolbar-record").removeClass("toolbar-inactive");
                }
            });
            chrome.storage.sync.get(['mic'], function(result) {
                if (result.mic == 'disabled') {
                    micEnabled(false);
                }
            });
    
            // Extension wrapper
            var wrapper = "<div id='"+uniqueid+"' style='width: 100%;height:100%;position:absolute;'></div>";
            $("body").prepend(wrapper);
            
            // Inject the camera iframe
            var iframeinject = "<div id='camera-hide'></div><div id='wrap-iframe-camera'><iframe src='"+chrome.extension.getURL('./html/camera.html')+"' allow='camera;microphone'></iframe></div>";
            $("#"+uniqueid).prepend(iframeinject);
            
            // Inject the toolbar
            var toolbarinject = "<iframe id='toolbar-settings-camera' class='toolbar-inactive-camera' src='"+chrome.extension.getURL('./html/settings.html')+"'></iframe><div id='toolbar-record-camera'><div id='pause-camera' class='tool-camera'><img src='"+chrome.extension.getURL('./assets/images/pausewhite.svg')+"'/></div><div id='mic-camera' class='tool-camera tool-active-camera'><img src='"+chrome.extension.getURL('./assets/images/mic-off.svg')+"'/></div><div id='settings-camera' class='tool-camera'><img src='"+chrome.extension.getURL('./assets/images/settings.svg')+"'/></div></div>";
            $("#"+uniqueid).prepend(toolbarinject);
            
            $("#"+uniqueid+" #wrap-iframe-camera iframe").on("load", function(){
                // Check if countdown is enabled
                if (active) {
                    $("#"+uniqueid+" #toolbar-record-camera").css("pointer-events", "none");
                    chrome.storage.sync.get(['countdown_time'], function(result) {
                        injectCountdown(result.countdown_time);
                    });
                } else {
                    recording = true;
                    chrome.runtime.sendMessage({type: "countdown"});
                }
            });
        } else {
            $("#"+uniqueid).remove();
        }
    }
    
    // Countdown
    function injectCountdown(time){
        var countdowninject = "<div id='countdown-camera'><img src='"+chrome.extension.getURL('./assets/images/3-countdown.svg')+"'></div>";
        $("#"+uniqueid).prepend(countdowninject);
        countdown(time);
    }
    function delay(num,time,last) {
        window.setTimeout(function(){
            if (!last) {
                $("#"+uniqueid+" #countdown-camera img").attr("src", chrome.extension.getURL('./assets/images/'+num+'-countdown.svg'));
            } else {
                $("#"+uniqueid+" #countdown-camera").addClass("countdown-done-camera");
                chrome.runtime.sendMessage({type: "countdown"});
                recording = true;
                $("#"+uniqueid+" #toolbar-record-camera").css("pointer-events", "all");
            }
        },time*1000);
    }
    function countdown(time){
        $("#"+uniqueid+" #countdown-camera img").attr("src", chrome.extension.getURL('./assets/images/'+time+'-countdown.svg'));
        for (var i = 0; i <= time; i++) {
            if (i == time) {
                delay(time-i,i,true);
            } else {
                delay(time-i,i,false);
            }
        }
    }
    
    // Enable/disable audio
    function audioEnable(type, enable) {
        chrome.runtime.sendMessage({type: "audio-switch", enable:enable, source:type});
    }
    
    // Enable/disable mic
    function micEnabled(enable) {
        if (enable) {
            micon = true;
            $("#"+uniqueid+" #mic-camera").addClass("tool-active-camera");
            $("#"+uniqueid+" #mic-camera img").attr("src", chrome.extension.getURL('./assets/images/mic-off.svg'));
            audioEnable("mic", true);
        } else {
            micon = false;
            $("#"+uniqueid+" #mic-camera").removeClass("tool-active-camera");
            $("#"+uniqueid+" #mic-camera img").attr("src", chrome.extension.getURL('./assets/images/mic.svg'));
            audioEnable("mic", false);
        }
    }
    
    // Save recording
    function saveRecording(){
        chrome.runtime.sendMessage({type: "stop-save"}); 
    }
    
    // Discard the recording
    function cancelRecording(){
        chrome.runtime.sendMessage({type: "stop-cancel"}); 
    }
    
    // Pause camera recording
    function pauseRecording() {
        recording = false;
        $("#"+uniqueid+" #pause-camera img").attr("src", chrome.extension.getURL('./assets/images/play.svg'));
        $("#"+uniqueid+" #mic-camera img").attr("src", chrome.extension.getURL('./assets/images/complete.svg'));
        $("#"+uniqueid+" #settings-camera img").attr("src", chrome.extension.getURL('./assets/images/cancel.svg'));
        $("#"+uniqueid+" #mic-camera").removeClass("tool-active-camera");
        $("#"+uniqueid+" #settings-camera").removeClass("tool-active-camera");
        $("#"+uniqueid+" #toolbar-settings-camera").addClass("toolbar-inactive-camera");
    }
    
    // Resume camera recording
    function resumeRecording() {
        recording = true;
        $("#"+uniqueid+" #pause-camera img").attr("src", chrome.extension.getURL('./assets/images/pause-white.svg'));
        $("#"+uniqueid+" #mic-camera img").attr("src", chrome.extension.getURL('./assets/images/mic-off.svg'));
        $("#"+uniqueid+" #settings-camera img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
    }
    
    // Playback control
    function pauseResume(){
        if (recording) {
            chrome.runtime.sendMessage({type: "pause-camera"});
            pauseRecording()
        } else {
            chrome.runtime.sendMessage({type: "resume-camera"});
            resumeRecording();
        }
    }
    
    // Send devices to settings modal
    function sendSettings() {
        chrome.runtime.sendMessage({type: "device-list", cameradevices:cameradevices, audiodevices:audiodevices});
    }
    
    // Hide toobar
    function hideTools() {
        if (!persistent) {
            $("#"+uniqueid+" #toolbar-settings-camera").addClass("toolbar-inactive-camera");
            $("#"+uniqueid+" #toolbar-record-camera").addClass("toolbar-inactive-camera");
        }
    }
    
    // Push to talk
    $(document).keydown(function(e) {
      if (e.ctrlKey) {
          alt = true;
      }
      if (mdown && alt) {
        micEnabled(true);
      }
    }).keyup(function(e) { 
         if (e.ctrlKey) {
            alt = false;
         }
        if (holdtalk) {
            micEnabled(false);
        }
    });
    $(document).keydown(function(e) {
      if (e.which == 77) {
          mdown = true;
      }
      if (mdown && alt) {
        micEnabled(true);
      }
    }).keyup(function(e) { 
        if (e.which == 77) {
          mdown = false;
         }
        if (holdtalk) {
            micEnabled(false);
        }
    });
    
    // Stop recording
    $(document).on("click", "#"+uniqueid+" #pause-camera", function(e){
        if (recording) {
            pauseResume();
        }
    });
    
    // Click to turn on/off microphone
    $(document).on("click", "#"+uniqueid+" #mic-camera", function(){
        if (recording) {
            if (micon) {
                micEnabled(false)
            } else {
                micEnabled(true);
            }
        } else {
            saveRecording();
        }
    })
    
    // Settings/cancel button
    $(document).on("click", "#"+uniqueid+" #toolbar-record-camera #settings-camera", function(){
        if (recording) {
            if ($("#"+uniqueid+" #toolbar-record-camera #settings-camera").hasClass("pen-options-camera")) {
                moretools = false;
                $("#"+uniqueid+" #toolbar-record-camera #settings-camera").removeClass("pen-options-camera");
                $("#"+uniqueid+" #toolbar-record-camera #settings-camera img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
                $("#"+uniqueid+" #toolbar-settings-camera").addClass("toolbar-inactive-camera");
            } else {
                sendSettings();
                moretools = true;
                $("#"+uniqueid+" #toolbar-settings-camera").removeClass("toolbar-inactive-camera");
                $("#"+uniqueid+" #toolbar-record-camera #settings-camera").addClass("pen-options-camera");
                $("#"+uniqueid+" #toolbar-record-camera #settings-camera img").attr("src", chrome.extension.getURL('./assets/images/close.svg'));
            }
        } else {
            cancelRecording();
        }
    });
    
    
    // Listen for popup/background/content messages
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type == "camera-list") {
            cameradevices = request.devices;
            audiodevices = request.audio;
        } else if (request.type == "push-to-talk") {
            holdtalk = request.enabled;
            micEnabled(false);
        } else if (request.type == "end") {
            injectCode(false, false);
        } else if (request.type == "restart-cam") {
            injectCode(true, request.countdown);
        } else if (request.type == "update-cmic") {
            if (request.id == "disabled") {
                micEnabled(false);
            } else {
                micEnabled(true);
            }
        } else if (request.type == "end-recording") {
            injectCode(false);
        }
    });
})