''

// set static fields
Drawer.DEFAULT_GRID = 10;
Drawer.DEFAULT_ZOOM_STEP = 20;

function Drawer(canvasID) {
  // declare propertys
  this.context = null;
  this.myObserver = null;
  this.selCoord = new Coord(0, 0, 0, 0);          // текущая область выделения
  this.axisCoord = new Coord(-10, -10, 10, 10);   // Вычислительная система координат
  this.graphCoord = new Coord(40, 400, 600, 40);  // Размеры канвы графика
  this.canvasCoord = new Coord(0, 0, 1000, 1000); // Размеры всей канвы для рисования
  this.canvasData = null;
  this.formula = '';
  this.gridCount = Drawer.DEFAULT_GRID;
  this.zoomStep = Drawer.DEFAULT_ZOOM_STEP;
  this.quality = 1;  //
  this.onError = null;
  
  // declare private variables
  this._ARROW_SIZE = 5;  // axis arrow size
  this._SERIF_SIZE = 4;  // axis serif size
  this._timer = null; // redraw timer
  this._canvasData = null;
  
  // private variables for zoom
  this._zoom = {
    timer: null,
    deltaX1: 0,
    deltaX2: 0,
    deltaY1: 0,
    deltaY2: 0,
    iterator: 0
  };
  
  // call when constructing prototype!
  this.setEvents(canvasID);
}

const myObserver = new ResizeObserver(entries => {
  onResizeCanvas();
});

Drawer.prototype.setEvents = function (canvasID) {
  let cnv = $(canvasID)[0];
  if (cnv.getContext) {
    this.context = cnv.getContext('2d', {willReadFrequently: true});
    
    cnv.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
    cnv.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
    cnv.addEventListener('mouseleave', this.onCanvasMouseLeave.bind(this));
    cnv.addEventListener('mouseup', this.onCanvasMouseUp.bind(this));
    cnv.addEventListener('contextmenu', this.onCanvasContextMenu.bind(this));
    myObserver.observe($(ID_CANVAS_DIV)[0]);
    myObserver.observe($('body')[0]);
    
    return true;
  } else {
    cnv.removeEventListener('mousedown');
    cnv.removeEventListener('mousemove');
    cnv.removeEventListener('mouseleave');
    cnv.removeEventListener('mouseup');
    cnv.removeEventListener('contextmenu');
    cnv.removeEventListener('resize');
    return false;
  }
};

Drawer.prototype.onCanvasMouseDown = function () {
  let event = window.event;
  this._zoom.leftBtnDown = !!(event.button == 0);
  
  if (this._zoom.leftBtnDown) {
    this.selCoord.set1(event.offsetX, event.offsetY);
    // copy canvas image
    if (this._canvasData) {
      this.paste(this.canvasCoord.x1, this.canvasCoord.y1);
    } else {
      this.copy(this.canvasCoord);
    }
  }
};

Drawer.prototype.onCanvasContextMenu = function () {
  this.clearSelection();
  this.redraw();
};

Drawer.prototype.onCanvasMouseMove = function () {
  if (this._zoom.leftBtnDown) {
    this._zoom.iterator = this.zoomStep;
    clearInterval(this._zoom.timer);
    
    this.selCoord.set2(event.offsetX, event.offsetY);
    this.drawSelection();
  }
};

Drawer.prototype.onCanvasMouseUp = function () {
  let event = window.event;
  
  if (this._zoom.leftBtnDown) {
    this.selCoord.set2(event.offsetX, event.offsetY);
    this._zoom.leftBtnDown = false;
    
    this.onZoomStart();
  }
  this._canvasData = null;
};

Drawer.prototype.onCanvasMouseLeave = function () {
  this.onCanvasMouseUp();
};

Drawer.prototype.onZoomStart = function () {
  // too small selection rect
  let sel = this.selCoord;
  let axis = this.axisCoord;
  let canvas = this.canvasCoord;
  
  if ((sel.width < 10) || (sel.height < 10)) {
    // erase selection on canvas
    this.paste(canvas.x1, canvas.y1)
  } else
    // need undo zoom
  if (sel.isInverterX && sel.isInverterY) {
    onInput();
  } else {
    // need zoom
    sel.normalize();
    
    // так как зум анимированный и будет проходить this.zoomStep итераций,
    // нам нужно вычислить дельту для каждой координаты для одной итерации
    // получаем разницу между начальной и конечной координотой и делим её на this.zoomStep.
    // для передачи дельт между функциями используем onZoom как объект
    
    sel.dbg('selection');
    axis.dbg('axis now');
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
    this.quality = 3; // decrease quality for speed
    clearTimeout(this._zoom.timer);
    // Запускаем таймер зума
    this._zoom.timer = setTimeout(this.onZoom.bind(this), 15);
  }
};

Drawer.prototype.onZoomEnd = function () {
  this.quality = 1; // // возвращаем качество
  this.redraw(); // redraw with normal dx
};

Drawer.prototype.onZoom = function () {
  this._zoom.iterator++;
  if (this._zoom.iterator > this.zoomStep) {
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
  if (this.onError) {
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

// main draw function
Drawer.prototype.redraw = function () {
  if (!this.context) {
    return this.callOnError('Context is null');
  }
  
  try {
    this.clearCanvas();
    this._drawGrid();
    this.drawGraph();
    this._clearBorder();
    this._drawAxis();
    this._drawSerifsAndText(true, true);
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
  this.canvasData = this.context.getImageData(coord.x1, coord.y1, coord.x2, coord.y2);
};

Drawer.prototype.paste = function (x, y) {
  this.context.putImageData(this.canvasData, x, y);
};

// redraw with delay
Drawer.prototype.redrawTimeout = function (timeout) {
  clearTimeout(this._timer);
  this._timer = setTimeout(this.redraw.bind(this), timeout);
};

Drawer.prototype.selToValidSel = function () {
  let sel = this.selCoord;
  let graph = this.graphCoord;
  
  let validSel = new Coord();
  validSel.copyFrom(sel);
  validSel.normalize();
  
  // selection rect must be in graph rect
  if (validSel.x1 < graph.x1) {
    validSel.x1 = graph.x1;
  }
  if (validSel.y1 < graph.y1) {
    validSel.y1 = graph.y1;
  }
  if (validSel.x2 > graph.x2) {
    validSel.x2 = graph.x2;
  }
  if (validSel.y2 > graph.y2) {
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

Drawer.prototype.drawSelection = function () {
  let ctx = this.context;
  let sel = this.selCoord;
  let cnv = this.canvasCoord;
  
  this.paste(cnv.x1, cnv.y1);
  
  let inv = !(sel.isInverterX && sel.isInverterY);
  let validSel = this.selToValidSel();
  let selAxis = this.selToAxis();
  
  // draw rect
  ctx.fillStyle = inv ? 'rgba(100,100,100,0.3)' : 'rgba(200,100,100,0.3)';
  ctx.fillRect(validSel.x1, validSel.y1, validSel.width, validSel.height);
  ctx.strokeStyle = inv ? 'rgba(100,100,100,0.6)' : 'rgba(200,100,100,0.6)';
  ctx.strokeRect(validSel.x1, validSel.y1, validSel.width, validSel.height);
  // draw text coordinates x1/y1
  ctx.fillStyle = inv ? 'rgba(100,100,100,1)' : 'rgba(200,100,100,1)';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'end';
  let txt = '(' + selAxis.x1.toFixed(1) + ', ' + selAxis.y1.toFixed(1) + ')';
  ctx.fillText(txt, validSel.x1 - 10, validSel.y1 - 10);
  // draw text coordinates x2/y2
  txt = '(' + selAxis.x2.toFixed(1) + ', ' + selAxis.y2.toFixed(1) + ')';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  ctx.fillText(txt, validSel.x2 + 10, validSel.y2 + 10);
};

Drawer.prototype.clearSelection = function () {
  let cnv = this.canvasCoord;
  this.paste(cnv.x1, cnv.y1);
};

Drawer.prototype._drawSerifsAndText = function (drawSerif, drawText) {
  if (!this.gridCount) {
    return
  }
  
  let ctx = this.context;
  let graph = this.graphCoord;
  let axis = this.axisCoord;
  
  ctx.beginPath();
  ctx.strokeStyle = "#555";
  
  if (drawSerif) {
    let gridLen = graph.width / this.gridCount;
    for (let i = gridLen; i < graph.width; i += gridLen) {
      ctx.moveTo(graph.x1 + i, graph.y2 + this._SERIF_SIZE);
      ctx.lineTo(graph.x1 + i, graph.y2 - this._SERIF_SIZE);
    }
    
    gridLen = graph.height / this.gridCount;
    for (let i = gridLen; i < graph.height; i += gridLen) {
      ctx.moveTo(graph.x1 - this._SERIF_SIZE, graph.y1 + i);
      ctx.lineTo(graph.x1 + this._SERIF_SIZE, graph.y1 + i);
    }
    ctx.stroke();
  }
  
  if (drawText) {
    ctx.beginPath();
    ctx.fillStyle = '#44A';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    
    gridLen = graph.width / this.gridCount;
    for (let i = 0; i < graph.width; i += gridLen) {
      let txt = graph.pointXToCoord(graph.x1 + i, axis).toFixed(1);
      ctx.fillText(txt, graph.x1 + i, graph.y2 + this._SERIF_SIZE, gridLen * 0.75);
    }
    
    ctx.textBaseline = '';
    ctx.textAlign = 'end';
    
    gridLen = graph.height / this.gridCount;
    for (let i = 0; i < graph.height; i += gridLen) {
      let txt = graph.pointYToCoord(graph.y2 - i, axis).toFixed(1);
      ctx.fillText(txt, graph.x1 - this._SERIF_SIZE, graph.y2 - i - gridLen / 3, CANVAS_PADDING);
    }
  }
};

Drawer.prototype._drawAxis = function () {
  
  let graph = this.graphCoord;
  let ctx = this.context;
  
  ctx.beginPath();
  ctx.strokeStyle = "#555";
  // Y axis
  ctx.moveTo(graph.x1, graph.y2);
  ctx.lineTo(graph.x1, graph.y1);
  ctx.lineTo(graph.x1 - this._ARROW_SIZE, graph.y1 + this._ARROW_SIZE);
  ctx.moveTo(graph.x1, graph.y1);
  ctx.lineTo(graph.x1 + this._ARROW_SIZE, graph.y1 + this._ARROW_SIZE);
  // X axis
  ctx.moveTo(graph.x1, graph.y2);
  ctx.lineTo(graph.x2, graph.y2);
  ctx.lineTo(graph.x2 - this._ARROW_SIZE, graph.y2 - this._ARROW_SIZE);
  ctx.moveTo(graph.x2, graph.y2);
  ctx.lineTo(graph.x2 - this._ARROW_SIZE, graph.y2 + this._ARROW_SIZE);
  
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
  
  ctx.fillStyle = "#EEE";
  ctx.fillRect(graph.x1, graph.y1, graph.width, graph.height);
  
  if (this.gridCount > 0) {
    ctx.strokeStyle = "#BBB";
    
    // vertical grid lines
    let gridLen = graph.width / this.gridCount;
    if (gridLen) {
      for (let i = gridLen; i < graph.width; i += gridLen) {
        ctx.moveTo(graph.x1 + i, graph.y2);
        ctx.lineTo(graph.x1 + i, graph.y2 - graph.height);
      }
    }
    
    // horizontal grid lines
    gridLen = graph.height / this.gridCount;
    if (gridLen) {
      for (let i = gridLen; i < graph.height; i += gridLen) {
        ctx.moveTo(graph.x1, graph.y2 - i);
        ctx.lineTo(graph.x1 + graph.width, graph.y2 - i);
      }
    }
  }
  
  ctx.stroke();
  
  // draw ZERO cross
  ctx.beginPath();
  ctx.strokeStyle = "#444";
  
  if (graph.containPoint(cnvX, graph.y1)) {
    ctx.moveTo(cnvX, graph.y1);
    ctx.lineTo(cnvX, graph.y2);
  }
  if (graph.containPoint(graph.x1, cnvY)) {
    ctx.moveTo(graph.x1, cnvY);
    ctx.lineTo(graph.x2, cnvY);
  }
  ctx.stroke();
};

Drawer.prototype.drawGraph = function () {
  let graph = this.graphCoord;
  let axis = this.axisCoord;
  let ctx = this.context;
  
  if (!this.formula) {
    return
  }
  
  let dx = this.quality * axis.width / graph.width;
  
  ctx.strokeStyle = "#F40";
  let first = true;
  ctx.beginPath();
  
  // создаём функцию из строки. Это делается через new Function() один раз перед циклом.
  // вместо чтобы в цикле вычислять через eval().
  // экономия времени огромная!
  // При создании функции с использованием new Function, её свойство [[Scope]] ссылается не на текущий LexicalEnvironment, а на window!!!!
  let evalFunc = new Function('x', 'return ' + this.formula);
  
  for (let x = axis.x1; x <= axis.x2; x += dx) {
    let y;
    try {
      y = evalFunc(x);
    } catch (e) {
      break;
    }
    
    if (!isFinite(y)) { // разрыв функции
      first = true;
      //	debug('infinite');
      continue;
    }
    
    // переводим числовые координаты в коорд. КАНВЫ
    let cnvX = axis.pointXToCoord(x, graph);
    let cnvY = axis.pointYToCoord(y, graph);
    
    if (first) { // переход к первой точке
      ctx.moveTo(cnvX, cnvY);
      first = false;
    }
    ctx.lineTo(cnvX, cnvY);
  }
  
  ctx.stroke();
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
  if (keyName) {
    return this.table[index][keyName];
  } else {
    return this.table[index];
  }
};

Functions.prototype.correctFormula = function (formula) {
  formula.replace(' ', '');           // delete spaces
  formula = formula.toLowerCase();   // to lower case
  
  // correct all math functions andd constants
  for (let i = 0; i < this.count; i++) {
    let rpl = this.getKey(i, 'js');
    let fnd = this.getKey(i, 'usr');
    
    fnd = new RegExp('(?:^|\\b)(' + fnd + ')(?=\\b|$)', 'gi');
    formula = formula.replace(fnd, rpl);
  }
  return formula;
};

