$(document).ready(function(){
    var blobs = recordedBlobs;
    var player;
    var trimslider = document.getElementById('trimslider');
    var removeslider = document.getElementById('removeslider');
    var setup = true;
    
    // Show recorded video
    var superBuffer = new Blob(recordedBlobs, {
        type: 'video/webm'
    });
    
    // Create the src url from the blob. #t=duration is a Chrome bug workaround, as the webm generated through Media Recorder has a N/A duration in its metadata, so you can't seek the video in the player. Using Media Fragments (https://www.w3.org/TR/media-frags/#URIfragment-user-agent) and setting the duration manually in the src url fixes the issue.
    var url = window.URL.createObjectURL(superBuffer);
    $("#video").attr("src", url+"#t="+blobs.length);
    $("#format-select").niceSelect();
    $("#g-savetodrive").attr("src", url);
    
    
    // Convert seconds to timestamp
    function timestamp(value) {
        var sec_num = value;
        var hours   = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        return hours+':'+minutes+':'+seconds;
    }
    
    // Initialize range sliders
    function initRanges() {
        noUiSlider.create(trimslider, {
            start: [blobs.length],
            connect: "upper",
            range: {
                'min': 0,
                'max': blobs.length
            }
        });
        $("#trim-end input").val(timestamp(blobs.length));
        
        noUiSlider.create(removeslider, {
            start: [0, blobs.length],
            connect: true,
            range: {
                'min': 0,
                'max': blobs.length
            }
        });
        $("#remove-end input").val(timestamp(blobs.length));
    }
    
    // Update range values
    function updateRanges(blobs) {
        trimslider.noUiSlider.updateOptions({
           start: [blobs.length],
            range: {
                'min': 0,
                'max': blobs.length
            }
        });
        $("#trim-start input").val(timestamp(0));
        $("#trim-end input").val(timestamp(blobs.length));
        
        removeslider.noUiSlider.updateOptions({
           start: [0, blobs.length],
            range: {
                'min': 0,
                'max': blobs.length
            }
        });
        $("#remove-start input").val(timestamp(0));
        $("#remove-end input").val(timestamp(blobs.length));
        window.setTimeout(function(){
            player.currentTime = 0;
        }, 500)
        player.restart();
    }
    
    // Reset video
    function reset() {
        blobs = recordedBlobs;
        var superBuffer = new Blob(blobs, {
            type: 'video/webm'
        });
        var url = window.URL.createObjectURL(superBuffer);
        $("#video").attr("src", url+"#t="+blobs.length);
        updateRanges(blobs);
    }
    
    // Trim video between two values
    function trim(a, b) {
        blobs = blobs.slice(a, b);
        var superBuffer = new Blob(blobs, {
            type: 'video/webm'
        });
        var url = window.URL.createObjectURL(superBuffer);
        $("#video").attr("src", url+"#t="+blobs.length);
        updateRanges(blobs);
    }
    
    // Remove part of the video
    function remove(a, b) {
        var start = blobs.slice(0, a);
        var end = blobs.slice(b, blobs.length);
        blobs = start.concat(end);
        var superBuffer = new Blob(blobs, {
            type: 'video/webm'
        });
        var url = window.URL.createObjectURL(superBuffer);
        $("#video").attr("src", url+"#t="+blobs.length);
        updateRanges(blobs);
    }
    
    // Download video in different formats
    function download() {
        $("#download-label").html(chrome.i18n.getMessage("downloading"))
        if ($("#format-select").val() == "mp4") {
            var superBuffer = new Blob(blobs, {
                type: 'video/mp4'
            });
            var url = window.URL.createObjectURL(superBuffer);
            chrome.downloads.download({
                url: url
            });
            $("#download-label").html(chrome.i18n.getMessage("download"))
            
        } else if ($("#format-select").val() == "webm") {
            var superBuffer2 = new Blob(blobs, {
                type: 'video/webm'
            });
            var url = window.URL.createObjectURL(superBuffer2);
            chrome.downloads.download({
                url: url
            });
            $("#download-label").html(chrome.i18n.getMessage("download"))
        } else if ($("#format-select").val() == "gif") {
            var superBuffer = new Blob(blobs, {
                type: 'video/webm'
            });
            convertStreams(superBuffer, "gif");
        }
    }
    
    // Save on Drive
    function saveDrive() {
        chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
            if (!token) {
              return;
            }
            $("#share span").html(chrome.i18n.getMessage("saving"));
            $("#share").css("pointer-events", "none");

            // Check for folder existence
            const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and name = 'Screenity Videos'");
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.responseType = 'json';
            xhr.onload = () => {
              var res = xhr.response.files;
              if (res.length > 0) {
                var folderId = res[0].id;
                  
                // If folder already exists, the upload the video
                return actuallyUpload(folderId);
              } else {
                // If the folder does NOT exist, then create the folder
                return createFolder();
              }
            };
            xhr.send();
        });
    }

    // Create the "Screenity" folder, if it doesn't already exist
    function createFolder() {
        chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
            if (!token) {
              return;
            }
            $("#share span").html(chrome.i18n.getMessage("saving"));
            $("#share").css("pointer-events", "none");
            
            // Create or find folder (Note: If you change the folder name here, also change on row 158)
            var folderName = "Screenity Videos"
            var metadata = {
                name: [folderName],
                mimeType: 'application/vnd.google-apps.folder'
            };
            
            var form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.responseType = 'json';
            xhr.onload = () => {
                var folderId = xhr.response.id;
                
                // After creating the folder, now proceed to upload
                return actuallyUpload(folderId);
            };
            xhr.send(form);
        });
    }

    // Now that the folder has been located or created, time to upload the video
    function actuallyUpload(folderId) {
        chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
            if (!token) {
              return;
            }
            $("#share span").html(chrome.i18n.getMessage("saving"));
            $("#share").css("pointer-events", "none");
            var metadata = {
                name: 'video.mp4',
                mimeType: 'video/mp4',
                parents: [folderId]
            };
            var superBuffer = new Blob(blobs, {
                type: 'video/mp4'
            });
            var form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            form.append('file', superBuffer);

            // Upload to Drive
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.responseType = 'json';
            xhr.onload = () => {
                var fileId = xhr.response.id;
                $("#share span").html("Save to Drive");
                $("#share").css("pointer-events", "all");
                
                // Open file in Drive in a new tab
                chrome.tabs.create({
                     url: "https://drive.google.com/file/d/"+fileId
                });
                
                // This line copies the upload URL to clipboard
                // Fails if the user leaves the current tab before upload is complete
                navigator.clipboard.writeText("https://drive.google.com/file/d/"+fileId);
            };
            xhr.send(form);
        });
    }
    
    // Check when video has been loaded
    $("#video").on("loadedmetadata", function(){

        // Initialize custom video player
        player = new Plyr('#video', {
            controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
            ratio: '16:9'
        });
        
        // Check when player is ready
        player.on("canplay", function(){
            // First time setup
            if (setup) {
                setup = false;
                initRanges();
                player.currentTime = 0;
            }
            
            // Check when trim slider values change
            trimslider.noUiSlider.on('slide', function(values, handle) {
                $("#trim-start input").val(timestamp(0));
                $("#trim-end input").val(timestamp(values[0]));
                player.currentTime = parseFloat(values[handle]);
            });
            
            // Check when remove slider values change
            removeslider.noUiSlider.on('slide', function(values, handle) {
                $("#remove-start input").val(timestamp(values[0]));
                $("#remove-end input").val(timestamp(values[1]));
                player.currentTime = parseFloat(values[handle]);
            });
            
        });
    })
    

    // Applying a trim
    $("#apply-trim").on("click", function(){
        trim(0, parseInt(trimslider.noUiSlider.get()[0]));
    });
    
    // Removing part of the video
    $("#apply-remove").on("click", function(){
        remove(parseInt(removeslider.noUiSlider.get()[0]), parseInt(removeslider.noUiSlider.get()[1]));
    });
    
    // Download video
    $("#download").on("click", function(){
        download();
    });
    
    // Save on Drive
    $("#share").on("click", function(){
        saveDrive();
    });
    
    // Revert changes made to the video
    $("#reset").on("click", function(){
        reset();
    });
    
    // For mobile version
    $("#show-hide").on("click", function(){
        $("#settings").toggleClass("hidepanel");
        $("#export").toggleClass("hidepanel");
    }) ;
    
    // Localization (strings in different languages)
    $("#made-with").html(chrome.i18n.getMessage("made_with"));
    $("#by-alyssa").html(chrome.i18n.getMessage("by_alyssa"));
    $("#rate-label").html(chrome.i18n.getMessage("rate_extension"));
    $("#show-hide").html(chrome.i18n.getMessage("show_hide"));
    $("#edit-label").html(chrome.i18n.getMessage("edit_recording"));
    $("h2").html(chrome.i18n.getMessage("edit_recording_desc"));
    $("#format-select-label").html(chrome.i18n.getMessage("format"));
    $("#webm-default").html(chrome.i18n.getMessage("webm"));
    $("#trim-label").html(chrome.i18n.getMessage("trim_video"));
    $(".start-label").html(chrome.i18n.getMessage("start"));
    $(".end-label").html(chrome.i18n.getMessage("end"));
    $("#apply-trim").html(chrome.i18n.getMessage("apply"));
    $("#remove-label").html(chrome.i18n.getMessage("remove_part"));
    $("#format-select-label").html(chrome.i18n.getMessage("format"));
    $("#apply-remove").html(chrome.i18n.getMessage("apply"));
    $("#reset").html(chrome.i18n.getMessage("reset"));
    $("#download-label").html(chrome.i18n.getMessage("download"));
    $("#share span").html(chrome.i18n.getMessage("save_drive"));
    $("#apply-trim").html(chrome.i18n.getMessage("apply"));
});
