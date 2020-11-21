$(document).ready(function(){
    var recording = false;
    
    // Set up custom dropdowns
    $("#camera-select").niceSelect();
    $("#mic-select").niceSelect();
    
    // Get default settings (set by the user)
    chrome.storage.sync.get(null, function(result) {
        if (!result.toolbar) {
            $("#persistent").prop("checked", true);  
        }
        if (result.flip) {
            $("#flip").prop("checked", true);  
        }
        if (result.pushtotalk) {
            $("#push").prop("checked", true);  
        }
        if (result.countdown) {
            $("#countdown").prop("checked", true);  
        }
        if (result.quality == "max") {
            $("#quality").html("Smaller file size");
        } else {
            $("#quality").html("Highest quality")
        }
        if ($(".type-active").attr("id") == "tab-only") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/tab-only.svg'));
        } else if ($(".type-active").attr("id") == "desktop") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/desktop.svg'));
        } else if ($(".type-active").attr("id") == "camera-only") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/camera-only.svg'));
        }
        $(".type-active").removeClass("type-active");
        $("#"+result.type).addClass("type-active");
        if ($("#"+result.type).attr("id") == "tab-only") {
           $("#"+result.type).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/tab-only-active.svg'));
        } else if ($("#"+result.type).attr("id") == "desktop") {
           $("#"+result.type).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/desktop-active.svg'));
        } else if ($("#"+result.type).attr("id") == "camera-only") {
           $("#"+result.type).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/camera-only-active.svg'));
        }
    });
    
    // Start recording
    function record(){
        if (!recording) {
            chrome.runtime.sendMessage({type: "record"});
            $("#record").html("Starting recording...");
        } else {
            recording = false;
            $("#record").html("Start recording");
            chrome.runtime.sendMessage({type: "stop-save"}); 
        }
    }
    
    // Request extension audio access if website denies it (for background)
    function audioRequest() {
        navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
           var audiodevices = [];
            navigator.mediaDevices.enumerateDevices().then(function(devices) {
              devices.forEach(function(device) {
                  if (device.kind == "audioinput") {
                      audiodevices.push({label:device.label, id:device.deviceId});
                  }
              }); 
              getAudio(audiodevices);
            });
        }).catch(function(error){
            $("#mic-select").html("<option value='disabled'>Disabled (allow access)</option>");
        });
    }
    
    
    // Get available audio devices
    function getAudio(audio) {
        $("#mic-select").html("<option value='disabled'>Disabled</option>");
        audio.forEach(function(device) {
            $("#mic-select").append("<option value='"+device.id+"'>"+device.label+"</option>");
        });
        $("#mic-select").niceSelect('update');
        chrome.storage.sync.get(['mic'], function(result) {
            if (result.mic != 0) {
                $('#mic-select').val(result.mic).niceSelect('update');
            } else {
                $('#mic-select').val($("#mic-select option:nth-child(2)").val()).niceSelect('update');
                chrome.runtime.sendMessage({type: "update-mic", id:$("#mic-select").val()});
            }
        });
    }
    
    // Get available camera devices
    function getCamera(camera) {
        $("#camera-select").html("<option value='disabled'>Disabled</option>");
        camera.forEach(function(device) {
            $("#camera-select").append("<option value='"+device.id+"'>"+device.label+"</option>")
        });
        $("#camera-select").niceSelect('update');
        chrome.storage.sync.get(['camera'], function(result) {
            if (result.camera != 0 && result.camera != "disabled-access") {
                $('#camera-select').val(result.camera).niceSelect('update');
                if ($(".type-active").attr("id") == "camera-only" && $("#camera-select").val() == "disabled") {
                    $("#record").addClass("record-disabled");
                } else {
                    $("#record").removeClass("record-disabled");
                }
            } else {
                $('#camera-select').val($("#camera-select option:nth-child(2)").val()).niceSelect('update');
                chrome.runtime.sendMessage({type: "update-camera", id:$("#camera-select").val()});
            }
        });
    }
    
    // Get available camera devices
    chrome.tabs.getSelected(null, function(tab) {
        chrome.tabs.sendMessage(tab.id, {
            type: "camera-request"
        });
    });
    
    // Check if recording is ongoing
    chrome.runtime.sendMessage({type: "record-request"}, function(response){
        recording = response.recording;
        if (response.recording) {
            $("#record").html("Stop recording");
            $("#record").addClass("record-stop");
        }
    });
    
    // Check if current tab is unable to be recorded
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        if (tabs[0].url.includes("chrome://") || tabs[0].url.includes("chrome-extension://") || tabs[0].url.includes("chrome.com") || tabs[0].url.includes("chrome.google.com")) {
            $("#record").addClass("record-disabled");
            $("#record").html("Can't record in this page");
        }
    });
    
    // Modify settings
    $("#flip").on("change", function(){
        chrome.storage.sync.set({flip: this.checked});
        chrome.runtime.sendMessage({type: "flip-camera", enabled:this.checked});
    });
    $("#push").on("change", function(){
        chrome.storage.sync.set({pushtotalk: this.checked});
        chrome.runtime.sendMessage({type: "push-to-talk", enabled:this.checked});
    });
    $("#countdown").on("change", function(){
        chrome.storage.sync.set({countdown: this.checked});
    });
    $("#persistent").on("change", function(){
        chrome.storage.sync.set({toolbar: !this.checked});
        chrome.runtime.sendMessage({type: "switch-toolbar", enabled:!this.checked});
    });
    $("#camera-select").on("change", function(){
        chrome.runtime.sendMessage({type: "update-camera", id:$("#camera-select").val()});
        if ($(".type-active").attr("id") == "camera-only" && ($("#camera-select").val() == "disabled" || $("#camera-select").val() == "disabled-access")) {
            $("#record").addClass("record-disabled");
        } else {
            $("#record").removeClass("record-disabled");
        }
    });
    $("#mic-select").on("change", function(){
        chrome.runtime.sendMessage({type: "update-mic", id:$("#mic-select").val()});
    });
    
    // Change recording area
    $(document).on("click", ".type:not(.type-active)", function(){
       if ($(".type-active").attr("id") == "tab-only") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/tab-only.svg'));
       } else if ($(".type-active").attr("id") == "desktop") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/desktop.svg'));
       } else if ($(".type-active").attr("id") == "camera-only") {
           $(".type-active").find("img").attr("src", chrome.extension.getURL('./assets/images/popup/camera-only.svg'));
       }
       $(".type-active").removeClass("type-active");
       $(this).addClass("type-active");
        if ($(".type-active").attr("id") == "camera-only" && ($("#camera-select").val() == "disabled" || $("#camera-select").val() == "disabled-access")) {
            $("#record").addClass("record-disabled");
        } else {
            $("#record").removeClass("record-disabled");
        }
       if ($(this).attr("id") == "tab-only") {
           $(this).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/tab-only-active.svg'));
       } else if ($(this).attr("id") == "desktop") {
           $(this).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/desktop-active.svg'));
       } else if ($(this).attr("id") == "camera-only") {
           $(this).find("img").attr("src", chrome.extension.getURL('./assets/images/popup/camera-only-active.svg'));
       }
        chrome.runtime.sendMessage({type: "recording-type", recording:$(".type-active").attr("id")});
        chrome.storage.sync.set({type:$(".type-active").attr("id")});
    });
    
    // Start recording
    $("#record").on("click", function(){
        record();
    });
    
    // Show more dropdown
    $("#more").on("click", function(e){
        if ($("#more-select").hasClass("countactive")) {
            $("#more-select").removeClass("countactive");
        } else {
            $("#more-select").addClass("countactive");
        }
    });
    
    // Show countdown dropdown
    $("#count-select").on("click", function(e){
        e.preventDefault(); 
        if ($("#countdown-select").hasClass("countactive")) {
            $("#countdown-select").removeClass("countactive");
        } else {
            $("#countdown-select").addClass("countactive");
        }
    });
    
    // Change countdown time
    $(".countdown").on("click", function(){
        $("#count-select").html($(this).html().slice(0, -1));
        chrome.storage.sync.set({countdown_time: parseInt($(this).html().slice(0, -1))});
        $("#countdown-select").removeClass("countactive");
    })
    
    // Hide countdown dropdown when clicking anywhere but the dropdown
    $(document).on("click", function(e){
        if (!$("#countdown-select").is(e.target) && $("#countdown-select").has(e.target).length === 0 && !$("#count-select").is(e.target) && $("#count-select").has(e.target).length === 0) {
            $("#countdown-select").removeClass("countactive");
        }
        if (!$("#more-select").is(e.target) && $("#more-select").has(e.target).length === 0 && !$("#more").is(e.target) && $("#more").has(e.target).length === 0) {
            $("#more-select").removeClass("countactive");
        }
    })
    
    // Go to the shortcuts page in Chrome (workaround, chrome:// links are a local resource so they can't be triggered via a normal link)
    $("#shortcuts").on("click", function(e){
        chrome.tabs.create({
             url: "chrome://extensions/shortcuts"
        });
    })
    
    // Higher quality or smaller file size for the recording
    $("#quality").on("click", function(e){
        chrome.storage.sync.get(['quality'], function(result) {
            if (result.quality == "max") {
                chrome.storage.sync.set({
                    quality: "min"
                });
                $("#quality").html("Highest quality");
            } else {
                chrome.storage.sync.set({
                    quality: "max"
                });
                $("#quality").html("Smaller file size");
            }
        });
    });
    
    // Receive messages
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type == "loaded") {
            window.close();
        } else if (request.type == "sources") {
            getCamera(request.devices);
            
            // Allow user to start recording
            if (!recording) {
                $("#record").html("Start recording");
            }
            $("#record").removeClass("record-disabled");
        } else if (request.type == "sources-audio") {
            getAudio(request.devices);
            
            // Allow user to start recording
            if (!recording) {
                $("#record").html("Start recording");
            }
            $("#record").removeClass("record-disabled");
        } else if (request.type == "sources-noaccess") {
            $("#camera-select").html("<option value='disabled-access'>Disabled (allow access in URL bar)</option>");
            $("#camera-select").niceSelect('update');
            chrome.storage.sync.set({
                camera: "disabled-access"
            });
            
            // Allow user to start recording
            if (!recording) {
                $("#record").html("Start recording");
            }
            if ($(".type-active").attr("id") != "camera-only") {
                $("#record").removeClass("record-disabled");
            }
        } else if (request.type == "sources-loaded") {
            chrome.tabs.getSelected(null, function(tab) {
                chrome.tabs.sendMessage(tab.id, {
                    type: "camera-request"
                });
            });
        } else if (request.type == "sources-audio-noaccess") {
            audioRequest();   
        }
    });
});
