$(document).ready(function(){
    // Retrieve defaults
    chrome.storage.sync.get(['toolbar'], function(result) {
        if (!result.toolbar) {
            $("#persistent").prop("checked", true);  
        }
    });
    chrome.storage.sync.get(['flip'], function(result) {
        if (result.flip) {
            $("#flip-camera").prop("checked", true);  
        }
    });
    chrome.storage.sync.get(['pushtotalk'], function(result) {
        if (result.pushtotalk) {
            $("#push-talk").prop("checked", true);  
        }
    });
    
    // Get available audio devices
    function getAudio(request) {
        $("#audio-select").html("<option value='disabled'>"+chrome.i18n.getMessage("disabled")+"</option>");
        request.audiodevices.forEach(function(device) {
            $("#audio-select").append("<option value='"+device.id+"'>"+device.label+"</option>")
        });
        $("#audio-select").niceSelect();
        chrome.storage.sync.get(['mic'], function(result) {
            if (result.mic != 0) {
                $('#audio-select').val(result.mic).niceSelect('update');
            } else {
                $('#audio-select').val($("#audio-select option:nth-child(2)").val()).niceSelect('update');
            }
        });
    }
    
    // Get available camera devices
    function getCamera(request) {
        $("#camera-select").html("<option value='disabled'>"+chrome.i18n.getMessage("disabled")+"</option>");
        request.cameradevices.forEach(function(device) {
            $("#camera-select").append("<option value='"+device.id+"'>"+device.label+"</option>")
        });
        $("#camera-select").niceSelect();
        chrome.storage.sync.get(['camera'], function(result) {
            if (result.camera != 0) {
                $('#camera-select').val(result.camera).niceSelect('update');
            } else {
                $('#camera-select').val($("#camera-select option:nth-child(2)").val()).niceSelect('update');
            }
        });
    }
    
    // Change settings
    $("#flip-camera").on("change", function(){
        chrome.storage.sync.set({flip: this.checked});
        chrome.runtime.sendMessage({type: "flip-camera", enabled:this.checked});
    });
    $("#push-talk").on("change", function(){
        chrome.storage.sync.set({pushtotalk: this.checked});
        chrome.runtime.sendMessage({type: "push-to-talk", enabled:this.checked});
    });
    $("#camera-select").on("change", function(){
        chrome.runtime.sendMessage({type: "update-camera", id:$("#camera-select").val()});
    });
    $("#audio-select").on("change", function(){
        chrome.runtime.sendMessage({type: "update-mic", id:$("#audio-select").val()});
    });
    $("#persistent").on("change", function(){
        chrome.storage.sync.set({toolbar: this.checked});
        chrome.runtime.sendMessage({type: "switch-toolbar", enabled:!this.checked});
    });
    
    // Listen for messages
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type == "device-list") {
            getAudio(request);
            getCamera(request);
        }
    });
    
    // Localization (strings in different languages)
    $("#camera-select-label").html(chrome.i18n.getMessage("camera"));
    $("#flip-label").html(chrome.i18n.getMessage("flip_camera"));
    $("#mic-label").html(chrome.i18n.getMessage("microphone"));
    $("#push-label").html(chrome.i18n.getMessage("push_to_talk"));
    $("#hover-label").html(chrome.i18n.getMessage("only_on_hover"));
});