const COOKIE_LIFE = 7;
const DRAWER_COOKIE = 'drawer';
const NOT = 'нет';
const DATA_INPUT_ERROR = 'ошибка ввода данных: ';
const REDRAW_TIMEOUT = 300;

const CLR_DEFAULT_FORMULA = 'red';
const ID_CANVAS = '#cnv';
const ID_CANVAS_DIV = '#cnv-div';
const ID_LABEL_CANVAS_SIZE = '#lbl-cnv-size';
const ID_GRID_SIZE = '#grid-size';
const ID_LABEL_GRID = '#lbl-grid-size';
const ID_SHOW_CURSORS = "#show-cursors";

const ID_FORMULA_TABLE = '#formula-table';
const CLS_FORMULA_INPUT = 'formula-input';
const CLS_FORMULA_COLOR = 'formula-color';
const CLS_FORMULA_LABEL = 'formula-label';
const CLS_FORMULA_INVALID = 'formula-invalid';
const CLS_ERROR_INPUT = 'input-error';
const CLS_FORMULA_ADD = 'formula-add';
const CLS_FORMULA_DEL = 'formula-del';

const ID_AXIS_X1 = '#axis-X-start';
const ID_AXIS_X2 = '#axis-X-end';
const ID_AXIS_Y1 = '#axis-Y-start';
const ID_AXIS_Y2 = '#axis-Y-end';

const ID_HELP = '#help';
const CLS_HELP_LINE = 'help-line';
const CLS_HELP_FUNC = 'help-func';
const CLS_HELP_DESCR = 'help-descr';

var drawer;
var functions;
var resizeObserver;

function onError(drw, err) {
  debug(err);
}

function createHelp() {
  // let helpDiv = document.getElementsByClassName(ID_HELP)[0];
  // let helpLine = document.getElementsByClassName(CLS_HELP_LINE)[0];
  //
  // for (let i = 0; i < functions.count; i++) {
  //   let cln = helpLine.cloneNode(true);
  //   let helpFunc = cln.getElementsByClassName(CLS_HELP_FUNC)[0];
  //   let helpDescr = cln.getElementsByClassName(CLS_HELP_DESCR)[0];
  //   let fnc = functions.getKey(i);
  //
  //   helpFunc.innerText = fnc.usr;
  //   helpDescr.innerText = fnc.dsc;
  //   helpFunc.setAttribute('title', fnc.js);
  //   cln.removeAttribute('hidden');
  //   helpDiv.appendChild(cln);
  // }
}

function onFormulaBtnClick(btn) {
  let $table = $(ID_FORMULA_TABLE);
  let $rows = $(ID_FORMULA_TABLE + ' tr');
  let $btnRow = $(btn).parent().parent();
  let update;
  
  if ( $(btn).hasClass(CLS_FORMULA_ADD) ) { // add button
    let rand = '#' + Math.floor(Math.random() * 16777215).toString(16);
    $btnRow.clone().appendTo($table);
    $btnRow.children().children('.' + CLS_FORMULA_COLOR).val(rand);
    update = true;
  }
  else if ( $(btn).hasClass(CLS_FORMULA_DEL) ) { // del button
    if ( $rows.length > 1 ) {
      $btnRow.remove();
      update = true;
    }
  }
  
  if ( update ) {
    loadDrawerFromElements(drawer);
  }
}

function addFormula() {
  return $(ID_FORMULA_TABLE + ' tbody').children(':last')
    .clone().appendTo($(ID_FORMULA_TABLE))
}

function clearFormulaList() {
  $(ID_FORMULA_TABLE + ' tbody').children(':not(:last)').remove();
}

// Событие при изменении параметров канвы.
// События от контролов разнесены на две функции из-за того, что при изменении размеров
// канвы всё изображение стирается и получается мерцание. Зачем лишний раз мерцать?!
function onResizeCanvas() {
  let $cnv = $(ID_CANVAS);
  let div = $(ID_CANVAS_DIV)[0];
  let $lbl = $(ID_LABEL_CANVAS_SIZE);
  let $body = $('body');
  
  // Вся канва
  let style = window.getComputedStyle(div, null);
  let h = parseInt(style.getPropertyValue("height"));
  let w = parseInt(style.getPropertyValue("width"));
  const dy = 12;
  let rect = div.getBoundingClientRect();
  drawer.canvasCoord.set(0, 0, w, h - dy);
  
  $lbl.text(`${w}\u00D7${h}`);
  $cnv.attr("width", w);
  $cnv.attr("height", h - dy);
  
  // move the Resize icon at bottom-right corner
  $body.css('background-position-x', Math.trunc(rect.x + w + window.scrollX) + 'px');
  $body.css('background-position-y', Math.trunc(rect.y + h + window.scrollY) + 'px');
  
  drawer.reload(false);
  drawer.redrawTimeout(drawer, 0);
}


// Событие при изменении параметров графика
function onInput(refresh) {
  loadDrawerFromElements(drawer, refresh)
}

function isValid(value) {
  return isFinite(value);
}

function loadElementsFromDrawer(drw) {
  $(ID_GRID_SIZE).val(drw.gridCount);
  $(ID_LABEL_GRID).text(drw.gridCount);
  $(ID_AXIS_X1).val(drw.userCoord.x1);
  $(ID_AXIS_X2).val(drw.userCoord.x2);
  $(ID_AXIS_Y1).val(drw.userCoord.y1);
  $(ID_AXIS_Y2).val(drw.userCoord.y2);
  $(ID_SHOW_CURSORS).prop('checked', drw.showCursors);
  
  // reload formula list
  clearFormulaList();
  for (let i = 0; i < drw.formula.length; i++) {
    if ( i > 0 ) {
      addFormula();
    }
    let f = drw.formula[i].replace('Math.', '');
    $(ID_FORMULA_TABLE + ' tr:last .' + CLS_FORMULA_INPUT).val(f);
    $(ID_FORMULA_TABLE + ' tr:last .' + CLS_FORMULA_COLOR).val(drw.formulaColors[i] || CLR_DEFAULT_FORMULA);
  }
}

function loadDrawerFromElements(drw, reload) {
  let $inpGrid = $(ID_GRID_SIZE);
  let $inpX1 = $(ID_AXIS_X1);
  let $inpX2 = $(ID_AXIS_X2);
  let $inpY1 = $(ID_AXIS_Y1);
  let $inpY2 = $(ID_AXIS_Y2);
  let $cbxCursors = $(ID_SHOW_CURSORS);
  let axis = new Coord();
  
  drw.gridCount = Math.abs(+$inpGrid.val());
  if ( !isValid(drw.gridCount) || drw.gridCount < 0 ) {
    drw.gridCount = drw.DEF_GRID_COUNT;
  }
  $(ID_LABEL_GRID).text(drw.gridCount);
  
  drw.showCursors = $cbxCursors.is(":checked");
  axis.set(+$inpX1.val(), +$inpY1.val(), +$inpX2.val(), +$inpY2.val());
  
  drw.formula = [];
  drw.formulaColors = [];
  let rows = $(ID_FORMULA_TABLE + ' tbody tr');
  for (let rw = 0; rw < rows.length; rw++) {
    let $lbl = $(ID_FORMULA_TABLE + ` tbody tr:eq(${rw}) .` + CLS_FORMULA_LABEL);
    let $formulaInp = $(ID_FORMULA_TABLE + ` tbody tr:eq(${rw}) .` + CLS_FORMULA_INPUT);
    let $colorInp = $(ID_FORMULA_TABLE + ` tbody tr:eq(${rw}) .` + CLS_FORMULA_COLOR);
    let f = $formulaInp.val();
    f = functions.correctFormula(f);
    
    try {
      {
        let x;
        let y = new Function('x', f);
      }
      $lbl.removeClass(CLS_FORMULA_INVALID);
      $formulaInp.removeClass(CLS_ERROR_INPUT);
      drw.formulaColors.push($colorInp.val());
      drw.formula.push(f);
    } catch (e) {
      $lbl.text(e.message);
      $lbl.addClass(CLS_FORMULA_INVALID);
      $formulaInp.addClass(CLS_ERROR_INPUT);
    }
  }
  
  // check axis
  let $arr = [$inpX1, $inpY1, $inpX2, $inpY2];
  for (let i = 0; i < $arr.length; i++) {
    axis.setInd(i, +$arr[i].val());
    if ( isValid(axis.getInd(i)) ) {
      $arr[i].removeClass(CLS_ERROR_INPUT);
    }
    else {
      $arr[i].addClass(CLS_ERROR_INPUT);
    }
  }
  
  if ( axis.isValid() ) {
    drw.userCoord.copyFrom(axis)
    saveDrawerToCookies(drw, DRAWER_COOKIE);
  }
  else {
    for (let i = 0; i < $arr.length; i++) {
      $arr[i].addClass(CLS_ERROR_INPUT);
    }
  }
  
  if ( reload !== false ) {
    drw.reload(false);
  }
  drw.redrawTimeout(REDRAW_TIMEOUT);
}

function loadDrawerFromCookies(drw, param) {
  let res = cookieExists(param) ? drw.fromString(getCookie(param)) : false;
  
  for (let i = 0; res && i < drw.formula.length; i++) {
    drw.formula[i] = functions.correctFormula(drw.formula[i]);
  }
  return res;
}

function saveDrawerToCookies(drw, param) {
  eraseCookie(param);
  let s = drw.toString();
  setCookie(param, s, COOKIE_LIFE);
}

function loadPage() {
  functions = new Functions();
  createHelp();
  drawer = new Drawer('cnv');
  drawer.onError = onError;
  
  resizeObserver = new ResizeObserver(entries => {
    onResizeCanvas();
  });
  resizeObserver.observe($(ID_CANVAS_DIV)[0]);
  resizeObserver.observe($('body')[0]);
  
  loadDrawerFromCookies(drawer, DRAWER_COOKIE);
  loadElementsFromDrawer(drawer);
  onResizeCanvas(); // <= redraw here
}

function debug(msg) {
  let lbl = $("#dbg");
  lbl[0].innerText = msg;
  console.log(msg);
}