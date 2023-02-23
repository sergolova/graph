// set static fields
Drawer.DEF_GRID_COUNT = 10;
Drawer.DEF_ZOOM_STEP = 10;
Drawer.ZOOM_TIMER_MS = 50;
Drawer.CANVAS_PADDING = 30;
Drawer.ARROW_SIZE = 5;  // axis arrow size
Drawer.SERIF_SIZE = 4;  // axis serif size
Drawer.CURSOR_RAD = 2;
Drawer.POINT_TEXT_INDENT = 10;
Drawer.TRANSPARENT_BG = false;
Drawer.SERIF_TEXT_INDENT_X = 5;
Drawer.SERIF_TEXT_INDENT_Y = 5;
Drawer.WHEEL_PERCENT = 10;
Drawer.ZOOM_CURSOR_TIMEOUT = 300;

Drawer.CUR_DRAG = 'grab';
Drawer.CUR_NORMAL = 'crosshair';
Drawer.CUR_ZOOM = 'zoom';
Drawer.CUR_ZOOMIN = 'zoom-in';
Drawer.CUR_ZOOMOUT = 'zoom-out';

Drawer.HIGH_QUALITY = 1;
Drawer.LOW_QUALITY = 3;

// colors
Drawer.CLR_FORMULA_DEFAULT = "#FF0000";
Drawer.CLR_CANVAS_BG = 1;
Drawer.CLR_GRAPH_BG = "#e0e0e0";
Drawer.CLR_GRID_BG = "#EEE";
Drawer.CLR_GRID = "#BBB";
Drawer.CLR_AXIS = "#555";
Drawer.CLR_ZERO_CROSS = "#444";
Drawer.CLR_CURSOR_CROSS = '#00779D';
Drawer.CLR_CURSOR_Y = '#159d00';
Drawer.CLR_CURSOR_Y_TEXT = '#0c5d00';
Drawer.CLR_CURSOR_TEXT = '#004257';
Drawer.CLR_SERIF = "#555";
Drawer.CLR_SERIF_TEXT = '#44A';
Drawer.CLR_SEL_FW = 'rgba(200,100,100,0.6)';
Drawer.CLR_SEL_FW_BG = 'rgba(200,100,100,0.3)';
Drawer.CLR_SEL_FW_TEXT = 'rgba(200,100,100,1)';
Drawer.CLR_SEL_RV = 'rgba(0,66,87,0.6)';
Drawer.CLR_SEL_RV_BG = 'rgb(0,119,157,0.3)';
Drawer.CLR_SEL_RV_TEXT = 'rgba(0,66,87,1)';

function Drawer(canvasID) {
  // declare properties 
  this.canvasID = canvasID;
  Object.defineProperties(this, {
    'canvasElem': {
      get: () => document.getElementById(this.canvasID)
    }
  });
  
  this.context = null;
  this.curPoint = new Point();          // cursor point. Relative to the upper left corner of the canvas
  this.userCoord = new Coord(-10, -10, 10, 10);   // Вычислительная система координат, заданная пользователем
  this.axisCoord = new Coord();   // Текущая вычислительная система координат в зависимости от Zoom или Drag.
  this.graphCoord = new Coord();  // Размеры канвы графика. Вычисляется
  this.canvasCoord = new Coord(0, 0, 1000, 1000); // Размеры всей канвы для рисования
  this.canvasData = null;
  this.formula = [];
  this.formulaColors = [];
  this.showCursors = true;
  this.gridCount = Drawer.DEF_GRID_COUNT;
  this.zoomStep = Drawer.DEF_ZOOM_STEP;
  this.quality = 1;
  this.onError = null;
  
  // declare private variables
  this._JSONFields = 'userCoord,canvasCoord,formula,formulaColors,showCursors,gridCount,x1,y1,x2,y2';
  this._timer = null; // redraw timer
  this._cursorSave = null;
  
  this._sel = {
    begin: false,
    coord: null          // текущая область выделения
  };
  
  // private variables for zoom
  this._zoom = {
    begin: false,
    timer: null,
    deltaX1: 0,
    deltaX2: 0,
    deltaY1: 0,
    deltaY2: 0,
    iterator: 0
  };
  
  this._drag = {
    begin: false,       // drag in progress
    coord: new Coord(), // 1 - start drag point, 2 - current drag point
    axis: new Coord(),  // axis at the moment of start of dragging
  }
  
  // call when constructing prototype!
  this.setEvents();
};

Drawer.prototype.toString = function () {
  return JSON.stringify(this, this._JSONFields.split`,`);
};

Drawer.prototype.fromString = function (str) {
  let num = 0; // number of loaded fields
  if ( str ) {
    let obj = JSON.parse(str);
    let fields = this._JSONFields.split(',');
    for (const [key, value] of Object.entries(obj)) {
      if ( fields.includes(key) ) {
        if ( typeof this[key] === 'object' ) {
          Object.assign(this[key], value);
        }
        else {
          this[key] = value;
        }
        num++;
      }
    }
    this.reload();
  }
  return num > 0; // or num===this._JSONFields.length
};

Drawer.prototype.reload = function (needRedraw = false) {
  this.axisCoord.copyFrom(this.userCoord);
  this.graphCoord.copyFrom(this.canvasCoord);
  this.graphCoord.modify(+Drawer.CANVAS_PADDING, +Drawer.CANVAS_PADDING, -Drawer.CANVAS_PADDING, -Drawer.CANVAS_PADDING);
  this.curPoint.set(0, 0);
  this.onSelEnd();
  this.onDragEnd();
  if ( needRedraw ) {
    this.redraw();
    this.drawCursor();
  }
}

Drawer.prototype.setEvents = function () {
  let cnv = this.canvasElem;
  if ( cnv ) {
    if ( cnv.getContext ) {
      this.context = cnv.getContext('2d', {willReadFrequently: true});
      cnv.addEventListener('wheel', this.onMouseWheel.bind(this));
      cnv.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
      cnv.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
      cnv.addEventListener('mouseleave', this.onCanvasMouseLeave.bind(this));
      cnv.addEventListener('mouseup', this.onCanvasMouseUp.bind(this));
      cnv.addEventListener('dblclick', this.onCanvasDoubleClick.bind(this));
      cnv.addEventListener('contextmenu', this.onCanvasContextMenu.bind(this));
      return true;
    }
    else {
      this.context = null;
      cnv.removeEventListener('mousedown');
      cnv.removeEventListener('mousemove');
      cnv.removeEventListener('mouseleave');
      cnv.removeEventListener('mouseup');
      cnv.removeEventListener('contextmenu');
      cnv.removeEventListener('dblclick');
      cnv.removeEventListener('wheel');
      return false;
    }
  }
};

Drawer.prototype.onCanvasMouseDown = function () {
  let event = window.event;
  
  if ( (event.button === 0) && event.ctrlKey ) {
    this._sel.coord = new Coord(event.offsetX, event.offsetY, 0, 0);
    this.onSelStart();
  }
  else if ( (event.button === 0) && !event.ctrlKey ) {
    // save mouse start position
    this._drag.coord.set(event.offsetX, event.offsetY, event.offsetX, event.offsetY);
    // save axis at the moment of start of dragging
    this._drag.axis.copyFrom(this.axisCoord);
    this.onDragStart();
  }
};

Drawer.prototype.onCanvasMouseMove = function () {
  if ( this._sel.begin ) {
    this._sel.coord.set2(event.offsetX, event.offsetY);
    this.paste(this.canvasCoord.x1, this.canvasCoord.y1); // restore canvas image
    this.drawSelection();
    if ( this._sel.coord.isInverterX && this._sel.coord.isInverterY ) {
      this.canvasElem.style.cursor = Drawer.CUR_ZOOMOUT;
    }
    else {
      this.canvasElem.style.cursor = Drawer.CUR_ZOOMIN;
    }
    
  }
  else if ( this._drag.begin ) {
    this._drag.coord.set2(event.offsetX, event.offsetY);
    this.onDrag();
  }
  else if ( this.showCursors ) {
    this.curPoint = new Point(event.offsetX, event.offsetY);
    this.paste(this.canvasCoord.x1, this.canvasCoord.y1); // restore canvas image
    this.drawCursor();
  }
};

Drawer.prototype.onCanvasMouseUp = function () {
  let event = window.event;
  
  if ( this._sel.begin ) {
    this._sel.coord.set2(event.offsetX, event.offsetY);
    this.onSelEnd();
    this.onZoomStart();
  }
  else if ( this._drag.begin ) {
    
    this.onDragEnd();
    this.redraw(); // need redraw after quality change
  }
  this._canvasData = null;
};

Drawer.prototype.onCanvasMouseLeave = function () {
  this.onCanvasMouseUp();
};

Drawer.prototype.onSelStart = function () {
  this._sel.begin = true;
  if ( this.canvasElem ) {
    this._cursorSave = this.canvasElem.style.cursor;
    this.canvasElem.style.cursor = Drawer.CUR_ZOOM;
  }
}

Drawer.prototype.onSelEnd = function () {
  this._sel.begin = false;
  if ( this.canvasElem ) {
    this.canvasElem.style.cursor = this._cursorSave;
  }
}

Drawer.prototype.onCanvasContextMenu = function () {
  this.clearSelection();
  // this.redraw();
  this.onCanvasMouseUp();
};

Drawer.prototype.onCanvasDoubleClick = function () {
  this.reload();
};

Drawer.prototype.onMouseWheel = function () {
  // zoom
  let event = window.event;
  let axis = this.axisCoord;
  let all = !event.altKey && !event.shiftKey;
  let sign = Math.sign(event.deltaY);
  
  let deltaX = (event.shiftKey || all) ?
    (sign * axis.width * Drawer.WHEEL_PERCENT / 100 / 2) : 0;
  let deltaY = (event.altKey || all) ?
    (sign * axis.height * Drawer.WHEEL_PERCENT / 100 / 2) : 0;
  
  axis.x1 -= deltaX;
  axis.y1 -= deltaY;
  axis.x2 += deltaX;
  axis.y2 += deltaY;
  
  this.onSelEnd();
  this.redraw();
  this.onCanvasMouseMove();
};

Drawer.prototype.onZoomStart = function () {
  // too small selection rect
  let sel = this._sel.coord;
  let axis = this.axisCoord;
  let canvas = this.canvasCoord;
  
  if ( (sel.width < 10) || (sel.height < 10) ) {
    // erase selection on canvas
    this.paste(canvas.x1, canvas.y1)
  }
  else
    // need undo zoom
  if ( sel.isInverterX && sel.isInverterY ) {
    this.reload(true);
  }
  else {
    // need zoom
    sel.normalize();
    
    // так как зум анимированный и будет проходить this.zoomStep итераций,
    // нам нужно вычислить дельту для каждой координаты для одной итерации
    // получаем разницу между начальной и конечной координатой и делим её на this.zoomStep.
    // для передачи дельт между функциями используем onZoom как объект
    
    let zoomCoord = this.selToAxis();
    zoomCoord.normalize();
    zoomCoord.dbg('zoom');
    this._zoom.deltaX1 = Math.abs(axis.x1 - zoomCoord.x1) / this.zoomStep;
    this._zoom.deltaX2 = Math.abs(axis.x2 - zoomCoord.x2) / this.zoomStep;
    this._zoom.deltaY1 = Math.abs(axis.y1 - zoomCoord.y1) / this.zoomStep;
    this._zoom.deltaY2 = Math.abs(axis.y2 - zoomCoord.y2) / this.zoomStep;
    
    debug('dx1=' + this._zoom.deltaX1.toFixed(1) +
      ' dy1=' + this._zoom.deltaY1.toFixed(1) +
      ' dx2=' + this._zoom.deltaX2.toFixed(1) +
      ' dy2=' + this._zoom.deltaY2.toFixed(1));
    
    this._zoom.iterator = 0; // strip
    this.quality = Drawer.LOW_QUALITY; // decrease quality for speed
    clearTimeout(this._zoom.timer);
    // Запускаем таймер зума
    this._zoom.begin = true;
    this._zoom.timer = setTimeout(this.onZoom.bind(this), Drawer.ZOOM_TIMER_MS);
  }
};

Drawer.prototype.onZoomEnd = function () {
  this.quality = Drawer.HIGH_QUALITY; // // возвращаем качество
  this.redraw(); // redraw with normal dx
  this._zoom.begin = false;
};

Drawer.prototype.onZoom = function () {
  this._zoom.iterator++;
  if ( this._zoom.iterator > this.zoomStep ) {
    this.onZoomEnd();
    return;
  }
  
  this.axisCoord.x1 += Math.abs(this._zoom.deltaX1);
  this.axisCoord.x2 -= Math.abs(this._zoom.deltaX2);
  this.axisCoord.y1 += Math.abs(this._zoom.deltaY1);
  this.axisCoord.y2 -= Math.abs(this._zoom.deltaY2);
  this.axisCoord.normalize();
  this.axisCoord.dbg('step ' + this._zoom.iterator);
  this.redraw(); // redraw with small dx ()
  
  setTimeout(this.onZoom.bind(this), 15);
};

Drawer.prototype.callOnError = function (err) {
  if ( this.onError ) {
    this.onError(this, err);
  }
  return false; //always!
};

Drawer.prototype._clearBorder = function () {
  let ctx = this.context;
  let cnv = this.canvasCoord;
  let graph = this.graphCoord;
  
  ctx.clearRect(cnv.x1, cnv.y1, cnv.width, graph.y1 - cnv.y1);
  ctx.clearRect(cnv.x1, graph.y2, cnv.width, cnv.y2 - graph.y2);
  ctx.clearRect(cnv.x1, cnv.y1, graph.x1, cnv.height);
  ctx.clearRect(graph.x2, cnv.y1, cnv.x2 - graph.x2, cnv.height);
};

Drawer.prototype._fillBorder = function () {
  let ctx = this.context;
  let cnv = this.canvasCoord;
  let graph = this.graphCoord;
  
  ctx.beginPath();
  ctx.fillStyle = Drawer.CLR_GRAPH_BG;
  
  ctx.fillRect(cnv.x1, cnv.y1, cnv.width, graph.y1 - cnv.y1);
  ctx.fillRect(cnv.x1, graph.y2, cnv.width, cnv.y2 - graph.y2);
  ctx.fillRect(cnv.x1, cnv.y1, graph.x1, cnv.height);
  ctx.fillRect(graph.x2, cnv.y1, cnv.x2 - graph.x2, cnv.height);
  
  ctx.stroke();
};

Drawer.prototype.checkCriticalVariables = function () {
  if ( !this.context ) {
    return this.callOnError('Context is null');
  }
  else if ( !this.axisCoord.isValid() ) {
    return this.callOnError('Invalid axisCoord');
  }
  else if ( !this.graphCoord.isValid() ) {
    return this.callOnError('Invalid graphCoord');
  }
  else if ( !this.canvasCoord.isValid() ) {
    return this.callOnError('Invalid canvasCoord');
  }
  return true;
}

// main draw function
Drawer.prototype.redraw = function () {
  if ( !this.checkCriticalVariables() ) {
    return;
  }
  
  try {
    //  this.clearCanvas(); // clear all
    this._drawGrid();
    this.drawGraph();
    if ( Drawer.TRANSPARENT_BG ) {
      this._clearBorder();
    }
    else {
      this._fillBorder();
    }
    this._drawAxis();
    this._drawSerifsAndText(true, true);
    this.copy();
    return true;
  } catch (err) {
    return this.callOnError(err.message);
  }
};

Drawer.prototype.clearCanvas = function () {
  let cnv = this.canvasCoord;
  this.context.clearRect(cnv.x1, cnv.y1, cnv.width, cnv.height);
};

Drawer.prototype.copy = function (coord) {
  if ( !coord ) {
    coord = this.canvasCoord;
  }
  this.canvasData = this.context.getImageData(coord.x1, coord.y1, coord.x2, coord.y2);
};

Drawer.prototype.paste = function (x, y) {
  if ( this.canvasData ) {
    this.context.putImageData(this.canvasData, x, y);
  }
  else {
    console.log('Drawer.prototype.paste: canvasData=' + this.canvasData);
  }
};

// redraw with delay
Drawer.prototype.redrawTimeout = function (timeout) {
  clearTimeout(this._timer);
  this._timer = setTimeout(this.redraw.bind(this), timeout);
};

Drawer.prototype.selToValidSel = function () {
  let sel = this._sel.coord;
  let graph = this.graphCoord;
  
  let validSel = new Coord();
  validSel.copyFrom(sel);
  validSel.normalize();
  
  // selection rect must be in graph rect
  if ( validSel.x1 < graph.x1 ) {
    validSel.x1 = graph.x1;
  }
  if ( validSel.y1 < graph.y1 ) {
    validSel.y1 = graph.y1;
  }
  if ( validSel.x2 > graph.x2 ) {
    validSel.x2 = graph.x2;
  }
  if ( validSel.y2 > graph.y2 ) {
    validSel.y2 = graph.y2;
  }
  return validSel;
};

Drawer.prototype.selToAxis = function () {
  let graph = this.graphCoord;
  let axis = this.axisCoord;
  
  let validSel = this.selToValidSel();
  
  let xa1 = graph.pointXToCoord(validSel.x1, axis);
  let ya1 = graph.pointYToCoord(validSel.y1, axis);
  let xa2 = graph.pointXToCoord(validSel.x2, axis);
  let ya2 = graph.pointYToCoord(validSel.y2, axis);
  
  return new Coord(xa1, ya1, xa2, ya2);
};

Drawer.prototype.formatPointStr = function (x, y) {
  return `(${x.toFixed(1)}, ${y.toFixed(1)})`
};

Drawer.prototype.getTextHintPoint = function (ctx, txt, x, y, coord) {
  let xVal, yVal;
  let r = ctx.measureText(txt);
  let fontHeight = r.fontBoundingBoxAscent + r.fontBoundingBoxDescent;
  
  if ( x + r.width + Drawer.POINT_TEXT_INDENT >= coord.x2 ) {
    xVal = x - Drawer.POINT_TEXT_INDENT - r.width;
  }
  else {
    xVal = x + Drawer.POINT_TEXT_INDENT;
  }
  
  if ( y + fontHeight + Drawer.POINT_TEXT_INDENT >= coord.y2 ) {
    yVal = y - Drawer.POINT_TEXT_INDENT - fontHeight;
  }
  else {
    yVal = y + Drawer.POINT_TEXT_INDENT;
  }
  
  return {x: xVal, y: yVal}
};

Drawer.prototype.onDragStart = function () {
  this._drag.begin = true;
  this.quality = Drawer.LOW_QUALITY;
  // save and set drag cursor
  if ( this.canvasElem ) {
    this._cursorSave = this.canvasElem.style.cursor;
    this.canvasElem.style.cursor = Drawer.CUR_DRAG;
  }
}

Drawer.prototype.onDragEnd = function () {
  this._drag.begin = false;
  this.quality = Drawer.HIGH_QUALITY;
  // restore cursor
  if ( this.canvasElem ) {
    this.canvasElem.style.cursor = this._cursorSave;
  }
};

Drawer.prototype.onDrag = function () {
  let graph = this.graphCoord;
  let drag = this._drag.coord;
  let axis = this.axisCoord;
  
  let axisDrag = new Coord(
    graph.pointXToCoord(drag.x1, axis),
    graph.pointYToCoord(drag.y1, axis),
    graph.pointXToCoord(drag.x2, axis),
    graph.pointYToCoord(drag.y2, axis));
  
  axis.set(
    this._drag.axis.x1 - axisDrag.deltaX,
    this._drag.axis.y1 - axisDrag.deltaY,
    this._drag.axis.x2 - axisDrag.deltaX,
    this._drag.axis.y2 - axisDrag.deltaY);
  
  this.redraw()
};

Drawer.prototype.drawCursor = function () {
  if ( !this.checkCriticalVariables() ) {
    return;
  }
  
  let ctx = this.context;
  let graph = this.graphCoord;
  let cur = this.curPoint;
  let axis = this.axisCoord;
  let xa1 = graph.pointXToCoord(cur.x, axis);
  let ya1 = graph.pointYToCoord(cur.y, axis);
  
  // cursor in graph rect
  if ( graph.containPoint(cur.x, cur.y) ) {
    // draw cursor cross
    ctx.beginPath();
    ctx.strokeStyle = Drawer.CLR_CURSOR_CROSS;
    ctx.moveTo(cur.x, graph.y1);
    ctx.lineTo(cur.x, graph.y2);
    ctx.moveTo(graph.x1, cur.y);
    ctx.lineTo(graph.x2, cur.y);
    ctx.stroke();
    
    // draw text for cursor cross
    ctx.fillStyle = Drawer.CLR_CURSOR_TEXT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';
    let txt = this.formatPointStr(xa1, ya1);
    let pt = this.getTextHintPoint(ctx, txt, cur.x, cur.y, graph);
    ctx.fillText(txt, pt.x, pt.y);
    
    // calc Y-value for cursor
    for (let iForm = 0; iForm < this.formula.length; iForm++) {
      let f = this.formula[iForm];
      let evalFunc = new Function('x', 'return ' + f);
      let x = xa1;
      let y;
      let error = false;
      try {
        y = evalFunc(x);
      } catch (e) {
        error = true;
      }
      
      if ( !error ) {
        let yc = axis.pointYToCoord(y, graph); // Y-axis => Y-Canvas
        
        // draw Y-cursor cross
        ctx.beginPath();
        ctx.strokeStyle = this.formulaColors[iForm];
        if ( graph.containPoint(cur.x, yc) ) {
          ctx.moveTo(graph.x1, yc);
          ctx.lineTo(graph.x2, yc);
          ctx.arc(cur.x, yc, Drawer.CURSOR_RAD, 0, 2 * Math.PI);
          
          // draw text for Y-cursor cross
          ctx.fillStyle = Drawer.CLR_CURSOR_Y_TEXT;
          let txt = this.formatPointStr(xa1, y);
          let pt = this.getTextHintPoint(ctx, txt, cur.x, yc, graph);
          ctx.fillText(txt, pt.x, pt.y);
        }
        ctx.stroke();
      }// error
    }
  }
};

Drawer.prototype.drawSelection = function () {
  let ctx = this.context;
  let sel = this._sel.coord;
  let inv = !(sel.isInverterX && sel.isInverterY);
  let validSel = this.selToValidSel();
  let selAxis = this.selToAxis();
  
  // draw rect
  ctx.fillStyle = inv ? Drawer.CLR_SEL_RV_BG : Drawer.CLR_SEL_FW_BG;
  ctx.fillRect(validSel.x1, validSel.y1, validSel.width, validSel.height);
  ctx.strokeStyle = inv ? Drawer.CLR_SEL_RV : Drawer.CLR_SEL_FW;
  ctx.strokeRect(validSel.x1, validSel.y1, validSel.width, validSel.height);
  
  // select style for text 
  ctx.fillStyle = inv ? Drawer.CLR_SEL_RV_TEXT : Drawer.CLR_SEL_FW_TEXT;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  
  // draw text coordinates x1/y1
  let txt = this.formatPointStr(selAxis.x1, selAxis.y1);
  let pt = this.getTextHintPoint(ctx, txt, validSel.x1, validSel.y1, this.graphCoord);
  ctx.fillText(txt, pt.x, pt.y);
  
  // draw text coordinates x2/y2
  txt = this.formatPointStr(selAxis.x2, selAxis.y2);
  pt = this.getTextHintPoint(ctx, txt, validSel.x2, validSel.y2, this.graphCoord);
  ctx.fillText(txt, pt.x, pt.y);
};

Drawer.prototype.clearSelection = function () {
  let cnv = this.canvasCoord;
  this.paste(cnv.x1, cnv.y1);
  this.onSelEnd();
};

Drawer.prototype._drawSerifsAndText = function (drawSerif, drawText) {
  if ( !this.gridCount ) {
    return
  }
  
  let ctx = this.context;
  let graph = this.graphCoord;
  let cnv = this.canvasCoord;
  let axis = this.axisCoord;
  
  ctx.beginPath();
  ctx.strokeStyle = Drawer.CLR_SERIF;
  
  if ( drawSerif ) {
    let gridLen = graph.width / this.gridCount;
    for (let i = gridLen; i < (graph.width - 1); i += gridLen) {
      ctx.moveTo(graph.x1 + i, graph.y2 + Drawer.SERIF_SIZE);
      ctx.lineTo(graph.x1 + i, graph.y2 - Drawer.SERIF_SIZE);
    }
    
    gridLen = graph.height / this.gridCount;
    for (let i = gridLen; i < (graph.height - 1); i += gridLen) {
      ctx.moveTo(graph.x1 - Drawer.SERIF_SIZE, graph.y1 + i);
      ctx.lineTo(graph.x1 + Drawer.SERIF_SIZE, graph.y1 + i);
    }
    ctx.stroke();
  }
  
  if ( drawText ) {
    ctx.beginPath();
    ctx.fillStyle = Drawer.CLR_SERIF_TEXT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    
    let gridLen = graph.width / this.gridCount;
    // let fontHeight = r.fontBoundingBoxAscent + r.fontBoundingBoxDescent;
    let prevTextBorder = cnv.x1;
    for (let i = 0; i < graph.width; i += gridLen) {
      let txt = graph.pointXToCoord(graph.x1 + i, axis).toFixed(1);
      let r;
      let x = graph.x1 + i;
      if ( x > prevTextBorder ) { // draw if the marks do not intersect
        r = ctx.measureText(txt);
        ctx.fillText(txt, x, graph.y2 + Drawer.SERIF_SIZE);
        prevTextBorder = x + r.width + Drawer.SERIF_TEXT_INDENT_X;
      }
    }
    
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'end';
    
    prevTextBorder = cnv.y2;
    gridLen = graph.height / this.gridCount;
    for (let i = 0; i < graph.height; i += gridLen) {
      let txt = graph.pointYToCoord(graph.y2 - i, axis).toFixed(1);
      let r;
      let y = graph.y2 - i;
      if ( y < prevTextBorder ) { // draw if the marks do not intersect
        r = ctx.measureText(txt);
        ctx.fillText(txt, graph.x1 - Drawer.SERIF_SIZE, y, Drawer.CANVAS_PADDING);
        prevTextBorder = y - (r.fontBoundingBoxAscent + r.fontBoundingBoxDescent) / 2 - Drawer.SERIF_TEXT_INDENT_Y;
      }
    }// for
  } // draw text
};

Drawer.prototype._drawAxis = function () {
  let graph = this.graphCoord;
  let ctx = this.context;
  
  ctx.beginPath();
  ctx.strokeStyle = Drawer.CLR_AXIS;
  // Y axis
  ctx.moveTo(graph.x1, graph.y2);
  ctx.lineTo(graph.x1, graph.y1);
  ctx.lineTo(graph.x1 - Drawer.ARROW_SIZE, graph.y1 + Drawer.ARROW_SIZE);
  ctx.moveTo(graph.x1, graph.y1);
  ctx.lineTo(graph.x1 + Drawer.ARROW_SIZE, graph.y1 + Drawer.ARROW_SIZE);
  // X axis
  ctx.moveTo(graph.x1, graph.y2);
  ctx.lineTo(graph.x2, graph.y2);
  ctx.lineTo(graph.x2 - Drawer.ARROW_SIZE, graph.y2 - Drawer.ARROW_SIZE);
  ctx.moveTo(graph.x2, graph.y2);
  ctx.lineTo(graph.x2 - Drawer.ARROW_SIZE, graph.y2 + Drawer.ARROW_SIZE);
  
  ctx.stroke();
  ctx.moveTo(graph.x1, graph.y2);
};

Drawer.prototype._drawGrid = function () {
  let graph = this.graphCoord;
  let axis = this.axisCoord;
  let ctx = this.context;
  let cnvX = axis.pointXToCoord(0, graph);
  let cnvY = axis.pointYToCoord(0, graph);
  
  ctx.beginPath();
  
  ctx.fillStyle = Drawer.CLR_GRID_BG;
  ctx.fillRect(graph.x1, graph.y1, graph.width, graph.height);
  
  if ( this.gridCount > 0 ) {
    ctx.strokeStyle = Drawer.CLR_GRID;
    
    // vertical grid lines
    let gridLen = graph.width / this.gridCount;
    if ( gridLen ) {
      for (let i = gridLen; i < graph.width; i += gridLen) {
        ctx.moveTo(graph.x1 + i, graph.y2);
        ctx.lineTo(graph.x1 + i, graph.y2 - graph.height);
      }
    }
    
    // horizontal grid lines
    gridLen = graph.height / this.gridCount;
    if ( gridLen ) {
      for (let i = gridLen; i < graph.height; i += gridLen) {
        ctx.moveTo(graph.x1, graph.y2 - i);
        ctx.lineTo(graph.x1 + graph.width, graph.y2 - i);
      }
    }
  }
  
  ctx.stroke();
  
  // draw ZERO cross
  ctx.beginPath();
  ctx.strokeStyle = Drawer.CLR_ZERO_CROSS;
  
  if ( graph.containPoint(cnvX, graph.y1) ) {
    ctx.moveTo(cnvX, graph.y1);
    ctx.lineTo(cnvX, graph.y2);
  }
  if ( graph.containPoint(graph.x1, cnvY) ) {
    ctx.moveTo(graph.x1, cnvY);
    ctx.lineTo(graph.x2, cnvY);
  }
  ctx.stroke();
};

Drawer.prototype.drawGraph = function () {
  let graph = this.graphCoord;
  let axis = this.axisCoord;
  let ctx = this.context;
  
  if ( this.formula.length === 0 ) {
    return
  }
  
  let dx = this.quality * axis.width / graph.width;
  
  // formula cycle
  for (let iForm = 0; iForm < this.formula.length; iForm++) {
    ctx.strokeStyle = this.formulaColors[iForm] || Drawer.CLR_FORMULA_DEFAULT;
    let first = true;
    let f = this.formula[iForm];
    ctx.beginPath();
    
    // создаём функцию из строки. Это делается через new Function() один раз перед циклом.
    // вместо чтобы в цикле вычислять через eval().
    // экономия времени огромная!
    // При создании функции с использованием new Function, её свойство [[Scope]] ссылается не на текущий LexicalEnvironment, а на window!!!!
    let evalFunc = new Function('x', 'return ' + f);
    
    for (let x = axis.x1; x <= axis.x2; x += dx) {
      let y;
      try {
        y = evalFunc(x);
      } catch (e) {
        break;
      }
      
      if ( !isFinite(y) ) { // разрыв функции
        first = true;
        //	debug('infinite');
        continue;
      }
      
      // переводим числовые координаты в коорд. КАНВЫ
      let cnvX = axis.pointXToCoord(x, graph);
      let cnvY = axis.pointYToCoord(y, graph);
      
      if ( first ) { // переход к первой точке
        ctx.moveTo(cnvX, cnvY);
        first = false;
      }
      ctx.lineTo(cnvX, cnvY);
    }
    
    ctx.stroke();
  }
};

// -----------------------------------------------------------------------------------------------
// Functions constructor
// -----------------------------------------------------------------------------------------------
function Functions() {
  this.table = [];
  this.add('Math.E', 'e', 'The mathematical constant e');
  this.add('Math.LN10', 'ln10', 'The natural logarithm of 10');
  this.add('Math.LN2', 'ln2', 'The base-2 logarithm of e');
  this.add('Math.LOG2E', 'log2e', 'The base-10 logarithm of e');
  this.add('Math.LOG10E', 'log10e', 'The base-10 logarithm of e');
  this.add('Math.PI', 'pi', 'This is the ratio of the circumference of a circle to its diameter.');
  this.add('Math.SQRT1_2', 'sqrt12', 'The square root of 0.5, or equivalently one divided by the square root of 2');
  this.add('Math.SQRT2', 'sqrt2', 'The square root of 2');
  this.add('Math.abs', 'abs', 'Returns the absolute value of a number');
  this.add('Math.acos', 'acos', 'Returns the arc cosine (or inverse cosine) of a number');
  this.add('Math.asin', 'asin', 'Returns the arcsine of a number');
  this.add('Math.atan', 'atan', 'Returns the arctangent of a number');
  this.add('Math.atan2', 'atan2', 'Returns the angle (in radians) from the X axis to a point');
  this.add('Math.ceil', 'ceil', 'Returns the smallest integer greater than or equal to its numeric argument');
  this.add('Math.sin', 'sin', 'Returns the square root of a number');
  this.add('Math.cos', 'cos', 'Returns the cosine of a number');
  this.add('Math.exp', 'exp', 'Returns e (the base of natural logarithms) raised to a power');
  this.add('Math.floor', 'floor', 'Returns the greatest integer less than or equal to its numeric argument');
  this.add('Math.log', 'log', 'Returns the natural logarithm (base e) of a number');
  this.add('Math.max', 'max', '(v1,v2,v3,...) Returns the larger of a set of supplied numeric expressions');
  this.add('Math.min', 'min', '(v1,v2,v3,...) Returns the smaller of a set of supplied numeric expressions');
  this.add('Math.pow', 'pow', '(value, power) Returns the value of a base expression taken to a specified power');
  this.add('Math.random', 'random', 'Returns a pseudorandom number between 0 and 1');
  this.add('Math.round', 'round', 'Returns a supplied numeric expression rounded to the nearest number');
  this.add('Math.sqrt', 'sqrt', 'Returns the square root of a number');
  this.add('Math.tan', 'tan', 'Returns the tangent of a number');
  
  Object.defineProperty(this, 'count', {
    get: function () {
      return this.table.length;
    }
  });
}

Functions.prototype.add = function (funcJS, funcUser, descr) {
  this.table.push({js: funcJS, usr: funcUser, dsc: descr});
};

// copy from start to "="
Functions.prototype.getKey = function (index, keyName) {
  return keyName ? this.table[index][keyName] : this.table[index];
};

Functions.prototype.correctFormula = function (formula) {
  formula.replace(' ', '');           // delete spaces
  formula = formula.toLowerCase();   // to lower case
  formula = formula.replace('math.', ''); //
  
  // correct all math functions and constants
  for (let i = 0; i < this.count; i++) {
    let rpl = this.getKey(i, 'js');
    let fnd = this.getKey(i, 'usr');
    
    fnd = new RegExp('(?:^|\\b)(' + fnd + ')(?=\\b|$)', 'gi');
    formula = formula.replace(fnd, rpl);
  }
  return formula;
};