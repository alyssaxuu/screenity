// Extended fabric line class
var arrowmousedown = false;
var arrowmousemove = false;
fabric.LineArrow = fabric.util.createClass(fabric.Line, {
    type: 'lineArrow',
    initialize: function(element, options) {
        options || (options = {});
        this.callSuper('initialize', element, options);
    },
    toObject: function() {
        return fabric.util.object.extend(this.callSuper('toObject'));
    },
    _render: function(ctx) {
        this.ctx = ctx;
        this.callSuper('_render', ctx);
        let p = this.calcLinePoints();
        let xDiff = this.x2 - this.x1;
        let yDiff = this.y2 - this.y1;
        let angle = Math.atan2(yDiff, xDiff);
        this.drawArrow(angle, p.x2, p.y2, this.heads[0]);
        ctx.save();
        xDiff = -this.x2 + this.x1;
        yDiff = -this.y2 + this.y1;
        angle = Math.atan2(yDiff, xDiff);
        this.drawArrow(angle, p.x1, p.y1, this.heads[1]);
    },
    drawArrow: function(angle, xPos, yPos, head) {
        this.ctx.save();
        if (head) {
            this.ctx.translate(xPos, yPos);
            this.ctx.rotate(angle);
            this.ctx.beginPath();
            this.ctx.moveTo(10, 0);
            this.ctx.lineTo(-8, 8);
            this.ctx.lineTo(-8, -8);
            this.ctx.closePath();
        }
        this.ctx.fillStyle = this.stroke;
        this.ctx.fill();
        this.ctx.restore();
    }
});

fabric.LineArrow.fromObject = function(object, callback) {
    callback && callback(new fabric.LineArrow([object.x1, object.y1, object.x2, object.y2], object));
};

fabric.LineArrow.async = true;
var Arrow = (function() {
    function Arrow(canvas) {
        this.canvas = canvas;
        this.className = 'Arrow';
        this.isDrawing = false;
        this.bindEvents();
    }
    
    // Detect canvas events
    Arrow.prototype.bindEvents = function() {
        var inst = this;
        inst.canvas.on('mouse:down', function(o) {
            inst.onMouseDown(o);
        });
        inst.canvas.on('mouse:move', function(o) {
            inst.onMouseMove(o);
        });
        inst.canvas.on('mouse:up', function(o) {
            inst.onMouseUp(o);
        });
        inst.canvas.on('object:moving', function(o) {
            inst.disable();
        });
    }
    
    Arrow.prototype.onMouseUp = function(o) {
        // Check if the user has moved the mouse to prevent accidental arrows
        if (window.arrowon && arrowmousemove) {
            var inst = this;
            this.line.set({
                dirty: true,
                objectCaching: true
            });
            if (inst.isEnable()) {
                inst.canvas.discardActiveObject().renderAll();
            }
            this.line.hasControls = true;
            this.line.hasBorders = true;
            this.line.setControlsVisibility({
                bl: true,
                br: true,
                tl: true,
                tr: true,
                mb: false,
                ml: false,
                mr: false,
                mt: false,
                mtr: true,
            });
            inst.canvas.renderAll();
            inst.disable();
        } else if (window.arrowon && !arrowmousemove && arrowmousedown) {
            var inst = this;
            inst.canvas.remove(inst.canvas.getActiveObject());
        }
        arrowmousemove = false;
        arrowmousedown = false;
    };

    Arrow.prototype.onMouseMove = function(o) {
        if (window.arrowon && arrowmousedown) {
            var inst = this;
            if (!inst.isEnable()) {
                return;
            }
            if (arrowmousedown) {
                arrowmousemove = true;
            }
            var pointer = inst.canvas.getPointer(o.e);
            var activeObj = inst.canvas.getActiveObject();
            activeObj.set({
                x2: pointer.x,
                y2: pointer.y
            });
            activeObj.setCoords();
            inst.canvas.renderAll();
        }
    };

    Arrow.prototype.onMouseDown = function(o) {
        // Check if an arrow can be drawn (not clicking an existing canvas object)
        if (o.target == null && window.arrowon) {
            arrowmousedown = true;
            arrowmousemove = false;
            var inst = this;
            inst.enable();
            var pointer = inst.canvas.getPointer(o.e);
            var points = [pointer.x, pointer.y, pointer.x, pointer.y];
            this.line = new fabric.LineArrow(points, {
                strokeWidth: 3,
                fill: pickr.getColor().toRGBA(),
                stroke: pickr.getColor().toRGBA(),
                originX: 'center',
                originY: 'center',
                hasBorders: false,
                hasControls: false,
                transparentCorners: false,
                autoReposition: false,
                borderColor: '#0E98FC',
                cornerColor: '#0E98FC',
                objectCaching: false,
                perPixelTargetFind: true,
                heads: [1, 0]
            });
            inst.canvas.add(this.line).setActiveObject(this.line);
        } else {
            arrowmousedown = false;
        }
    };

    Arrow.prototype.isEnable = function() {
        return this.isDrawing;
    }

    Arrow.prototype.enable = function() {
        this.isDrawing = true;
    }

    Arrow.prototype.disable = function() {
        this.isDrawing = false;
    }
    return Arrow;
}());