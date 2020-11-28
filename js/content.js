$(document).ready(function(){
    const uniqueid = "screenity-screen-recorder-extension";
    var recording = true;
    var drag, dragx, dragy, timer, pickr;
    var dragging = false;
    var dragged = false;
    var drawing = false;
    var erasing = false;
    var mousedown = false;
    var pendown = false;
    var cameraon = true;
    var micon = true;
    var tabaudioon = true;
    var arrowon = false;
    var texton = false;
    var clickon = false;
    var focuson = false;
    var hideon = false;
    var sliderhover = false;
    var sliderhovereraser = false;
    var penhover = false;
    var eraserhover = false;
    var cameradevices = [];
    var audiodevices = [];
    var alt = false;
    var mdown = false;
    var holdtalk = false;
    var persistent = false;
    var lastx = 0;
    var lasty = 0;
    var lastscrollx = 0;
    var lastscrolly = 0;
    
    // Get defaults
    function getDefaults() {
        chrome.storage.sync.get(['pushtotalk'], function(result) {
           if (result.pushtotalk) {
               holdtalk = true;
               micEnabled(false);
           } 
        });
        chrome.storage.sync.get(['toolbar'], function(result) {
           persistent = result.toolbar;
           if (!countdownactive && persistent) {
               chrome.runtime.sendMessage({type: "countdown"});
                if (persistent) {
                    $("#"+uniqueid+" #toolbar-record").removeClass("toolbar-inactive");
                }
           }
        });
        chrome.storage.sync.get(['mic'], function(result) {
            if (result.mic == 'disabled' || result.mic == 0) {
                micEnabled(false);
            }
        });
        chrome.storage.sync.get(['camera'], function(result) {
            if (result.camera == 'disabled' || result.camera == 0) {
                cameraEnabled(false);
            } else if (result.camera == 'disabled-access') {
                $("#"+uniqueid+" #camera").addClass("camera-on");
                $("#"+uniqueid+" #toolbar-settings").addClass("settings-camon");
                $("#"+uniqueid+" #wrap-iframe").addClass("no-camera");
                $("#"+uniqueid+" #hide-camera").addClass("camera-hidden");
                $("#"+uniqueid+" #detect-iframe").addClass("no-camera");
            }
        });
    }
    
    injectCode(true, countdownactive);
    
    // Inject or remove all the content
    function injectCode(inject, active) {
        if (inject) { 
            // Reset to start a new recording
            recording = true;
            alt = false;
            mdown = false;
            dragging = false;
            drawing = false;
            erasing = false;
            mousedown = false;
            pendown = false;
            cameraon = true;
            micon = true;
            tabaudioon = true;
            arrowon = false;
            window.arrowon = arrowon;
            texton = false;
            clickon = false;
            focuson = false;
            hideon = false;
            sliderhover = false;
            sliderhovereraser = false;
            penhover = false;
            eraserhover = false;

            // Get list of audio devices
            chrome.runtime.sendMessage({type: "audio-request"}, function(response){
                audiodevices = response.devices;
            });
            
            // Extension wrapper
            var wrapper = "<div id='"+uniqueid+"' style='width: 100%;height:100%;position:absolute;'></div>";
            $("body").append(wrapper);
            
            // Inject the iframe
            var iframeinject = "<div id='canvas-cont'><canvas id='canvas-draw'></canvas></div><div id='click-highlight'></div><div id='detect-iframe'><div id='hide-camera' class='camera-hidden'><img src='"+chrome.extension.getURL('./assets/images/close.svg')+"' class='noselect'></div><div id='change-size' class='camera-hidden'><div id='small-size' class='size-active choose-size'></div><div id='medium-size' class='choose-size'></div><div id='large-size' class='choose-size'></div></div></div><div id='wrap-iframe' class='notransition'><iframe src='"+chrome.extension.getURL('./html/camera.html')+"' allow='camera'></iframe></div><canvas id='canvas-freedraw' width=500 height=500></canvas><canvas id='canvas-focus' width=500 height=500></canvas>";
            $("#"+uniqueid).prepend(iframeinject);

            // Inject the toolbar
            var toolbarinject = "<div id='color-pckr-thing'></div><div id='pen-slider' class='toolbar-inactive'><input type='range' min=1 max=50><img class='slider-track' src='"+chrome.extension.getURL('./assets/images/slider-track.svg')+"'></div><div id='eraser-slider' class='toolbar-inactive'><input type='range' min=1 max=50><img class='slider-track' src='"+chrome.extension.getURL('./assets/images/slider-track.svg')+"'></div><iframe id='toolbar-settings' class='toolbar-inactive' src='"+chrome.extension.getURL('./html/settings.html')+"'></iframe><div id='toolbar-record-cursor' class='toolbar-inactive noselect'><div id='click-tool' class='tool' title='Highlight clicks'><img src='"+chrome.extension.getURL('./assets/images/click.svg')+"'/></div><div id='focus-tool' class='tool' title='Highlight cursor'><img src='"+chrome.extension.getURL('./assets/images/focus.svg')+"'/></div><div id='hide-cursor-tool' class='tool' title='Hide cursor when inactive'><img src='"+chrome.extension.getURL('./assets/images/hide-cursor.svg')+"'/></div></div>   <div id='toolbar-record-pen' class='toolbar-inactive noselect'><div id='pen-tool' class='tool' title='Pen tool'><img src='"+chrome.extension.getURL('./assets/images/pen.svg')+"' class=/></div><div id='eraser' class='tool' title='Eraser tool'><img src='"+chrome.extension.getURL('./assets/images/eraser.svg')+"'/></div><div id='color-pckr' class='tool' title='Change the annotation color'><div id='color-icon'></div></div><div id='text' class='tool' title='Text tool'><img src='"+chrome.extension.getURL('./assets/images/text.svg')+"'/></div><div id='arrow' class='tool' title='Arrow tool'><img src='"+chrome.extension.getURL('./assets/images/arrow.svg')+"'/></div><div id='clear' class='tool' title='Delete all annotations'><img src='"+chrome.extension.getURL('./assets/images/clear.svg')+"'/></div></div>   <div id='toolbar-record' class='toolbar-inactive noselect'><div id='pause' class='tool' title='Pause/resume recording'><img src='"+chrome.extension.getURL('./assets/images/pausewhite.svg')+"'/></div><div id='cursor' class='tool' title='Cursor settings'><img src='"+chrome.extension.getURL('./assets/images/cursor.svg')+"'/></div><div id='pen' class='tool' title='Annotation tools'><img src='"+chrome.extension.getURL('./assets/images/pen.svg')+"'/></div><div id='camera' title='Enable camera' class='tool'><img src='"+chrome.extension.getURL('./assets/images/camera.svg')+"'/></div><div id='mic' class='tool tool-active' title='Enable/disable microphone'><img src='"+chrome.extension.getURL('./assets/images/mic-off.svg')+"'/></div><div id='tab-audio' class='tool tool-active' title='Enable/disable browser audio'><img src='"+chrome.extension.getURL('./assets/images/tab-audio-off.svg')+"'/></div><div id='settings' class='tool' title='Recording settings'><img src='"+chrome.extension.getURL('./assets/images/settings.svg')+"'/></div></div>";
            $("#"+uniqueid).prepend(toolbarinject);
            
            getDefaults();
            
            // Initialize color picker
            pickr = Pickr.create({
            el: '#color-pckr',
            theme: 'nano',
            swatches: false,
            default: "#EB205D",
            useAsButton: true,
            autoReposition: true,
            position: "top-middle",
            components: {
                preview: true,
                opacity: true,
                hue: true,
                interaction: {
                    hex: false,
                    rgba: false,
                    hsla: false,
                    hsva: false,
                    cmyk: false,
                    input: false,
                    clear: false,
                    save: false
                }
            }
            });
            window.pickr = pickr;
            $("#"+uniqueid).append($(".pcr-app"));
            $("#"+uniqueid+" #camera").addClass("camera-on");
            drag = $("#"+uniqueid+" #wrap-iframe");
            
            // Allow CSS transitions (prevents camera from scaling on load)
            window.setTimeout(function(){
                $(".notransition").removeClass("notransition");
            }, 500);
            
            // Check if countdown is enabled
            if (active) {
                $("#"+uniqueid+" #toolbar-record").css("pointer-events", "none");
                chrome.storage.sync.get(['countdown_time'], function(result) {
                    injectCountdown(result.countdown_time);
                });
            } else {
                chrome.runtime.sendMessage({type: "countdown"});
                if (persistent) {
                    $("#"+uniqueid+" #toolbar-record").removeClass("toolbar-inactive");
                }
                if (camerasize && camerapos) {
                    cameraSize(camerasize);
                    setCameraPos(camerapos.x, camerapos.y);
                }
            }
            
            // Initialize canvas
            initCanvas();
        } else {
            $("#"+uniqueid).remove();
        }
    }
    
    // Countdown
    function injectCountdown(time){
        var countdowninject = "<div id='countdown'><img src='"+chrome.extension.getURL('./assets/images/3-countdown.svg')+"'></div>";
        $("#"+uniqueid).prepend(countdowninject);
        countdown(time);
    }
    function delay(num,time,last) {
        window.setTimeout(function(){
            if (!last) {
                $("#"+uniqueid+" #countdown img").attr("src", chrome.extension.getURL('./assets/images/'+num+'-countdown.svg'));
            } else {
                $("#"+uniqueid+" #countdown").addClass("countdown-done");
                window.setTimeout(function(){
                    chrome.runtime.sendMessage({type: "countdown"});
                },10);
                if (persistent) {
                    $("#"+uniqueid+" #toolbar-record").removeClass("toolbar-inactive");
                }
                $("#"+uniqueid+" #toolbar-record").css("pointer-events", "all");
            }
        },time*1000);
    }
    function countdown(time){
        $("#"+uniqueid+" #countdown img").attr("src", chrome.extension.getURL('./assets/images/'+time+'-countdown.svg'));
        for (var i = 0; i <= time; i++) {
            if (i == time) {
                delay(time-i,i,true);
            } else {
                delay(time-i,i,false);
            }
        }
    }
    
    // Pause/resume recording
    function pauseResume(){
        if (recording) {
            chrome.runtime.sendMessage({type: "pause"}, function(response){
                if (response.success) {
                    pauseRecording();
                }
            });
        } else {
            chrome.runtime.sendMessage({type: "resume"}, function(response){
                if (response.success) {
                    resumeRecording();
                }
            });
        }
    }
    
    // Canvas initialization
    var canvas_focus,ctx_focus,canvas_free,ctx_free,canvas;
    var last_mousex = 0;
    var last_mousey = 0;
    var mousex = 0;
    var mousey = 0;
    var pendown = false;
    var tooltype = 'draw';
    var penset = false;
    var textediting = false;
    var mouseover = false;
    var moretools = false;
    const canvas_free_id = "#"+uniqueid+" #canvas-freedraw";
    const canvas_focus_id = "#"+uniqueid+" #canvas-focus";
    var arrow;
    
    function initCanvas() {
        // Reset defaults
        canvas_focus = document.getElementById("canvas-focus");
        ctx_focus = canvas_focus.getContext('2d');
        canvas_free = document.getElementById("canvas-freedraw");
        ctx_free = canvas_free.getContext('2d');
        last_mousex = 0;
        last_mousey = 0;
        mousex = 0;
        mousey = 0;
        pendown = false;
        tooltype = 'draw';
        penset = false;
        $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
        
        // Interactive FabricJs canvas initialization
        canvas = new fabric.Canvas('canvas-draw', {
            preserveObjectStacking: true,
            height: $(document).height(),
            width: $(document).width(),
            renderOnAddRemove: false
        });
        textediting = false;
        $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
        
        // Resize canvas to be full size
        onResize();
        window.setTimeout(function(){
            onResize();
        },500)
        canvas.selection = false;
        mouseover = false;
        moretools = false;
        arrow = new Arrow(canvas);
        
        // Detect mousedown on FabricJs canvas
        canvas.on('mouse:down', function(options) {
            if (textediting) {
                textediting = false;
            } else if (texton && options.target == null && !canvas.getActiveObject()) {
                newTextbox(options.pointer.x, options.pointer.y);
            }
        })
    }
    
    // Focus canvas (highlight cursor)
    function focus(e) {
        ctx_focus.clearRect(0, 0, canvas_focus.width, canvas_focus.height);
        ctx_focus.beginPath();
        ctx_focus.rect(0, 0, canvas_focus.width, canvas_focus.height);
        ctx_focus.fillStyle = "rgba(0,0,0,.45)";
        ctx_focus.globalCompositeOperation = "source-over";
        ctx_focus.fill();
        ctx_focus.beginPath();
        ctx_focus.arc(lastx, lasty, 50, 0, 2 * Math.PI);
        ctx_focus.globalCompositeOperation = "destination-out";
        ctx_focus.fill();
    }
    
    // Free drawing
    function draw(e) {
        mousex = parseInt(e.pageX);
        mousey = parseInt(e.pageY);
        if(pendown) {
            ctx_free.beginPath();
            if (!penset) {
                ctx_free.lineWidth = 10;
            }
            if(tooltype == 'draw') {
                ctx_free.globalCompositeOperation = 'source-over';
                ctx_free.strokeStyle = pickr.getColor().toRGBA();
            } else {
                ctx_free.globalCompositeOperation = 'destination-out';
            }
            ctx_free.moveTo(last_mousex,last_mousey);
            ctx_free.lineTo(mousex,mousey);
            ctx_free.lineJoin = 'round';
            ctx_free.lineCap = 'round';
            ctx_free.stroke();
        }
        last_mousex = mousex;
        last_mousey = mousey;
    }

    // Create a new textbox
    function newTextbox(x, y) {
        if (typeof x !== 'undefined' && typeof y !== 'undefined') {
            var newtext = new fabric.Textbox('', {
                left: x,
                top: y,
                fontFamily: 'sans-serif',
                fill: pickr.getColor().toRGBA().toString(),
                transparentCorners: false,
                lockRotation: true,
                borderColor: '#0E98FC',
                cornerColor: '#0E98FC',
                centeredScaling: false,
                borderOpacityWhenMoving: 1,
                hasControls: true,
                hasRotationPoint: false,
                lockScalingFlip: true,
                lockSkewingX: true,
                lockSkewingY: true,
                cursorWidth: 1,
                width: 100,
                cursorDuration: 1,
                cursorDelay: 250
            });
        }
        newtext.setControlsVisibility({
            bl: true,
            br: true,
            tl: true,
            tr: true,
            mb: false,
            ml: true,
            mr: true,
            mt: false,
            mtr: false,
        });
        canvas.add(newtext).setActiveObject(newtext);
        canvas.bringToFront(newtext);
        canvas.renderAll();
        newtext.enterEditing();
        textediting = true;
    }
    
    // Automatically increase textbox width (do not break words)
    canvas.on(("text:changed"),function()  {
        var linewidth = canvas.getActiveObject().__lineWidths[canvas.getActiveObject().__lineWidths.length-1]; 
        if (!isNaN(linewidth) && linewidth+40 > canvas.getActiveObject().width) {
            canvas.getActiveObject().set("width",(linewidth+40));
            canvas.renderAll();
        }
    })
    
    // Resize canvas to fit document
    function onResize() {
        canvas.setWidth($(document).width());
        canvas.setHeight($(document).height());
        canvas.renderAll();
        canvas_free.style.width = $(document).width();
        canvas_free.style.height = $(document).height();
        canvas_free.width = $(document).width();
        canvas_free.height = $(document).height();
        canvas_focus.style.width = $(document).width();
        canvas_focus.style.height = $(document).height();
        canvas_focus.width = $(document).width();
        canvas_focus.height = $(document).height();
    }
    
    // Detect document dimensions changing
    const resizeObserver = new ResizeObserver(entries => {
        onResize();
    });
    if (window.location.href.includes("twitter.com") || window.location.href.includes("facebook.com") || window.location.href.includes("pinterest.com") || window.location.href.includes("reddit.com")) {
        document.body.style.height = "unset";
    }
    resizeObserver.observe(document.body);
    
    // Show click highlight
    function mouseClick(e) {
        $("#"+uniqueid+" #click-highlight").css("top", e.clientY+$(window).scrollTop()-15+"px");
        $("#"+uniqueid+" #click-highlight").css("left", e.clientX+$(window).scrollLeft()-15+"px");
        $("#"+uniqueid+" #click-highlight").addClass("show-click");
    }
    
    // Reset drawing toolbar
    function resetDrawingTools() {
        arrowon = false;
        window.arrowon = arrowon;
        drawing = false;
        erasing = false;
        texton = false;
        $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
        $("#"+uniqueid+" #pen-tool").removeClass("tool-active");
        $("#"+uniqueid+" #pen-tool img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
        $("#"+uniqueid+" #eraser").removeClass("tool-active");
        $("#"+uniqueid+" #eraser img").attr("src", chrome.extension.getURL('./assets/images/eraser.svg'));
        $("#"+uniqueid+" #arrow").removeClass("tool-active");
        $("#"+uniqueid+" #arrow img").attr("src", chrome.extension.getURL('./assets/images/arrow.svg'));
        $("#"+uniqueid+" #text").removeClass("tool-active");
        $("#"+uniqueid+" #text img").attr("src", chrome.extension.getURL('./assets/images/text.svg'));
    }
    
    // Hide the toolbar (on mouseout if setting is enabled)
    function hideTools() {
        if (!persistent) {
            $("#"+uniqueid+" #pen-slider").addClass("toolbar-inactive");
            $("#"+uniqueid+" #eraser-slider").addClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-record-pen").addClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-record-cursor").addClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-settings").addClass("toolbar-inactive");
            $("#"+uniqueid+" .tool-disabled").removeClass("tool-disabled");
            $("#"+uniqueid+" #toolbar-record").addClass("toolbar-inactive");
        }
    }
    
    // Pause the recording
    function pauseRecording() {
        recording = false;
        
        // Hide opened toolbars
        hideTools();
        moretools = false;
        $("#"+uniqueid+" #toolbar-record-pen").addClass("toolbar-inactive");
        $("#"+uniqueid+" #toolbar-record-cursor").addClass("toolbar-inactive");
        $("#"+uniqueid+" #toolbar-settings").addClass("toolbar-inactive");
        $("#"+uniqueid+" #toolbar-record").removeClass("toolbar-inactive");
        $("#"+uniqueid+" .pen-options").removeClass("pen-options");
        $("#"+uniqueid+" #toolbar-record #settings").removeClass("pen-options");
        
        // Replace icons & tooltips
        $("#"+uniqueid+" #pause img").attr("src", chrome.extension.getURL('./assets/images/play.svg'));
        $("#"+uniqueid+" #cursor img").attr("src", chrome.extension.getURL('./assets/images/complete.svg'));
        $("#"+uniqueid+" #cursor").attr("title", "Save recording");
        $("#"+uniqueid+" #pen img").attr("src", chrome.extension.getURL('./assets/images/cancel.svg'));
        $("#"+uniqueid+" #pen").attr("title", "Discard recording");
        $("#"+uniqueid+" #toolbar-record #settings img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
        
        
        // Hide tools
        $("#"+uniqueid+" #camera").addClass("hide-button");
        $("#"+uniqueid+" #mic").addClass("hide-button");
        $("#"+uniqueid+" #tab-audio").addClass("hide-button");
        $("#"+uniqueid+" #settings").addClass("hide-button");
        
        // Disable all tools
        $("#"+uniqueid+" #pen-slider").addClass("toolbar-inactive");
        drawing = false;
        arrowon = false;
        texton = false;
        clickon = false;
        hideon = false;
        focuson = false;
        $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
        $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
        $("#"+uniqueid+" #canvas-focus").css("pointer-events", 'none');
        $("#"+uniqueid+" #toolbar-record #pen").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-pen #pen-tool").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-pen #eraser").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-pen #text").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record #arrow").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-cursor #click-tool").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-cursor #focus-tool").removeClass("tool-active");
        $("#"+uniqueid+" #toolbar-record-cursor #hide-cursor-tool").removeClass("tool-active");
        
        // Replace images for all tools
        $("#"+uniqueid+" #text img").attr("src", chrome.extension.getURL('./assets/images/text.svg'));
        $("#"+uniqueid+" #pen-tool img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
        $("#"+uniqueid+" #eraser img").attr("src", chrome.extension.getURL('./assets/images/eraser.svg'));
        $("#"+uniqueid+" #arrow img").attr("src", chrome.extension.getURL('./assets/images/arrow.svg'));
        $("#"+uniqueid+" #click-tool img").attr("src", chrome.extension.getURL('./assets/images/click.svg'));
        $("#"+uniqueid+" #focus-tool img").attr("src", chrome.extension.getURL('./assets/images/focus.svg'));
        $("#"+uniqueid+" #hide-cursor-tool img").attr("src", chrome.extension.getURL('./assets/images/hide-cursor.svg'));
        ctx_focus.clearRect(0, 0, canvas_focus.width, canvas_focus.height);
        canvas.defaultCursor = "crosshair";
    }
    
    // Resume the recording
    function resumeRecording() {
        recording = true;
        $("#"+uniqueid+" #pause img").attr("src", chrome.extension.getURL('./assets/images/pausewhite.svg'));
        $("#"+uniqueid+" #cursor img").attr("src", chrome.extension.getURL('./assets/images/cursor.svg'));
        $("#"+uniqueid+" #cursor").attr("title", "Cursor settings");
        $("#"+uniqueid+" #pen img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
        $("#"+uniqueid+" #pen").attr("title", "Annotation tools");
        $("#"+uniqueid+" .hide-button").removeClass("hide-button");
    }
    
    // Stop and save the recording
    function saveRecording(){
        chrome.runtime.sendMessage({type: "stop-save"}); 
    }
    
    // Stop and discard the recording
    function cancelRecording(){
        chrome.runtime.sendMessage({type: "stop-cancel"}); 
    }
    
    // Send the camera and audio devices list to the settings panel
    function sendSettings() {
        chrome.runtime.sendMessage({type: "device-list", cameradevices:cameradevices, audiodevices:audiodevices});
    }
    
    // Switch system/microphone audio on and off
    function audioEnable(type, enable) {
        chrome.runtime.sendMessage({type: "audio-switch", enable:enable, source:type});
    }
    
    // Switch microphone on and off
    function micEnabled(enable) {
        micon = enable;
        if (enable) {
            $("#"+uniqueid+" #mic").addClass("tool-active");
            $("#"+uniqueid+" #mic img").attr("src", chrome.extension.getURL('./assets/images/mic-off.svg'));
            audioEnable("mic", true);
        } else {
            $("#"+uniqueid+" #mic").removeClass("tool-active");
            $("#"+uniqueid+" #mic img").attr("src", chrome.extension.getURL('./assets/images/mic.svg'));
            audioEnable("mic", false);
        }
    }
    
    // Switch camera on and off
    function cameraEnabled(enable) {
        cameraon = enable;
        if (enable) {
            chrome.runtime.sendMessage({type: "camera-check"});
            $("#"+uniqueid+" #wrap-iframe").removeClass("no-camera");
            $("#"+uniqueid+" #detect-iframe").removeClass("no-camera");
            $("#"+uniqueid+" #camera").addClass("camera-on");
            $("#"+uniqueid+" #toolbar-settings").removeClass("settings-camon");
        } else {
            $("#"+uniqueid+" #wrap-iframe").addClass("no-camera");
            $("#"+uniqueid+" #hide-camera").addClass("camera-hidden");
            $("#"+uniqueid+" #detect-iframe").addClass("no-camera");
            $("#"+uniqueid+" #camera").removeClass("camera-on");
            $("#"+uniqueid+" #toolbar-settings").addClass("settings-camon");
        }
    }
    
    // Change camera size
    function cameraSize(id) {
        if (id == "small-size") {
            $("#"+uniqueid+" .size-active").removeClass("size-active");
            $("#"+uniqueid+" #small-size").addClass("size-active");
            $("#"+uniqueid+" #detect-iframe").css({"width": "195px", "height": "195px"});
            $("#"+uniqueid+" #wrap-iframe").css({"width": "195px", "height": "195px"});
            $("#"+uniqueid+" #hide-camera").css({"left": "7px", "top": "7px"});
        } else if (id == "medium-size") {
            $("#"+uniqueid+" .size-active").removeClass("size-active");
            $("#"+uniqueid+" #medium-size").addClass("size-active");
            $("#"+uniqueid+" #detect-iframe").css({"width": "330px", "height": "330px"});
            $("#"+uniqueid+" #wrap-iframe").css({"width": "330px", "height": "330px"});
            $("#"+uniqueid+" #hide-camera").css({"left": "27px", "top": "27px"});
        } else {
            $("#"+uniqueid+" .size-active").removeClass("size-active");
            $("#"+uniqueid+" #large-size").addClass("size-active");
            $("#"+uniqueid+" #detect-iframe").css({"width": "580px", "height": "580px"});
            $("#"+uniqueid+" #wrap-iframe").css({"width": "580px", "height": "580px"});
            $("#"+uniqueid+" #hide-camera").css({"left": "64px", "top": "64px"});
        }
        chrome.runtime.sendMessage({type: "camera-size", size:id});
    }
    
    function setCameraPos(x,y) {
        $("#"+uniqueid+" #wrap-iframe").css("left", x,);
        $("#"+uniqueid+" #wrap-iframe").css("top", y);
        $("#"+uniqueid+" #detect-iframe").css("left", x);
        $("#"+uniqueid+" #detect-iframe").css("top", y);
    }
    
    // When the mouse button is clicked
    function mouseDown(e) {
        if (clickon && !$("#"+uniqueid+" .pcr-app").is(e.target) && $("#"+uniqueid+" .pcr-app").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-record").is(e.target) && $("#"+uniqueid+" #toolbar-record").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-record-pen").is(e.target) && $("#"+uniqueid+" #toolbar-record-pen").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-record-cursor").is(e.target) && $("#"+uniqueid+" #toolbar-record-cursor").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-settings").is(e.target) && $("#"+uniqueid+" #toolbar-settings").has(e.target).length === 0 && !$("#"+uniqueid+" #pen-slider").is(e.target) && $("#"+uniqueid+" #pen-slider").has(e.target).length === 0 && !$("#"+uniqueid+" #eraser-slider").is(e.target) && $("#"+uniqueid+" #eraser-slider").has(e.target).length === 0) {
            mouseClick(e)
        }
        mousedown = true;
    }
    
    // When the mouse button is released
    function mouseUp(e) {
       if (dragged) {
           chrome.runtime.sendMessage({type: "camera-pos", x:$("#"+uniqueid+" #detect-iframe").css("left"), y:$("#"+uniqueid+" #detect-iframe").css("top")});
           dragged = false;
       }
       $("#"+uniqueid+" #detect-iframe").css("pointer-events", "all");
       $("#"+uniqueid+" #toolbar-record").css("pointer-events", "all");
       pendown = false;
       mousedown = false;
       dragging = false; 
        window.setTimeout(function(){
            $(".show-click").removeClass("show-click");
        }, 200);
        
        // Hide tools (if setting is enabled)
        if (!$("#"+uniqueid+" .pcr-app").is(e.target) && $("#"+uniqueid+" .pcr-app").has(e.target).length === 0 &!$("#"+uniqueid+" #toolbar-record").is(e.target) && $("#"+uniqueid+" #toolbar-record").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-record-pen").is(e.target) && $("#"+uniqueid+" #toolbar-record-pen").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-record-cursor").is(e.target) && $("#"+uniqueid+" #toolbar-record-cursor").has(e.target).length === 0 && !$("#"+uniqueid+" #toolbar-settings").is(e.target) && $("#"+uniqueid+" #toolbar-settings").has(e.target).length === 0 && !$("#"+uniqueid+" #pen-slider").is(e.target) && $("#"+uniqueid+" #pen-slider").has(e.target).length === 0 && !$("#"+uniqueid+" #eraser-slider").is(e.target) && $("#"+uniqueid+" #eraser-slider").has(e.target).length === 0)  {
            hideTools();
        }
    }
    
    // When the mouse moves
    function mouseMove(e) {
        lastx = e.pageX;
        lasty = e.pageY;
        if (dragging && cameraon) {
            // Drag the camera container
            drag.css("left", e.clientX-dragx-$(window).scrollLeft()+"px",);
            drag.css("top", e.clientY-dragy-$(window).scrollTop()+"px");
            $("#"+uniqueid+" #detect-iframe").css("left", e.clientX-dragx-$(window).scrollLeft()+"px");
            $("#"+uniqueid+" #detect-iframe").css("top", e.clientY-dragy-$(window).scrollTop()+"px");
            dragged = true;
        } else {
          // Free drawing
          if (pendown) {
            draw(e);
          }
          // Highlight cursor
          if (focuson) {
            focus(e);  
          }
        } 
        // Hide cursor if inactive for more than 2 seconds
        if (hideon) {
          clearTimeout(timer);
          $(".no-cursor").removeClass("no-cursor");
          timer = window.setTimeout(function(){
              $("body").addClass("no-cursor");
          },2000)
        } else {
          $(".no-cursor").removeClass("no-cursor");
        }
    }
    
    // Start freedrawing
    function startDrawing(e) {
        if (drawing) {
            last_mousex = parseInt(e.pageX);
            last_mousey = parseInt(e.pageY);
            mousex = parseInt(e.pageX);
            mousey = parseInt(e.pageY);
            pendown = true;
        }
    }
    
    // Detect when a color has been selected
    pickr.on("change", (color,instance) => {
       $("#"+uniqueid+" #color-icon").css("background-color", color.toRGBA().toString()); 
        if (canvas.getActiveObject() && canvas.getActiveObject().type == "textbox") {
            canvas.getActiveObject().set("fill", color.toRGBA().toString());
        } else if (canvas.getActiveObject()) {
            canvas.getActiveObject().set("stroke", color.toRGBA().toString());
        }
        canvas.renderAll();
    });
    
    // Detect push to talk keystroke
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
    
    // Pause/resume recording
    $(document).on("click", "#"+uniqueid+" #pause", function(e){
        pauseResume();
    });
    
    // Change camera size
    $(document).on("click", "#"+uniqueid+" .choose-size", function(e){
        cameraSize(e.target.id);
    })
    
    // Hide/show camera
    $(document).on("click", "#"+uniqueid+" #hide-camera", function(){
        cameraEnabled(false);

    })
    $(document).on("click", "#camera", function(){
        cameraEnabled(true);
    })
    
    // Turn on/off microphone
    $(document).on("click", "#"+uniqueid+" #mic", function(){
        micEnabled(!micon)
    })
    
    // Turn on/off tab audio
    $(document).on("click", "#"+uniqueid+" #tab-audio", function(){
        if (tabaudioon) {
            audioEnable("tab", false);
            tabaudioon = false;
            $("#"+uniqueid+" #tab-audio").removeClass("tool-active");
            $("#"+uniqueid+" #tab-audio img").attr("src", chrome.extension.getURL('./assets/images/tab-audio.svg'));
            chrome.runtime.sendMessage({type: "tab-audio-off"});
        } else {
            audioEnable("tab", true);
            tabaudioon = true;
            $("#"+uniqueid+" #tab-audio").addClass("tool-active");
            $("#"+uniqueid+" #tab-audio img").attr("src", chrome.extension.getURL('./assets/images/tab-audio-off.svg'));
            chrome.runtime.sendMessage({type: "tab-audio-on"});
        }
    })
    
    // Show camera settings
    $(document).on("mouseover", "#"+uniqueid+" #detect-iframe", function(e){
        if (cameraon) {
            $(".camera-hidden").removeClass("camera-hidden"); 
        }
    });
    
    // Hide camera settings
    $(document).on("mouseout", "#"+uniqueid+" #detect-iframe", function(e){
        $("#"+uniqueid+" #hide-camera").addClass("camera-hidden"); 
        $("#"+uniqueid+" #change-size").addClass("camera-hidden"); 
    });
    
    // Detect a click on the camera container (possible drag)
    $(document).on("mousedown", "#"+uniqueid+" #detect-iframe", function(e){
        if (e.which !== 1) return;
        e.stopPropagation()
        drag = $("#"+uniqueid+" #wrap-iframe");
        dragx = e.clientX-drag.offset().left;
        dragy = e.clientY-drag.offset().top;
        dragging = true;
    });
    
    // Detect scroll to update focus circle position
    $(document).on("scroll", function(e){
        if (focuson) {
            if (lastscrollx != $(document).scrollLeft()){
                lastx -= lastscrollx;
                lastscrollx = $(document).scrollLeft();
                lastx += lastscrollx;
            }
            if (lastscrolly != $(document).scrollTop()){
                lasty -= lastscrolly;
                lastscrolly = $(document).scrollTop();
                lasty += lastscrolly;
            }   
            focus(e);  
        }
    })
    
    // Prevent camera being dragged while drawing
    $(document).on("mousemove", "#"+uniqueid+" #detect-iframe", function(e){
        if (drawing && pendown) {
            $("#"+uniqueid+" #detect-iframe").css("pointer-events", "none");
        }
    })
    
    // Detect click on freedrawing canvas (to start drawing)
    $(document).on('mousedown', canvas_free_id, function(e) {
        startDrawing(e);
    });
    $(document).on('touchstart', canvas_free_id, function(e) {
        startDrawing(e);
    });
    
    // Detect click anywhere on the page (except tools)
    $(document).on("mousedown", function(e){
        mouseDown(e);
    });
    $(document).on("touchstart", function(e){
        mouseDown(e);
    });
    
    // Detect mouse up anywhere on the page
    $(document).on("mouseup", function(e){
        mouseUp(e);
    });
    $(document).on("touchend", function(e){
        mouseUp(e);
    });
    
    // Detect cursor moving anywhere on the page
    $(document).on("mousemove", function(e){
        mouseMove(e);
    });
    $(document).on("touchmove", function(e){
        mouseMove(e);
    })
    
    // Change line thickness for pen and eraser
    $(document).on("input change", "#"+uniqueid+" #pen-slider input", function(){
        penset = true;
        ctx_free.lineWidth = $(this).val();
    })
    $(document).on("input change", "#"+uniqueid+" #eraser-slider input", function(){
        penset = true;
        ctx_free.lineWidth = $(this).val();
    })
    
    // Delete selected object (only for arrows and text)
    $(document).on("keydown", function(e){
        if ((e.keyCode == 46 || e.key == 'Delete' || e.code == 'Delete' || e.key == 'Backspace') && canvas.getActiveObject() && !canvas.getActiveObject().isEditing) {
            canvas.remove(canvas.getActiveObject());
            canvas.renderAll(); 
        }
    })
    
    // Detect when the window changes size
    $(window).resize(function() {
        onResize();
    }); 
    
    // Show toolbar if hovering (if setting is enabled)
    $(document).on("mouseover", "#"+uniqueid+" #toolbar-record", function(){
        if (!mousedown) {
            mouseover = true;
            $("#"+uniqueid+" #toolbar-record").removeClass("toolbar-inactive");
            if ($("#"+uniqueid+" #pen").hasClass("pen-options")) {
                $("#"+uniqueid+" #toolbar-record-pen").removeClass("toolbar-inactive");
            } else if ($("#"+uniqueid+" #settings").hasClass("pen-options")) {
                $("#"+uniqueid+" #toolbar-settings").removeClass("toolbar-inactive");
            } else if ($("#"+uniqueid+" #cursor").hasClass("pen-options")) {
                $("#"+uniqueid+" #toolbar-record-cursor").removeClass("toolbar-inactive");
            }
        }
    });
    
    // Hide toolbar on mouseout (if setting is enabled)
    $(document).on("mouseout", "#"+uniqueid+" #toolbar-record", function(){
        mouseover = false;
        window.setTimeout(function(){
            if (!mouseover && !moretools && !persistent) {
                $("#"+uniqueid+" #toolbar-record").addClass("toolbar-inactive");
            }
        },500)
    });
    
    // Open settings panel
    $(document).on("click", "#"+uniqueid+" #toolbar-record #settings", function(){
        if ($("#"+uniqueid+" #toolbar-record #settings").hasClass("pen-options")) {
            moretools = false;
            $("#"+uniqueid+" #toolbar-record #settings").removeClass("pen-options");
            $("#"+uniqueid+" #toolbar-record #settings img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
            $("#"+uniqueid+" #toolbar-settings").addClass("toolbar-inactive");
        } else {
            sendSettings();
            moretools = true;
            $("#"+uniqueid+" #toolbar-settings").removeClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-record #pen").removeClass("pen-options");
            if (arrowon || texton || drawing) {
                $("#"+uniqueid+" #toolbar-record #pen").addClass("tool-active");
                $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/penactive.svg'));
            } else {
                $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
            }
            $("#"+uniqueid+" #toolbar-record #cursor").removeClass("pen-options");
            $("#"+uniqueid+" #toolbar-record #cursor img").attr("src", chrome.extension.getURL('./assets/images/cursor.svg'));
            $("#"+uniqueid+" #toolbar-record-cursor").addClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-record-pen").addClass("toolbar-inactive");
            $("#"+uniqueid+" #toolbar-record #settings").addClass("pen-options");
            $("#"+uniqueid+" #toolbar-record #settings img").attr("src", chrome.extension.getURL('./assets/images/close.svg'));
        }
    });
    
    // Show/hide slider for pen tool
    $(document).on("mouseenter", "#"+uniqueid+" #pen-tool", function(){
        if (drawing && tooltype == "draw") {
            $("#"+uniqueid+" #pen-slider").removeClass("toolbar-inactive"); 
            penhover = true;
        }
    });
    $(document).on("mouseleave", "#"+uniqueid+" #pen-tool", function(){
        penhover = false;
        window.setTimeout(function(){
            if (!sliderhover && drawing && tooltype == "draw"){
               $("#"+uniqueid+" #pen-slider").addClass("toolbar-inactive");  
            }
        },50)
    });
    $(document).on("mouseenter", "#"+uniqueid+" #pen-slider", function(){
       sliderhover = true; 
    });
    $(document).on("mouseleave", "#"+uniqueid+" #pen-slider", function(){
        sliderhover = false;
        window.setTimeout(function(){
            if (!penhover && drawing && tooltype == "draw"){
                $("#"+uniqueid+" #pen-slider").addClass("toolbar-inactive");  
            }
        },50)
    });
    
    // Show/hide slider for eraser tool
    $(document).on("mouseenter", "#"+uniqueid+" #eraser", function(){
        if (drawing && tooltype == "erase") {
       $("#"+uniqueid+" #eraser-slider").removeClass("toolbar-inactive"); 
        eraserhover = true;
        }
    });
    $(document).on("mouseleave", "#"+uniqueid+" #eraser", function(){
        eraserhover = false;
        window.setTimeout(function(){
            if (!sliderhovereraser && drawing && tooltype == "erase"){
                $("#"+uniqueid+" #eraser-slider").addClass("toolbar-inactive");  
            }
        },50)
    });
    $(document).on("mouseenter", "#"+uniqueid+" #eraser-slider", function(){
       sliderhovereraser = true; 
    });
    $(document).on("mouseleave", "#"+uniqueid+" #eraser-slider", function(){
        sliderhovereraser = false;
        window.setTimeout(function(){
            if (!eraserhover && drawing && tooltype == "erase"){
                $("#"+uniqueid+" #eraser-slider").addClass("toolbar-inactive");  
            }
        },50)
    });
    
    // Open pen toolbar, or discard the recording if it's paused
    $(document).on("click", "#"+uniqueid+" #toolbar-record #pen", function(){
        if (recording) {
            if ($("#"+uniqueid+" #toolbar-record #pen").hasClass("pen-options")) {
                moretools = false;
                $("#"+uniqueid+" #toolbar-record #pen").removeClass("pen-options");
                $("#"+uniqueid+" #toolbar-record-pen").addClass("toolbar-inactive");
                if (arrowon || texton || drawing) {
                    $("#"+uniqueid+" #toolbar-record #pen").addClass("tool-active");
                    $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/penactive.svg'));
                } else {
                    $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
                }
            } else {
                $("#"+uniqueid+" #toolbar-record #pen").removeClass("tool-active");
                moretools = true;
                $("#"+uniqueid+" #toolbar-record #settings").removeClass("pen-options");
                $("#"+uniqueid+" #toolbar-record #settings img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
                $("#"+uniqueid+" #toolbar-settings").addClass("toolbar-inactive");
                $("#"+uniqueid+" #toolbar-record #cursor").removeClass("pen-options");
                $("#"+uniqueid+" #toolbar-record-cursor").addClass("toolbar-inactive");
                $("#"+uniqueid+" #toolbar-record #cursor img").attr("src", chrome.extension.getURL('./assets/images/cursor.svg'));
                $("#"+uniqueid+" #toolbar-record #pen").addClass("pen-options");
                $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/close.svg'));
                $("#"+uniqueid+" #toolbar-record-pen").removeClass("toolbar-inactive");
            }
        } else {
            cancelRecording();
        }
    });
    
    // Open cursor toolbar, or save the recording if it's paused
    $(document).on("click", "#"+uniqueid+" #toolbar-record #cursor", function(){
        if (recording) {
            if ($("#"+uniqueid+" #toolbar-record #cursor").hasClass("pen-options")) {
                moretools = false;
                $("#"+uniqueid+" #toolbar-record #cursor").removeClass("pen-options");
                $("#"+uniqueid+" #toolbar-record #cursor img").attr("src", chrome.extension.getURL('./assets/images/cursor.svg'));
                $("#"+uniqueid+" #toolbar-record-cursor").addClass("toolbar-inactive");
            } else {
                moretools = true;
                $("#"+uniqueid+" #toolbar-record #settings").removeClass("pen-options");
                $("#"+uniqueid+" #toolbar-record #settings img").attr("src", chrome.extension.getURL('./assets/images/settings.svg'));
                $("#"+uniqueid+" #toolbar-settings").addClass("toolbar-inactive");
                $("#"+uniqueid+" #toolbar-record #pen").removeClass("pen-options");
                if (arrowon || texton || drawing) {
                    $("#"+uniqueid+" #toolbar-record #pen").addClass("tool-active");
                    $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/penactive.svg'));
                } else {
                    $("#"+uniqueid+" #toolbar-record #pen img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
                }
                $("#"+uniqueid+" #toolbar-record-pen").addClass("toolbar-inactive");
                $("#"+uniqueid+" #toolbar-record #cursor").addClass("pen-options");
                $("#"+uniqueid+" #toolbar-record #cursor img").attr("src", chrome.extension.getURL('./assets/images/close.svg'));
                $("#"+uniqueid+" #toolbar-record-cursor").removeClass("toolbar-inactive");
            }
        } else {
            saveRecording();
        }
    });
    
    // Enable/disable freedrawing
    $(document).on("click", "#"+uniqueid+" #pen-tool", function(){
       if ($("#"+uniqueid+" #pen-tool").hasClass("tool-active")) {
           $("#"+uniqueid+" #pen-slider").addClass("toolbar-inactive");
           drawing = false;
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
           $("#"+uniqueid+" #pen-tool").removeClass("tool-active");
           $("#"+uniqueid+" #pen-tool img").attr("src", chrome.extension.getURL('./assets/images/pen.svg'));
       } else {
           $("#"+uniqueid+" #pen-slider").removeClass("toolbar-inactive");
           resetDrawingTools();
           canvas.discardActiveObject();
           canvas.renderAll(); 
           tooltype = 'draw';
           drawing = true;
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'all');
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
           $("#"+uniqueid+" #pen-tool").addClass("tool-active");
           $("#"+uniqueid+" #pen-tool img").attr("src", chrome.extension.getURL('./assets/images/penactive.svg'));
       }
    });
    
    // Enable/disable eraser
    $(document).on("click", "#"+uniqueid+" #eraser", function(){
       if ($("#"+uniqueid+" #eraser").hasClass("tool-active")) {
           $("#"+uniqueid+" #eraser-slider").addClass("toolbar-inactive");
           drawing = false;
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
           $("#"+uniqueid+" #eraser").removeClass("tool-active");
           $("#"+uniqueid+" #eraser img").attr("src", chrome.extension.getURL('./assets/images/eraser.svg'));
       } else {
           $("#"+uniqueid+" #eraser-slider").removeClass("toolbar-inactive");
           resetDrawingTools();
           canvas.discardActiveObject();
           canvas.renderAll(); 
           drawing = true;
           tooltype = 'erase';
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'all');
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
           $("#"+uniqueid+" #eraser").addClass("tool-active");
           $("#"+uniqueid+" #eraser img").attr("src", chrome.extension.getURL('./assets/images/eraseractive.svg'));
       }
    });
    
    // Enable/disable text tool
    $(document).on("click", "#"+uniqueid+" #text", function(){
       if (texton) {
           texton = false;
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
           $("#"+uniqueid+" #text").removeClass("tool-active");
           $("#"+uniqueid+" #text img").attr("src", chrome.extension.getURL('./assets/images/text.svg'));
           canvas.defaultCursor = "crosshair";
       } else {
           resetDrawingTools();
           texton = true;
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'all');
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
           $("#"+uniqueid+" #text").addClass("tool-active");
           $("#"+uniqueid+" #text img").attr("src", chrome.extension.getURL('assets/images/textactive.svg'));
           canvas.defaultCursor = "text";
       }
    });
    
    // Enable/disable arrow tool
    $(document).on("click", "#"+uniqueid+" #arrow", function(){
       if (arrowon) {
           arrowon = false;
           window.arrowon = arrowon;
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'none');
           $("#"+uniqueid+" #arrow").removeClass("tool-active");
           $("#"+uniqueid+" #arrow img").attr("src", chrome.extension.getURL('./assets/images/arrow.svg'));
       } else {
           resetDrawingTools();
           arrowon = true;
           window.arrowon = arrowon;
           $("#"+uniqueid+" #canvas-cont").css("pointer-events", 'all');
           $("#"+uniqueid+" #canvas-freedraw").css("pointer-events", 'none');
           $("#"+uniqueid+" #arrow").addClass("tool-active");
           $("#"+uniqueid+" #arrow img").attr("src", chrome.extension.getURL('./assets/images/arrowactive.svg'));
           canvas.defaultCursor = "crosshair";
       }
    });
    
    // Enable/disable click highlight
    $(document).on("click", "#"+uniqueid+" #click-tool", function(){
       if (clickon) {
           clickon = false;
           $("#"+uniqueid+" #click-tool").removeClass("tool-active");
           $("#"+uniqueid+" #click-tool img").attr("src", chrome.extension.getURL('./assets/images/click.svg'));
       } else {
           clickon = true;
           $("#"+uniqueid+" #click-tool").addClass("tool-active");
           $("#"+uniqueid+" #click-tool img").attr("src", chrome.extension.getURL('./assets/images/clickactive.svg'));
       }
    });
    
    // Enable/disable cursor highlight
    $(document).on("click", "#"+uniqueid+" #focus-tool", function(e){
       if (focuson) {
           ctx_focus.clearRect(0, 0, canvas_focus.width, canvas_focus.height);
           focuson = false;
           $("#"+uniqueid+" #focus-tool").removeClass("tool-active");
           $("#"+uniqueid+" #focus-tool img").attr("src", chrome.extension.getURL('./assets/images/focus.svg'));
       } else {
           focuson = true;
           focus(e);
           $("#"+uniqueid+" #focus-tool").addClass("tool-active");
           $("#"+uniqueid+" #focus-tool img").attr("src", chrome.extension.getURL('./assets/images/focusactive.svg'));
       }
    });
    
    // Enable/disable hiding cursor on inactivity
    $(document).on("click", "#"+uniqueid+" #hide-cursor-tool", function(e){
       if (hideon) {
           ctx_focus.clearRect(0, 0, canvas_focus.width, canvas_focus.height);
           hideon = false;
           $("#"+uniqueid+" #hide-cursor-tool").removeClass("tool-active");
           $("#"+uniqueid+" #hide-cursor-tool img").attr("src", chrome.extension.getURL('./assets/images/hide-cursor.svg'));
       } else {
           hideon = true;
           $("#"+uniqueid+" #hide-cursor-tool").addClass("tool-active");
           $("#"+uniqueid+" #hide-cursor-tool img").attr("src", chrome.extension.getURL('./assets/images/hide-cursoractive.svg'));
       }
    });
    
    // Clear the canvas
    $(document).on("click", "#clear", function(){
        canvas.clear();
        ctx_free.clearRect(0, 0, canvas_free.width, canvas_free.height);
    })

    // Listen for popup/background/content messages
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type == "camera-list") {
            cameradevices = request.devices;
        } else if (request.type == "audio-list") {
            audiodevices = request.devices;
        } else if (request.type == "end") {
            injectCode(false, false);
        } else if (request.type == "pause/resume") {
            pauseResume();
        } else if (request.type == "mute/unmute") {
            if (micon) {
                micEnabled(false);
            } else {
                micEnabled(true);
            }
        } else if (request.type == "push-to-talk") {
            holdtalk = request.enabled;
            micEnabled(false);
        } else if (request.type == "switch-toolbar") {
            persistent = request.enabled;
            if (persistent) {
                $("#toolbar-record").removeClass("toolbar-inactive");
            } else {
                $("#toolbar-record").addClass("toolbar-inactive");
            }
        } else if (request.type == "restart") {
            camerapos = request.camerapos;
            camerasize = request.camerasize;
            injectCode(true, request.countdown);
        } else if (request.type == "update-camera") {
            if (request.id == "disabled" || request.id == 0) {
                cameraEnabled(false);
            } else if (request.id == "disabled-access") {
                $("#"+uniqueid+" #camera").addClass("camera-on");
                $("#"+uniqueid+" #toolbar-settings").addClass("settings-camon");
                $("#"+uniqueid+" #wrap-iframe").addClass("no-camera");
                $("#"+uniqueid+" #hide-camera").addClass("camera-hidden");
                $("#"+uniqueid+" #detect-iframe").addClass("no-camera");
            } else {
                cameraEnabled(true);
            }
        } else if (request.type == "update-cmic") {
            if (request.id == "disabled" || request.id == 0) {
                micEnabled(false);
            } else {
                micEnabled(true);
            }
        } else if (request.type == "no-camera-access") {
            $("#"+uniqueid+" #camera").addClass("camera-on");
            $("#"+uniqueid+" #toolbar-settings").addClass("settings-camon");
            $("#"+uniqueid+" #wrap-iframe").addClass("no-camera");
            $("#"+uniqueid+" #hide-camera").addClass("camera-hidden");
            $("#"+uniqueid+" #detect-iframe").addClass("no-camera");
        }
    });
});